const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS courriers (
        id SERIAL PRIMARY KEY,
        numero VARCHAR(50) NOT NULL DEFAULT '',
        expediteur VARCHAR(255) NOT NULL DEFAULT '',
        objet TEXT NOT NULL DEFAULT '',
        date_arrivee DATE,
        niveau_urgence VARCHAR(50) DEFAULT '',
        destinataire VARCHAR(255) DEFAULT 'Premier Ministre',
        etat VARCHAR(50) DEFAULT 'Non assigné',
        position VARCHAR(255) DEFAULT '',
        jours_retard INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL UNIQUE,
      csv_text TEXT NOT NULL DEFAULT '',
      file_name VARCHAR(255) DEFAULT '',
      mode VARCHAR(50) DEFAULT 'all',
      date_debut VARCHAR(20) DEFAULT '',
      date_fin VARCHAR(20) DEFAULT '',
      courrier_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await client.query('ALTER TABLE courriers ADD COLUMN IF NOT EXISTS niveau_urgence VARCHAR(50) DEFAULT \'\'');
    await client.query('ALTER TABLE courriers ADD COLUMN IF NOT EXISTS destinataire VARCHAR(255) DEFAULT \'Premier Ministre\'');
    console.log('Tables "courriers" et "sessions" prêtes');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
