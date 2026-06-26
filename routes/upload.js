const crypto = require('crypto');
const express = require('express');
const XLSX = require('xlsx');
const path = require('path');
const router = express.Router();
const upload = require('../middlewares/upload');
const { processCSV } = require('../services/csv');
const { createSession, getCurrentSessionId } = require('../services/db');

router.post('/', upload.single('file'), async (req, res) => {
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
    const sessionId = crypto.randomUUID();
    await createSession(sessionId, csvText, req.file.originalname);

    res.json({
      success: true,
      count: rows.length,
      sessionId,
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

module.exports = router;
