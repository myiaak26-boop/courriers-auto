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
        etat VARCHAR(50) DEFAULT 'Non assigné',
        position VARCHAR(255) DEFAULT '',
        jours_retard INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Table "courriers" prête');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
