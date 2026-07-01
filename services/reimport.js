const XLSX = require('xlsx');
const { normalizeHeader, cleanText } = require('../utils/csv-utils');

const FIELD_DEFS = [
  { field: 'numero', patterns: ['numero', 'n °', 'n°'] },
  { field: 'expediteur', patterns: ['expediteur', 'expéditeur'] },
  { field: 'destinataire', patterns: ['destinataire'] },
  { field: 'objet', patterns: ['objet du courrier', 'objet'] },
  { field: 'niveau_urgence', patterns: ['niveau urgence', 'niveau d urgence', 'urgence'] },
  { field: 'position', patterns: ['position'] },
  { field: 'etat', patterns: ['etat', 'état'] },
  { field: 'jours_retard', patterns: ['nbre jours', 'retard'] }
];

function processGeneratedXLS(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames.find(n => normalizeHeader(n) === 'situation') || workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i] || [];
    const first = String(row[0] || '').replace(/[°\s]/g, '').trim();
    if (first.length > 0 && /^n/i.test(first)) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) throw new Error('En-têtes non trouvées dans le fichier réimporté.');

  const headers = (rows[headerRowIdx] || []).map(h => String(h || ''));
  const dataRows = rows.slice(headerRowIdx + 1).filter(r => {
    if (!Array.isArray(r)) return false;
    return r.some(c => String(c || '').trim() !== '');
  });

  const colMap = {};
  const usedIndices = new Set();

  FIELD_DEFS.forEach(({ field, patterns }) => {
    for (let i = 0; i < headers.length; i++) {
      if (usedIndices.has(i)) continue;
      const norm = normalizeHeader(headers[i]);
      if (patterns.some(p => norm.includes(normalizeHeader(p)))) {
        colMap[i] = field;
        usedIndices.add(i);
        break;
      }
    }
  });

  const required = ['numero', 'expediteur', 'objet'];
  const found = new Set(Object.values(colMap));
  const missing = required.filter(f => !found.has(f));
  if (missing.length) throw new Error('Colonnes obligatoires manquantes : ' + missing.join(', '));

  const result = dataRows.map(r => {
    const obj = { dateArrivee: '' };
    Object.entries(colMap).forEach(([colIdx, field]) => {
      const raw = String(r[parseInt(colIdx)] || '').trim();
      if (field === 'numero') {
        obj.numero = raw.split('-')[0].replace(/[°\s]/g, '').trim();
      } else if (field === 'etat') {
        const norm = normalizeHeader(raw);
        if (['enregistre', 'enregistré', 'non assigne', 'non assigné'].includes(norm)) obj.etat = 'Non assigné';
        else if (['assigne', 'assigné', 'en retard'].includes(norm)) obj.etat = 'Assigné';
        else obj.etat = raw || 'Non assigné';
      } else if (field === 'destinataire') {
        obj.destinataire = raw || 'Premier Ministre';
      } else if (field === 'jours_retard') {
        // ignored — recalculated
      } else {
        obj[field] = raw;
      }
    });
    if (!obj.destinataire) obj.destinataire = 'Premier Ministre';
    if (!obj.etat) obj.etat = 'Non assigné';
    if (!obj.niveau_urgence) obj.niveau_urgence = '';
    if (!obj.position) obj.position = '';
    return obj;
  }).filter(r => r.numero || r.expediteur || r.objet)
    .sort((a, b) => (parseInt(b.numero || '0', 10) || 0) - (parseInt(a.numero || '0', 10) || 0));

  if (!result.length) throw new Error('Aucune ligne exploitable trouvée dans le fichier.');

  const csvHeaders = ['Numéro', 'Expéditeur', 'Destinataire', 'Objet', 'Date d\'Arrivée', 'Niveau d Urgence', 'Position', 'Etat'];
  const csvLines = [csvHeaders.join(',')];
  result.forEach(r => {
    const esc = (v) => {
      const s = String(v || '');
      return s.includes(',') || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    csvLines.push([
      esc(r.numero), esc(r.expediteur), esc(r.destinataire),
      esc(r.objet), '', esc(r.niveau_urgence || ''),
      esc(r.position || ''), esc(r.etat || '')
    ].join(','));
  });

  return {
    rows: result,
    csvText: csvLines.join('\n')
  };
}

module.exports = { processGeneratedXLS };
