const express = require('express');
const router = express.Router();
const { buildMailContent } = require('../services/mail');

router.post('/', async (req, res) => {
  try {
    const { mode, dateDebut, dateFin } = req.body;
    const content = buildMailContent(mode || 'all', dateDebut || '', dateFin || '');
    res.json({ success: true, subject: content.subject, text: content.text, html: content.html });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
