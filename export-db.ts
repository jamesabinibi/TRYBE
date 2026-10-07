import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

/**
 * Gryndee Database Exporter
 * Connects to your AWS RDS database and exports all tables and data
 * into a standard SQL file: gryndee_backup.sql
 *
 * Usage:
 *   npx tsx export-db.ts
 */

const poolConfig: pg.PoolConfig = {
  host: process.env.AWS_DB_HOST || 'gryndee-db.cevskqcic97b.us-east-1.rds.amazonaws.com',
  port: parseInt(process.env.AWS_DB_PORT || '5432'),
  user: process.env.AWS_DB_USER || 'postgres',
  password: process.env.AWS_DB_PASSWORD,
  database: process.env.AWS_DB_NAME || 'postgres',
  ssl: { rejectUnauthorized: false }
};

const pool = new Pool(poolConfig);

const TABLES_ORDER = [
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
  'activity_logs'
];

async function exportDatabase() {
  const outputFile = path.resolve(process.cwd(), 'gryndee_backup.sql');
  console.log('📡 Connecting to AWS RDS:', poolConfig.host);

  const client = await pool.connect();
  const writeStream = fs.createWriteStream(outputFile, { encoding: 'utf8' });

  writeStream.write(`-- ================================================\n`);
  writeStream.write(`-- Gryndee Database Backup\n`);
  writeStream.write(`-- Export Date: ${new Date().toISOString()}\n`);
  writeStream.write(`-- Source: ${poolConfig.host}\n`);
  writeStream.write(`-- ================================================\n\n`);

  try {
    for (const tableName of TABLES_ORDER) {
      // Check if table exists
      const checkRes = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1 AND table_schema = 'public'`,
        [tableName]
      );
      if (checkRes.rows.length === 0) {
        console.log(`⏩ [${tableName}] Skipping (does not exist in source).`);
        continue;
      }

      console.log(`📦 Exporting [${tableName}]...`);
      writeStream.write(`-- Table: ${tableName}\n`);

      const rowsResult = await client.query(`SELECT * FROM "${tableName}"`);
      const rows = rowsResult.rows;

      if (rows.length === 0) {
        console.log(`   ℹ️  0 rows.`);
        writeStream.write(`-- No rows for ${tableName}\n\n`);
        continue;
      }

      console.log(`   ✅ ${rows.length} rows exported.`);
      const columns = Object.keys(rows[0]);
      const colNames = columns.map(c => `"${c}"`).join(', ');

      for (const row of rows) {
        const valStrings = columns.map(c => {
          const v = row[c];
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return v.toString();
          if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
          if (v instanceof Date) return `'${v.toISOString()}'`;
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
          return `'${v.toString().replace(/'/g, "''")}'`;
        });

        writeStream.write(
          `INSERT INTO "${tableName}" (${colNames}) VALUES (${valStrings.join(', ')}) ON CONFLICT DO NOTHING;\n`
        );
      }
      writeStream.write('\n');
    }

    writeStream.end();
    console.log(`\n🎉 Backup saved successfully to: ${outputFile}`);
    console.log(`File size: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`);
  } catch (err: any) {
    console.error('❌ Export failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

exportDatabase();
