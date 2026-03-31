import pkg from 'pg';
const { Pool } = pkg;
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

async function alterTable() {
  try {
    console.log('Altering chat_messages table...');
    await pool.query(`
      ALTER TABLE chat_messages 
      ADD COLUMN IF NOT EXISTS guest_id VARCHAR(255),
      ALTER COLUMN account_id DROP NOT NULL,
      ALTER COLUMN user_id DROP NOT NULL;
    `);
    console.log('Successfully altered chat_messages table.');
  } catch (err) {
    console.error('Error altering table:', err);
  } finally {
    await pool.end();
  }
}

alterTable();
