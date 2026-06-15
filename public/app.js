let sessionId = '';
let courriers = [];
let totalLines = 0;
let currentMode = 'all';
let generatedFileName = '';
let modifiedIds = new Set();
let dataStored = false;
let ccRecipients = [];
let autoSaveTimer = null;

function addCc(email) {
  const e = email.trim();
  if (!e) return;
  if (ccRecipients.includes(e)) return;
  ccRecipients.push(e);
  renderCcTags();
  document.getElementById('ccInput').value = '';
  document.getElementById('ccInput').focus();
}

function removeCc(email) {
  ccRecipients = ccRecipients.filter(r => r !== email);
  renderCcTags();
}

function renderCcTags() {
  const container = document.getElementById('ccTags');
  container.innerHTML = ccRecipients.map(r =>
    `<span class="tag">${esc(r)}<span class="tag-remove" onclick="removeCc('${esc(r).replace(/'/g, "\\'")}')">×</span></span>`
  ).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  const ccInput = document.getElementById('ccInput');
  const ccBtn = document.getElementById('addCcBtn');

  ccInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addCc(ccInput.value);
    }
  });

  ccBtn.addEventListener('click', () => addCc(ccInput.value));
});

function goToStep(n) {
  for (let i = 1; i <= 5; i++) {
    document.getElementById('card' + i).classList.remove('active');
    const ind = document.getElementById('step' + i + '-indicator');
    ind.classList.remove('active');
  }
  document.getElementById('card' + n).classList.add('active');
  document.getElementById('step' + n + '-indicator').classList.add('active');
  for (let i = 1; i < n; i++) {
    document.getElementById('step' + i + '-indicator').classList.add('done');
  }
  if (n === 4) {
    updateSummary();
    updateMailSubjectPreview();
  }
  if (n === 5) {
    updateMailSubjectPreview();
    renderCcTags();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('drag');
  if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e => { if (e.target.files[0]) handleUpload(e.target.files[0]); });

async function handleUpload(file) {
  const sp = document.getElementById('spinner1');
  const btn = document.getElementById('btn1Next');
  const alert1 = document.getElementById('alert1');
  const alert1msg = document.getElementById('alert1-msg');

  alert1.classList.remove('show');
  sp.classList.add('show');
  btn.disabled = true;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok || data.error) {
      alert1msg.textContent = data.error || 'Erreur inconnue';
      alert1.classList.add('show');
      sp.classList.remove('show');
      return;
    }

    sessionId = data.sessionId;
    totalLines = data.count;

    const preview = data.preview || [];
    const cols = preview.length ? Object.keys(preview[0]) : [];
    let html = '<div class="table-wrap"><table><thead><tr>';
    cols.forEach(c => html += '<th>' + c + '</th>');
    html += '</tr></thead><tbody>';
    preview.forEach(row => {
      html += '<tr>';
      cols.forEach(c => html += '<td>' + (row[c] || '') + '</td>');
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    if (preview.length < totalLines) {
      html += '<p style="font-size:12px;color:var(--muted);margin-top:8px;text-align:center">… et ' + (totalLines - preview.length) + ' autre(s) ligne(s)</p>';
    }
    document.getElementById('previewTable').innerHTML = html;
    document.getElementById('uploadSuccess').style.display = 'block';
    btn.disabled = false;

  } catch(e) {
    alert1msg.textContent = 'Erreur réseau : ' + e.message;
    alert1.classList.add('show');
  }
  sp.classList.remove('show');
}

document.getElementById('btn1Next').addEventListener('click', () => goToStep(2));

function selectMode(mode) {
  if (dataStored) return;
  currentMode = mode;
  ['all', 'assigne_non_traite', 'en_retard'].forEach(m => {
    const card = document.getElementById('mode-' + (m === 'all' ? 'all' : m === 'assigne_non_traite' ? 'assigne' : 'retard'));
    card.classList.toggle('selected', m === mode);
  });
  setDefaultDates();
  updateDateUI();
  updateDatePreview();
}

function setDefaultDates() {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);

  if (currentMode === 'all') {
    document.getElementById('dateDebut').value = iso;
    document.getElementById('dateFin').value = '';
  } else if (currentMode === 'assigne_non_traite') {
    const start = new Date(today);
    start.setDate(start.getDate() - 7);
    document.getElementById('dateDebut').value = start.toISOString().slice(0, 10);
    document.getElementById('dateFin').value = iso;
  } else if (currentMode === 'en_retard') {
    document.getElementById('dateDebut').value = today.getFullYear() + '-01-01';
    document.getElementById('dateFin').value = iso;
  }
  updateDatePreview();
}

function updateDateUI() {
  const wrap = document.getElementById('dateFinWrap');
  const label = document.getElementById('labelDebut');
  if (currentMode === 'all') {
    wrap.style.display = 'none';
    label.textContent = 'Date (optionnelle)';
  } else {
    wrap.style.display = 'block';
    label.textContent = 'Date de début';
  }
}

function updateDatePreview() {
  const debut = document.getElementById('dateDebut').value;
  const fin = document.getElementById('dateFin').value;
  const el = document.getElementById('datePreview');
  const mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const jours = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

  if (currentMode === 'all' && debut) {
    const d = new Date(debut + 'T00:00:00');
    if (!isNaN(d)) el.textContent = 'Rapport pour le ' + jours[d.getDay()] + ' ' + d.getDate() + ' ' + mois[d.getMonth()] + ' ' + d.getFullYear();
  } else if (debut && fin) {
    const d1 = new Date(debut + 'T00:00:00');
    const d2 = new Date(fin + 'T00:00:00');
    if (!isNaN(d1) && !isNaN(d2)) el.textContent = 'Période : du ' + d1.getDate() + ' ' + mois[d1.getMonth()] + ' ' + d1.getFullYear() + ' au ' + d2.getDate() + ' ' + mois[d2.getMonth()] + ' ' + d2.getFullYear();
  } else {
    el.textContent = 'Laissez vide pour importer tous les courriers.';
  }
}

document.getElementById('dateDebut').addEventListener('change', updateDatePreview);
document.getElementById('dateFin').addEventListener('change', updateDatePreview);

updateDateUI();
setDefaultDates();

async function storeData() {
  if (!sessionId) {
    document.getElementById('alert2-msg').textContent = 'Aucune donnée importée. Revenez à l\'étape 1.';
    document.getElementById('alert2').classList.add('show');
    return;
  }

  const sp = document.getElementById('spinner2');
  const btn = document.getElementById('btnStore');
  const alert2 = document.getElementById('alert2');

  alert2.classList.remove('show');
  sp.classList.add('show');
  btn.disabled = true;

  try {
    const res = await fetch('/api/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        mode: currentMode,
        dateDebut: document.getElementById('dateDebut').value,
        dateFin: document.getElementById('dateFin').value
      })
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      document.getElementById('alert2-msg').textContent = data.error || 'Erreur inconnue';
      alert2.classList.add('show');
      sp.classList.remove('show');
      btn.disabled = false;
      return;
    }

    courriers = data.rows;
    dataStored = true;
    modifiedIds = new Set();

    document.querySelectorAll('.mode-card').forEach(c => c.classList.add('disabled'));
    document.getElementById('dateDebut').disabled = true;
    document.getElementById('dateFin').disabled = true;

    renderEditableTable();

  } catch(e) {
    document.getElementById('alert2-msg').textContent = 'Erreur réseau : ' + e.message;
    alert2.classList.add('show');
    sp.classList.remove('show');
    btn.disabled = false;
  }
}

function renderEditableTable() {
  const wrap = document.getElementById('editableTableWrap');
  if (!courriers.length) {
    wrap.innerHTML = '<p style="color:var(--muted)">Aucune donnée.</p>';
    return;
  }

  const dense = localStorage.getItem('tableDensity') !== 'comfort';
  let html = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">';
  html += '<span style="font-size:12px;color:var(--muted)">Densité :</span>';
  html += '<button class="btn btn-outline" style="padding:5px 12px;font-size:12px" onclick="toggleDensity()">' + (dense ? 'Confort' : 'Dense') + '</button>';
  html += '</div>';
  html += '<div class="table-container"><div class="table-wrap"><table class="' + (dense ? 'dense' : 'comfort') + '" id="editableTable"><thead><tr>';
  html += '<th>N°</th><th>Expéditeur</th><th>Destinataire</th><th>Objet</th><th>Date arrivée</th><th>Urgence</th><th>État</th><th>Position</th>';
  html += '</tr></thead><tbody>';

  for (const c of courriers) {
    const dateStr = c.date_arrivee ? c.date_arrivee.toString().slice(0, 10) : '';
    html += '<tr data-id="' + c.id + '">';
    html += '<td>' + esc(c.numero) + '</td>';
    html += '<td>' + esc(c.expediteur) + '</td>';
    html += '<td contenteditable="true" data-field="destinataire" data-id="' + c.id + '" oninput="onCellChange(this)">' + esc(c.destinataire || 'Premier Ministre') + '</td>';
    html += '<td>' + esc(c.objet) + '</td>';
    html += '<td>' + esc(dateStr) + '</td>';
    html += '<td contenteditable="true" data-field="niveau_urgence" data-id="' + c.id + '" oninput="onCellChange(this)">' + esc(c.niveau_urgence || '') + '</td>';
    html += '<td>' + esc(c.etat) + '</td>';
    html += '<td>' + esc(c.position) + '</td>';
    html += '</tr>';
  }

  html += '</tbody></table></div></div>';
  wrap.innerHTML = html;

  document.getElementById('btn3Next').disabled = false;
  document.getElementById('saveStatus').textContent = '';
  document.getElementById('saveStatus').className = 'save-status';
  document.getElementById('autoFillWrap').style.display = 'block';
  document.getElementById('alertAf').classList.remove('show');
  document.getElementById('alertAfErr').classList.remove('show');

  goToStep(3);
}

function toggleDensity() {
  const tbl = document.getElementById('editableTable');
  if (!tbl) return;
  const dense = tbl.classList.contains('dense');
  tbl.className = dense ? 'comfort' : 'dense';
  localStorage.setItem('tableDensity', dense ? 'comfort' : 'dense');
  const btn = event.target;
  if (btn) btn.textContent = dense ? 'Dense' : 'Confort';
}

function esc(s) {
  const el = document.createElement('div');
  el.textContent = s || '';
  return el.innerHTML;
}

function onCellChange(el) {
  const id = parseInt(el.dataset.id, 10);
  modifiedIds.add(id);
  el.classList.add('modified');
  updateSaveStatus();

  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  const status = document.getElementById('saveStatus');
  status.textContent = '⚡ Sauvegarde automatique...';
  autoSaveTimer = setTimeout(() => {
    saveChanges();
  }, 2000);
}

function updateSaveStatus() {
  const status = document.getElementById('saveStatus');
  const count = modifiedIds.size;
  if (count === 0) {
    status.textContent = '';
    status.className = 'save-status';
  } else {
    status.textContent = count + ' modification(s) non enregistrée(s)';
    status.className = 'save-status unsaved';
  }
}

async function saveChanges() {
  const ids = Array.from(modifiedIds);
  if (!ids.length) return;

  for (const id of ids) {
    const tr = document.querySelector('tr[data-id="' + id + '"]');
    if (!tr) continue;
    const destEl = tr.querySelector('td[data-field="destinataire"]');
    const urgEl = tr.querySelector('td[data-field="niveau_urgence"]');
    const etatEl = tr.querySelector('td[data-field="etat"]');
    const posEl = tr.querySelector('td[data-field="position"]');
    const payload = {};
    if (destEl) payload.destinataire = destEl.textContent.trim();
    if (urgEl) payload.niveau_urgence = urgEl.textContent.trim();
    if (etatEl) payload.etat = etatEl.textContent.trim();
    if (posEl) payload.position = posEl.textContent.trim();

    try {
      const res = await fetch('/api/courriers/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const tr2 = document.querySelector('tr[data-id="' + id + '"]');
        if (tr2) tr2.querySelectorAll('td.modified').forEach(c => c.classList.remove('modified'));
      }
    } catch(e) {}
  }

  modifiedIds = new Set();
  updateSaveStatus();
  const status = document.getElementById('saveStatus');
  status.textContent = '✓ Sauvegardé il y a quelques secondes';
  status.className = 'save-status saved';
}

async function autoFillUrgency() {
  const btn = document.getElementById('btnAutoFill');
  const sp = document.getElementById('spinnerAf');
  const alertOk = document.getElementById('alertAf');
  const alertErr = document.getElementById('alertAfErr');
  const info = document.getElementById('autoFillInfo');

  alertOk.classList.remove('show');
  alertErr.classList.remove('show');
  sp.classList.add('show');
  btn.disabled = true;
  info.textContent = 'Analyse des objets par IA...';

  try {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      await saveChanges();
    }

    const res = await fetch('/api/auto-fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      document.getElementById('alertAfErr-msg').textContent = data.error || 'Erreur inconnue';
      alertErr.classList.add('show');
      sp.classList.remove('show');
      btn.disabled = false;
      info.textContent = '';
      return;
    }

    courriers = data.rows;
    modifiedIds = new Set();

    document.getElementById('alertAf-msg').textContent =
      data.modifiedCount + ' courrier(s) mis à jour sur ' + data.total;
    alertOk.classList.add('show');

    renderEditableTable();

  } catch (e) {
    document.getElementById('alertAfErr-msg').textContent = 'Erreur réseau : ' + e.message;
    alertErr.classList.add('show');
  }

  sp.classList.remove('show');
  btn.disabled = false;
  info.textContent = '';
}

function updateSummary() {
  const labels = { all: 'Situation journalière complète', assigne_non_traite: 'Assignés non traités', en_retard: 'En retard de traitement' };
  document.getElementById('sum-mode').textContent = labels[currentMode];
  const debut = document.getElementById('dateDebut').value;
  const fin = document.getElementById('dateFin').value;
  const mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  let datesLabel = '—';
  if (currentMode === 'all' && debut) {
    const d = new Date(debut + 'T00:00:00');
    if (!isNaN(d)) datesLabel = d.getDate() + ' ' + mois[d.getMonth()] + ' ' + d.getFullYear();
  } else if (debut && fin) {
    const d1 = new Date(debut + 'T00:00:00'), d2 = new Date(fin + 'T00:00:00');
    if (!isNaN(d1) && !isNaN(d2)) datesLabel = d1.getDate() + ' ' + mois[d1.getMonth()] + ' → ' + d2.getDate() + ' ' + mois[d2.getMonth()] + ' ' + d2.getFullYear();
  }
  document.getElementById('sum-lines').textContent = courriers.length + ' courrier(s)';
  document.getElementById('sum-dates').textContent = datesLabel;
}

function updateMailSubjectPreview() {
  const debut = document.getElementById('dateDebut').value;
  const fin = document.getElementById('dateFin').value;
  const mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const jours = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  let label = '';
  if (currentMode === 'all' && debut) {
    const d = new Date(debut + 'T00:00:00');
    if (!isNaN(d)) label = jours[d.getDay()] + ' ' + d.getDate() + ' ' + mois[d.getMonth()] + ' ' + d.getFullYear();
  } else if (debut && fin) {
    const d1 = new Date(debut + 'T00:00:00'), d2 = new Date(fin + 'T00:00:00');
    if (!isNaN(d1) && !isNaN(d2)) label = 'Du ' + d1.getDate() + ' ' + mois[d1.getMonth()] + ' au ' + d2.getDate() + ' ' + mois[d2.getMonth()] + ' ' + d2.getFullYear();
  }
  const titles = {
    all: 'SITUATION JOURNALIÈRE DES COURRIERS ARRIVÉS',
    assigne_non_traite: 'SITUATION DES COURRIERS ASSIGNÉS NON TRAITÉS',
    en_retard: 'SITUATION DES COURRIERS EN RETARD DE TRAITEMENT'
  };
  document.getElementById('mailSubjectPreview').textContent = (titles[currentMode] || '') + (label ? ' — ' + label : '');
}

async function generateFile() {
  const sp = document.getElementById('spinner4');
  const btn = document.getElementById('btnGenerate');
  const alert4 = document.getElementById('alert4');
  const alert4ok = document.getElementById('alert4-ok');
  alert4.classList.remove('show'); alert4ok.classList.remove('show');
  sp.classList.add('show'); btn.disabled = true;

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: currentMode,
        dateDebut: document.getElementById('dateDebut').value,
        dateFin: document.getElementById('dateFin').value
      })
    });

    if (!res.ok) {
      const data = await res.json();
      document.getElementById('alert4-msg').textContent = data.error || 'Erreur inconnue';
      alert4.classList.add('show');
    } else {
      generatedFileName = decodeURIComponent(res.headers.get('X-File-Name') || 'rapport.xls');
      const count = res.headers.get('X-Count') || '?';
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = generatedFileName;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      document.getElementById('alert4-ok-msg').textContent = 'Fichier généré avec ' + count + ' courrier(s) — téléchargement démarré.';
      alert4ok.classList.add('show');
      document.getElementById('btnToMail').style.display = 'inline-flex';
      const pdfBtn = document.getElementById('btnPDF');
      if (pdfBtn) pdfBtn.style.display = 'inline-flex';
    }
  } catch(e) {
    document.getElementById('alert4-msg').textContent = 'Erreur réseau : ' + e.message;
    alert4.classList.add('show');
  }
  sp.classList.remove('show'); btn.disabled = false;
}

async function generatePDF() {
  const sp = document.getElementById('spinnerPdf');
  const btn = document.getElementById('btnPDF');
  const alert4 = document.getElementById('alert4');
  const alert4ok = document.getElementById('alert4-ok');
  alert4.classList.remove('show'); alert4ok.classList.remove('show');
  if (sp) sp.classList.add('show'); if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: currentMode,
        dateDebut: document.getElementById('dateDebut').value,
        dateFin: document.getElementById('dateFin').value
      })
    });

    if (!res.ok) {
      const data = await res.json();
      document.getElementById('alert4-msg').textContent = data.error || 'Erreur inconnue';
      alert4.classList.add('show');
    } else {
      generatedFileName = decodeURIComponent(res.headers.get('X-File-Name') || 'rapport.pdf');
      const count = res.headers.get('X-Count') || '?';
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = generatedFileName;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      document.getElementById('alert4-ok-msg').textContent = 'PDF généré avec ' + count + ' courrier(s) — téléchargement démarré.';
      alert4ok.classList.add('show');
      document.getElementById('btnToMail').style.display = 'inline-flex';
    }
  } catch(e) {
    document.getElementById('alert4-msg').textContent = 'Erreur réseau : ' + e.message;
    alert4.classList.add('show');
  }
  if (sp) sp.classList.remove('show'); if (btn) btn.disabled = false;
}

async function sendMail() {
  const sp = document.getElementById('spinner5');
  const btn = document.getElementById('btnSendMail');
  const alert5 = document.getElementById('alert5');
  const alert5ok = document.getElementById('alert5-ok');
  alert5.classList.remove('show'); alert5ok.classList.remove('show');
  sp.classList.add('show'); btn.disabled = true;

  try {
    const res = await fetch('/api/send-mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: currentMode,
        dateDebut: document.getElementById('dateDebut').value,
        dateFin: document.getElementById('dateFin').value,
        mailTo: document.getElementById('mailTo').value,
        mailCc: ccRecipients
      })
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      document.getElementById('alert5-msg').textContent = data.error || 'Erreur inconnue';
      alert5.classList.add('show');
    } else {
      document.getElementById('mailSuccess').style.display = 'block';
      document.getElementById('mailSuccessMsg').textContent = data.message;
      btn.style.display = 'none';
    }
  } catch(e) {
    document.getElementById('alert5-msg').textContent = 'Erreur réseau : ' + e.message;
    alert5.classList.add('show');
  }
  sp.classList.remove('show'); btn.disabled = false;
}

function resetAll() {
  sessionId = '';
  courriers = [];
  totalLines = 0;
  currentMode = 'all';
  generatedFileName = '';
  modifiedIds = new Set();
  dataStored = false;
  ccRecipients = [];

  document.getElementById('uploadSuccess').style.display = 'none';
  document.getElementById('fileInput').value = '';
  document.getElementById('btn1Next').disabled = true;
  document.getElementById('btnToMail').style.display = 'none';
  document.getElementById('mailSuccess').style.display = 'none';
  document.getElementById('btnSendMail').style.display = 'inline-flex';
  document.getElementById('editableTableWrap').innerHTML = '';
  document.getElementById('btn3Next').disabled = true;
  document.getElementById('saveStatus').textContent = '';
  document.getElementById('saveStatus').className = 'save-status';
  document.getElementById('autoFillWrap').style.display = 'none';
  const pdfBtn = document.getElementById('btnPDF');
  if (pdfBtn) pdfBtn.style.display = 'none';

  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('disabled'));
  document.getElementById('dateDebut').disabled = false;
  document.getElementById('dateFin').disabled = false;

  document.querySelectorAll('.alert').forEach(a => a.classList.remove('show'));
  for (let i = 1; i <= 5; i++) {
    const ind = document.getElementById('step' + i + '-indicator');
    ind.classList.remove('active', 'done');
  }
  goToStep(1);
}

function newReport() {
  courriers = [];
  dataStored = false;
  modifiedIds = new Set();
  generatedFileName = '';
  ccRecipients = [];

  document.getElementById('btnToMail').style.display = 'none';
  document.getElementById('mailSuccess').style.display = 'none';
  document.getElementById('btnSendMail').style.display = 'inline-flex';
  document.getElementById('editableTableWrap').innerHTML = '';
  document.getElementById('btn3Next').disabled = true;
  document.getElementById('saveStatus').textContent = '';
  document.getElementById('saveStatus').className = 'save-status';
  document.getElementById('autoFillWrap').style.display = 'none';
  const pdfBtn = document.getElementById('btnPDF');
  if (pdfBtn) pdfBtn.style.display = 'none';

  document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('disabled'));
  document.getElementById('dateDebut').disabled = false;
  document.getElementById('dateFin').disabled = false;

  document.querySelectorAll('.alert').forEach(a => a.classList.remove('show'));

  goToStep(2);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js');
}
