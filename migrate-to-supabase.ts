import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const srcPool = new Pool({
  host: process.env.AWS_DB_HOST || 'gryndee-db.cevskqcic97b.us-east-1.rds.amazonaws.com',
  port: parseInt(process.env.AWS_DB_PORT || '5432'),
  user: process.env.AWS_DB_USER || 'postgres',
  password: process.env.AWS_DB_PASSWORD,
  database: process.env.AWS_DB_NAME || 'postgres',
  ssl: { rejectUnauthorized: false }
});

const destPool = new Pool({
  host: 'db.crhfiaeezettshwivzig.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'Ab@midele1980',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

const TABLES_ORDER = [
  'accounts',
  'users',
  'settings',
  'system_settings',
  'categories',
  'products',
  'product_variants',
  'product_images',
  'services',
  'customers',
  'sales',
  'sale_items',
  'expenses',
  'bookkeeping',
  'notifications',
  'legal_documents',
  'promo_codes',
  'promo_code_usages',
  'automated_email_templates',
  'sent_automated_emails',
  'chat_messages'
];

async function syncSchema() {
  console.log('🔄 Step 1: Replicating table schemas to Supabase...');
  const srcClient = await srcPool.connect();
  const destClient = await destPool.connect();

  try {
    for (const tableName of TABLES_ORDER) {
      // Check if table exists in source
      const tableCheck = await srcClient.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1 AND table_schema = 'public'`,
        [tableName]
      );
      if (tableCheck.rows.length === 0) continue;

      // Get columns
      const colRes = await srcClient.query(
        `SELECT column_name, data_type, udt_name, column_default, is_nullable 
         FROM information_schema.columns 
         WHERE table_name = $1 AND table_schema = 'public' 
         ORDER BY ordinal_position`,
        [tableName]
      );

      // Get primary key
      const pkRes = await srcClient.query(
        `SELECT kcu.column_name 
         FROM information_schema.table_constraints tc 
         JOIN information_schema.key_column_usage kcu 
           ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema 
         WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1 AND tc.table_schema = 'public'`,
        [tableName]
      );
      const pks = pkRes.rows.map(r => `"${r.column_name}"`);

      const colDefs = colRes.rows.map(col => {
        let type = col.udt_name.toUpperCase();
        if (type === 'INT4') type = 'INTEGER';
        else if (type === 'INT8') type = 'BIGINT';
        else if (type === 'INT2') type = 'SMALLINT';
        else if (type === 'BOOL') type = 'BOOLEAN';
        else if (type === 'VARCHAR') type = 'VARCHAR';
        else if (type === 'TEXT') type = 'TEXT';
        else if (type === 'TIMESTAMPTZ') type = 'TIMESTAMP WITH TIME ZONE';
        else if (type === 'TIMESTAMP') type = 'TIMESTAMP';
        else if (type === 'JSONB') type = 'JSONB';
        else if (type === 'NUMERIC') type = 'NUMERIC';
        else if (type === 'BYTEA') type = 'BYTEA';

        let def = `"${col.column_name}" ${type}`;
        if (col.column_default) {
          // Keep defaults if not nextval sequence
          if (!col.column_default.includes('nextval')) {
            def += ` DEFAULT ${col.column_default}`;
          }
        }
        if (col.is_nullable === 'NO') {
          def += ' NOT NULL';
        }
        return def;
      });

      if (pks.length > 0) {
        colDefs.push(`PRIMARY KEY (${pks.join(', ')})`);
      }

      const createSql = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${colDefs.join(',\n  ')}\n);`;
      await destClient.query(createSql);
      console.log(`   ✅ Schema ready: ${tableName}`);
    }
  } finally {
    srcClient.release();
    destClient.release();
  }
}

async function syncData() {
  console.log('\n🚀 Step 2: Copying table data to Supabase in batches...');
  const srcClient = await srcPool.connect();
  const destClient = await destPool.connect();

  try {
    for (const tableName of TABLES_ORDER) {
      // Check total rows in source
      const countRes = await srcClient.query(`SELECT COUNT(*) FROM "${tableName}"`);
      const totalRows = parseInt(countRes.rows[0].count, 10);

      if (totalRows === 0) {
        console.log(`ℹ️  [${tableName}] 0 rows. Skipping.`);
        continue;
      }

      console.log(`📦 [${tableName}] Total rows to copy: ${totalRows.toLocaleString()}`);

      // Determine batch size (smaller for product_images due to large blobs)
      const batchSize = tableName === 'product_images' ? 10 : 500;
      let offset = 0;

      while (offset < totalRows) {
        const rowsRes = await srcClient.query(
          `SELECT * FROM "${tableName}" ORDER BY 1 LIMIT $1 OFFSET $2`,
          [batchSize, offset]
        );
        const rows = rowsRes.rows;
        if (rows.length === 0) break;

        const columns = Object.keys(rows[0]);
        const colNames = columns.map(c => `"${c}"`).join(', ');

        // Multi-row INSERT
        const values: any[] = [];
        const valuePlaceholders: string[] = [];

        let paramIdx = 1;
        for (const row of rows) {
          const rowPlaceholders: string[] = [];
          for (const col of columns) {
            values.push(row[col]);
            rowPlaceholders.push(`$${paramIdx++}`);
          }
          valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
        }

        const insertSql = `
          INSERT INTO "${tableName}" (${colNames}) 
          VALUES ${valuePlaceholders.join(',\n')} 
          ON CONFLICT DO NOTHING
        `;

        await destClient.query(insertSql, values);
        offset += rows.length;

        const pct = Math.min(100, Math.round((offset / totalRows) * 100));
        process.stdout.write(`   ⏳ [${tableName}] ${offset.toLocaleString()} / ${totalRows.toLocaleString()} (${pct}%)\r`);
      }

      console.log(`\n   ✅ [${tableName}] Completed (${totalRows.toLocaleString()} rows).`);

      // Reset auto-increment sequence if id column exists
      try {
        await destClient.query(`
          SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), COALESCE(MAX(id), 1) + 1, false)
          FROM "${tableName}"
        `);
      } catch {}
    }

    console.log('\n🎉 ALL DATA MIGRATED SUCCESSFULLY TO SUPABASE!');
  } finally {
    srcClient.release();
    destClient.release();
    await srcPool.end();
    await destPool.end();
  }
}

async function run() {
  try {
    await syncSchema();
    await syncData();
  } catch (err: any) {
    console.error('\n❌ Migration error:', err.message || err);
  }
}

run();
