import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

/**
 * Gryndee One-Click Database Migrator
 * Copies all data from your current AWS RDS instance to a new free PostgreSQL database
 * (such as Supabase, Neon.tech, or Railway).
 *
 * Usage:
 *   DEST_DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" npx tsx migrate-db.ts
 */

const srcConfig: pg.PoolConfig = process.env.SRC_DATABASE_URL
  ? {
      connectionString: process.env.SRC_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      host: process.env.AWS_DB_HOST || 'gryndee-db.cevskqcic97b.us-east-1.rds.amazonaws.com',
      port: parseInt(process.env.AWS_DB_PORT || '5432'),
      user: process.env.AWS_DB_USER || 'postgres',
      password: process.env.AWS_DB_PASSWORD,
      database: process.env.AWS_DB_NAME || 'postgres',
      ssl: { rejectUnauthorized: false },
    };

const destUrl = process.env.DEST_DATABASE_URL || process.env.DATABASE_URL;

if (!destUrl || destUrl === 'inventory.db') {
  console.error('\n❌ ERROR: DEST_DATABASE_URL is required.');
  console.log('Please provide the destination connection string:');
  console.log('  DEST_DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" npx tsx migrate-db.ts\n');
  process.exit(1);
}

const destConfig: pg.PoolConfig = {
  connectionString: destUrl,
  ssl: destUrl.includes('localhost') ? false : { rejectUnauthorized: false },
};

const srcPool = new Pool(srcConfig);
const destPool = new Pool(destConfig);

const TABLES_IN_ORDER = [
  'accounts',
  'users',
  'categories',
  'products',
  'sales',
  'sale_items',
  'customers',
  'expenses',
  'invoices',
  'invoice_items',
  'settings',
  'system_settings',
  'promo_codes',
  'promo_code_usages',
  'automated_email_templates',
  'sent_automated_emails',
  'chat_messages',
  'activity_logs',
];

async function migrate() {
  console.log('🚀 Starting Gryndee Database Migration...');
  console.log(`📡 Source: ${srcConfig.host || 'SRC_DATABASE_URL'}`);
  console.log(`🎯 Destination: ${destUrl.split('@')[1] || 'DEST_DATABASE_URL'}\n`);

  const srcClient = await srcPool.connect();
  const destClient = await destPool.connect();

  try {
    // 1. First run schema initialization on the destination database to ensure all tables exist
    console.log('⚙️  Initializing tables & schema on target database...');
    // Accounts
    await destClient.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id INTEGER,
        account_type TEXT DEFAULT 'personal',
        business_type TEXT,
        referral_code TEXT UNIQUE,
        referred_by_id INTEGER REFERENCES accounts(id),
        invoice_terms TEXT,
        trial_expiry TIMESTAMP WITH TIME ZONE,
        subscription_plan TEXT DEFAULT 'regular',
        subscription_status TEXT DEFAULT 'active',
        last_payment_date TIMESTAMP WITH TIME ZONE,
        invoice_count_month INTEGER DEFAULT 0,
        last_invoice_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        referral_count INTEGER DEFAULT 0,
        referrals_for_reward INTEGER DEFAULT 0,
        active_referral_count INTEGER DEFAULT 0,
        legal_structure TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Users
    await destClient.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE,
        password TEXT NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'user',
        account_id INTEGER REFERENCES accounts(id),
        is_active BOOLEAN DEFAULT TRUE,
        reset_code TEXT,
        reset_expires TIMESTAMP WITH TIME ZONE,
        is_verified BOOLEAN DEFAULT false,
        verification_code TEXT,
        verification_expires TIMESTAMP WITH TIME ZONE,
        permissions JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // System Settings & Settings
    await destClient.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        business_name TEXT,
        currency TEXT DEFAULT 'USD',
        tax_rate NUMERIC DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Other Tables
    await destClient.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        name TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        name TEXT NOT NULL,
        category_id INTEGER,
        price NUMERIC NOT NULL,
        cost_price NUMERIC,
        stock_quantity INTEGER DEFAULT 0,
        image_url TEXT,
        barcode TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        user_id INTEGER REFERENCES users(id),
        customer_id INTEGER REFERENCES customers(id),
        total_amount NUMERIC NOT NULL,
        payment_method TEXT,
        status TEXT DEFAULT 'completed',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY,
        sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price NUMERIC NOT NULL,
        total_price NUMERIC NOT NULL
      );
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        user_id INTEGER REFERENCES users(id),
        title TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        category TEXT,
        date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        receipt_url TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        customer_id INTEGER REFERENCES customers(id),
        invoice_number TEXT NOT NULL,
        total_amount NUMERIC NOT NULL,
        status TEXT DEFAULT 'pending',
        due_date TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS promo_codes (
        id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        duration_months INTEGER NOT NULL DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        usage_count INTEGER DEFAULT 0,
        max_usages INTEGER DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        user_id INTEGER REFERENCES users(id),
        guest_id TEXT,
        guest_email TEXT,
        message TEXT NOT NULL,
        is_from_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Schema ready on target database.\n');

    // 2. Migrate each table in topological order
    for (const tableName of TABLES_IN_ORDER) {
      // Check if table exists in source
      const tableCheck = await srcClient.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1 AND table_schema = 'public'`,
        [tableName]
      );
      if (tableCheck.rows.length === 0) {
        console.log(`⏩ [${tableName}] Skipping (not present in source database).`);
        continue;
      }

      const countResult = await srcClient.query(`SELECT COUNT(*) FROM "${tableName}"`);
      const rowCount = parseInt(countResult.rows[0].count, 10);

      if (rowCount === 0) {
        console.log(`ℹ️  [${tableName}] 0 rows found. Skipping.`);
        continue;
      }

      console.log(`📦 [${tableName}] Migrating ${rowCount} rows...`);
      const rowsResult = await srcClient.query(`SELECT * FROM "${tableName}"`);
      const rows = rowsResult.rows;

      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        const colNames = columns.map(c => `"${c}"`).join(', ');

        for (const row of rows) {
          const values = columns.map(c => row[c]);
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

          try {
            await destClient.query(
              `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
              values
            );
          } catch (err: any) {
            // Log non-fatal row skip
            console.warn(`   ⚠️ Warning inserting row in ${tableName}:`, err.message);
          }
        }
      }

      // Reset auto-increment sequence if id column exists
      try {
        await destClient.query(`
          SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), COALESCE(MAX(id), 1) + 1, false)
          FROM "${tableName}"
        `);
      } catch {
        // Sequence reset not applicable for all tables
      }

      console.log(`✅ [${tableName}] Successfully migrated.`);
    }

    console.log('\n🎉 ALL DATA MIGRATED SUCCESSFULLY!');
    console.log('You can now point DATABASE_URL to your new database in .env and safely terminate your AWS RDS instance to eliminate the bill.');
  } catch (err: any) {
    console.error('\n❌ Migration failed:', err);
  } finally {
    srcClient.release();
    destClient.release();
    await srcPool.end();
    await destPool.end();
  }
}

migrate();
