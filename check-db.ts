import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.AWS_DB_HOST,
  port: parseInt(process.env.AWS_DB_PORT || '5432'),
  user: process.env.AWS_DB_USER,
  password: process.env.AWS_DB_PASSWORD,
  database: process.env.AWS_DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const { rows } = await pool.query("SELECT value FROM system_settings WHERE key = 'LANDING_CONFIG'");
    if (rows.length > 0) {
      const config = JSON.parse(rows[0].value);
      console.log("Logo URL:", config.logo.url);
    } else {
      console.log("No LANDING_CONFIG found");
    }
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
