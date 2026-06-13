const express = require('express');
const router = express.Router();
const { processCSV } = require('../services/csv');
const { listSessions, getSession, deleteAllCourriers, insertCourriers, getAllCourriers } = require('../services/db');

router.get('/', async (req, res) => {
  try {
    const sessions = await listSessions(5);
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/load', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'Session ID requis.' });

    const session = await getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session introuvable.' });

    const allRows = processCSV(session.csv_text);

    await deleteAllCourriers();
    await insertCourriers(allRows);

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
