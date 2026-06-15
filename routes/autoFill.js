const express = require('express');
const router = express.Router();
const { getAllCourriers, updateCourrier } = require('../services/db');
const { autoFillUrgencyForCourriers } = require('../services/dateExtractor');

router.post('/', async (req, res) => {
  try {
    const courriers = await getAllCourriers();
    if (!courriers.length) {
      return res.status(400).json({ error: 'Aucun courrier en base.' });
    }

    const updates = await autoFillUrgencyForCourriers(courriers);

    let modifiedCount = 0;
    for (const u of updates) {
      const result = await updateCourrier(u.id, { niveau_urgence: u.niveau_urgence });
      if (result) modifiedCount++;
    }

    const updated = await getAllCourriers();
    res.json({
      success: true,
      modifiedCount,
      total: courriers.length,
      rows: updated
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
