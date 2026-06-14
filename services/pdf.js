const PDFDocument = require('pdfkit');
const { buildDateRangeLabel } = require('./xls');

function generatePDF(rows, mode, dateDebut, dateFin) {
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

  const navy = '#0f2545';
  const blue = '#1a3f7a';
  const lightBlue = '#8FB3DE';
  const white = '#FFFFFF';
  const textColor = '#1a2540';

  const left = 40;
  let top = 40;
  const baseRowH = 14;
  const fontSize = 7;

  const scale = (doc.page.width - 80) / 940;

  const headers = mode === 'en_retard'
    ? ['N°', 'GEC', 'Expéditeur', 'Objet', 'Urgence', 'Position', 'État', 'Jours']
    : ['N°', 'GEC', 'Expéditeur', 'Destinataire', 'Objet', 'Urgence', 'Position', 'État'];

  const pxW = mode === 'en_retard'
    ? [30, 60, 140, 280, 80, 140, 90, 50]
    : [30, 60, 140, 120, 280, 80, 140, 90];
  const colW = pxW.map(v => Math.round(v * scale));

  const objetIdx = mode === 'en_retard' ? 3 : 4;

  const dateLabel = buildDateRangeLabel(mode, dateDebut, dateFin) || 'Date non spécifiée';

  const title = mode === 'assigne_non_traite'
    ? `SITUATION DES COURRIERS ASSIGNÉS NON TRAITÉS — ${dateLabel}`
    : mode === 'en_retard'
    ? `SITUATION DES COURRIERS EN RETARD DE TRAITEMENT — ${dateLabel}`
    : `SITUATION JOURNALIÈRE DES COURRIERS ARRIVÉS — ${dateLabel}`;

  doc.font('Helvetica-Bold').fontSize(13).fillColor(navy);
  doc.text('SECRETARIAT CENTRAL ET DOCUMENTATION PRIMATURE', left, top, { width: doc.page.width - 80, align: 'center' });
  top = doc.y + 6;

  doc.fontSize(10).fillColor(blue);
  doc.text(title, left, top, { width: doc.page.width - 80, align: 'center' });
  top = doc.y + 10;

  function drawHeader() {
    let x = left;
    const totalW = colW.reduce((a, b) => a + b, 0);
    doc.rect(x, top, totalW, baseRowH).fill(navy);
    doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(white);
    headers.forEach((h, i) => {
      doc.rect(x, top, colW[i], baseRowH).stroke('#ffffff');
      doc.text(h, x + 2, top + (baseRowH - fontSize) / 2, {
        width: colW[i] - 4, align: i === 0 ? 'center' : 'left'
      });
      x += colW[i];
    });
    top += baseRowH;
  }

  function calcRowHeight(r) {
    const objText = r.objet || '';
    const h = doc.heightOfString(objText, { width: colW[objetIdx] - 4, fontSize });
    return Math.max(baseRowH, h + 4);
  }

  function drawRow(r, idx) {
    const rowH = calcRowHeight(r);
    if (top + rowH > doc.page.height - 40) {
      doc.addPage();
      top = 40;
      drawHeader();
    }

    const bg = idx % 2 === 0 ? lightBlue : white;
    let x = left;

    const vals = mode === 'en_retard'
      ? [String(idx + 1), r.numero, r.expediteur, r.objet, r.niveauUrgence || '', r.position, r.etat, String(calcJours(r.dateArrivee))]
      : [String(idx + 1), r.numero, r.expediteur, r.destinataire || 'Premier Ministre', r.objet, r.niveauUrgence || '', r.position, r.etat];

    vals.forEach((v, i) => {
      doc.rect(x, top, colW[i], rowH).fill(bg);
      doc.rect(x, top, colW[i], rowH).stroke('#a0b4d0');
      doc.fillColor(textColor);
      doc.text(String(v || ''), x + 2, top + 2, {
        width: colW[i] - 4, align: i < 2 ? 'center' : 'left', fontSize
      });
      x += colW[i];
    });
    top += rowH;
  }

  function calcJours(dateArrivee) {
    if (!dateArrivee) return '';
    const d = new Date(dateArrivee);
    if (isNaN(d)) return '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.floor((today - d) / 86400000);
  }

  drawHeader();
  for (let i = 0; i < rows.length; i++) {
    drawRow(rows[i], i);
  }

  let x = left;
  const totalW = colW.reduce((a, b) => a + b, 0);
  if (top + baseRowH > doc.page.height - 40) { doc.addPage(); top = 40; }
  doc.rect(x, top, totalW, baseRowH).fill(blue);
  doc.rect(x, top, totalW, baseRowH).stroke('#ffffff');
  doc.font('Helvetica-Bold').fontSize(8).fillColor(white);
  doc.text(`TOTAL : ${rows.length} COURRIER(S)`, x + 4, top + (baseRowH - 8) / 2, { width: totalW - 8 });

  doc.end();
  return doc;
}

module.exports = { generatePDF };
