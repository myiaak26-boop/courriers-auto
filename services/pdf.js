const PDFDocument = require('pdfkit');
const { buildDateRangeLabel } = require('./xls');

function generatePDF(rows, mode, dateDebut, dateFin) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  const navy = '#0f2545';
  const blue = '#1a3f7a';
  const lightBlue = '#8FB3DE';
  const white = '#FFFFFF';
  const textColor = '#1a2540';

  const left = 40;
  const pageW = doc.page.width - 80;
  let top = 40;
  const rowH = 16;

  const dateLabel = buildDateRangeLabel(mode, dateDebut, dateFin) || 'Date non spécifiée';

  const title = mode === 'assigne_non_traite'
    ? `SITUATION DES COURRIERS ASSIGNÉS NON TRAITÉS — ${dateLabel}`
    : mode === 'en_retard'
    ? `SITUATION DES COURRIERS EN RETARD DE TRAITEMENT — ${dateLabel}`
    : `SITUATION JOURNALIÈRE DES COURRIERS ARRIVÉS — ${dateLabel}`;

  const headers = mode === 'en_retard'
    ? ['N°', 'Expéditeur', 'Objet', 'Urgence', 'Position', 'État', 'Jours']
    : ['N°', 'Expéditeur', 'Destinataire', 'Objet', 'Urgence', 'Position', 'État'];

  const colW = mode === 'en_retard'
    ? [28, 100, 190, 45, 90, 55, 42]
    : [28, 90, 68, 190, 45, 90, 55];

  doc.font('Helvetica-Bold').fontSize(13).fillColor(navy);
  doc.text('SECRETARIAT CENTRAL ET DOCUMENTATION PRIMATURE', left, top, { width: pageW, align: 'center' });
  top = doc.y + 6;

  doc.fontSize(10).fillColor(blue);
  doc.text(title, left, top, { width: pageW, align: 'center' });
  top = doc.y + 10;

  function drawTable() {
    let x = left;

    doc.rect(x, top, colW.reduce((a, b) => a + b, 0), rowH).fill(navy);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(white);
    headers.forEach((h, i) => {
      doc.text(h, x + 2, top + (rowH - 9) / 2 + 1, {
        width: colW[i] - 4, align: i === 0 ? 'center' : 'left'
      });
      x += colW[i];
    });
    top += rowH;

    doc.font('Helvetica').fontSize(7.5).fillColor(textColor);
    for (let idx = 0; idx < rows.length; idx++) {
      if (top + rowH > doc.page.height - 40) {
        doc.addPage();
        top = 40;
        x = left;
        doc.rect(x, top, colW.reduce((a, b) => a + b, 0), rowH).fill(navy);
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(white);
        headers.forEach((h, i) => {
          doc.text(h, x + 2, top + (rowH - 9) / 2 + 1, { width: colW[i] - 4, align: i === 0 ? 'center' : 'left' });
          x += colW[i];
        });
        top += rowH;
        doc.font('Helvetica').fontSize(7.5).fillColor(textColor);
      }

      const r = rows[idx];
      const bg = idx % 2 === 0 ? lightBlue : white;
      x = left;

      const vals = mode === 'en_retard'
        ? [r.numero, r.expediteur, r.objet, r.niveauUrgence || '', r.position, 'En retard',
           String(calcJours(r.dateArrivee))]
        : [r.numero, r.expediteur, r.destinataire || 'Premier Ministre', r.objet,
           r.niveauUrgence || '', r.position, r.etat];

      vals.forEach((v, i) => {
        doc.rect(x, top, colW[i], rowH).fill(bg);
        doc.fillColor(textColor).text(String(v || ''), x + 2, top + (rowH - 9) / 2 + 1, {
          width: colW[i] - 4, align: i === 0 ? 'center' : 'left'
        });
        x += colW[i];
      });
      top += rowH;
    }
  }

  function calcJours(dateArrivee) {
    if (!dateArrivee) return '';
    const d = new Date(dateArrivee);
    if (isNaN(d)) return '';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.floor((today - d) / 86400000);
  }

  drawTable();

  x = left;
  const totalW = colW.reduce((a, b) => a + b, 0);
  if (top + rowH > doc.page.height - 40) { doc.addPage(); top = 40; }
  doc.rect(x, top, totalW, rowH).fill(blue);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(white);
  doc.text(`TOTAL : ${rows.length} COURRIER(S)`, x + 4, top + (rowH - 9) / 2 + 1, { width: totalW - 8 });

  doc.end();
  return doc;
}

module.exports = { generatePDF };
