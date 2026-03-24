import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  host: process.env.AWS_DB_HOST,
  user: process.env.AWS_DB_USER,
  password: process.env.AWS_DB_PASSWORD,
  database: process.env.AWS_DB_NAME,
  port: parseInt(process.env.AWS_DB_PORT || '5432'),
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const { rows: users } = await pool.query("SELECT id, username, email, account_id, role FROM users WHERE email = 'mails@trybeoriginals.com' OR username = 'trybemanager'");
    console.log("Users:", users);
    
    if (users.length > 0) {
      const accountId = users[0].account_id;
      const { rows: products } = await pool.query("SELECT id, name, account_id FROM products WHERE account_id = $1 LIMIT 5", [accountId]);
      console.log("Products for account", accountId, ":", products);
      
      const { rows: allProducts } = await pool.query("SELECT id, name, account_id FROM products WHERE account_id = $1 LIMIT 5", [accountId]);
      console.log("Other products:", allProducts);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
