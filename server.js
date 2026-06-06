/**
 * server.js — Serveur Express pour courriers-auto
 */

require('dotenv').config();
const express = require('express');
const multer  = require('multer');
const nodemailer = require('nodemailer');
const XLSX    = require('xlsx');
const path    = require('path');
const fs      = require('fs');

const { processCSV, generateXLS, buildMailContent } = require('./logic');

const app  = express();
const PORT = process.env.PORT || 3000;

// Config multer — stockage en mémoire
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('Format non supporté. Utilisez .xlsx, .xls ou .csv'));
  }
});

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Config mail (Gmail SMTP via Nodemailer) ─────────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER || 'amadoukeita5263@gmail.com',
    pass: process.env.GMAIL_PASS
  }
});

// ── ROUTE : Upload + parsing ─────────────────────────────────────────────────
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });

    let csvText;
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext === '.csv') {
      csvText = req.file.buffer.toString('utf8');
    } else {
      // Excel → CSV via xlsx
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      csvText = XLSX.utils.sheet_to_csv(sheet);
    }

    const rows = processCSV(csvText);

    res.json({
      success: true,
      count: rows.length,
      csvText,            // on renvoie le CSV parsé pour le réutiliser côté serveur
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

// ── ROUTE : Générer le fichier XLS ──────────────────────────────────────────
app.post('/api/generate', express.json({ limit: '20mb' }), (req, res) => {
  try {
    const { csvText, mode, dateDebut, dateFin } = req.body;
    if (!csvText) return res.status(400).json({ error: 'Données manquantes.' });

    const rows = processCSV(csvText);
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

// ── ROUTE : Envoyer par mail ────────────────────────────────────────────────
app.post('/api/send-mail', express.json({ limit: '20mb' }), async (req, res) => {
  try {
    const { csvText, mode, dateDebut, dateFin, mailTo } = req.body;
    if (!csvText) return res.status(400).json({ error: 'Données manquantes.' });
    if (!process.env.GMAIL_PASS) {
      return res.status(500).json({ error: 'Mot de passe d\'application Gmail manquant (GMAIL_PASS). Générez-le sur https://myaccount.google.com/apppasswords' });
    }

    const rows = processCSV(csvText);
    const result = generateXLS(rows, rows, mode || 'all', dateDebut || '', dateFin || '');
    if (!result) return res.status(400).json({ error: 'Aucun courrier trouvé pour les critères sélectionnés.' });

    const { subject, text, html } = buildMailContent(mode || 'all', dateDebut || '', dateFin || '');
    const recipient = mailTo || process.env.MAIL_TO || 'aboubacar.bangoura@primature.gov.gn';

    await transporter.sendMail({
      to: recipient,
      from: process.env.GMAIL_USER || 'amadoukeita5263@gmail.com',
      replyTo: process.env.GMAIL_USER || 'amadoukeita5263@gmail.com',
      subject,
      text,
      html,
      attachments: [{
        filename: result.fileName,
        content: Buffer.from(result.xml, 'utf8')
      }]
    });

    res.json({ success: true, message: `Mail envoyé à ${recipient}`, subject });
  } catch (err) {
    console.error('Erreur envoi mail:', err);
    res.status(500).json({ error: 'Erreur envoi mail : ' + err.message });
  }
});

// ── Démarrage ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});
