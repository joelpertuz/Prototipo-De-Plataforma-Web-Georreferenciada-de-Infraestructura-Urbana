const { Pool } = require("pg");

// Ajusta estos valores según tu entorno, o usa DATABASE_URL en .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST || "localhost",
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  database: process.env.PGDATABASE || "vial_sas",
});

module.exports = pool;
