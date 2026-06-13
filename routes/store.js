const express = require('express');
const router = express.Router();
const { processCSV } = require('../services/csv');
const { getFilteredRows } = require('../services/xls');
const { getSession, deleteAllCourriers, insertCourriers, getAllCourriers } = require('../services/db');

router.post('/', async (req, res) => {
  try {
    const { sessionId, mode, dateDebut, dateFin } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'Session introuvable. Réimportez le fichier.' });

    const session = await getSession(sessionId);
    if (!session) return res.status(400).json({ error: 'Session expirée. Réimportez le fichier.' });

    const allRows = processCSV(session.csv_text);
    const filteredRows = getFilteredRows(allRows, mode || 'all', dateDebut || '', dateFin || '');

    if (!filteredRows.length) {
      return res.status(400).json({ error: 'Aucun courrier trouvé pour les critères sélectionnés.' });
    }

    await deleteAllCourriers();
    await insertCourriers(filteredRows);

    const dbRows = await getAllCourriers();

    res.json({
      success: true,
      count: dbRows.length,
      rows: dbRows
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
