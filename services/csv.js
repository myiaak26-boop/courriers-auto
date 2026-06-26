const { normalizeHeader, cleanText, cleanPosition } = require('../utils/csv-utils');
function keepLeftOfDash(v) {
  const s = cleanText(v);
  if (!s) return '';
  return s.split('-')[0].trim();
}

function parseDelimited(text) {
  text = String(text || '').replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/)[0] || '';
  const semi = (firstLine.match(/;/g) || []).length;
  const comma = (firstLine.match(/,/g) || []).length;
  const delimiter = semi > comma ? ';' : ',';
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (q && text[i + 1] === '"') { cell += '"'; i++; }
      else { q = !q; }
    } else if (ch === delimiter && !q) {
      row.push(cell); cell = '';
    } else if ((ch === '\n' || ch === '\r') && !q) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => String(v).trim() !== '')) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some(v => String(v).trim() !== '')) rows.push(row);
  return rows;
}

function rowsToObjects(grid) {
  if (!grid.length) return [];
  const headers = grid[0].map(h => String(h ?? ''));
  return grid.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i] ?? '');
    return obj;
  });
}

function pick(obj, names) {
  const map = {};
  Object.keys(obj).forEach(k => map[normalizeHeader(k)] = obj[k]);
  for (const name of names) {
    const key = normalizeHeader(name);
    if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
  }
  return '';
}

function normalizeObjects(objects) {
  return objects.map(o => {
    const numeroRaw = pick(o, ['Numéro', 'Numero']);
    const expediteur = cleanText(pick(o, ['Expéditeur', 'Expediteur']));
    const objet = cleanText(pick(o, ['Objet']));
    const etatSource = cleanText(pick(o, ['Etat', 'État']));
    const positionRaw = cleanText(pick(o, ['Position']));
    const position = cleanPosition(positionRaw);
    const dateArrivee = pick(o, ["Date d' Arrivée", "Date d'Arrivée", "Date d Arrivee", "Date Arrivee"]);
    const niveauUrgence = cleanText(pick(o, ['Niveau d Urgence', 'Niveau d\'Urgence', 'Niveau Urgence', 'Urgence']));
    const destinataire = cleanText(pick(o, ['Destinataire'])) || 'Premier Ministre';
    const numero = keepLeftOfDash(numeroRaw);
    if (!(numero || expediteur || objet)) return null;
    let etat = etatSource;
    const etatNorm = normalizeHeader(etatSource);
    if (etatNorm === 'enregistre') etat = 'Non assigné';
    else if (etatNorm === 'assigne') etat = 'Assigné';
    else if (etatNorm === 'non assigne') etat = 'Non assigné';
    else etat = etat || 'Non assigné';
    return { numero, expediteur, objet, dateArrivee, niveauUrgence, destinataire, etat, position, positionSource: positionRaw };
  }).filter(Boolean).sort((a, b) => (parseInt(b.numero || '0', 10) || 0) - (parseInt(a.numero || '0', 10) || 0));
}

function processCSV(csvText) {
  const grid = parseDelimited(csvText);
  const objects = rowsToObjects(grid);
  const headersNorm = grid[0] ? grid[0].map(normalizeHeader) : [];
  const okNumero = headersNorm.includes('numero');
  const okExp = headersNorm.includes('expediteur');
  const okObjet = headersNorm.includes('objet');
  if (!okNumero || !okExp || !okObjet) {
    throw new Error('En-têtes non reconnues. Vérifiez que le fichier contient les colonnes Numéro, Expéditeur, Objet.');
  }
  const rows = normalizeObjects(objects);
  if (!rows.length) throw new Error('Aucune ligne exploitable trouvée dans le fichier.');
  return rows;
}

module.exports = { processCSV };
