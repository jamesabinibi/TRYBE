
import pg from 'pg';
const { Pool } = pg;

async function checkDb() {
  // Use the same config as server.ts
  const pool = new Pool({
    host: process.env.AWS_DB_HOST || 'gryndee-db.cevskqcic97b.us-east-1.rds.amazonaws.com',
    port: parseInt(process.env.AWS_DB_PORT || '5432'),
    user: process.env.AWS_DB_USER || 'postgres',
    password: process.env.AWS_DB_PASSWORD,
    database: process.env.AWS_DB_NAME || 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to:', pool.options.host);
    console.log('User:', pool.options.user);
    console.log('Password length:', pool.options.password?.length || 0);

    const client = await pool.connect();
    try {
      console.log('--- ACCOUNTS ---');
      const { rows: accounts } = await client.query('SELECT id, name, owner_id FROM accounts ORDER BY id DESC LIMIT 10');
      console.table(accounts);

      console.log('--- USERS ---');
      const { rows: users } = await client.query('SELECT id, username, email, account_id, role FROM users ORDER BY id DESC LIMIT 10');
      console.table(users);

      console.log('--- COUNT ---');
      const { rows: counts } = await client.query('SELECT (SELECT COUNT(*) FROM accounts) as accounts_count, (SELECT COUNT(*) FROM users) as users_count');
      console.table(counts);

    } finally {
      client.release();
    }
  } catch (err) {
    console.error('DB Check failed:', err);
  } finally {
    await pool.end();
  }
}

checkDb();
