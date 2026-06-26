const Database = require('better-sqlite3');
const path = require('path');
const { SESSION_TTL_MS, SESSION_CLEANUP_INTERVAL_MS } = require('../config');

const DB_PATH = path.join(__dirname, '..', 'data.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    csv_text TEXT NOT NULL,
    file_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS courriers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    numero TEXT,
    expediteur TEXT,
    objet TEXT,
    date_arrivee TEXT,
    niveau_urgence TEXT DEFAULT '',
    destinataire TEXT DEFAULT 'Premier Ministre',
    etat TEXT,
    position TEXT,
    jours_retard INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_courriers_session ON courriers(session_id);
`);

const insertSessionStmt = db.prepare('INSERT INTO sessions (session_id, csv_text, file_name) VALUES (?, ?, ?)');
const getSessionStmt = db.prepare('SELECT * FROM sessions WHERE session_id = ?');
const deleteOldSessionsStmt = db.prepare("DELETE FROM sessions WHERE datetime(created_at) < datetime('now', ?)");
const deleteAllCourriersStmt = db.prepare('DELETE FROM courriers');
const insertCourrierStmt = db.prepare(`
  INSERT INTO courriers (session_id, numero, expediteur, objet, date_arrivee, niveau_urgence, destinataire, etat, position, jours_retard)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const getAllCourriersStmt = db.prepare('SELECT * FROM courriers ORDER BY id');
const getCourrierByIdStmt = db.prepare('SELECT * FROM courriers WHERE id = ?');

function toISODate(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return dateStr;
}

function createSession(sessionId, csvText, fileName) {
  insertSessionStmt.run(sessionId, csvText, fileName);
}

function getSession(sessionId) {
  return getSessionStmt.get(sessionId) || null;
}

function cleanupSessions() {
  deleteOldSessionsStmt.run(`-${SESSION_TTL_MS / 1000 / 60 / 24 || '1'} days`);
}

setInterval(cleanupSessions, SESSION_CLEANUP_INTERVAL_MS);
cleanupSessions();

function getCurrentSessionId() {
  const row = db.prepare('SELECT session_id FROM sessions ORDER BY created_at DESC LIMIT 1').get();
  return row ? row.session_id : null;
}

function getAllCourriers() {
  return getAllCourriersStmt.all();
}

function updateCourrier(id, fields) {
  const sets = [];
  const params = [];
  if (fields.etat != null) { sets.push('etat = ?'); params.push(fields.etat); }
  if (fields.position != null) { sets.push('position = ?'); params.push(fields.position); }
  if (fields.niveau_urgence != null) { sets.push('niveau_urgence = ?'); params.push(fields.niveau_urgence); }
  if (fields.destinataire != null) { sets.push('destinataire = ?'); params.push(fields.destinataire); }
  if (!sets.length) return null;
  sets.push("updated_at = datetime('now')");
  params.push(id);
  db.prepare(`UPDATE courriers SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return getCourrierByIdStmt.get(id) || null;
}

function deleteAllCourriers() {
  deleteAllCourriersStmt.run();
}

function insertCourriers(sessionId, rows) {
  const insertMany = db.transaction((rows) => {
    for (const r of rows) {
      const dateArrivee = toISODate(r.dateArrivee);
      insertCourrierStmt.run(
        sessionId,
        r.numero,
        r.expediteur,
        r.objet,
        dateArrivee,
        r.niveauUrgence || '',
        r.destinataire || 'Premier Ministre',
        r.etat,
        r.position,
        0
      );
    }
  });
  insertMany(rows);
}

module.exports = {
  createSession, getSession,
  getAllCourriers, updateCourrier, deleteAllCourriers, insertCourriers,
  getCurrentSessionId,
};
