import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const poolConfig = {
  host: process.env.AWS_DB_HOST || 'gryndee-db.cevskqcic97b.us-east-1.rds.amazonaws.com',
  port: parseInt(process.env.AWS_DB_PORT || '5432'),
  user: process.env.AWS_DB_USER || 'postgres',
  password: process.env.AWS_DB_PASSWORD,
  database: process.env.AWS_DB_NAME || 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
};

const pool = new Pool(poolConfig);

async function fixBusinessNames() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT id, business_name FROM settings');
    for (const row of rows) {
      if (row.business_name && row.business_name.startsWith('{"')) {
        try {
          const parsed = JSON.parse(row.business_name);
          if (parsed.name) {
            await client.query('UPDATE settings SET business_name = $1 WHERE id = $2', [parsed.name, row.id]);
            console.log(`Fixed business_name for settings id ${row.id}`);
          }
        } catch (e) {
          console.error(`Failed to parse business_name for settings id ${row.id}`);
        }
      }
    }
    
    const { rows: accountRows } = await client.query('SELECT id, business_name FROM accounts');
    for (const row of accountRows) {
      if (row.business_name && row.business_name.startsWith('{"')) {
        try {
          const parsed = JSON.parse(row.business_name);
          if (parsed.name) {
            await client.query('UPDATE accounts SET business_name = $1 WHERE id = $2', [parsed.name, row.id]);
            console.log(`Fixed business_name for accounts id ${row.id}`);
          }
        } catch (e) {
          console.error(`Failed to parse business_name for accounts id ${row.id}`);
        }
      }
    }
  } finally {
    client.release();
  }
}

fixBusinessNames().then(() => process.exit(0)).catch(console.error);
