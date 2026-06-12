require('dotenv').config();
const express = require('express');
const multer  = require('multer');
const sgMail  = require('@sendgrid/mail');
const XLSX    = require('xlsx');
const path    = require('path');
const { pool, initDB } = require('./db');

const { processCSV, generateXLS, buildMailContent } = require('./logic');

const app  = express();
const PORT = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('Format non supporté. Utilisez .xlsx, .xls ou .csv'));
  }
});

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});

app.use((err, req, res, next) => {
  console.error('ERREUR EXPRESS:', err);
  res.status(500).json({ error: err.message || 'Erreur interne' });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });

    let csvText;
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext === '.csv') {
      csvText = req.file.buffer.toString('utf8');
    } else {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      csvText = XLSX.utils.sheet_to_csv(sheet);
    }

    const rows = processCSV(csvText);

    res.json({
      success: true,
      count: rows.length,
      csvText,
      preview: rows.slice(0, 5).map(r => ({
        numero: r.numero,
        expediteur: r.expediteur,
        objet: r.objet,
        etat: r.etat,
        dateArrivee: r.dateArrivee
      }))
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/store', async (req, res) => {
  try {
    const { csvText, mode, dateDebut, dateFin } = req.body;
    if (!csvText) return res.status(400).json({ error: 'Données manquantes.' });

    const allRows = processCSV(csvText);
    const { getFilteredRows } = require('./logic');
    const filteredRows = getFilteredRows(allRows, mode || 'all', dateDebut || '', dateFin || '');

    if (!filteredRows.length) {
      return res.status(400).json({ error: 'Aucun courrier trouvé pour les critères sélectionnés.' });
    }

    const client = await pool.connect();
    try {
      await client.query('DELETE FROM courriers');
      for (const r of filteredRows) {
        const dateArrivee = toISODate(r.dateArrivee);
        await client.query(
          `INSERT INTO courriers (numero, expediteur, objet, date_arrivee, niveau_urgence, destinataire, etat, position)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [r.numero, r.expediteur, r.objet, dateArrivee, r.niveauUrgence || '', r.destinataire || 'Premier Ministre', r.etat, r.position]
        );
      }
    } finally {
      client.release();
    }

    const { rows: dbRows } = await pool.query(
      'SELECT id, numero, expediteur, objet, date_arrivee, niveau_urgence, etat, position FROM courriers ORDER BY id'
    );

    res.json({
      success: true,
      count: dbRows.length,
      rows: dbRows
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/courriers', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM courriers ORDER BY id');
    res.json({ success: true, rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/courriers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { etat, position, niveau_urgence, destinataire } = req.body;
    const { rows } = await pool.query(
      `UPDATE courriers SET etat = COALESCE($1, etat), position = COALESCE($2, position), niveau_urgence = COALESCE($3, niveau_urgence), destinataire = COALESCE($4, destinataire), updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING *`,
      [etat ?? null, position ?? null, niveau_urgence ?? null, destinataire ?? null, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Courrier introuvable.' });
    res.json({ success: true, row: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate', async (req, res) => {
  try {
    const { mode, dateDebut, dateFin } = req.body;
    const { rows: dbRows } = await pool.query('SELECT * FROM courriers ORDER BY id');
    if (!dbRows.length) return res.status(400).json({ error: 'Aucune donnée en base.' });

    const rows = dbRows.map(r => ({
      numero: r.numero,
      expediteur: r.expediteur,
      objet: r.objet,
      dateArrivee: r.date_arrivee ? dateToString(r.date_arrivee) : '',
      niveauUrgence: r.niveau_urgence || '',
      destinataire: r.destinataire || 'Premier Ministre',
      etat: r.etat,
      position: r.position,
      positionSource: r.position
    }));

    const result = generateXLS(rows, rows, mode || 'all', dateDebut || '', dateFin || '');

    if (!result) {
      return res.status(400).json({ error: 'Aucun courrier trouvé pour les critères sélectionnés.' });
    }

    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('X-File-Name', encodeURIComponent(result.fileName));
    res.setHeader('X-Count', result.count);
    res.send(Buffer.from(result.xml, 'utf8'));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/send-mail', async (req, res) => {
  try {
    const { mode, dateDebut, dateFin, mailTo, mailCc } = req.body;
    if (!process.env.SENDGRID_API_KEY) {
      return res.status(500).json({ error: 'Clé API SendGrid manquante sur le serveur.' });
    }

    const { rows: dbRows } = await pool.query('SELECT * FROM courriers ORDER BY id');
    if (!dbRows.length) return res.status(400).json({ error: 'Aucune donnée en base.' });

    const rows = dbRows.map(r => ({
      numero: r.numero,
      expediteur: r.expediteur,
      objet: r.objet,
      dateArrivee: r.date_arrivee ? dateToString(r.date_arrivee) : '',
      niveauUrgence: r.niveau_urgence || '',
      destinataire: r.destinataire || 'Premier Ministre',
      etat: r.etat,
      position: r.position,
      positionSource: r.position
    }));

    const result = generateXLS(rows, rows, mode || 'all', dateDebut || '', dateFin || '');
    if (!result) return res.status(400).json({ error: 'Aucun courrier trouvé pour les critères sélectionnés.' });

    const { subject, text, html } = buildMailContent(mode || 'all', dateDebut || '', dateFin || '');
    const to = mailTo || process.env.MAIL_TO || 'aboubacar.bangoura@primature.gov.gn';
    const cc = Array.isArray(mailCc) && mailCc.length ? mailCc : [];
    const fromAddr = process.env.MAIL_FROM || 'amadoukeita5263@gmail.com';

    await sgMail.send({
      to,
      cc,
      from: fromAddr,
      replyTo: fromAddr,
      subject,
      text,
      html,
      attachments: [{
        filename: result.fileName,
        content: Buffer.from(result.xml, 'utf8').toString('base64'),
        type: 'application/vnd.ms-excel',
        disposition: 'attachment'
      }]
    });

    const allRecipients = [to, ...cc].join(', ');
    res.json({ success: true, message: `Mail envoyé à ${allRecipients}`, subject });
  } catch (err) {
    console.error('Erreur envoi mail:', err.response?.body || err);
    res.status(500).json({ error: 'Erreur envoi mail : ' + (err.response?.body?.message || err.message) });
  }
});

function dateToString(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function toISODate(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return dateStr;
}

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Erreur init DB:', err);
  process.exit(1);
});
