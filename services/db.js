const sessions = new Map();
let courriers = [];
let nextId = 1;

function toISODate(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return dateStr;
}

async function createSession(sessionId, csvText, fileName) {
  sessions.set(sessionId, { session_id: sessionId, csv_text: csvText, file_name: fileName, created_at: new Date().toISOString() });
}

async function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

async function getAllCourriers() {
  return courriers;
}

async function updateCourrier(id, fields) {
  const idx = courriers.findIndex(c => c.id === Number(id));
  if (idx === -1) return null;
  if (fields.etat != null) courriers[idx].etat = fields.etat;
  if (fields.position != null) courriers[idx].position = fields.position;
  if (fields.niveau_urgence != null) courriers[idx].niveau_urgence = fields.niveau_urgence;
  if (fields.destinataire != null) courriers[idx].destinataire = fields.destinataire;
  courriers[idx].updated_at = new Date().toISOString();
  return courriers[idx];
}

async function deleteAllCourriers() {
  courriers = [];
  nextId = 1;
}

async function insertCourriers(rows) {
  for (const r of rows) {
    const dateArrivee = toISODate(r.dateArrivee);
    courriers.push({
      id: nextId++,
      numero: r.numero,
      expediteur: r.expediteur,
      objet: r.objet,
      date_arrivee: dateArrivee,
      niveau_urgence: r.niveauUrgence || '',
      destinataire: r.destinataire || 'Premier Ministre',
      etat: r.etat,
      position: r.position,
      jours_retard: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
}

module.exports = {
  createSession, getSession,
  getAllCourriers, updateCourrier, deleteAllCourriers, insertCourriers
};
