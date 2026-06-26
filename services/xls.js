const { normalizeHeader, cleanText, xmlEscape } = require('../utils/csv-utils');

function parseDate(s) {
  const str = cleanText(s);
  if (!str) return null;
  let d = null;
  const iso = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (iso) d = new Date(+iso[1], +iso[2] - 1, +iso[3]);
  if (!d || isNaN(d)) {
    const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) d = new Date(+m[3], +m[2] - 1, +m[1]);
  }
  if (!d || isNaN(d)) d = new Date(str);
  if (!d || isNaN(d)) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function getFilteredRows(rowsNorm, mode, dateDebut, dateFin) {
  if (mode === 'assigne_non_traite') {
    return rowsNorm.filter(r => {
      if (normalizeHeader(r.etat) !== 'assigne') return false;
      const d = parseDate(r.dateArrivee);
      if (!d) return true;
      if (dateDebut) { const dd = new Date(dateDebut + 'T00:00:00'); if (!isNaN(dd) && d < dd) return false; }
      if (dateFin) { const df = new Date(dateFin + 'T00:00:00'); if (!isNaN(df) && d > df) return false; }
      return true;
    });
  }
  if (mode === 'en_retard') {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const limiteHaute = new Date(today); limiteHaute.setDate(limiteHaute.getDate() - 5);
    return rowsNorm.filter(r => {
      if (normalizeHeader(r.etat) !== 'assigne') return false;
      const d = parseDate(r.dateArrivee);
      if (!d) return false;
      if (d > limiteHaute) return false;
      if (dateDebut) { const dd = new Date(dateDebut + 'T00:00:00'); if (!isNaN(dd) && d < dd) return false; }
      if (dateFin) { const df = new Date(dateFin + 'T00:00:00'); if (!isNaN(df) && d > df) return false; }
      return true;
    });
  }
  if (dateDebut) {
    return rowsNorm.filter(r => {
      const d = parseDate(r.dateArrivee);
      if (!d) return false;
      const dd = new Date(dateDebut + 'T00:00:00');
      if (isNaN(dd)) return false;
      return d.getTime() === dd.getTime();
    });
  }
  return rowsNorm.slice();
}

function calcJoursRetard(dateArrivee) {
  const d = parseDate(dateArrivee);
  if (!d) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.floor((today - d) / 86400000);
}

function buildDateRangeLabel(mode, dateDebut, dateFin) {
  const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  if (mode === 'all') {
    if (dateDebut) {
      const d1 = new Date(dateDebut + 'T00:00:00');
      if (!isNaN(d1)) return jours[d1.getDay()] + ' ' + String(d1.getDate()).padStart(2, '0') + ' ' + mois[d1.getMonth()] + ' ' + d1.getFullYear();
    }
    return null;
  }
  if (dateDebut && dateFin) {
    const d1 = new Date(dateDebut + 'T00:00:00');
    const d2 = new Date(dateFin + 'T00:00:00');
    if (!isNaN(d1) && !isNaN(d2)) {
      const j1 = String(d1.getDate()).padStart(2, '0');
      const j2 = String(d2.getDate()).padStart(2, '0');
      const m1 = mois[d1.getMonth()];
      const m2 = mois[d2.getMonth()];
      const a1 = d1.getFullYear(); const a2 = d2.getFullYear();
      if (a1 === a2 && m1 === m2) return 'Du ' + j1 + ' au ' + j2 + ' ' + m1 + ' ' + a1;
      if (a1 === a2) return 'Du ' + j1 + ' ' + m1 + ' au ' + j2 + ' ' + m2 + ' ' + a1;
      return 'Du ' + j1 + ' ' + m1 + ' ' + a1 + ' au ' + j2 + ' ' + m2 + ' ' + a2;
    }
  }
  if (dateDebut) {
    const d1 = new Date(dateDebut + 'T00:00:00');
    if (!isNaN(d1)) return 'Du ' + String(d1.getDate()).padStart(2, '0') + ' ' + mois[d1.getMonth()] + ' ' + d1.getFullYear();
  }
  return null;
}

function buildFileDateSuffix(mode, dateDebut, dateFin) {
  const moisAbr = ['jan', 'fev', 'mar', 'avr', 'mai', 'jun', 'jul', 'aou', 'sep', 'oct', 'nov', 'dec'];
  if (mode === 'all') {
    if (dateDebut) {
      const d1 = new Date(dateDebut + 'T00:00:00');
      if (!isNaN(d1)) return String(d1.getDate()).padStart(2, '0') + '_' + moisAbr[d1.getMonth()] + '_' + d1.getFullYear();
    }
    return new Date().toISOString().slice(0, 10);
  }
  if (dateDebut && dateFin) {
    const d1 = new Date(dateDebut + 'T00:00:00');
    const d2 = new Date(dateFin + 'T00:00:00');
    if (!isNaN(d1) && !isNaN(d2)) {
      const j1 = String(d1.getDate()).padStart(2, '0');
      const j2 = String(d2.getDate()).padStart(2, '0');
      const m1 = moisAbr[d1.getMonth()];
      const m2 = moisAbr[d2.getMonth()];
      const a = d2.getFullYear();
      if (m1 === m2) return j1 + '-' + j2 + '_' + m1 + '_' + a;
      return j1 + '_' + m1 + '-' + j2 + '_' + m2 + '_' + a;
    }
  }
  if (dateDebut) {
    const d1 = new Date(dateDebut + 'T00:00:00');
    if (!isNaN(d1)) return String(d1.getDate()).padStart(2, '0') + '_' + moisAbr[d1.getMonth()] + '_' + d1.getFullYear();
  }
  return new Date().toISOString().slice(0, 10);
}

function dateToString(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function generateXLS(rowsNorm, rawRowsNorm, mode, dateDebut, dateFin) {
  const rowsExport = getFilteredRows(rowsNorm, mode, dateDebut, dateFin);
  if (!rowsExport.length) return null;

  const dateRangeLabel = buildDateRangeLabel(mode, dateDebut, dateFin);
  const dateLabel = dateRangeLabel || 'Date non spécifiée';

  const workbookTitle = mode === 'assigne_non_traite'
    ? `SITUATION DES COURRIERS ASSIGNÉS NON TRAITÉS — ${xmlEscape(dateLabel)}`
    : mode === 'en_retard'
    ? `SITUATION DES COURRIERS EN RETARD DE TRAITEMENT — ${xmlEscape(dateLabel)}`
    : `SITUATION JOURNALIÈRE DES COURRIERS ARRIVÉS — ${xmlEscape(dateLabel)}`;

  const senders = {};
  rowsExport.forEach(r => { const k = r.expediteur || 'Non renseigné'; senders[k] = (senders[k] || 0) + 1; });
  const senderRows = Object.entries(senders).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `<Row><Cell ss:StyleID="cell"><Data ss:Type="String">${xmlEscape(k)}</Data></Cell><Cell ss:StyleID="cent"><Data ss:Type="Number">${v}</Data></Cell></Row>`).join('');

  const nbAssigned = rawRowsNorm.filter(r => normalizeHeader(r.etat) === 'assigné').length;
  const nbUnassigned = rawRowsNorm.filter(r => normalizeHeader(r.etat) === 'non assigné').length;

  function extractNomPosition(posSource) {
    return (posSource || '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim() || 'Non renseigné';
  }
  const concernesMap = {};
  if (mode === 'en_retard') {
    rowsExport.forEach(r => {
      const nom = extractNomPosition(r.positionSource || r.position);
      concernesMap[nom] = (concernesMap[nom] || 0) + 1;
    });
  }
  const concernesRows = Object.entries(concernesMap).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `<Row><Cell ss:StyleID="cell"><Data ss:Type="String">${xmlEscape(k)}</Data></Cell><Cell ss:StyleID="cent"><Data ss:Type="Number">${v}</Data></Cell></Row>`).join('');

  const dataRows = rowsExport.map((r, idx) => {
    const rowStyle = idx % 2 === 0 ? 'rowBlue' : 'rowWhite';
    if (mode === 'en_retard') {
      const jours = calcJoursRetard(r.dateArrivee);
      return `<Row>
<Cell ss:StyleID="cent_${rowStyle}"><Data ss:Type="String">${xmlEscape(r.numero)}</Data></Cell>
<Cell ss:StyleID="cell_${rowStyle}"><Data ss:Type="String">${xmlEscape(r.expediteur)}</Data></Cell>
<Cell ss:StyleID="cell_${rowStyle}"><Data ss:Type="String">${xmlEscape(r.objet)}</Data></Cell>
<Cell ss:StyleID="cell_${rowStyle}"><Data ss:Type="String">${xmlEscape(r.niveauUrgence || '')}</Data></Cell>
<Cell ss:StyleID="cell_${rowStyle}"><Data ss:Type="String">${xmlEscape(r.position)}</Data></Cell>
<Cell ss:StyleID="cent_${rowStyle}"><Data ss:Type="String">En retard</Data></Cell>
<Cell ss:StyleID="cent_${rowStyle}"><Data ss:Type="Number">${jours}</Data></Cell>
</Row>`;
    }
    return `<Row>
<Cell ss:StyleID="cent_${rowStyle}"><Data ss:Type="String">${xmlEscape(r.numero)}</Data></Cell>
<Cell ss:StyleID="cell_${rowStyle}"><Data ss:Type="String">${xmlEscape(r.expediteur)}</Data></Cell>
<Cell ss:StyleID="cell_${rowStyle}"><Data ss:Type="String">${xmlEscape(r.destinataire || 'Premier Ministre')}</Data></Cell>
<Cell ss:StyleID="cell_${rowStyle}"><Data ss:Type="String">${xmlEscape(r.objet)}</Data></Cell>
<Cell ss:StyleID="cell_${rowStyle}"><Data ss:Type="String">${xmlEscape(r.niveauUrgence || '')}</Data></Cell>
<Cell ss:StyleID="cell_${rowStyle}"><Data ss:Type="String">${xmlEscape(r.position)}</Data></Cell>
<Cell ss:StyleID="cent_${rowStyle}"><Data ss:Type="String">${xmlEscape(r.etat)}</Data></Cell>
</Row>`;
  }).join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">
<Styles>
<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Font ss:FontName="Arial" ss:Size="10"/></Style>
<Style ss:ID="title"><Font ss:FontName="Arial" ss:Size="14" ss:Bold="1" ss:Color="#FFFFFF"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Interior ss:Color="#16345F" ss:Pattern="Solid"/></Style>
<Style ss:ID="subtitle"><Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Interior ss:Color="#234E84" ss:Pattern="Solid"/></Style>
<Style ss:ID="head"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Interior ss:Color="#234E84" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0B223F"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0B223F"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0B223F"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0B223F"/></Borders></Style>
<Style ss:ID="cell"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/></Borders></Style>
<Style ss:ID="cent"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/></Borders></Style>
<Style ss:ID="cell_rowBlue"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Interior ss:Color="#8FB3DE" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/></Borders></Style>
<Style ss:ID="cent_rowBlue"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Interior ss:Color="#8FB3DE" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/></Borders></Style>
<Style ss:ID="cell_rowWhite"><Alignment ss:Vertical="Center" ss:WrapText="1"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/></Borders></Style>
<Style ss:ID="cent_rowWhite"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#23384F"/></Borders></Style>
<Style ss:ID="total"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Interior ss:Color="#234E84" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0B223F"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0B223F"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0B223F"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0B223F"/></Borders></Style>
</Styles>
<Worksheet ss:Name="Situation"><Table>
${mode === 'en_retard'
  ? '<Column ss:Width="28"/><Column ss:Width="180"/><Column ss:Width="360"/><Column ss:Width="55"/><Column ss:Width="130"/><Column ss:Width="67"/><Column ss:Width="80"/>'
  : '<Column ss:Width="28"/><Column ss:Width="180"/><Column ss:Width="77"/><Column ss:Width="360"/><Column ss:Width="55"/><Column ss:Width="130"/><Column ss:Width="67"/>'}
<Row ss:Height="28"><Cell ss:MergeAcross="6" ss:StyleID="title"><Data ss:Type="String">SECRETARIAT CENTRAL ET DOCUMENTATION PRIMATURE</Data></Cell></Row>
<Row ss:Height="24"><Cell ss:MergeAcross="6" ss:StyleID="subtitle"><Data ss:Type="String">${workbookTitle}</Data></Cell></Row>
<Row/>
${mode === 'en_retard'
  ? `<Row><Cell ss:StyleID="head"><Data ss:Type="String">N°</Data></Cell><Cell ss:StyleID="head"><Data ss:Type="String">Expéditeur</Data></Cell><Cell ss:StyleID="head"><Data ss:Type="String">Objet du Courrier</Data></Cell><Cell ss:StyleID="head"><Data ss:Type="String">Niveau&#10;d'Urgence</Data></Cell><Cell ss:StyleID="head"><Data ss:Type="String">Position</Data></Cell><Cell ss:StyleID="head"><Data ss:Type="String">État</Data></Cell><Cell ss:StyleID="head"><Data ss:Type="String">Nbre jours&#10;de retard</Data></Cell></Row>`
  : `<Row><Cell ss:StyleID="head"><Data ss:Type="String">N°</Data></Cell><Cell ss:StyleID="head"><Data ss:Type="String">Expéditeur</Data></Cell><Cell ss:StyleID="head"><Data ss:Type="String">Destinataire</Data></Cell><Cell ss:StyleID="head"><Data ss:Type="String">Objet du Courrier</Data></Cell><Cell ss:StyleID="head"><Data ss:Type="String">Niveau&#10;d'Urgence</Data></Cell><Cell ss:StyleID="head"><Data ss:Type="String">Position</Data></Cell><Cell ss:StyleID="head"><Data ss:Type="String">État</Data></Cell></Row>`}
${dataRows}
<Row><Cell ss:MergeAcross="6" ss:StyleID="total"><Data ss:Type="String">TOTAL : ${rowsExport.length} COURRIER(S) ${mode === 'assigne_non_traite' ? 'ASSIGNÉ(S) NON TRAITÉ(S)' : mode === 'en_retard' ? 'EN RETARD DE TRAITEMENT' : 'ENREGISTRÉ(S)'}</Data></Cell></Row>
</Table></Worksheet>
<Worksheet ss:Name="Tableau de bord"><Table>
<Column ss:Width="340"/><Column ss:Width="140"/>
<Row><Cell ss:MergeAcross="1" ss:StyleID="title"><Data ss:Type="String">TABLEAU DE BORD DES COURRIERS</Data></Cell></Row>
<Row><Cell ss:MergeAcross="1" ss:StyleID="subtitle"><Data ss:Type="String">${workbookTitle}</Data></Cell></Row>
<Row/>
<Row><Cell ss:StyleID="head"><Data ss:Type="String">Indicateur</Data></Cell><Cell ss:StyleID="head"><Data ss:Type="String">Valeur</Data></Cell></Row>
${mode === 'assigne_non_traite'
? `<Row><Cell ss:StyleID="cell"><Data ss:Type="String">Total des courriers assignés non traités</Data></Cell><Cell ss:StyleID="cent"><Data ss:Type="Number">${rowsExport.length}</Data></Cell></Row>`
: mode === 'en_retard'
? `<Row><Cell ss:StyleID="cell"><Data ss:Type="String">Total des courriers en retard de traitement</Data></Cell><Cell ss:StyleID="cent"><Data ss:Type="Number">${rowsExport.length}</Data></Cell></Row>`
: `<Row><Cell ss:StyleID="cell"><Data ss:Type="String">Total des courriers</Data></Cell><Cell ss:StyleID="cent"><Data ss:Type="Number">${rowsExport.length}</Data></Cell></Row>
<Row><Cell ss:StyleID="cell"><Data ss:Type="String">Courriers assignés</Data></Cell><Cell ss:StyleID="cent"><Data ss:Type="Number">${nbAssigned}</Data></Cell></Row>
<Row><Cell ss:StyleID="cell"><Data ss:Type="String">Courriers non assignés</Data></Cell><Cell ss:StyleID="cent"><Data ss:Type="Number">${nbUnassigned}</Data></Cell></Row>`}
<Row/>
<Row><Cell ss:StyleID="head"><Data ss:Type="String">${mode === 'en_retard' ? 'Responsable concerné' : 'Expéditeur'}</Data></Cell><Cell ss:StyleID="head"><Data ss:Type="String">Nombre</Data></Cell></Row>
${mode === 'en_retard' ? concernesRows : senderRows}
</Table></Worksheet>
</Workbook>`;

  const fileSuffix = buildFileDateSuffix(mode, dateDebut, dateFin);
  const fileName = fileSuffix + '_' + (
    mode === 'assigne_non_traite' ? 'Situation_Courriers_Assignes_Non_Traites' :
    mode === 'en_retard' ? 'Situation_Courriers_En_Retard' :
    'Situation_Courriers_Journaliere') + '.xls';

  return { xml, fileName, count: rowsExport.length, workbookTitle };
}

module.exports = { generateXLS, getFilteredRows, buildDateRangeLabel, dateToString, buildFileDateSuffix };
