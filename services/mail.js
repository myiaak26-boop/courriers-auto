const { buildDateRangeLabel } = require('./xls');

function buildMailContent(mode, dateDebut, dateFin) {
  const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const today = new Date();
  const dateLabel = buildDateRangeLabel(mode, dateDebut, dateFin) ||
    jours[today.getDay()] + ' ' + String(today.getDate()).padStart(2, '0') + ' ' + mois[today.getMonth()] + ' ' + today.getFullYear();

  function wrapHtml(bodyText) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a2540;background:#f4f7fc;padding:0;margin:0">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
<div style="background:linear-gradient(135deg,#0f2545,#1a3f7a);padding:20px 28px">
<h1 style="color:#ffffff;font-size:18px;margin:0;font-weight:700">SECRÉTARIAT CENTRAL — PRIMATURE</h1>
</div>
<div style="padding:28px;color:#1a2540;font-size:14px;line-height:1.6">
${bodyText}
</div>
</div></body></html>`;
  }

  if (mode === 'all') {
    return {
      subject: `SITUATION JOURNALIÈRE DES COURRIERS ARRIVÉS — ${dateLabel}`,
      text: `Bonsoir Chef,\n\nVeuillez trouver en pièce jointe la situation journalière des courriers arrivés du ${dateLabel}.\n\nCordialement.`,
      html: wrapHtml(`<p style="margin:0 0 16px">Bonsoir Chef,</p>
<p style="margin:0 0 16px">Veuillez trouver en pièce jointe la <strong>situation journalière des courriers arrivés</strong> du <strong>${dateLabel}</strong>.</p>
<p style="margin:0">Cordialement.</p>`)
    };
  }
  if (mode === 'en_retard') {
    return {
      subject: `SITUATION DES COURRIERS EN RETARD DE TRAITEMENT — ${dateLabel}`,
      text: `Bonsoir Chef,\n\nVeuillez trouver en pièce jointe la situation des courriers en retard de traitement ${dateLabel}.\n\nCordialement.`,
      html: wrapHtml(`<p style="margin:0 0 16px">Bonsoir Chef,</p>
<p style="margin:0 0 16px">Veuillez trouver en pièce jointe la <strong>situation des courriers en retard de traitement</strong> ${dateLabel}.</p>
<p style="margin:0">Cordialement.</p>`)
    };
  }
  return {
    subject: `SITUATION DES COURRIERS ASSIGNÉS NON TRAITÉS — ${dateLabel}`,
    text: `Bonsoir Chef,\n\nVeuillez trouver en pièce jointe la situation des courriers assignés non traités ${dateLabel}.\n\nCordialement.`,
    html: wrapHtml(`<p style="margin:0 0 16px">Bonsoir Chef,</p>
<p style="margin:0 0 16px">Veuillez trouver en pièce jointe la <strong>situation des courriers assignés non traités</strong> ${dateLabel}.</p>
<p style="margin:0">Cordialement.</p>`)
  };
}

module.exports = { buildMailContent };
