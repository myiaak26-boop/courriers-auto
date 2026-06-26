const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { getAllCourriers, updateCourrier } = require('../services/db');
const { autoFillFieldsForCourriers } = require('../services/dateExtractor');

router.post('/', [
  body('fields').optional().isArray(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation échouée', details: errors.array() });

  try {
    if (!process.env.NVIDIA_API_KEY) {
      return res.status(400).json({ error: 'Clé API NVIDIA non configurée. Définissez NVIDIA_API_KEY dans les variables d\'environnement.' });
    }

    const courriers = await getAllCourriers();
    if (!courriers.length) {
      return res.status(400).json({ error: 'Aucun courrier en base.' });
    }

    const fields = req.body.fields || ['urgence', 'destinataire'];
    const updates = await autoFillFieldsForCourriers(courriers, fields);

    let urgenceCount = 0;
    let destCount = 0;

    for (const u of updates) {
      const payload = {};
      let changed = false;

      if (fields.includes('urgence') && u.niveau_urgence) {
        payload.niveau_urgence = u.niveau_urgence;
        changed = true;
      }

      if (fields.includes('destinataire') && u.destinataire) {
        payload.destinataire = u.destinataire;
        changed = true;
      }

      if (!changed) continue;

      const result = await updateCourrier(u.id, payload);
      if (!result) continue;

      if (fields.includes('urgence') && u.niveau_urgence) urgenceCount++;
      if (fields.includes('destinataire') && u.destinataire) destCount++;
    }

    const updated = await getAllCourriers();
    res.json({
      success: true,
      urgenceCount,
      destCount,
      modifiedCount: urgenceCount + destCount,
      total: courriers.length,
      rows: updated
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
