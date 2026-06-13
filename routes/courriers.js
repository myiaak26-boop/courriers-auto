const express = require('express');
const router = express.Router();
const { getAllCourriers, updateCourrier } = require('../services/db');

router.get('/', async (req, res) => {
  try {
    const rows = await getAllCourriers();
    res.json({ success: true, rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { etat, position, niveau_urgence, destinataire } = req.body;
    const row = await updateCourrier(id, { etat, position, niveau_urgence, destinataire });
    if (!row) return res.status(404).json({ error: 'Courrier introuvable.' });
    res.json({ success: true, row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
