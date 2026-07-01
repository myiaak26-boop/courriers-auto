const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');
const { processGeneratedXLS } = require('../services/reimport');
const { createSession } = require('../services/db');

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });

    const ext = req.file.originalname.toLowerCase();
    if (!ext.endsWith('.xls') && !ext.endsWith('.xlsx')) {
      return res.status(400).json({ error: 'Format non supporté. Utilisez un fichier .xls généré par l\'application.' });
    }

    const result = processGeneratedXLS(req.file.buffer);
    const sessionId = crypto.randomUUID();
    await createSession(sessionId, result.csvText, req.file.originalname);

    res.json({
      success: true,
      count: result.rows.length,
      sessionId,
      preview: result.rows.slice(0, 5).map(r => ({
        numero: r.numero,
        expediteur: r.expediteur,
        objet: r.objet,
        etat: r.etat,
        destinataire: r.destinataire,
        niveau_urgence: r.niveau_urgence
      }))
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
