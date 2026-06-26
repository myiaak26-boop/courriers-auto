const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { buildMailContent } = require('../services/mail');

router.post('/', [
  body('mode').optional().isIn(['all', 'assigne_non_traite', 'en_retard']),
  body('dateDebut').optional().isString(),
  body('dateFin').optional().isString(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation échouée', details: errors.array() });

  try {
    const { mode, dateDebut, dateFin } = req.body;
    const content = buildMailContent(mode || 'all', dateDebut || '', dateFin || '');
    res.json({ success: true, subject: content.subject, text: content.text, html: content.html });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
