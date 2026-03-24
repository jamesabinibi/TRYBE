
import pg from 'pg';
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

const pool = new pg.Pool(poolConfig);

async function run() {
  try {
    console.log('--- User Check ---');
    const { rows: users } = await pool.query("SELECT id, email, account_id, role FROM users WHERE email = 'mails@trybeoriginals.com'");
    console.log(JSON.stringify(users, null, 2));

    if (users.length > 0) {
      const accountId = users[0].account_id;
      console.log(`\n--- Products for Account ID ${accountId} ---`);
      const { rows: products } = await pool.query("SELECT count(*) FROM products WHERE account_id = $1", [accountId]);
      console.log(JSON.stringify(products, null, 2));

      console.log(`\n--- Other Users for Account ID ${accountId} ---`);
      const { rows: otherUsers } = await pool.query("SELECT id, email, role FROM users WHERE account_id = $1", [accountId]);
      console.log(JSON.stringify(otherUsers, null, 2));
    }

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
