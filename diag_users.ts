
import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const poolConfig = {
  host: process.env.AWS_DB_HOST || 'trybe-db.c7668600q8v7.eu-west-1.rds.amazonaws.com',
  port: parseInt(process.env.AWS_DB_PORT || '5432'),
  user: process.env.AWS_DB_USER || 'postgres',
  password: process.env.AWS_DB_PASSWORD,
  database: process.env.AWS_DB_NAME || 'trybe_db',
  ssl: {
    rejectUnauthorized: false
  }
};

async function diag() {
  if (!process.env.AWS_DB_PASSWORD) {
    console.error("AWS_DB_PASSWORD is not set.");
    return;
  }

  const pool = new pg.Pool(poolConfig);

  try {
    console.log("--- All Users ---");
    const { rows: users } = await pool.query("SELECT id, email, account_id, role, name FROM users ORDER BY account_id");
    console.table(users);

    console.log("\n--- All Accounts ---");
    const { rows: accounts } = await pool.query("SELECT id, name FROM accounts");
    console.table(accounts);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

diag();
