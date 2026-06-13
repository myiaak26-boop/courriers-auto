const express = require('express');
const router = express.Router();
const { getAllCourriers } = require('../services/db');
const { generateXLS, dateToString } = require('../services/xls');

router.post('/', async (req, res) => {
  try {
    const { mode, dateDebut, dateFin } = req.body;
    const dbRows = await getAllCourriers();
    if (!dbRows.length) return res.status(400).json({ error: 'Aucune donnée en base.' });

    const rows = dbRows.map(r => ({
      numero: r.numero,
      expediteur: r.expediteur,
      objet: r.objet,
      dateArrivee: r.date_arrivee ? dateToString(r.date_arrivee) : '',
      niveauUrgence: r.niveau_urgence || '',
      destinataire: r.destinataire || 'Premier Ministre',
      etat: r.etat,
      position: r.position,
      positionSource: r.position
    }));

    const result = generateXLS(rows, rows, mode || 'all', dateDebut || '', dateFin || '');
    if (!result) return res.status(400).json({ error: 'Aucun courrier trouvé pour les critères sélectionnés.' });

    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('X-File-Name', encodeURIComponent(result.fileName));
    res.setHeader('X-Count', result.count);
    res.send(Buffer.from(result.xml, 'utf8'));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
