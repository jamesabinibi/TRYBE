
import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://postgres:${process.env.AWS_DB_PASSWORD}@${process.env.AWS_DB_HOST}:${process.env.AWS_DB_PORT}/${process.env.AWS_DB_NAME}`
});

async function check() {
  try {
    const { rows } = await pool.query('SELECT id, name, created_at FROM accounts WHERE is_active = true ORDER BY created_at DESC');
    console.log('Total Active Accounts:', rows.length);
    rows.forEach(r => {
      console.log(`- ID: ${r.id}, Name: ${r.name}, Created: ${r.created_at}`);
    });
    
    const { rows: users } = await pool.query('SELECT id, name, email, account_id FROM users');
    console.log('\nTotal Users:', users.length);
    users.forEach(u => {
      console.log(`- User: ${u.name} (${u.email}), Account ID: ${u.account_id}`);
    });
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

check();
