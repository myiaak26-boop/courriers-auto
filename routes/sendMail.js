const express = require('express');
const sgMail = require('@sendgrid/mail');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { getAllCourriers } = require('../services/db');
const { generateXLS, dateToString } = require('../services/xls');
const { buildMailContent } = require('../services/mail');
const config = require('../config');

router.post('/', [
  body('mode').optional().isIn(['all', 'assigne_non_traite', 'en_retard']),
  body('mailTo').optional().isEmail(),
  body('mailCc').optional().isArray(),
  body('customSubject').optional().isString(),
  body('customText').optional().isString(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation échouée', details: errors.array() });

  try {
    const { mode, dateDebut, dateFin, mailTo, mailCc } = req.body;
    if (!process.env.SENDGRID_API_KEY) {
      return res.status(500).json({ error: 'Clé API SendGrid manquante sur le serveur.' });
    }

    const dbRows = await getAllCourriers();
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

    const mailContent = buildMailContent(mode || 'all', dateDebut || '', dateFin || '');
    const subject = req.body.customSubject || mailContent.subject;
    const text = req.body.customText || mailContent.text;
    const html = mailContent.html;
    const to = mailTo || process.env.MAIL_TO || config.DEFAULT_MAIL_TO;
    const cc = Array.isArray(mailCc) && mailCc.length ? mailCc : undefined;
    const fromAddr = process.env.MAIL_FROM || config.DEFAULT_MAIL_FROM;

    const msg = {
      to,
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
    };
    if (cc) msg.cc = cc;

    await sgMail.send(msg);

    const allRecipients = cc ? [to, ...cc].join(', ') : to;
    res.json({ success: true, message: `Mail envoyé à ${allRecipients}`, subject });
  } catch (err) {
    console.error('Erreur envoi mail:', err.response?.body || err);
    res.status(500).json({ error: 'Erreur envoi mail : ' + (err.response?.body?.message || err.message) });
  }
});

module.exports = router;
