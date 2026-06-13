const express = require('express');
const router = express.Router();
const { getAllCourriers } = require('../services/db');
const { dateToString, buildFileDateSuffix } = require('../services/xls');
const { generatePDF } = require('../services/pdf');

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

    const doc = generatePDF(rows, mode || 'all', dateDebut || '', dateFin || '');

    const fileSuffix = buildFileDateSuffix(mode || 'all', dateDebut || '', dateFin || '');
    const fileName = fileSuffix + '_' + (
      mode === 'assigne_non_traite' ? 'Situation_Courriers_Assignes_Non_Traites' :
      mode === 'en_retard' ? 'Situation_Courriers_En_Retard' :
      'Situation_Courriers_Journaliere') + '.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('X-File-Name', encodeURIComponent(fileName));
    res.setHeader('X-Count', rows.length);

    doc.pipe(res);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
