const { pool } = require('../db');

function toISODate(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return dateStr;
}

async function createSession(sessionId, csvText, fileName) {
  await pool.query(
    `INSERT INTO sessions (session_id, csv_text, file_name) VALUES ($1, $2, $3)
     ON CONFLICT (session_id) DO UPDATE SET csv_text = $2, file_name = $3, created_at = CURRENT_TIMESTAMP`,
    [sessionId, csvText, fileName]
  );
}

async function getSession(sessionId) {
  const { rows } = await pool.query('SELECT * FROM sessions WHERE session_id = $1', [sessionId]);
  return rows[0] || null;
}

async function getAllCourriers() {
  const { rows } = await pool.query('SELECT * FROM courriers ORDER BY id');
  return rows;
}

async function updateCourrier(id, fields) {
  const { rows } = await pool.query(
    `UPDATE courriers SET etat = COALESCE($1, etat), position = COALESCE($2, position),
     niveau_urgence = COALESCE($3, niveau_urgence), destinataire = COALESCE($4, destinataire),
     updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *`,
    [fields.etat ?? null, fields.position ?? null, fields.niveau_urgence ?? null, fields.destinataire ?? null, id]
  );
  return rows[0] || null;
}

async function deleteAllCourriers() {
  await pool.query('DELETE FROM courriers');
}

async function insertCourriers(rows) {
  const client = await pool.connect();
  try {
    for (const r of rows) {
      const dateArrivee = toISODate(r.dateArrivee);
      await client.query(
        `INSERT INTO courriers (numero, expediteur, objet, date_arrivee, niveau_urgence, destinataire, etat, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [r.numero, r.expediteur, r.objet, dateArrivee, r.niveauUrgence || '', r.destinataire || 'Premier Ministre', r.etat, r.position]
      );
    }
  } finally {
    client.release();
  }
}

module.exports = {
  createSession, getSession,
  getAllCourriers, updateCourrier, deleteAllCourriers, insertCourriers
};
