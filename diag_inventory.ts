
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
    console.error("AWS_DB_PASSWORD is not set in process.env.");
    // Try to find it in server.ts if possible, but let's just hope it's in env
    return;
  }

  const pool = new pg.Pool(poolConfig);

  try {
    console.log("--- User Lookup ---");
    const { rows: users } = await pool.query("SELECT id, email, account_id, role, username FROM users WHERE email = 'mails@trybeoriginals.com'");
    console.log("User 'mails@trybeoriginals.com':", users);

    if (users.length > 0) {
      const accountId = users[0].account_id;
      console.log(`\n--- Other Users in Account ${accountId} ---`);
      const { rows: otherUsers } = await pool.query("SELECT id, email, role, username FROM users WHERE account_id = $1", [accountId]);
      console.table(otherUsers);

      console.log(`\n--- Products in Account ${accountId} ---`);
      const { rows: products } = await pool.query("SELECT id, name, created_at FROM products WHERE account_id = $1 LIMIT 10", [accountId]);
      console.table(products);

      const { rows: productCount } = await pool.query("SELECT count(*) FROM products WHERE account_id = $1", [accountId]);
      console.log(`Total products for account ${accountId}:`, productCount[0].count);
      
      console.log(`\n--- Categories in Account ${accountId} ---`);
      const { rows: categories } = await pool.query("SELECT id, name FROM categories WHERE account_id = $1", [accountId]);
      console.table(categories);
    } else {
      console.log("User 'mails@trybeoriginals.com' not found in RDS.");
    }

  } catch (err) {
    console.error("Error during diagnostic:", err);
  } finally {
    await pool.end();
  }
}

diag();
