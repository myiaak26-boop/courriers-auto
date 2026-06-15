const express = require('express');
const router = express.Router();
const { getAllCourriers, updateCourrier } = require('../services/db');
const { autoFillFieldsForCourriers } = require('../services/dateExtractor');

router.post('/', async (req, res) => {
  try {
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
