const express = require('express');
const router = express.Router();
const { getCountByEtat, getTopExpediteurs, getWeeklyEvolution } = require('../services/db');

router.get('/', async (req, res) => {
  try {
    const [byEtat, topExpediteurs, weeklyEvolution] = await Promise.all([
      getCountByEtat(),
      getTopExpediteurs(10),
      getWeeklyEvolution()
    ]);

    res.json({
      success: true,
      data: {
        byEtat,
        topExpediteurs,
        weeklyEvolution
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
