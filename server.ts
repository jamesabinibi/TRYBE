import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from 'fs';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { GoogleGenAI, Type } from "@google/genai";
import { v2 as cloudinary } from 'cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Cloudinary Config
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('[INIT] Cloudinary initialized');
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Cloudinary Helper
async function uploadToCloudinary(base64Data: string, folder: string = 'products') {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !base64Data || !base64Data.startsWith('data:image')) {
    return base64Data;
  }
  try {
    const result = await cloudinary.uploader.upload(base64Data, {
      folder,
      resource_type: 'auto',
      transformation: [
        { width: 800, crop: "limit" },
        { quality: "auto" },
        { fetch_format: "auto" }
      ]
    });
    console.log(`[CLOUDINARY] Uploaded to: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    console.error('[CLOUDINARY] Upload failed:', error);
    return base64Data;
  }
}

console.log(`[INIT] Starting server at ${new Date().toISOString()}`);
console.log(`[INIT] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[INIT] VERCEL: ${process.env.VERCEL}`);

let supabase: any;
try {
  if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
    console.error('[INIT] ERROR: Invalid or missing SUPABASE_URL');
  } else if (!supabaseAnonKey) {
    console.error('[INIT] ERROR: Missing SUPABASE_ANON_KEY');
  } else {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log(`[INIT] Supabase client initialized with URL: ${supabaseUrl}`);
  }
} catch (err) {
  console.error('[INIT] CRITICAL: Failed to initialize Supabase client:', err);
}

// Email transporter setup
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function isValidEmail(email: string) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// AWS RDS Pool
const { Pool } = pg;
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

// Only create pool if we have a password, otherwise use a dummy or handle gracefully
const pool = new Pool(poolConfig);

// Handle pool errors to prevent process crash
pool.on('error', (err) => {
  console.error('[RDS] Unexpected error on idle client', err);
});

async function initAwsDb() {
  if (!process.env.AWS_DB_PASSWORD) {
    console.warn('[DB] AWS_DB_PASSWORD not set. Skipping RDS initialization.');
    return;
  }
  try {
    const client = await pool.connect();
    console.log('[DB] Connected to AWS RDS. Running schema check...');
    
    // Full schema check/init
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Ensure owner_id exists if table was created without it
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='owner_id') THEN
          ALTER TABLE accounts ADD COLUMN owner_id INTEGER;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE,
        password TEXT NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'user',
        account_id INTEGER REFERENCES accounts(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Ensure users columns exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='username') THEN
          ALTER TABLE users ADD COLUMN username TEXT UNIQUE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='name') THEN
          ALTER TABLE users ADD COLUMN name TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') THEN
          ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='account_id') THEN
          ALTER TABLE users ADD COLUMN account_id INTEGER REFERENCES accounts(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='reset_code') THEN
          ALTER TABLE users ADD COLUMN reset_code TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='reset_expires') THEN
          ALTER TABLE users ADD COLUMN reset_expires TIMESTAMP WITH TIME ZONE;
        END IF;
      END $$;
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        business_name TEXT DEFAULT 'Gryndee',
        currency TEXT DEFAULT 'NGN',
        vat_enabled BOOLEAN DEFAULT FALSE,
        low_stock_threshold INTEGER DEFAULT 5,
        logo_url TEXT,
        brand_color TEXT DEFAULT '#10b981',
        slogan TEXT,
        address TEXT,
        email TEXT,
        website TEXT,
        phone_number TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        name TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Ensure categories columns exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='account_id') THEN
          ALTER TABLE categories ADD COLUMN account_id INTEGER REFERENCES accounts(id);
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        category_id INTEGER REFERENCES categories(id),
        name TEXT NOT NULL,
        description TEXT,
        cost_price DECIMAL(12, 2) DEFAULT 0,
        selling_price DECIMAL(12, 2) DEFAULT 0,
        supplier_name TEXT,
        unit TEXT DEFAULT 'Pieces',
        pieces_per_unit INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Ensure products columns exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='supplier_name') THEN
          ALTER TABLE products ADD COLUMN supplier_name TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='unit') THEN
          ALTER TABLE products ADD COLUMN unit TEXT DEFAULT 'Pieces';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='pieces_per_unit') THEN
          ALTER TABLE products ADD COLUMN pieces_per_unit INTEGER DEFAULT 1;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS product_variants (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        size TEXT,
        color TEXT,
        sku TEXT,
        quantity INTEGER DEFAULT 0,
        low_stock_threshold INTEGER DEFAULT 5,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Ensure product_variants columns exist
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_variants' AND column_name='low_stock_threshold') THEN
          ALTER TABLE product_variants ADD COLUMN low_stock_threshold INTEGER DEFAULT 5;
        END IF;
      END $$;
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        customer_id INTEGER,
        staff_id INTEGER REFERENCES users(id),
        total_amount DECIMAL(12, 2) DEFAULT 0,
        cost_price_total DECIMAL(12, 2) DEFAULT 0,
        discount_amount DECIMAL(12, 2) DEFAULT 0,
        vat_amount DECIMAL(12, 2) DEFAULT 0,
        payment_method TEXT,
        status TEXT DEFAULT 'completed',
        customer_name TEXT,
        customer_phone TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY,
        sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        variant_id INTEGER REFERENCES product_variants(id),
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(12, 2) NOT NULL,
        total_price DECIMAL(12, 2) NOT NULL,
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

      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        category TEXT,
        amount DECIMAL(12, 2) NOT NULL,
        description TEXT,
        date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS product_images (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        is_primary BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        name TEXT NOT NULL,
        description TEXT,
        price DECIMAL(12, 2) DEFAULT 0,
        duration_minutes INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bookkeeping (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        type TEXT NOT NULL, -- 'income' or 'expense'
        category TEXT,
        amount DECIMAL(12, 2) NOT NULL,
        description TEXT,
        reference_id TEXT, -- sale_id or expense_id
        date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id),
        user_id INTEGER REFERENCES users(id),
        title TEXT,
        message TEXT,
        type TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[DB] AWS RDS Schema check complete.');
    
    // Ensure default admin exists
    const { rows: existingAdmin } = await client.query('SELECT id FROM users WHERE username = $1 LIMIT 1', ['admin']);
    if (existingAdmin.length === 0) {
      console.log('[DB] No default admin found. Creating admin/admin123...');
      // Create a default account for the admin
      const { rows: accounts } = await client.query('INSERT INTO accounts (name) VALUES ($1) RETURNING id', ['Gryndee Demo Account']);
      const accountId = accounts[0].id;
      
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await client.query(
        'INSERT INTO users (account_id, username, email, password, role, name) VALUES ($1, $2, $3, $4, $5, $6)',
        [accountId, 'admin', 'admin@gryndee.com', hashedPassword, 'admin', 'Demo Admin']
      );
      
      // Create default settings for this account
      await client.query(
        'INSERT INTO settings (account_id, business_name, currency) VALUES ($1, $2, $3)',
        [accountId, 'Gryndee Demo', 'NGN']
      );
      
      console.log('[DB] Default admin created: admin / admin123');
    }

    client.release();
  } catch (err) {
    console.error('[DB] AWS RDS connection failed:', err);
  }
}

initAwsDb();

async function sendEmail(to: string, subject: string, text: string, html?: string) {
  console.log(`[EMAIL] Sending to ${to}: ${subject}`);
  try {
    // For demo purposes, we'll log the email content if no real credentials are provided
    if (!process.env.SMTP_USER || process.env.SMTP_USER === 'mock_user') {
      console.log('--- MOCK EMAIL START ---');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Body: ${text}`);
      console.log('--- MOCK EMAIL END ---');
      return { messageId: 'mock-id-' + Date.now() };
    }

    const info = await transporter.sendMail({
      from: `"Gryndee" <${process.env.SMTP_FROM || 'noreply@gryndee.com'}>`,
      to,
      subject,
      text,
      html: html || text,
    });
    console.log(`[EMAIL] Sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`[EMAIL] Failed to send:`, error);
    throw error;
  }
}

async function createServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Trailing slash middleware for API
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') && req.path.length > 1 && req.path.endsWith('/')) {
      const query = req.url.slice(req.path.length);
      const safepath = req.path.slice(0, -1);
      req.url = safepath + query;
    }
    next();
  });

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.method === 'POST') {
      console.log('Request Headers:', JSON.stringify(req.headers, null, 2));
      console.log('Request Body Keys:', Object.keys(req.body));
    }
    next();
  });

  // Data Migration Tool
  app.post("/api/admin/migrate", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role !== 'super_admin') {
        return res.status(403).json({ error: "Only superadmin can run migration" });
      }

      if (!supabase || !process.env.AWS_DB_PASSWORD) {
        return res.status(500).json({ error: "Both Supabase and RDS must be configured" });
      }

      console.log('[MIGRATE] Starting data migration from Supabase to RDS...');
      const results: any = {};

      // 1. Migrate Accounts
      const { data: accounts } = await supabase.from('accounts').select('*');
      if (accounts) {
        console.log(`[MIGRATE] Migrating ${accounts.length} accounts...`);
        for (const acc of accounts) {
          await pool.query(
            'INSERT INTO accounts (id, name, owner_id, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, owner_id = EXCLUDED.owner_id',
            [acc.id, acc.name, acc.owner_id, acc.created_at]
          );
        }
        results.accounts = accounts.length;
      }

      // 2. Migrate Users
      const { data: users } = await supabase.from('users').select('*');
      if (users) {
        console.log(`[MIGRATE] Migrating ${users.length} users...`);
        for (const u of users) {
          await pool.query(
            'INSERT INTO users (id, email, username, password, name, role, account_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, username = EXCLUDED.username, password = EXCLUDED.password, name = EXCLUDED.name, role = EXCLUDED.role, account_id = EXCLUDED.account_id',
            [u.id, u.email, u.username, u.password, u.name, u.role, u.account_id, u.created_at]
          );
        }
        results.users = users.length;
      }

      // 3. Migrate Categories
      const { data: categories } = await supabase.from('categories').select('*');
      if (categories) {
        for (const cat of categories) {
          await pool.query(
            'INSERT INTO categories (id, account_id, name, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
            [cat.id, cat.account_id, cat.name, cat.created_at]
          );
        }
        results.categories = categories.length;
      }

      // 4. Migrate Products
      const { data: products } = await supabase.from('products').select('*');
      if (products) {
        for (const p of products) {
          await pool.query(
            'INSERT INTO products (id, account_id, category_id, name, description, cost_price, selling_price, supplier_name, unit, pieces_per_unit, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING',
            [p.id, p.account_id, p.category_id, p.name, p.description, p.cost_price, p.selling_price, p.supplier_name, p.unit, p.pieces_per_unit, p.created_at]
          );
        }
        results.products = products.length;
      }

      // 5. Migrate Variants
      const { data: variants } = await supabase.from('product_variants').select('*');
      if (variants) {
        for (const v of variants) {
          await pool.query(
            'INSERT INTO product_variants (id, product_id, size, color, sku, quantity, low_stock_threshold, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING',
            [v.id, v.product_id, v.size, v.color, v.sku, v.quantity, v.low_stock_threshold, v.created_at]
          );
        }
        results.variants = variants.length;
      }

      // 6. Migrate Settings
      const { data: settings } = await supabase.from('settings').select('*');
      if (settings) {
        for (const s of settings) {
          await pool.query(
            'INSERT INTO settings (id, account_id, business_name, currency, vat_enabled, low_stock_threshold, logo_url, brand_color, slogan, address, email, website, phone_number, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) ON CONFLICT (id) DO NOTHING',
            [s.id, s.account_id, s.business_name, s.currency, s.vat_enabled, s.low_stock_threshold, s.logo_url, s.brand_color, s.slogan, s.address, s.email, s.website, s.phone_number, s.created_at]
          );
        }
        results.settings = settings.length;
      }

      // 7. Migrate Customers
      const { data: customers } = await supabase.from('customers').select('*');
      if (customers) {
        for (const c of customers) {
          await pool.query(
            'INSERT INTO customers (id, account_id, name, email, phone, address, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
            [c.id, c.account_id, c.name, c.email, c.phone, c.address, c.created_at]
          );
        }
        results.customers = customers.length;
      }

      // 8. Migrate Sales
      const { data: sales } = await supabase.from('sales').select('*');
      if (sales) {
        for (const s of sales) {
          await pool.query(
            'INSERT INTO sales (id, account_id, customer_id, staff_id, total_amount, cost_price_total, discount_amount, vat_amount, payment_method, status, customer_name, customer_phone, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) ON CONFLICT (id) DO NOTHING',
            [s.id, s.account_id, s.customer_id, s.staff_id, s.total_amount, s.cost_price_total, s.discount_amount, s.vat_amount, s.payment_method, s.status, s.customer_name, s.customer_phone, s.created_at]
          );
        }
        results.sales = sales.length;
      }

      // 9. Migrate Sale Items
      const { data: saleItems } = await supabase.from('sale_items').select('*');
      if (saleItems) {
        for (const si of saleItems) {
          await pool.query(
            'INSERT INTO sale_items (id, sale_id, product_id, variant_id, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
            [si.id, si.sale_id, si.product_id, si.variant_id, si.quantity, si.unit_price, si.total_price]
          );
        }
        results.sale_items = saleItems.length;
      }

      // 10. Migrate Expenses
      const { data: expenses } = await supabase.from('expenses').select('*');
      if (expenses) {
        for (const e of expenses) {
          await pool.query(
            'INSERT INTO expenses (id, account_id, category, amount, description, date, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
            [e.id, e.account_id, e.category, e.amount, e.description, e.date, e.created_at]
          );
        }
        results.expenses = expenses.length;
      }

      console.log('[MIGRATE] Migration completed successfully.');
      res.json({ status: "success", results });
    } catch (err: any) {
      console.error('[MIGRATE] Migration failed:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", version: "2.4.9-stable", time: new Date().toISOString() });
  });

  // Helper to get account_id from headers or user_id
  const getAccountId = async (req: any) => {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      console.log(`[AUTH] Missing x-user-id header for ${req.method} ${req.url}`);
      return null;
    }

    // Handle virtual superadmin
    if (userId === '0') {
      const superAdminPass = process.env.SUPERADMIN_PASSWORD;
      if (!superAdminPass) {
        console.error(`[AUTH] Virtual superadmin attempt but SUPERADMIN_PASSWORD not set`);
        return null;
      }
      
      console.log(`[AUTH] Virtual superadmin detected`);
      try {
        // Try RDS first
        if (process.env.AWS_DB_PASSWORD) {
          const { rows } = await pool.query('SELECT id FROM accounts WHERE name = $1 LIMIT 1', ['System Admin']);
          let systemAccount = rows[0];
          if (!systemAccount) {
            const insertRes = await pool.query('INSERT INTO accounts (name) VALUES ($1) RETURNING id', ['System Admin']);
            systemAccount = insertRes.rows[0];
          }
          return { id: '0', account_id: systemAccount?.id || 0, role: 'super_admin' };
        }

        // Fallback to Supabase
        let { data: systemAccount } = await supabase.from('accounts').select('id').eq('name', 'System Admin').maybeSingle();
        if (!systemAccount) {
          const { data: newAcc, error: accErr } = await supabase.from('accounts').insert([{ name: 'System Admin' }]).select().single();
          if (accErr) {
            console.error(`[AUTH] Failed to create System Admin account:`, accErr);
            return { account_id: 0, role: 'super_admin' };
          }
          systemAccount = newAcc;
        }
        return { id: '0', account_id: systemAccount?.id || 0, role: 'super_admin' };
      } catch (e) {
        console.error(`[AUTH] Exception in virtual superadmin account lookup:`, e);
        return { id: '0', account_id: 0, role: 'super_admin' };
      }
    }
    
    try {
      // Try RDS first
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query('SELECT id, account_id, role FROM users WHERE id = $1', [userId]);
        if (rows.length > 0) {
          return rows[0];
        }
      }

      // Fallback to Supabase
      let { data: user, error } = await supabase.from('users').select('id, account_id, role').eq('id', userId).single();
      if (error || !user) {
        if (error?.code === 'PGRST116' || !user) {
          console.log(`[AUTH] User ID ${userId} not found in users table.`);
          return null;
        }
        console.error(`[AUTH] Failed to find user for ID ${userId}:`, error);
        return null;
      }

      return user;
    } catch (e) {
      console.error(`[AUTH] Exception in getAccountId for ID ${userId}:`, e);
      return null;
    }
  };

  // Database Setup
  app.get("/api/diag/schema", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const { data, error } = await supabase.rpc('exec_sql', { 
        sql_query: "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public'" 
      });
      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/diag/setup", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || (userInfo.role !== 'admin' && userInfo.role !== 'super_admin')) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Ensure RLS is disabled on all tables to avoid join issues
      const tablesToDisableRLS = [
        'accounts', 'users', 'categories', 'products', 'product_variants', 
        'product_images', 'sales', 'sale_items', 'expenses', 'customers', 
        'settings', 'notifications', 'services', 'bookkeeping'
      ];
      
      for (const table of tablesToDisableRLS) {
        await supabase.rpc('exec_sql', { sql_query: `ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;` }).catch(() => {});
      }

      const setupSql = `
-- 0. Accounts (Multi-tenancy)
CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 0.1 Users
CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'staff',
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrations for existing tables
DO $$ 
BEGIN 
  -- Add account_id to users
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='account_id') THEN
    ALTER TABLE users ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
  
  -- Add created_at to users if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='created_at') THEN
    ALTER TABLE users ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Ensure at least one account exists for orphaned data
  IF NOT EXISTS (SELECT 1 FROM accounts) THEN
    INSERT INTO accounts (name) VALUES ('Default Business');
  END IF;

  -- Link orphaned users to the first account
  UPDATE users SET account_id = (SELECT id FROM accounts LIMIT 1) WHERE account_id IS NULL AND role != 'super_admin';

  -- Add account_id to other tables if they exist but are missing it
  -- Categories
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='categories') AND 
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='account_id') THEN
    ALTER TABLE categories ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
    UPDATE categories SET account_id = (SELECT id FROM accounts LIMIT 1) WHERE account_id IS NULL;
  END IF;

  -- Products
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='products') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='account_id') THEN
      ALTER TABLE products ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
      UPDATE products SET account_id = (SELECT id FROM accounts LIMIT 1) WHERE account_id IS NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='unit') THEN
      ALTER TABLE products ADD COLUMN unit TEXT DEFAULT 'Pieces';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='pieces_per_unit') THEN
      ALTER TABLE products ADD COLUMN pieces_per_unit INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='product_type') THEN
      ALTER TABLE products ADD COLUMN product_type TEXT DEFAULT 'one';
    END IF;
  END IF;

  -- Sales
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='sales') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='account_id') THEN
      ALTER TABLE sales ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
      UPDATE sales SET account_id = (SELECT id FROM accounts LIMIT 1) WHERE account_id IS NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='discount_amount') THEN
      ALTER TABLE sales ADD COLUMN discount_amount DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='discount_percentage') THEN
      ALTER TABLE sales ADD COLUMN discount_percentage DECIMAL(5,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='vat_amount') THEN
      ALTER TABLE sales ADD COLUMN vat_amount DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='customer_name') THEN
      ALTER TABLE sales ADD COLUMN customer_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='customer_phone') THEN
      ALTER TABLE sales ADD COLUMN customer_phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='customer_email') THEN
      ALTER TABLE sales ADD COLUMN customer_email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='customer_address') THEN
      ALTER TABLE sales ADD COLUMN customer_address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='cost_price_total') THEN
      ALTER TABLE sales ADD COLUMN cost_price_total DECIMAL(12,2) DEFAULT 0;
    END IF;
    -- Add foreign keys if they are missing their constraints
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sales_staff_id_fkey') THEN
        ALTER TABLE sales ADD CONSTRAINT sales_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE SET NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sales_customer_id_fkey') THEN
        ALTER TABLE sales ADD CONSTRAINT sales_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
      END IF;
    END $$;
  END IF;

  -- Expenses
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='expenses') AND 
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='account_id') THEN
    ALTER TABLE expenses ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
    UPDATE expenses SET account_id = (SELECT id FROM accounts LIMIT 1) WHERE account_id IS NULL;
  END IF;

  -- Customers
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='customers') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='account_id') THEN
      ALTER TABLE customers ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
      UPDATE customers SET account_id = (SELECT id FROM accounts LIMIT 1) WHERE account_id IS NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='loyalty_points') THEN
      ALTER TABLE customers ADD COLUMN loyalty_points INTEGER DEFAULT 0;
    END IF;
  END IF;

  -- Settings
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='settings') AND 
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='account_id') THEN
    ALTER TABLE settings ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
    UPDATE settings SET account_id = (SELECT id FROM accounts LIMIT 1) WHERE account_id IS NULL;
  END IF;

  -- Product Variants
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='product_variants') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_variants' AND column_name='account_id') THEN
      ALTER TABLE product_variants ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_variants' AND column_name='low_stock_threshold') THEN
      ALTER TABLE product_variants ADD COLUMN low_stock_threshold INTEGER DEFAULT 5;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_variants' AND column_name='price_override') THEN
      ALTER TABLE product_variants ADD COLUMN price_override DECIMAL(12,2);
    END IF;
    -- Link to account of the parent product
    UPDATE product_variants pv SET account_id = (SELECT account_id FROM products p WHERE p.id = pv.product_id) WHERE account_id IS NULL;
    -- Fallback for orphaned variants
    UPDATE product_variants SET account_id = (SELECT id FROM accounts LIMIT 1) WHERE account_id IS NULL;
  END IF;

  -- Product Images
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='product_images') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_images' AND column_name='account_id') THEN
      ALTER TABLE product_images ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
    END IF;
    UPDATE product_images pi SET account_id = (SELECT account_id FROM products p WHERE p.id = pi.product_id) WHERE account_id IS NULL;
    UPDATE product_images SET account_id = (SELECT id FROM accounts LIMIT 1) WHERE account_id IS NULL;
  END IF;

  -- Services
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='services') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='account_id') THEN
      ALTER TABLE services ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
    END IF;
    UPDATE services SET account_id = (SELECT id FROM accounts LIMIT 1) WHERE account_id IS NULL;
  END IF;

  -- Sale Items
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='sale_items') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='account_id') THEN
      ALTER TABLE sale_items ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='service_id') THEN
      ALTER TABLE sale_items ADD COLUMN service_id BIGINT REFERENCES services(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='unit_price') THEN
      ALTER TABLE sale_items ADD COLUMN unit_price DECIMAL(12,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='cost_price') THEN
      ALTER TABLE sale_items ADD COLUMN cost_price DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='total_price') THEN
      ALTER TABLE sale_items ADD COLUMN total_price DECIMAL(12,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='profit') THEN
      ALTER TABLE sale_items ADD COLUMN profit DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='product_name') THEN
      ALTER TABLE sale_items ADD COLUMN product_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='service_name') THEN
      ALTER TABLE sale_items ADD COLUMN service_name TEXT;
    END IF;
    UPDATE sale_items si SET account_id = (SELECT account_id FROM sales s WHERE s.id = si.sale_id) WHERE account_id IS NULL;
    UPDATE sale_items SET account_id = (SELECT id FROM accounts LIMIT 1) WHERE account_id IS NULL;
  END IF;

  -- Sales Migration
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='sales') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='cost_price_total') THEN
      ALTER TABLE sales ADD COLUMN cost_price_total DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='discount_amount') THEN
      ALTER TABLE sales ADD COLUMN discount_amount DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='discount_percentage') THEN
      ALTER TABLE sales ADD COLUMN discount_percentage DECIMAL(5,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='vat_amount') THEN
      ALTER TABLE sales ADD COLUMN vat_amount DECIMAL(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='customer_id') THEN
      ALTER TABLE sales ADD COLUMN customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='staff_id') THEN
      ALTER TABLE sales ADD COLUMN staff_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- Fix unique constraint on invoice_number to be per account
    DO $$
    DECLARE
        constraint_name TEXT;
    BEGIN
        SELECT conname INTO constraint_name
        FROM pg_constraint
        WHERE conrelid = 'sales'::regclass AND contype = 'u' AND conkey = (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid = 'sales'::regclass AND attname = 'invoice_number');
        
        IF constraint_name IS NOT NULL THEN
            EXECUTE 'ALTER TABLE sales DROP CONSTRAINT ' || constraint_name;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'sales'::regclass AND contype = 'u' AND conkey = (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid = 'sales'::regclass AND attname IN ('account_id', 'invoice_number'))) THEN
            ALTER TABLE sales ADD CONSTRAINT sales_account_invoice_unique UNIQUE (account_id, invoice_number);
        END IF;
    EXCEPTION WHEN OTHERS THEN
    END $$;
  END IF;

  -- Notifications
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='notifications') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='account_id') THEN
      ALTER TABLE notifications ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
      UPDATE notifications SET account_id = (SELECT id FROM accounts LIMIT 1) WHERE account_id IS NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='user_id') THEN
      ALTER TABLE notifications ADD COLUMN user_id BIGINT REFERENCES users(id) ON DELETE CASCADE;
      -- Try to link to a user if possible, otherwise first user in account
      UPDATE notifications n SET user_id = (SELECT id FROM users u WHERE u.account_id = n.account_id LIMIT 1) WHERE user_id IS NULL;
    END IF;
  END IF;

  -- Bookkeeping Migration
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='bookkeeping') THEN
    CREATE TABLE bookkeeping (
      id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      nature TEXT,
      amount DECIMAL(12,2) NOT NULL,
      description TEXT,
      date DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  ELSE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookkeeping' AND column_name='nature') THEN
      ALTER TABLE bookkeeping ADD COLUMN nature TEXT;
    END IF;
  END IF;

  -- Settings Migration (brand_color)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='settings') AND 
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='brand_color') THEN
    ALTER TABLE settings ADD COLUMN brand_color TEXT DEFAULT '#10b981';
  END IF;

END $$;

-- 1. Categories
CREATE TABLE IF NOT EXISTS categories (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, name)
);

-- 2. Products
CREATE TABLE IF NOT EXISTS products (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT,
  cost_price DECIMAL(12,2) DEFAULT 0,
  selling_price DECIMAL(12,2) DEFAULT 0,
  supplier_name TEXT,
  unit TEXT DEFAULT 'Pieces',
  pieces_per_unit INTEGER DEFAULT 1,
  product_type TEXT DEFAULT 'one',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Product Variants
CREATE TABLE IF NOT EXISTS product_variants (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  size TEXT,
  color TEXT,
  quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  price_override DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Product Images
CREATE TABLE IF NOT EXISTS product_images (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  image_data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Services
CREATE TABLE IF NOT EXISTS services (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(12,2) NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Settings
CREATE TABLE IF NOT EXISTS settings (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  business_name TEXT DEFAULT 'Gryndee',
  currency TEXT DEFAULT 'NGN',
  vat_enabled BOOLEAN DEFAULT false,
  low_stock_threshold INTEGER DEFAULT 5,
  logo_url TEXT,
  brand_color TEXT DEFAULT '#10b981',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id)
);

-- 7. Sales
CREATE TABLE IF NOT EXISTS sales (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,
  total_amount DECIMAL(12,2) NOT NULL,
  total_profit DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost_price_total DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  vat_amount DECIMAL(12,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',
  status TEXT DEFAULT 'Completed',
  staff_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  invoice_number TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Sale Items
CREATE TABLE IF NOT EXISTS sale_items (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  sale_id BIGINT REFERENCES sales(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  variant_id BIGINT REFERENCES product_variants(id) ON DELETE SET NULL,
  service_id BIGINT REFERENCES services(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  profit DECIMAL(12,2) NOT NULL DEFAULT 0,
  price_at_sale DECIMAL(12,2), -- Legacy
  cost_at_sale DECIMAL(12,2), -- Legacy
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Customers
CREATE TABLE IF NOT EXISTS customers (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  loyalty_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Bookkeeping
CREATE TABLE IF NOT EXISTS bookkeeping (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
      `;

      // Split SQL by semicolon and execute each statement
      const statements = setupSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const statement of statements) {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        if (error) {
          // Fallback if rpc exec_sql is not available (which is common)
          // In that case, we can't really run arbitrary SQL from the client easily without a custom function
          // But we can try to at least check if tables exist by querying them
          console.error(`[DIAG] Failed to execute statement:`, error);
          return res.status(500).json({ error: `Failed to execute SQL. Please run the SQL manually in Supabase SQL Editor. Error: ${error.message}` });
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Diagnostics
  app.get("/api/diag", async (req, res) => {
    const supabase_status = {
      connected: !!supabase,
      url_configured: !!supabaseUrl,
      key_configured: !!supabaseAnonKey,
      error: !supabaseUrl ? "Missing SUPABASE_URL" : (!supabaseAnonKey ? "Missing SUPABASE_ANON_KEY" : null)
    };

    if (!supabase) {
      return res.json({
        version: "2.4.9-stable",
        supabase_connected: false,
        supabase_status,
        tables: {},
        env: {
          cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME,
          gemini: !!process.env.GEMINI_API_KEY,
          smtp: !!process.env.SMTP_USER
        }
      });
    }
    
    const tables = [
      'users', 'products', 'categories', 'product_variants', 'product_images', 
      'sales', 'sale_items', 'expenses', 'customers', 'services', 'settings', 'notifications'
    ];
    
    const results: any = {};
    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('*', { count: 'exact', head: true }).limit(1);
        results[table] = {
          exists: !error || (error.code !== 'PGRST116' && !error.message.includes('relation') && !error.message.includes('does not exist')),
          error: error ? error.message : null
        };
      } catch (e: any) {
        results[table] = { exists: false, error: e.message };
      }
    }
    
    res.json({
      version: "2.4.9-stable",
      supabase_connected: true,
      supabase_status,
      tables: results,
      env: {
        cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME,
        gemini: !!process.env.GEMINI_API_KEY,
        smtp: !!process.env.SMTP_USER
      }
    });
  });

  // --- NEW FEATURES: EXPENSES, CUSTOMERS, SERVICES, AI (MOVED TO TOP OF API) ---

  app.get("/api/services", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.json([]);

      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('account_id', userInfo.account_id)
        .order('name', { ascending: true });

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('relation "services" does not exist')) {
          return res.json([]);
        }
        throw error;
      }
      res.json(data || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/services", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role === 'staff') return res.status(403).json({ error: "Forbidden" });

      const { name, description, price, duration_minutes, category } = req.body;
      const { data, error } = await supabase
        .from('services')
        .insert([{ 
          account_id: userInfo.account_id,
          name, description, price, duration_minutes, category 
        }])
        .select()
        .single();
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/services/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role === 'staff') return res.status(403).json({ error: "Forbidden" });

      const { name, description, price, duration_minutes, category } = req.body;
      const { data, error } = await supabase
        .from('services')
        .update({ name, description, price, duration_minutes, category })
        .eq('id', req.params.id)
        .eq('account_id', userInfo.account_id)
        .select()
        .single();
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/services/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role === 'staff') return res.status(403).json({ error: "Forbidden" });

      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', req.params.id)
        .eq('account_id', userInfo.account_id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Expenses API
  app.get("/api/expenses", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.json([]);

      let { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('account_id', userInfo.account_id)
        .order('date', { ascending: false });

      if (error) {
        console.error('[EXPENSES] Fetch error:', error);
        return res.status(500).json({ error: error.message });
      }
      res.json(data || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role === 'staff') return res.status(403).json({ error: "Forbidden" });

      const { category, amount, description, date } = req.body;
      const { data, error } = await supabase
        .from('expenses')
        .insert([{ 
          account_id: userInfo.account_id,
          category, amount, description, date: date || new Date().toISOString() 
        }])
        .select()
        .single();

      if (error) throw error;

      // Add to bookkeeping
      try {
        await supabase.from('bookkeeping').insert([{
          account_id: userInfo.account_id,
          type: 'Expense',
          nature: 'expense',
          amount: parseFloat(amount),
          description: `Expense - ${category}: ${description}`,
          date: date || new Date().toISOString().split('T')[0]
        }]);
      } catch (e) {
        console.error('[EXPENSES] Failed to add bookkeeping entry:', e);
      }

      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role === 'staff') return res.status(403).json({ error: "Forbidden" });

      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', req.params.id)
        .eq('account_id', userInfo.account_id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Customers API
  app.get("/api/customers", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.json([]);

      let { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('account_id', userInfo.account_id)
        .order('name', { ascending: true });

      if (error) {
        if (error.message?.includes('relation "customers" does not exist') || error.code === '42P01') {
          console.warn('[CUSTOMERS] Table "customers" not found. Returning empty array.');
          return res.json([]);
        }
        
        console.error('[CUSTOMERS] Fetch error:', error);
        return res.status(500).json({ error: error.message });
      }
      res.json(data || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/customers", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      const { name, phone, email } = req.body;
      const customerData: any = { 
        account_id: userInfo.account_id,
        name, phone, email
      };
      
      // Try with loyalty_points first, fallback if it fails
      let result = await supabase.from('customers').insert([customerData]).select().single();
      
      if (result.error && result.error.message.includes('loyalty_points')) {
        console.warn('[CUSTOMERS] loyalty_points column missing, retrying without it');
        result = await supabase.from('customers').insert([{ account_id: userInfo.account_id, name, phone, email }]).select().single();
      }

      if (result.error) throw result.error;
      res.json(result.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/customers/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      const { name, phone, email, address } = req.body;
      const { data, error } = await supabase
        .from('customers')
        .update({ name, phone, email, address })
        .eq('id', req.params.id)
        .eq('account_id', userInfo.account_id)
        .select()
        .single();
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', req.params.id)
        .eq('account_id', userInfo.account_id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/customers/:id/history", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items (
            *,
            product_variants!variant_id (
              *,
              products!product_id (name)
            )
          )
        `)
        .eq('customer_id', req.params.id)
        .eq('account_id', userInfo.account_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI Bank Transaction Processing
  app.post("/api/ai/process-transaction", async (req, res) => {
    console.log('[API] POST /api/ai/process-transaction called');
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[AI] GEMINI_API_KEY is missing');
      return res.status(500).json({ error: "AI configuration error: GEMINI_API_KEY is missing. Please add it to your environment variables." });
    }

    try {
      const { image } = req.body; // base64 image
      if (!image) return res.status(400).json({ error: "Image is required" });

      const ai = new GoogleGenAI({ apiKey });
      
      // Clean up base64 string if it contains prefix
      const base64Data = image.includes(',') ? image.split(',')[1] : image;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: `Extract the transaction amount, date, and narration from this bank screenshot. 
            Common formats include OPay, PalmPay, Kuda, or traditional bank receipts.
            - Amount: Look for the total amount transferred (e.g., ₦174,000.00). Return as a number without currency symbols.
            - Date: Look for the transaction date (e.g., 28/02/26). Return in YYYY-MM-DD format if possible, or as found.
            - Narration: Look for 'Remark', 'Description', 'Narration', or 'Reference'.
            Return as JSON.` },
            { inlineData: { mimeType: "image/png", data: base64Data } }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              amount: { type: Type.NUMBER },
              date: { type: Type.STRING },
              narration: { type: Type.STRING },
              confidence: { type: Type.NUMBER }
            }
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("AI returned empty response");
      
      console.log('[AI] Processed transaction:', text);
      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error('[AI] Transaction processing error:', error);
      res.status(500).json({ error: error.message || "Failed to process image with AI" });
    }
  });

  app.post("/api/ai/forecast", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "AI configuration error: GEMINI_API_KEY is missing." });
    }

    try {
      // Fetch data for AI context
      const { data: sales } = await supabase.from('sales').select('*, sale_items(*)').order('created_at', { ascending: false }).limit(50);
      const { data: products } = await supabase.from('products').select('*, product_variants(*)');
      const { data: expenses } = await supabase.from('expenses').select('*').order('date', { ascending: false }).limit(20);

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: `Analyze this business data and provide a strategic forecast.
            Sales Data: ${JSON.stringify(sales)}
            Inventory Data: ${JSON.stringify(products)}
            Expenses Data: ${JSON.stringify(expenses)}
            
            Return a JSON object with:
            - strategic_advice: A paragraph of actionable advice.
            - forecasted_revenue: A number representing expected revenue for next month.
            - restock_suggestions: Array of { product_name: string, suggested_quantity: number } for items running low or selling fast.
            ` }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              strategic_advice: { type: Type.STRING },
              forecasted_revenue: { type: Type.NUMBER },
              restock_suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    product_name: { type: Type.STRING },
                    suggested_quantity: { type: Type.NUMBER }
                  }
                }
              }
            }
          }
        }
      });

      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error('[AI] Forecast error:', error);
      res.status(500).json({ error: error.message });
    }
  });


  app.get("/api/test", async (req, res) => {
    const dbStatus = {
      rds: false,
      supabase: !!supabase,
      active_db: 'none'
    };

    if (process.env.AWS_DB_PASSWORD) {
      try {
        const client = await pool.connect();
        dbStatus.rds = true;
        dbStatus.active_db = 'AWS RDS';
        client.release();
      } catch (e) {
        console.error('[TEST] RDS Connection failed:', e);
      }
    }

    if (dbStatus.active_db === 'none' && supabase) {
      dbStatus.active_db = 'Supabase (Fallback)';
    }

    res.json({ 
      message: "Gryndee API is working", 
      version: "2.5.0", 
      database: dbStatus,
      env: process.env.NODE_ENV 
    });
  });

  // Categories (Moved to top)
  app.get("/api/categories", async (req, res) => {
    if (!supabase) return res.json([]);
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.json([]);

      let { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('account_id', userInfo.account_id)
        .order('name');

      if (error) {
        console.error('[CATEGORIES] Fetch error:', error);
        return res.status(500).json({ error: error.message });
      }
      res.json(data || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/categories", async (req, res) => {
    const { name } = req.body;
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role === 'staff') return res.status(403).json({ error: "Forbidden" });

      const { data, error } = await supabase
        .from('categories')
        .insert([{ account_id: userInfo.account_id, name }])
        .select()
        .single();
      if (error) throw error;
      res.json(data);
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Category already exists" });
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { id } = req.params;
    const { name } = req.body;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role === 'staff') return res.status(403).json({ error: "Forbidden" });

      const { data, error } = await supabase
        .from('categories')
        .update({ name })
        .eq('id', id)
        .eq('account_id', userInfo.account_id)
        .select()
        .single();
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { id } = req.params;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role === 'staff') return res.status(403).json({ error: "Forbidden" });

      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', id)
        .eq('account_id', userInfo.account_id);
      
      if (count && count > 0) {
        return res.status(400).json({ error: "Cannot delete category with associated products" });
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('account_id', userInfo.account_id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Auth
  const loginHandler = async (req: any, res: any) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username/Email and password are required" });
    }

    const trimmedUsername = username.trim();
    console.log(`[AUTH] Login attempt for: "${trimmedUsername}"`);
    
    if (!supabase) {
      console.warn('[AUTH] Supabase client not initialized, skipping Supabase check');
    } else {
      console.log(`[AUTH] Supabase client initialized`);
    }

    try {
      // Special case for superadmin if configured via env
      const superAdminPass = process.env.SUPERADMIN_PASSWORD;
    if (trimmedUsername.toLowerCase() === 'superadmin') {
      if (!superAdminPass) {
        console.error('[AUTH] Superadmin login attempt but SUPERADMIN_PASSWORD is not set in environment');
        return res.status(401).json({ error: "Superadmin login is disabled. Please set SUPERADMIN_PASSWORD environment variable." });
      }
      
      if (password === superAdminPass) {
        console.log(`[AUTH] Superadmin login via environment variable`);
        // Find or create a system account for superadmin
        let systemAccountId;
        if (process.env.AWS_DB_PASSWORD) {
          const { rows } = await pool.query('SELECT id FROM accounts WHERE name = $1 LIMIT 1', ['System Admin']);
          if (rows[0]) {
            systemAccountId = rows[0].id;
          } else {
            const insertRes = await pool.query('INSERT INTO accounts (name) VALUES ($1) RETURNING id', ['System Admin']);
            systemAccountId = insertRes.rows[0].id;
          }
        } else {
          let { data: systemAccount } = await supabase.from('accounts').select('id').eq('name', 'System Admin').maybeSingle();
          if (!systemAccount) {
            const { data: newAcc } = await supabase.from('accounts').insert([{ name: 'System Admin' }]).select().single();
            systemAccount = newAcc;
          }
          systemAccountId = systemAccount?.id;
        }
        
        return res.json({
          id: '0',
          username: 'superadmin',
          email: 'admin@gryndee.com',
          role: 'super_admin',
          name: 'System Super Admin',
          account_id: systemAccountId || 0
        });
      } else {
        return res.status(401).json({ error: "Invalid superadmin password" });
      }
    }

    let user;
    // Try RDS first
    if (process.env.AWS_DB_PASSWORD) {
        console.log(`[AUTH] Querying AWS RDS for: "${trimmedUsername}"`);
        const { rows } = await pool.query(
          'SELECT id, username, email, role, name, password, account_id FROM users WHERE username ILIKE $1 OR email ILIKE $1 LIMIT 1',
          [trimmedUsername]
        );
        user = rows[0];
      }

      // Fallback to Supabase if not found in RDS
      if (!user && supabase) {
        console.log(`[AUTH] Querying Supabase for: "${trimmedUsername}"`);
        let { data: supabaseUser, error: supabaseError } = await supabase
          .from('users')
          .select('id, username, email, role, name, password, account_id')
          .or(`username.ilike."${trimmedUsername}",email.ilike."${trimmedUsername}"`)
          .maybeSingle();

        if (supabaseError) {
          console.error(`[AUTH] Supabase query error:`, supabaseError);
        }
        user = supabaseUser;
      }

      if (user) {
        console.log(`[AUTH] User found: "${user.username}" (ID: ${user.id}, Role: ${user.role}, Account: ${user.account_id})`);
        
        // Auto-fix orphaned users if possible
        if (!user.account_id && user.role !== 'super_admin') {
          console.log(`[AUTH] Orphaned user detected, attempting to assign default account...`);
          const { data: firstAcc } = await supabase.from('accounts').select('id').limit(1).maybeSingle();
          if (firstAcc) {
            await supabase.from('users').update({ account_id: firstAcc.id }).eq('id', user.id);
            user.account_id = firstAcc.id;
            console.log(`[AUTH] Assigned user ${user.id} to account ${firstAcc.id}`);
          }
        }

        // Verify password
        let isPasswordValid = false;
        const storedPassword = user.password || '';
        if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
          isPasswordValid = await bcrypt.compare(password, storedPassword);
        } else {
          // Fallback for plain text passwords (legacy)
          isPasswordValid = storedPassword === password;
        }

        if (isPasswordValid) {
          console.log(`[AUTH] Login success: "${trimmedUsername}" (ID: ${user.id})`);
          // Don't send password back to client
          const { password: _, ...userWithoutPassword } = user;
          res.json(userWithoutPassword);
        } else {
          console.log(`[AUTH] Login failed: "${trimmedUsername}" - Password mismatch.`);
          res.status(401).json({ error: "Invalid username or password" });
        }
      } else {
        console.log(`[AUTH] Login failed: "${trimmedUsername}" - No user found with this username or email`);
        res.status(401).json({ error: "Invalid username or password" });
      }
    } catch (error) {
      console.error(`[AUTH] Login error:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  app.post(["/api/login", "/api/login/"], loginHandler);

  const registerHandler = async (req: any, res: any) => {
    const { username, email, password, name, role = 'staff' } = req.body;
    const trimmedUsername = username?.trim();
    const trimmedEmail = email?.trim()?.toLowerCase();
    
    if (!trimmedUsername || !trimmedEmail || !password) {
      return res.status(400).json({ error: "Username, email and password are required" });
    }

    if (!isValidEmail(trimmedEmail)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    console.log(`Register attempt: ${trimmedUsername} (${trimmedEmail})`);

    try {
      // Try RDS first
      if (process.env.AWS_DB_PASSWORD) {
        const { rows: existing } = await pool.query(
          'SELECT id FROM users WHERE username ILIKE $1 OR email ILIKE $2 LIMIT 1',
          [trimmedUsername, trimmedEmail]
        );

        if (existing.length > 0) {
          return res.status(400).json({ error: "Username or email already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // 1. Create Account
        const { rows: accountRows } = await pool.query(
          'INSERT INTO accounts (name) VALUES ($1) RETURNING id',
          [`${name || trimmedUsername}'s Business`]
        );
        const account = accountRows[0];

        // 2. Create User
        const { rows: userRows } = await pool.query(
          'INSERT INTO users (account_id, username, email, password, role, name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [account.id, trimmedUsername, trimmedEmail, hashedPassword, 'admin', name?.trim()]
        );
        const newUser = userRows[0];

        // 3. Update Account owner
        await pool.query('UPDATE accounts SET owner_id = $1 WHERE id = $2', [newUser.id, account.id]);

        // 4. Create settings
        await pool.query(
          'INSERT INTO settings (account_id, business_name, currency, brand_color) VALUES ($1, $2, $3, $4)',
          [account.id, name ? `${name}'s Business` : 'Gryndee', 'NGN', '#10b981']
        );

        console.log(`[AUTH] Register success (RDS): "${trimmedUsername}" (ID: ${newUser.id}, Account: ${account.id}).`);

        // Send email
        sendEmail(
          trimmedEmail,
          'Welcome to Gryndee!',
          `Hi ${name},\n\nYour account has been successfully created. You can now sign in with your username: ${trimmedUsername}.\n\nBest regards,\nThe Gryndee Team`,
          `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h1 style="color: #10b981;">Welcome to Gryndee!</h1>
            <p>Hi <strong>${name}</strong>,</p>
            <p>Your account has been successfully created. You can now sign in with your username: <strong>${trimmedUsername}</strong>.</p>
            <p>Gryndee helps you manage your inventory, sales, and bookkeeping with ease.</p>
            <p>Best regards,<br>The Gryndee Team</p>
          </div>
          `
        ).catch(err => console.error('Failed to send registration email:', err));

        return res.json({ id: newUser.id, username: trimmedUsername, email: trimmedEmail, account_id: account.id, role: 'admin' });
      }

      // Fallback to Supabase
      if (!supabase) {
        return res.status(500).json({ error: "Server configuration error: Supabase client is not initialized." });
      }

      // Check if exists case-insensitively
      const { data: existing, error: checkError } = await supabase
        .from('users')
        .select('id')
        .or(`username.ilike."${trimmedUsername}",email.ilike."${trimmedEmail}"`)
        .maybeSingle();

      if (checkError) {
        console.error('[AUTH] Registration check failed:', checkError);
        return res.status(500).json({ error: `Database error: ${checkError.message}` });
      }

      if (existing) {
        return res.status(400).json({ error: "Username or email already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // 1. Create Account first
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .insert([{ name: `${name || trimmedUsername}'s Business` }])
        .select()
        .single();

      if (accountError) {
        console.error('[AUTH] Account creation failed:', accountError);
        return res.status(500).json({ error: `Failed to create account: ${accountError.message}` });
      }

      // 2. Create User linked to Account
      const { data: newUser, error } = await supabase
        .from('users')
        .insert([{ 
          account_id: account.id,
          username: trimmedUsername, 
          email: trimmedEmail, 
          password: hashedPassword, 
          role: 'admin', // First user of a new account is ALWAYS admin
          name: name?.trim() 
        }])
        .select()
        .single();

      if (error) throw error;

      // 3. Update Account with owner_id
      await supabase.from('accounts').update({ owner_id: newUser.id }).eq('id', account.id);

      // 4. Create default settings for this account
      await supabase.from('settings').insert([{
        account_id: account.id,
        business_name: name ? `${name}'s Business` : 'Gryndee',
        currency: 'NGN',
        brand_color: '#10b981'
      }]);

      const userId = newUser.id;
      console.log(`[AUTH] Register success: "${trimmedUsername}" (ID: ${userId}, Account: ${account.id}).`);

      // Send confirmation email
      sendEmail(
        trimmedEmail,
        'Welcome to Gryndee!',
        `Hi ${name},\n\nYour account has been successfully created. You can now sign in with your username: ${trimmedUsername}.\n\nBest regards,\nThe Gryndee Team`,
        `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h1 style="color: #10b981;">Welcome to Gryndee!</h1>
          <p>Hi <strong>${name}</strong>,</p>
          <p>Your account has been successfully created. You can now sign in with your username: <strong>${trimmedUsername}</strong>.</p>
          <p>Gryndee helps you manage your inventory, sales, and bookkeeping with ease.</p>
          <p>Best regards,<br>The Gryndee Team</p>
        </div>
        `
      ).catch(err => console.error('Failed to send registration email:', err));

      // Create notification
      if (supabase) {
        await supabase
          .from('notifications')
          .insert([{
            user_id: userId,
            title: 'Welcome!',
            message: 'Your account has been successfully created. Welcome to Gryndee!',
            type: 'info'
          }]);
      }

      res.json(newUser);
    } catch (e: any) {
      console.error(`Register failed:`, e);
      res.status(400).json({ error: "Registration failed. Please try again." });
    }
  };

  app.post(["/api/register", "/api/register/"], registerHandler);

  app.post("/api/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 30 * 60000); // 30 mins

      let user;
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query('UPDATE users SET reset_code = $1, reset_expires = $2 WHERE email = $3 RETURNING username', [code, expires, email]);
        user = rows[0];
      } else {
        const { data, error } = await supabase
          .from('users')
          .update({ reset_code: code, reset_expires: expires.toISOString() })
          .eq('email', email)
          .select('username')
          .maybeSingle();
        if (error) throw error;
        user = data;
      }

      if (!user) {
        // Don't reveal if user exists for security
        return res.json({ message: "If an account exists with this email, a code has been sent." });
      }

      await sendEmail(
        email,
        'Password Reset Code - Gryndee',
        `Your password reset code is: ${code}. It expires in 30 minutes.`,
        `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #10b981;">Password Reset</h2>
          <p>You requested a password reset for your Gryndee account.</p>
          <p>Your confirmation code is:</p>
          <div style="background: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>This code will expire in 30 minutes.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <p>Best regards,<br>The Gryndee Team</p>
        </div>
        `
      );

      res.json({ message: "Confirmation code sent to " + email });
    } catch (error: any) {
      console.error('Forgot password error:', error);
      const errorMessage = error.message || "Failed to process request";
      res.status(500).json({ error: errorMessage });
    }
  });

  app.post("/api/reset-password", async (req, res) => {
    const { username, newPassword, code } = req.body;
    if (!username || !newPassword || !code) {
      return res.status(400).json({ error: "All fields are required" });
    }

    try {
      let user;
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query(
          'SELECT id, reset_code, reset_expires FROM users WHERE username = $1',
          [username]
        );
        user = rows[0];
      } else {
        const { data, error } = await supabase
          .from('users')
          .select('id, reset_code, reset_expires')
          .eq('username', username)
          .maybeSingle();
        if (error) throw error;
        user = data;
      }

      if (!user) return res.status(404).json({ error: "User not found" });
      
      if (user.reset_code !== code) return res.status(400).json({ error: "Invalid code" });
      
      const expires = new Date(user.reset_expires);
      if (expires < new Date()) return res.status(400).json({ error: "Code expired" });

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      if (process.env.AWS_DB_PASSWORD) {
        await pool.query(
          'UPDATE users SET password = $1, reset_code = NULL, reset_expires = NULL WHERE id = $2',
          [hashedPassword, user.id]
        );
      } else {
        const { error } = await supabase
          .from('users')
          .update({ password: hashedPassword, reset_code: null, reset_expires: null })
          .eq('id', user.id);
        if (error) throw error;
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // Test Email Route
  app.post("/api/admin/test-email", authenticateToken, async (req: any, res) => {
    if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    try {
      await sendEmail(
        email,
        'Gryndee SMTP Test',
        'This is a test email from your Gryndee application. If you received this, your SMTP settings are working correctly!',
        `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
            <h2 style="color: #10b981; margin-top: 0;">SMTP Test Successful!</h2>
            <p>This is a test email from your <strong>Gryndee</strong> application.</p>
            <p>If you received this, your SMTP settings (AWS SES) are configured correctly.</p>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="font-size: 12px; color: #6b7280;">Sent at: ${new Date().toLocaleString()}</p>
          </div>
        `
      );
      res.json({ success: true, message: 'Test email sent successfully!' });
    } catch (error: any) {
      console.error('Test email failed:', error);
      res.status(500).json({ 
        error: 'Failed to send test email', 
        details: error.message,
        code: error.code,
        command: error.command
      });
    }
  });

  // Users Management
  app.get("/api/users", async (req, res) => {
    if (!supabase) return res.json([]);
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      // Try selecting specific columns first
      let { data, error } = await supabase
        .from('users')
        .select('id, username, email, role, name')
        .eq('account_id', userInfo.account_id);
      
      if (error) {
        console.error('[SERVER] Users fetch error (specific columns):', error);
        // Fallback to select all if specific columns fail
        const fallback = await supabase.from('users').select('*').eq('account_id', userInfo.account_id);
        if (fallback.error) throw fallback.error;
        data = fallback.data;
      }
      
      res.json(data || []);
    } catch (error: any) {
      console.error('[SERVER] Users fetch exception:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post(["/api/users", "/api/users/"], async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { username, password, name, role, email } = req.body;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role !== 'admin' && userInfo.role !== 'super_admin') return res.status(403).json({ error: "Forbidden" });

      // Hash password if provided
      const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

      const { data, error } = await supabase
        .from('users')
        .insert([{ 
          account_id: userInfo.account_id,
          username, 
          password: hashedPassword, 
          name, role, email 
        }])
        .select('id, username, email, role, name')
        .single();
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put(["/api/users/:id", "/api/users/:id/"], async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { id } = req.params;
    const { username, password, name, role, email } = req.body;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role !== 'admin' && userInfo.role !== 'super_admin') return res.status(403).json({ error: "Forbidden" });

      const updateData: any = { username, name, role, email };
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }
      
      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .eq('account_id', userInfo.account_id)
        .select('id, username, email, role, name')
        .single();
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete(["/api/users/:id", "/api/users/:id/"], async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { id } = req.params;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role !== 'admin' && userInfo.role !== 'super_admin') return res.status(403).json({ error: "Forbidden" });

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id)
        .eq('account_id', userInfo.account_id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Products
  app.get("/api/products", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.json([]);

      // Try RDS first
      if (process.env.AWS_DB_PASSWORD) {
        console.log(`[DB] Fetching products from AWS RDS for account ${userInfo.account_id}`);
        const { rows: products } = await pool.query(
          'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.account_id = $1 ORDER BY p.created_at DESC',
          [userInfo.account_id]
        );
        
        for (const product of products) {
          const { rows: variants } = await pool.query('SELECT * FROM product_variants WHERE product_id = $1', [product.id]);
          product.product_variants = variants;
          product.categories = { name: product.category_name };
        }

        if (products.length > 0) {
          return res.json(products);
        }
      }

      if (!supabase) return res.json([]);
      let { data: products, error } = await supabase
        .from('products')
        .select(`
          *,
          categories(name),
          product_variants(*),
          product_images(image_data)
        `)
        .eq('account_id', userInfo.account_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[PRODUCTS] Fetch error:', error);
        
        // Fallback to simple select if join fails
        const fallback = await supabase
          .from('products')
          .select('*')
          .eq('account_id', userInfo.account_id)
          .order('created_at', { ascending: false });
        
        if (fallback.error) {
          console.error('[PRODUCTS] Fetch error (fallback):', fallback.error);
          return res.status(500).json({ error: fallback.error.message });
        }
        products = fallback.data;
      }

      const processedProducts = (products || []).map((p: any) => {
        // Handle potential naming variations from Supabase joins
        const variants = p.product_variants || p.variants || [];
        const totalStock = variants.reduce((acc: number, v: any) => acc + (v.quantity || 0), 0);
        
        return {
          ...p,
          category_name: p.categories?.name || (Array.isArray(p.categories) ? p.categories[0]?.name : null),
          variants: variants,
          total_stock: totalStock,
          images: (p.product_images || p.images || []).map((img: any) => img.image_data || img)
        };
      });

      res.json(processedProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role === 'staff') return res.status(403).json({ error: "Forbidden" });

      const { name, category_id, description, cost_price, selling_price, supplier_name, unit, pieces_per_unit, product_type, variants, images } = req.body;
      
      // Try RDS first
      if (process.env.AWS_DB_PASSWORD) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const { rows: productRows } = await client.query(
            'INSERT INTO products (account_id, name, category_id, description, cost_price, selling_price, supplier_name, unit, pieces_per_unit) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [userInfo.account_id, name, category_id, description, cost_price, selling_price, supplier_name, unit, pieces_per_unit]
          );
          const product = productRows[0];

          if (variants && Array.isArray(variants)) {
            for (const v of variants) {
              await client.query(
                'INSERT INTO product_variants (product_id, size, color, quantity, low_stock_threshold) VALUES ($1, $2, $3, $4, $5)',
                [product.id, v.size, v.color, v.quantity, v.low_stock_threshold]
              );
            }
          }
          await client.query('COMMIT');
          return res.json(product);
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert([{ 
          account_id: userInfo.account_id,
          name, category_id, description, cost_price, selling_price, supplier_name, unit, pieces_per_unit, product_type 
        }])
        .select()
        .single();

      if (productError) throw productError;
      const productId = product.id;

      if (variants && Array.isArray(variants)) {
        const variantsToInsert = variants.map(v => ({
          account_id: userInfo.account_id,
          product_id: productId,
          size: v.size,
          color: v.color,
          quantity: v.quantity,
          low_stock_threshold: v.low_stock_threshold,
          price_override: v.price_override
        }));
        await supabase.from('product_variants').insert(variantsToInsert);
      }

      if (images && Array.isArray(images) && images.length > 0) {
        const imagesToInsert = await Promise.all(images.map(async (img) => {
          const finalUrl = await uploadToCloudinary(img);
          return { account_id: userInfo.account_id, product_id: productId, image_data: finalUrl };
        }));
        await supabase.from('product_images').insert(imagesToInsert);
      }

      res.json({ id: productId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { id } = req.params;
    const { name, category_id, description, cost_price, selling_price, supplier_name, unit, pieces_per_unit, product_type, variants, images } = req.body;
    
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      let productError;
      try {
        const result = await supabase
          .from('products')
          .update({ name, category_id, description, cost_price, selling_price, supplier_name, unit, pieces_per_unit, product_type })
          .eq('id', id);
        productError = result.error;
      } catch (err: any) {
        if (err.message?.includes('column') || err.message?.includes('pieces_per_unit') || err.message?.includes('unit')) {
          console.log("[SERVER] Products schema missing new columns on update, falling back");
          const result = await supabase
            .from('products')
            .update({ name, category_id, description, cost_price, selling_price, supplier_name })
            .eq('id', id);
          productError = result.error;
        } else {
          throw err;
        }
      }

      if (productError) {
        if (productError.message?.includes('column') || productError.message?.includes('pieces_per_unit') || productError.message?.includes('unit')) {
          const result = await supabase
            .from('products')
            .update({ name, category_id, description, cost_price, selling_price, supplier_name })
            .eq('id', id);
          productError = result.error;
        }
      }

      if (productError) throw productError;

      // Update variants: be smart about it to avoid foreign key violations
      const { data: existingVariants, error: fetchError } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', id)
        .eq('account_id', userInfo.account_id);
      
      if (fetchError) throw fetchError;

      if (variants && Array.isArray(variants)) {
        // 1. Identify variants to delete (those in DB but not in new list)
        const variantsToDelete = existingVariants.filter((ev: any) => 
          !variants.some(v => v.size === ev.size && v.color === ev.color)
        );

        for (const ev of variantsToDelete) {
          await supabase.from('product_variants').delete().eq('id', ev.id).eq('account_id', userInfo.account_id);
        }

        // 2. Update existing or Insert new ones
        for (const v of variants) {
          const existing = existingVariants.find((ev: any) => ev.size === v.size && ev.color === v.color);
          
          if (existing) {
            // Update existing variant
            const { error: updErr } = await supabase.from('product_variants')
              .update({ 
                quantity: v.quantity, 
                low_stock_threshold: v.low_stock_threshold, 
                price_override: v.price_override 
              })
              .eq('id', existing.id)
              .eq('account_id', userInfo.account_id);
            if (updErr) throw updErr;
          } else {
            // Insert new variant
            const { error: insErr } = await supabase.from('product_variants').insert([{
              account_id: userInfo.account_id,
              product_id: id,
              size: v.size,
              color: v.color,
              quantity: v.quantity,
              low_stock_threshold: v.low_stock_threshold,
              price_override: v.price_override
            }]);
            if (insErr) throw insErr;
          }
        }
      }

      // Update images: delete old ones and insert new ones
      await supabase.from('product_images').delete().eq('product_id', id);
      if (images && Array.isArray(images) && images.length > 0) {
        const imagesToInsert = await Promise.all(images.map(async (img) => {
          const finalUrl = await uploadToCloudinary(img);
          return { product_id: id, image_data: finalUrl };
        }));
        await supabase.from('product_images').insert(imagesToInsert);
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { id } = req.params;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role === 'staff') return res.status(403).json({ error: "Forbidden" });

      // 1. Get all variant IDs for this product
      const { data: variants, error: vError } = await supabase
        .from('product_variants')
        .select('id')
        .eq('product_id', id)
        .eq('account_id', userInfo.account_id);
      if (vError) throw vError;

      if (variants && variants.length > 0) {
        const variantIds = variants.map(v => v.id);
        
        // 2. Check if any of these variants are in sale_items
        const { count, error: sError } = await supabase
          .from('sale_items')
          .select('*', { count: 'exact', head: true })
          .in('variant_id', variantIds)
          .eq('account_id', userInfo.account_id);
        
        if (sError) throw sError;
        
        if (count && count > 0) {
          return res.status(400).json({ 
            error: "Cannot delete product with sales history. Try marking it as inactive or out of stock instead." 
          });
        }
      }

      // 3. Delete variants and images first (cascade-like)
      await supabase.from('product_variants').delete().eq('product_id', id).eq('account_id', userInfo.account_id);
      await supabase.from('product_images').delete().eq('product_id', id).eq('account_id', userInfo.account_id);
      
      // 4. Delete product
      const { error: pError } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .eq('account_id', userInfo.account_id);
      if (pError) throw pError;
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete product" });
    }
  });

  // Helper to get account_id from headers or user_id
  // (Moved to top)

  app.get("/api/settings", async (req, res) => {
    const defaultSettings = { 
      business_name: 'Gryndee', 
      currency: 'NGN', 
      vat_enabled: false, 
      low_stock_threshold: 5, 
      logo_url: null, 
      brand_color: '#10b981',
      slogan: '',
      address: '',
      email: '',
      website: '',
      phone_number: ''
    };
    if (!supabase) return res.json(defaultSettings);
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.json(defaultSettings);

      const { data, error } = await supabase.from('settings').select('*').eq('account_id', userInfo.account_id);
      if (error) throw error;
      
      let settings = data[0] || { account_id: userInfo.account_id, ...defaultSettings };
      
      res.json(settings);
    } catch (error) {
      res.json(defaultSettings);
    }
  });

  app.post(["/api/settings", "/api/settings/"], async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { 
      business_name, currency, vat_enabled, low_stock_threshold, logo_url, brand_color,
      slogan, address, email, website, phone_number 
    } = req.body;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });
      
      if (userInfo.role !== 'admin' && userInfo.role !== 'owner' && userInfo.role !== 'super_admin') {
        const { data: account } = await supabase.from('accounts').select('owner_id').eq('id', userInfo.account_id).single();
        if (account?.owner_id !== parseInt(userInfo.id as string)) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      const { data: existing } = await supabase.from('settings').select('id').eq('account_id', userInfo.account_id).maybeSingle();
      
      let result;
      const settingsData = { 
        business_name, currency, vat_enabled, low_stock_threshold, logo_url, brand_color,
        slogan, address, email, website, phone_number 
      };
      
      if (existing) {
        result = await supabase.from('settings').update(settingsData).eq('id', existing.id).select().single();
      } else {
        result = await supabase.from('settings').insert([{ account_id: userInfo.account_id, ...settingsData }]).select().single();
      }
      
      if (result.error) {
        console.error('[SETTINGS] Save error:', result.error);
        // Fallback: If columns are missing, try to save without them but encode them in business_name
        if (result.error.message?.includes('column') || result.error.code === '42703') {
          const brandingData = {
            name: business_name,
            color: brand_color,
            logo: logo_url,
            slogan,
            address,
            email,
            website,
            phone: phone_number
          };
          const fallbackName = JSON.stringify(brandingData);
          const fallbackData = { business_name: fallbackName, currency, vat_enabled, low_stock_threshold };
          if (existing) {
            result = await supabase.from('settings').update(fallbackData).eq('id', existing.id).select().single();
          } else {
            result = await supabase.from('settings').insert([{ account_id: userInfo.account_id, ...fallbackData }]).select().single();
          }
        } else {
          throw result.error;
        }
      }
      res.json(result.data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Nigeria Tax Report API
  app.get("/api/tax-report", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      const { period = 'year' } = req.query;
      const now = new Date();
      const startDate = period === 'year' ? `${now.getFullYear()}-01-01` : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      // 1. Get total sales and VAT collected
      // Use select('*') to be resilient to missing columns in the schema cache
      const salesQuery = supabase.from('sales').select('*').eq('account_id', userInfo.account_id).gte('created_at', startDate);
      const { data: sales, error: salesError } = await salesQuery;
      
      // If error is about missing columns, try a more limited select
      if (salesError) {
        console.error('Sales fetch error:', salesError);
        // Fallback to basic columns if possible
      }

      const totalTurnover = sales?.reduce((acc: number, s: any) => acc + (parseFloat(s.total_amount) || 0), 0) || 0;
      const totalVatCollected = sales?.reduce((acc: number, s: any) => acc + (parseFloat(s.vat_amount || 0) || 0), 0) || 0;
      const totalCostOfSales = sales?.reduce((acc: number, s: any) => acc + (parseFloat(s.cost_price_total || 0) || 0), 0) || 0;

      // 2. Get expenses
      const expensesQuery = supabase.from('expenses').select('*').eq('account_id', userInfo.account_id).gte('date', startDate);
      const { data: expenses, error: expError } = await expensesQuery;
      const totalExpenses = expenses?.reduce((acc: number, e: any) => acc + (parseFloat(e.amount) || 0), 0) || 0;

      // 3. Calculate Profit
      const grossProfit = totalTurnover - totalCostOfSales;
      const netProfit = grossProfit - totalExpenses;

      // 4. Get Bookkeeping Inflows (Loans, Debts, etc.)
      const bookkeepingQuery = supabase.from('bookkeeping').select('*').eq('account_id', userInfo.account_id).gte('date', startDate);
      const { data: bookkeeping, error: bkError } = await bookkeepingQuery;
      const totalInflows = bookkeeping?.reduce((acc: number, b: any) => acc + (parseFloat(b.amount) || 0), 0) || 0;

      // 5. Nigeria Tax Calculations (Finance Act 2023)
      let citRate = 0;
      if (totalTurnover > 100000000) citRate = 0.30;
      else if (totalTurnover > 25000000) citRate = 0.20;

      const estimatedCIT = Math.max(0, netProfit * citRate);
      const educationTax = Math.max(0, netProfit * 0.03);
      const vatExempt = totalTurnover < 25000000;

      res.json({
        period,
        turnover: totalTurnover,
        gross_profit: grossProfit,
        net_profit: netProfit,
        total_expenses: totalExpenses,
        total_inflows: totalInflows,
        net_cash_flow: totalTurnover + totalInflows - totalExpenses,
        vat_collected: totalVatCollected,
        vat_exempt: vatExempt,
        estimated_cit: estimatedCIT,
        education_tax: educationTax,
        total_tax_liability: estimatedCIT + educationTax,
        cit_rate: citRate * 100,
        edu_tax_rate: 3,
        currency: 'NGN'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bookkeeping API
  app.get("/api/bookkeeping", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      const { data, error } = await supabase
        .from('bookkeeping')
        .select('*')
        .eq('account_id', userInfo.account_id)
        .order('date', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/bookkeeping", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { type, nature, amount, description, date } = req.body;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      const { data, error } = await supabase
        .from('bookkeeping')
        .insert([{
          account_id: userInfo.account_id,
          type,
          nature: nature || 'other',
          amount: parseFloat(amount),
          description,
          date: date || new Date().toISOString().split('T')[0]
        }])
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/bookkeeping/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { id } = req.params;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      const { error } = await supabase
        .from('bookkeeping')
        .delete()
        .eq('id', id)
        .eq('account_id', userInfo.account_id);

      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // User Profile
  app.put("/api/profile/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { id } = req.params;
    const { name, email } = req.body;
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ name, email })
        .eq('id', id)
        .select('id, username, email, role, name')
        .single();
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/change-password/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    try {
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('password')
        .eq('id', id)
        .single();
      
      if (fetchError || !user) throw new Error("User not found");
      if (user.password !== currentPassword) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('id', id);
      
      if (updateError) throw updateError;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sales
  app.post("/api/sales", async (req, res) => {
    const { 
      items, 
      payment_method, 
      staff_id, 
      customer_id, 
      customer_name, 
      customer_phone,
      customer_email,
      customer_address,
      discount_amount = 0,
      discount_percentage = 0,
      vat_amount = 0,
      invoice_number: custom_invoice_number
    } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items in sale" });
    }

    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      let invoice_number = custom_invoice_number || ("INV-" + Date.now());
      
      // Check if invoice number exists to prevent duplicate key errors
      const { data: existingSale } = await supabase
        .from('sales')
        .select('id')
        .eq('account_id', userInfo.account_id)
        .eq('invoice_number', invoice_number)
        .maybeSingle();
        
      if (existingSale) {
        if (custom_invoice_number) {
          return res.status(400).json({ error: "Invoice number already exists. Please use a different one." });
        } else {
          // If it was auto-generated and somehow collided, add more randomness
          invoice_number = "INV-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
        }
      }

      let total_amount = 0;
      let total_profit = 0;
      let cost_price_total = 0;
      
      const validStaffId = (staff_id && !isNaN(Number(staff_id))) ? Number(staff_id) : null;
      let finalCustomerId = customer_id;

      // Automatic Customer Creation
      if (!finalCustomerId && customer_name && customer_phone) {
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('account_id', userInfo.account_id)
          .eq('phone', customer_phone)
          .maybeSingle();
        
        if (existingCustomer) {
          finalCustomerId = existingCustomer.id;
        } else {
          const { data: newCustomer, error: cError } = await supabase
            .from('customers')
            .insert([{ 
              account_id: userInfo.account_id, 
              name: customer_name, 
              phone: customer_phone,
              email: customer_email,
              address: customer_address
            }])
            .select()
            .single();
          
          if (!cError && newCustomer) {
            finalCustomerId = newCustomer.id;
          }
        }
      }

      // Create the sale record
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([{ 
          account_id: userInfo.account_id,
          invoice_number, 
          customer_name,
          customer_phone,
          customer_email,
          customer_address,
          total_amount: 0, 
          total_profit: 0, 
          cost_price_total: 0,
          discount_amount,
          discount_percentage,
          vat_amount,
          payment_method, 
          staff_id: validStaffId,
          customer_id: finalCustomerId,
          status: 'Completed' // Default status for invoices
        }])
        .select()
        .single();

      if (saleError) throw saleError;
      const saleId = sale.id;

      // Notify admin of new sale
      const { data: adminUser } = await supabase
        .from('users')
        .select('email, name')
        .eq('account_id', userInfo.account_id)
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();

      if (adminUser && adminUser.email) {
        sendEmail(
          adminUser.email,
          `New Sale Recorded: ${invoice_number}`,
          `A new sale of ${total_amount} NGN has been recorded. Invoice: ${invoice_number}`,
          `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #10b981;">New Sale Recorded</h2>
            <p>Hi ${adminUser.name},</p>
            <p>A new transaction has been completed in your store.</p>
            <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
              <p style="margin: 0;">Invoice: <strong>${invoice_number}</strong></p>
              <p style="margin: 0;">Total Amount: <strong>${total_amount} NGN</strong></p>
              <p style="margin: 0;">Payment Method: ${payment_method}</p>
            </div>
            <p>You can view the full details in your Gryndee dashboard.</p>
            <p>Best regards,<br>Gryndee System</p>
          </div>
          `
        ).catch(err => console.error('Failed to send sale notification email:', err));
      }

      for (const item of items) {
        let sellingPrice = 0;
        let costPrice = 0;
        let profit = 0;
        let itemName = '';

        if (item.variant_id) {
          const { data: variant, error: vError } = await supabase
            .from('product_variants')
            .select('*, products(*)')
            .eq('id', item.variant_id)
            .single();

          if (vError || !variant) throw new Error(`Variant not found: ${item.variant_id}`);
          
          const product = variant.products;
          itemName = product.name + (variant.size || variant.color ? ` (${variant.size || ''}${variant.size && variant.color ? ' - ' : ''}${variant.color || ''})` : '');
          sellingPrice = item.price_override || variant.price_override || product.selling_price;
          costPrice = product.cost_price || 0;
          profit = (sellingPrice - costPrice) * item.quantity;
          
          total_amount += sellingPrice * item.quantity;
          total_profit += profit;
          cost_price_total += costPrice * item.quantity;
          
          await supabase
            .from('product_variants')
            .update({ quantity: variant.quantity - item.quantity })
            .eq('id', item.variant_id);

          // Low Stock Alert
          const newQuantity = variant.quantity - item.quantity;
          const threshold = variant.low_stock_threshold || 5;
          if (newQuantity <= threshold) {
            console.log(`[ALERT] Low stock for ${itemName}: ${newQuantity}`);
            // Find account owner email
            const { data: owner } = await supabase
              .from('users')
              .select('email, name')
              .eq('account_id', userInfo.account_id)
              .eq('role', 'admin')
              .limit(1)
              .maybeSingle();

            if (owner && owner.email) {
              sendEmail(
                owner.email,
                `Low Stock Alert: ${itemName}`,
                `The stock for ${itemName} is low (${newQuantity} remaining). Please restock soon.`,
                `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                  <h2 style="color: #f59e0b;">Low Stock Alert</h2>
                  <p>Hi ${owner.name},</p>
                  <p>The stock for <strong>${itemName}</strong> has reached the low threshold.</p>
                  <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0;">Current Quantity: <strong>${newQuantity}</strong></p>
                    <p style="margin: 0;">Threshold: ${threshold}</p>
                  </div>
                  <p>Please restock this item soon to avoid running out.</p>
                  <p>Best regards,<br>Gryndee System</p>
                </div>
                `
              ).catch(err => console.error('Failed to send low stock email:', err));
            }
          }

          const { error: itemError } = await supabase
            .from('sale_items')
            .insert([{
              account_id: userInfo.account_id,
              sale_id: saleId,
              variant_id: item.variant_id,
              product_name: itemName,
              quantity: item.quantity,
              unit_price: sellingPrice,
              cost_price: costPrice,
              total_price: sellingPrice * item.quantity,
              profit: profit
            }]);

          if (itemError) {
            console.error(`[SALES] Failed to insert sale item:`, itemError);
            // Fallback for older schemas
            if (itemError.message?.includes('column') || itemError.code === '42703') {
               await supabase.from('sale_items').insert([{
                 account_id: userInfo.account_id,
                 sale_id: saleId,
                 variant_id: item.variant_id,
                 quantity: item.quantity,
                 price_at_sale: sellingPrice,
                 cost_at_sale: costPrice
               }]);
            } else {
              throw itemError;
            }
          }
        } else if (item.service_id) {
          const { data: service, error: sError } = await supabase
            .from('services')
            .select('*')
            .eq('id', item.service_id)
            .single();

          if (sError || !service) throw new Error(`Service not found: ${item.service_id}`);

          itemName = service.name;
          sellingPrice = item.price_override || service.price;
          costPrice = 0; 
          profit = sellingPrice * item.quantity;

          total_amount += sellingPrice * item.quantity;
          total_profit += profit;

          const { error: itemError } = await supabase
            .from('sale_items')
            .insert([{
              account_id: userInfo.account_id,
              sale_id: saleId,
              service_id: item.service_id,
              service_name: itemName,
              quantity: item.quantity,
              unit_price: sellingPrice,
              cost_price: costPrice,
              total_price: sellingPrice * item.quantity,
              profit: profit
            }]);

          if (itemError) {
            console.error(`[SALES] Failed to insert sale item (service):`, itemError);
            // Fallback for older schemas
            if (itemError.message?.includes('column') || itemError.code === '42703') {
               await supabase.from('sale_items').insert([{
                 account_id: userInfo.account_id,
                 sale_id: saleId,
                 service_id: item.service_id,
                 quantity: item.quantity,
                 price_at_sale: sellingPrice,
                 cost_at_sale: costPrice
               }]);
            } else {
              throw itemError;
            }
          }
        }
      }
      
      // Apply discounts to final totals
      const final_total_amount = total_amount - discount_amount + vat_amount;
      const final_total_profit = total_profit - discount_amount;

      // Add to bookkeeping
      await supabase.from('bookkeeping').insert([{
        account_id: userInfo.account_id,
        type: 'Income',
        nature: 'sale',
        amount: final_total_amount,
        description: `Sale - Invoice #${invoice_number}`,
        date: new Date().toISOString().split('T')[0]
      }]);
      
      const { error: updateError } = await supabase
        .from('sales')
        .update({ 
          total_amount: final_total_amount, 
          total_profit: final_total_profit,
          cost_price_total: cost_price_total
        })
        .eq('id', saleId);

      if (updateError) throw updateError;

      res.json({ saleId, invoice_number });
    } catch (e: any) {
      console.error(`[SALES] Sale failed:`, e);
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/sales", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) {
        console.log('[SALES] No user info found for sales fetch');
        return res.json([]);
      }

      console.log(`[SALES] Fetching sales for account: ${userInfo.account_id}`);
      let { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customers!customer_id (name),
          users!staff_id (name),
          sale_items (
            *,
            product_variants!variant_id (
              *,
              products!product_id (name)
            ),
            services!service_id (name)
          )
        `)
        .eq('account_id', userInfo.account_id)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.message?.includes('relation "sales" does not exist') || error.code === '42P01') {
          console.warn('[SALES] Table "sales" not found. Returning empty array.');
          return res.json([]);
        }
        
        console.error('[SALES] Fetch error:', JSON.stringify(error, null, 2));
        // Fallback to separate queries if join fails
        const { data: salesData, error: salesError } = await supabase
          .from('sales')
          .select('*')
          .eq('account_id', userInfo.account_id)
          .order('created_at', { ascending: false });
        
        if (salesError) {
          if (salesError.message?.includes('relation "sales" does not exist') || salesError.code === '42P01') {
            console.warn('[SALES] Table "sales" not found in fallback. Returning empty array.');
            return res.json([]);
          }
          console.error('[SALES] Fetch error (fallback sales):', JSON.stringify(salesError, null, 2));
          return res.status(500).json({ error: salesError.message });
        }

        // Fetch items for these sales
        const saleIds = (salesData || []).map(s => s.id);
        if (saleIds.length > 0) {
          const { data: itemsData } = await supabase
            .from('sale_items')
            .select(`
              *,
              product_variants!variant_id (
                *,
                products!product_id (name)
              ),
              services!service_id (name)
            `)
            .in('sale_id', saleIds);
          
          if (itemsData) {
            salesData?.forEach(sale => {
              // Use loose equality or string conversion to avoid type mismatch issues
              sale.sale_items = itemsData.filter(item => String(item.sale_id) === String(sale.id));
            });
          }
        }
        data = salesData;
      }
      
      const flattened = (data || []).map((s: any) => ({
        ...s,
        customer_name: s.customer_name || s.customers?.name || (Array.isArray(s.customers) ? s.customers[0]?.name : null) || 'Walk-in',
        customer_email: s.customer_email || s.customers?.email || (Array.isArray(s.customers) ? s.customers[0]?.email : null) || '',
        customer_phone: s.customer_phone || s.customers?.phone || (Array.isArray(s.customers) ? s.customers[0]?.phone : null) || '',
        customer_address: s.customer_address || s.customers?.address || (Array.isArray(s.customers) ? s.customers[0]?.address : null) || '',
        staff_name: s.users?.name || (Array.isArray(s.users) ? s.users[0]?.name : null) || 'System',
        sale_items: (s.sale_items || []).map((item: any) => ({
          ...item,
          unit_price: item.unit_price || item.price_at_sale || 0,
          cost_price: item.cost_price || item.cost_at_sale || 0,
          product_name: item.product_name || item.product_variants?.products?.name || 'Item',
          service_name: item.service_name || item.services?.name || 'Service',
          variant_info: item.product_variants ? `${item.product_variants.size || ''} ${item.product_variants.color || ''}`.trim() : ''
        }))
      }));
      console.log(`[SALES] Returning ${flattened.length} sales`);
      res.json(flattened);
    } catch (error: any) {
      console.error('[SALES] API Error:', JSON.stringify(error, null, 2));
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/sales", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      // Delete only for this account
      await supabase.from('sale_items').delete().eq('account_id', userInfo.account_id);
      const { error } = await supabase.from('sales').delete().eq('account_id', userInfo.account_id);
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/sales/:id", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { id } = req.params;

    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      // 1. Get sale items to revert stock (ensure it belongs to this account)
      const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', id)
        .eq('account_id', userInfo.account_id);

      if (itemsError) throw itemsError;
      if (!items || items.length === 0) {
        // Check if sale exists but has no items
        const { data: sale } = await supabase.from('sales').select('id').eq('id', id).eq('account_id', userInfo.account_id).maybeSingle();
        if (!sale) return res.status(404).json({ error: "Sale not found" });
      }

      // 2. Revert stock for each item
      for (const item of items) {
        const { data: variant } = await supabase
          .from('product_variants')
          .select('quantity')
          .eq('id', item.variant_id)
          .eq('account_id', userInfo.account_id)
          .single();

        if (variant) {
          await supabase
            .from('product_variants')
            .update({ quantity: variant.quantity + item.quantity })
            .eq('id', item.variant_id)
            .eq('account_id', userInfo.account_id);
        }
      }

      // 3. Delete sale items
      await supabase.from('sale_items').delete().eq('sale_id', id).eq('account_id', userInfo.account_id);

      // 4. Delete the sale record
      const { error: saleError } = await supabase.from('sales').delete().eq('id', id).eq('account_id', userInfo.account_id);
      if (saleError) throw saleError;

      res.json({ success: true });
    } catch (e: any) {
      console.error(`[SALES] Delete failed:`, e);
      res.status(500).json({ error: e.message });
    }
  });

  // Super Admin Routes

  app.get("/api/admin/accounts", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role !== 'super_admin') return res.status(403).json({ error: "Forbidden" });

      const { data, error } = await supabase
        .from('accounts')
        .select('*, users(name, email)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const checkLowStock = async (userId: string) => {
    if (!supabase) return;
    
    try {
      // 1. Get all variants and their product names
      const { data: variants, error: variantsError } = await supabase
        .from('product_variants')
        .select('*, products(name), account_id');

      if (variantsError || !variants || variants.length === 0) return;

      const accountId = variants[0].account_id;
      
      // Get global threshold from settings
      const { data: settings } = await supabase
        .from('settings')
        .select('low_stock_threshold')
        .eq('account_id', accountId)
        .maybeSingle();
      
      const globalThreshold = settings?.low_stock_threshold || 5;

      // 2. Filter for low stock
      const lowStockVariants = variants.filter(v => 
        v.quantity !== null && 
        v.quantity <= (v.low_stock_threshold || globalThreshold)
      );
      
      if (lowStockVariants.length === 0) return;

      // 3. Get existing unread low stock notifications for this user to avoid duplicates
      const { data: existingNotifications } = await supabase
        .from('notifications')
        .select('message')
        .eq('user_id', userId)
        .eq('title', 'Low Stock Alert')
        .eq('is_read', false);

      const existingMessages = new Set(existingNotifications?.map(n => n.message) || []);

      // 4. Prepare new notifications
      const newNotifications = lowStockVariants
        .map(variant => {
          const message = `Product "${variant.products?.name || 'Unknown'}" (Size: ${variant.size}) is low on stock. Current quantity: ${variant.quantity}.`;
          return {
            user_id: userId,
            account_id: variant.account_id,
            title: 'Low Stock Alert',
            message,
            type: 'warning',
            is_read: false
          };
        })
        .filter(n => !existingMessages.has(n.message));

      // 5. Batch insert new notifications
      if (newNotifications.length > 0) {
        await supabase.from('notifications').insert(newNotifications);
      }
    } catch (error: any) {
      // Ignore errors if the notifications table doesn't exist
      if (error?.message?.includes('relation "notifications" does not exist')) {
        return;
      }
      console.error('[NOTIFICATIONS] Error checking low stock:', error);
    }
  };

  app.get("/api/notifications/:userId", async (req, res) => {
    if (!supabase) return res.json([]);
    const { userId } = req.params;
    
    if (!userId || userId === 'undefined' || userId === 'null' || userId === '[object Object]') {
      return res.json([]);
    }

    try {
      // Run low stock check in background - don't await to keep response fast
      checkLowStock(userId).catch(err => console.error('[NOTIFICATIONS] Background check failed:', err));

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50); // Limit to avoid huge responses
        
      if (error) throw error;
      res.json(data || []);
    } catch (error: any) {
      // If the table doesn't exist yet, just return an empty array instead of 500
      if (error?.code === 'PGRST116' || error?.message?.includes('relation "notifications" does not exist')) {
        return res.json([]);
      }
      console.error('[NOTIFICATIONS] Fetch error:', error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    if (!supabase) return res.json({ success: true });
    const { id } = req.params;
    try {
      if (id === 'all') {
        const userInfo = await getAccountId(req);
        if (!userInfo) return res.status(401).json({ error: "Unauthorized" });
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', userInfo.id);
      } else {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update notifications" });
    }
  });

  app.delete("/api/notifications/:userId", async (req, res) => {
    if (!supabase) return res.json({ success: true });
    const { userId } = req.params;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.id.toString() !== userId.toString()) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await supabase.from('notifications').delete().eq('user_id', userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear notifications" });
    }
  });

  // Analytics
  app.get("/api/analytics/summary", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      const { count: totalProducts } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('account_id', userInfo.account_id);
      const { count: totalSalesCount } = await supabase.from('sales').select('*', { count: 'exact', head: true }).eq('account_id', userInfo.account_id);
      
      const { data: variants } = await supabase.from('product_variants').select('quantity, low_stock_threshold').eq('account_id', userInfo.account_id);
      const totalStock = variants?.reduce((acc, v) => acc + (v.quantity || 0), 0) || 0;
      const lowStockCount = variants?.filter(v => v.quantity <= (v.low_stock_threshold || 0)).length || 0;

      const { data: todaySalesData } = await supabase
        .from('sales')
        .select('total_amount, total_profit')
        .eq('account_id', userInfo.account_id)
        .gte('created_at', today);

      const todaySales = todaySalesData?.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0) || 0;
      const todayProfit = todaySalesData?.reduce((acc, s) => acc + (Number(s.total_profit) || 0), 0) || 0;

      const { data: todayExpensesData } = await supabase
        .from('expenses')
        .select('amount')
        .eq('account_id', userInfo.account_id)
        .gte('date', today);
      const todayExpenses = todayExpensesData?.reduce((acc, e) => acc + (Number(e.amount) || 0), 0) || 0;

      res.json({
        version: "2.4.9-stable",
        total_products: totalProducts || 0,
        total_sales_count: totalSalesCount || 0,
        total_stock: totalStock,
        low_stock_count: lowStockCount,
        today_sales: todaySales,
        today_profit: todayProfit,
        today_expenses: todayExpenses
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analytics/trends", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      const { data, error } = await supabase
        .from('sales')
        .select('created_at, total_amount, total_profit')
        .eq('account_id', userInfo.account_id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by date
      const trendsMap = new Map();
      data.forEach(s => {
        const date = new Date(s.created_at).toISOString().split('T')[0];
        const existing = trendsMap.get(date) || { revenue: 0, profit: 0 };
        trendsMap.set(date, {
          revenue: existing.revenue + s.total_amount,
          profit: existing.profit + s.total_profit
        });
      });

      const trends = Array.from(trendsMap.entries()).map(([date, values]) => ({
        date,
        ...values
      }));

      res.json(trends);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analytics/top-sales", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      // Fetch sale items with product info
      // We use a more robust approach by fetching variants separately if needed, 
      // but let's try to fix the join first by ensuring the query is correct.
      const { data, error } = await supabase
        .from('sale_items')
        .select(`
          quantity, 
          unit_price, 
          total_price,
          product_variants(
            products(name)
          )
        `)
        .eq('account_id', userInfo.account_id)
        .limit(200);
      
      if (error) {
        console.error('[ANALYTICS] Top sales fetch error:', error);
        // Fallback: try without !inner
        const fallback = await supabase
          .from('sale_items')
          .select('quantity, unit_price, total_price, product_variants(products(name))')
          .eq('account_id', userInfo.account_id)
          .limit(200);
        if (fallback.error) throw fallback.error;
        return res.json(processTopSales(fallback.data));
      }
      
      res.json(processTopSales(data));
    } catch (error: any) {
      console.error('[ANALYTICS] Top sales exception:', error);
      res.status(500).json({ error: error.message });
    }
  });

  function processTopSales(data: any[]) {
    const topSalesMap = new Map();
    data.forEach((item: any) => {
      // Handle both object and array formats for relations
      const variant = Array.isArray(item.product_variants) ? item.product_variants[0] : item.product_variants;
      const product = Array.isArray(variant?.products) ? variant.products[0] : variant?.products;
      const name = product?.name || 'Unknown Product';
      
      const existing = topSalesMap.get(name) || { name, quantity: 0, revenue: 0 };
      const price = parseFloat(item.unit_price) || (parseFloat(item.total_price) / item.quantity) || 0;
      topSalesMap.set(name, {
        name,
        quantity: existing.quantity + item.quantity,
        revenue: existing.revenue + (item.quantity * price)
      });
    });
    
    return Array.from(topSalesMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  app.get("/api/analytics/top-expenses", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      const { data, error } = await supabase
        .from('expenses')
        .select('category, amount')
        .eq('account_id', userInfo.account_id)
        .order('amount', { ascending: false })
        .limit(5);
        
      if (error) throw error;
      res.json(data || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- NEW FEATURES: EXPENSES, CUSTOMERS, SERVICES, AI ---
  // (REMOVED - MOVED UP)

  // Staff Performance API
  app.get("/api/analytics/staff-performance", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      const { data, error } = await supabase
        .from('sales')
        .select('staff_id, total_amount, total_profit')
        .eq('account_id', userInfo.account_id);
      
      if (error) throw error;

      const { data: users } = await supabase.from('users').select('id, name').eq('account_id', userInfo.account_id);
      const userMap = new Map(users?.map(u => [u.id, u.name]));

      const performanceMap = new Map();
      data.forEach(s => {
        const staffName = userMap.get(s.staff_id) || `Staff #${s.staff_id}`;
        const existing = performanceMap.get(staffName) || { sales: 0, profit: 0, count: 0 };
        performanceMap.set(staffName, {
          sales: existing.sales + s.total_amount,
          profit: existing.profit + s.total_profit,
          count: existing.count + 1
        });
      });

      const performance = Array.from(performanceMap.entries()).map(([name, values]) => ({
        name,
        ...values
      }));

      res.json(performance);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/migrate-images", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const { data: images, error } = await supabase.from('product_images').select('*');
      if (error) throw error;
      
      let migratedCount = 0;
      for (const img of images) {
        if (img.image_data && img.image_data.startsWith('data:image')) {
          const cloudinaryUrl = await uploadToCloudinary(img.image_data);
          if (cloudinaryUrl && cloudinaryUrl.startsWith('http')) {
            await supabase.from('product_images').update({ image_data: cloudinaryUrl }).eq('id', img.id);
            migratedCount++;
          }
        }
      }
      res.json({ success: true, migratedCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Super Admin Broadcast
  app.post("/api/admin/broadcast", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role !== 'super_admin') {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { message, title = "System Broadcast" } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });

      console.log(`[ADMIN] Broadcasting message: "${message}"`);

      // Get all users to send notifications to
      const { data: users, error: userError } = await supabase.from('users').select('id, account_id');
      if (userError) {
        console.error('[ADMIN] Failed to fetch users for broadcast:', userError);
        throw userError;
      }
      
      if (users && users.length > 0) {
        const notifications = users.map(user => ({
          account_id: user.account_id,
          user_id: user.id,
          title,
          message,
          type: 'info',
          is_read: false
        }));

        const { error: notifyError } = await supabase.from('notifications').insert(notifications);
        if (notifyError) {
          console.error('[ADMIN] Failed to insert broadcast notifications:', notifyError);
          throw notifyError;
        }
      }

      res.json({ success: true, count: users?.length || 0 });
    } catch (error: any) {
      console.error('[ADMIN] Broadcast failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Super Admin Stats
  app.get("/api/admin/stats", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role !== 'super_admin') {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { count: accountCount, error: accErr } = await supabase.from('accounts').select('*', { count: 'exact', head: true });
      if (accErr) console.warn('[ADMIN] Stats: Failed to count accounts:', accErr.message);
      
      const { count: userCount, error: userErr } = await supabase.from('users').select('*', { count: 'exact', head: true });
      if (userErr) console.warn('[ADMIN] Stats: Failed to count users:', userErr.message);
      
      const { count: productCount, error: prodErr } = await supabase.from('products').select('*', { count: 'exact', head: true });
      if (prodErr) console.warn('[ADMIN] Stats: Failed to count products:', prodErr.message);
      
      const { count: saleCount, error: saleErr } = await supabase.from('sales').select('*', { count: 'exact', head: true });
      if (saleErr) console.warn('[ADMIN] Stats: Failed to count sales:', saleErr.message);
      
      // Get recent accounts
      const { data: recentAccounts, error: recentAccErr } = await supabase
        .from('accounts')
        .select('*, users(name, email)')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (recentAccErr) console.warn('[ADMIN] Stats: Failed to fetch recent accounts:', recentAccErr.message);

      res.json({
        accounts: accountCount || 0,
        users: userCount || 0,
        products: productCount || 0,
        sales: saleCount || 0,
        recentAccounts: recentAccounts || []
      });
    } catch (error: any) {
      console.error('[ADMIN] Stats failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Super Admin List All Users
  app.get("/api/admin/users", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role !== 'super_admin') {
        return res.status(403).json({ error: "Forbidden" });
      }

      console.log(`[ADMIN] Fetching all users...`);

      // Try simple select first to see if it's the join or order by causing issues
      let query = supabase.from('users').select('*, accounts(name)');
      
      const { data: users, error } = await query;

      if (error) {
        console.error('[ADMIN] Failed to fetch users with accounts:', error);
        // Fallback to simple select without join or order
        const { data: simpleUsers, error: simpleError } = await supabase
          .from('users')
          .select('*');
        
        if (simpleError) {
          console.error('[ADMIN] Fallback fetch users failed:', simpleError);
          throw simpleError;
        }
        return res.json(simpleUsers);
      }
      
      // Sort in memory if created_at might be missing or causing issues in SQL
      const sortedUsers = [...(users || [])].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });

      res.json(sortedUsers);
    } catch (error: any) {
      console.error('[ADMIN] List users failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Super Admin Reset User Password
  app.post("/api/admin/reset-user-password", async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role !== 'super_admin') {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { userId, newPassword } = req.body;
      if (!userId || !newPassword) {
        return res.status(400).json({ error: "Missing userId or newPassword" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const { error } = await supabase
        .from('users')
        .update({ password: hashedPassword })
        .eq('id', userId);

      if (error) throw error;

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API 404 handler
  app.all("/api/*", (req, res) => {
    console.log(`[API 404] ${req.method} ${req.url} - No route matched`);
    res.status(404).json({ 
      error: `API route not found (v2.4.3): ${req.method} ${req.path}`,
      method: req.method,
      path: req.path,
      url: req.url 
    });
  });

  // Vite / Static Files
  const distPath = path.resolve(__dirname, "dist");
  
  if (process.env.NODE_ENV !== "production") {
    console.log(`[VITE] Starting in DEVELOPMENT mode`);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.get('*', async (req, res, next) => {
      if (req.url.startsWith('/api/')) return next();
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    console.log(`[STATIC] Starting in PRODUCTION mode serving from: ${distPath}`);
    if (!fs.existsSync(distPath)) {
      console.error(`[STATIC] CRITICAL: dist directory not found at ${distPath}`);
      // List root directory to help debug
      try {
        const files = fs.readdirSync(__dirname);
        console.log(`[STATIC] Root directory contents: ${files.join(', ')}`);
      } catch (e) {}
    }
    
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (req.url.startsWith('/api/')) {
        return res.status(404).json({ error: "API route not found (SPA fallback)" });
      }
      
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        console.error(`[STATIC] CRITICAL: index.html not found at ${indexPath}`);
        res.status(500).send("Application build missing. Please check server logs.");
      }
    });
  }

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global error:", err);
    if (req.url.startsWith('/api/')) {
      res.status(500).json({ error: "Internal server error" });
    } else {
      next(err);
    }
  });

  try {
    // Ensure at least one super admin exists
    if (supabase) {
      // 1. Run basic migrations
      console.log('[INIT] Running startup migrations...');
      
      const runSql = async (sql: string) => {
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) console.warn(`[INIT] Migration warning: ${error.message}`);
      };

      // Ensure tables exist with all required columns
      await runSql(`
        CREATE TABLE IF NOT EXISTS accounts (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          name TEXT NOT NULL,
          owner_id BIGINT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await runSql(`
        CREATE TABLE IF NOT EXISTS users (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'staff',
          name TEXT,
          reset_code TEXT,
          reset_expires TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await runSql(`
        CREATE TABLE IF NOT EXISTS settings (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
          business_name TEXT DEFAULT 'Gryndee',
          currency TEXT DEFAULT 'NGN',
          vat_enabled BOOLEAN DEFAULT false,
          low_stock_threshold INTEGER DEFAULT 5,
          logo_url TEXT,
          brand_color TEXT DEFAULT '#10b981',
          slogan TEXT,
          address TEXT,
          email TEXT,
          website TEXT,
          phone_number TEXT,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(account_id)
        );
      `);

      // Add missing columns to settings if they don't exist
      const settingsCols = ['slogan', 'address', 'email', 'website', 'phone_number'];
      for (const col of settingsCols) {
        await runSql(`
          DO $$ 
          BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='${col}') THEN
              ALTER TABLE settings ADD COLUMN ${col} TEXT;
            END IF;
          END $$;
        `);
      }

      await runSql(`
        CREATE TABLE IF NOT EXISTS sales (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
          customer_id BIGINT,
          customer_name TEXT,
          customer_phone TEXT,
          customer_email TEXT,
          customer_address TEXT,
          total_amount DECIMAL(12,2) NOT NULL,
          total_profit DECIMAL(12,2) NOT NULL DEFAULT 0,
          cost_price_total DECIMAL(12,2) DEFAULT 0,
          vat_amount DECIMAL(12,2) DEFAULT 0,
          discount_percentage DECIMAL(12,2) DEFAULT 0,
          discount_amount DECIMAL(12,2) DEFAULT 0,
          payment_method TEXT DEFAULT 'Cash',
          status TEXT DEFAULT 'Completed',
          staff_id BIGINT,
          invoice_number TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT sales_account_invoice_unique UNIQUE (account_id, invoice_number)
        );
      `);

      // Fix unique constraint on invoice_number to be per account for existing tables
      await runSql(`
        DO $$
        DECLARE
            constraint_name TEXT;
        BEGIN
            -- Find the global unique constraint on invoice_number
            SELECT conname INTO constraint_name
            FROM pg_constraint
            WHERE conrelid = 'sales'::regclass AND contype = 'u' AND conkey = (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid = 'sales'::regclass AND attname = 'invoice_number');
            
            IF constraint_name IS NOT NULL THEN
                EXECUTE 'ALTER TABLE sales DROP CONSTRAINT ' || constraint_name;
            END IF;
            
            -- Add the composite unique constraint if it doesn't exist
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'sales'::regclass AND contype = 'u' AND conkey = (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid = 'sales'::regclass AND attname IN ('account_id', 'invoice_number'))) THEN
                ALTER TABLE sales ADD CONSTRAINT sales_account_invoice_unique UNIQUE (account_id, invoice_number);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore errors
        END $$;
      `);

      // Add missing columns to users if they don't exist
      const userCols = ['reset_code', 'reset_expires'];
      for (const col of userCols) {
        await runSql(`
          DO $$ 
          BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='${col}') THEN
              IF '${col}' = 'reset_expires' THEN
                ALTER TABLE users ADD COLUMN reset_expires TIMESTAMPTZ;
              ELSE
                ALTER TABLE users ADD COLUMN ${col} TEXT;
              END IF;
            END IF;
          END $$;
        `);
      }

      // Add missing columns to sales if they don't exist
      const salesCols = ['customer_name', 'customer_phone', 'customer_email', 'customer_address'];
      for (const col of salesCols) {
        await runSql(`
          DO $$ 
          BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='${col}') THEN
              ALTER TABLE sales ADD COLUMN ${col} TEXT;
            END IF;
          END $$;
        `);
      }

      await runSql(`
        CREATE TABLE IF NOT EXISTS services (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          price DECIMAL(12,2) NOT NULL,
          duration_minutes INTEGER DEFAULT 30,
          category TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await runSql(`
        CREATE TABLE IF NOT EXISTS product_variants (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
          product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          sku TEXT,
          quantity INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await runSql(`
        CREATE TABLE IF NOT EXISTS sale_items (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
          sale_id BIGINT REFERENCES sales(id) ON DELETE CASCADE,
          variant_id BIGINT REFERENCES product_variants(id) ON DELETE SET NULL,
          service_id BIGINT REFERENCES services(id) ON DELETE SET NULL,
          quantity INTEGER NOT NULL,
          unit_price DECIMAL(12,2) NOT NULL,
          cost_price DECIMAL(12,2) DEFAULT 0,
          total_price DECIMAL(12,2) DEFAULT 0,
          profit DECIMAL(12,2) DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS service_id BIGINT REFERENCES services(id) ON DELETE SET NULL;
      `);

      await runSql(`
        CREATE TABLE IF NOT EXISTS bookkeeping (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          nature TEXT DEFAULT 'other',
          amount DECIMAL(12,2) NOT NULL,
          description TEXT,
          date DATE DEFAULT CURRENT_DATE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Add missing columns to existing tables
      const migrations = [
        { table: 'settings', column: 'brand_color', type: 'TEXT DEFAULT \'#10b981\'' },
        { table: 'settings', column: 'logo_url', type: 'TEXT' },
        { table: 'bookkeeping', column: 'nature', type: 'TEXT DEFAULT \'other\'' },
        { table: 'sales', column: 'customer_id', type: 'BIGINT' },
        { table: 'sales', column: 'cost_price_total', type: 'DECIMAL(12,2) DEFAULT 0' },
        { table: 'sales', column: 'vat_amount', type: 'DECIMAL(12,2) DEFAULT 0' },
        { table: 'sales', column: 'discount_percentage', type: 'DECIMAL(12,2) DEFAULT 0' },
        { table: 'sales', column: 'discount_amount', type: 'DECIMAL(12,2) DEFAULT 0' },
        { table: 'sales', column: 'staff_id', type: 'BIGINT' },
        { table: 'sales', column: 'created_by', type: 'BIGINT' },
        { table: 'services', column: 'account_id', type: 'BIGINT REFERENCES accounts(id) ON DELETE CASCADE' },
        { table: 'products', column: 'account_id', type: 'BIGINT REFERENCES accounts(id) ON DELETE CASCADE' },
        { table: 'expenses', column: 'account_id', type: 'BIGINT REFERENCES accounts(id) ON DELETE CASCADE' },
        { table: 'customers', column: 'account_id', type: 'BIGINT REFERENCES accounts(id) ON DELETE CASCADE' },
        { table: 'notifications', column: 'account_id', type: 'BIGINT REFERENCES accounts(id) ON DELETE CASCADE' },
        { table: 'sale_items', column: 'account_id', type: 'BIGINT REFERENCES accounts(id) ON DELETE CASCADE' },
        { table: 'sale_items', column: 'unit_price', type: 'DECIMAL(12,2) DEFAULT 0' },
        { table: 'sale_items', column: 'cost_price', type: 'DECIMAL(12,2) DEFAULT 0' },
        { table: 'sale_items', column: 'total_price', type: 'DECIMAL(12,2) DEFAULT 0' },
        { table: 'sale_items', column: 'profit', type: 'DECIMAL(12,2) DEFAULT 0' },
        { table: 'sale_items', column: 'product_name', type: 'TEXT' },
        { table: 'sale_items', column: 'service_name', type: 'TEXT' },
        { table: 'product_variants', column: 'account_id', type: 'BIGINT REFERENCES accounts(id) ON DELETE CASCADE' },
        { table: 'product_images', column: 'account_id', type: 'BIGINT REFERENCES accounts(id) ON DELETE CASCADE' },
      ];

      for (const m of migrations) {
        await runSql(`
          DO $$ 
          BEGIN 
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='${m.table}') AND 
               NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='${m.table}' AND column_name='${m.column}') THEN
              ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.type};
            END IF;
          END $$;
        `);
      }

      // Reload schema cache
      await runSql(`NOTIFY pgrst, 'reload schema';`);

      // Data migrations for consistency
      await runSql(`
        UPDATE sale_items si 
        SET account_id = s.account_id 
        FROM sales s 
        WHERE si.sale_id = s.id AND si.account_id IS NULL;
      `);
      
      await runSql(`
        UPDATE product_variants pv
        SET account_id = p.account_id
        FROM products p
        WHERE pv.product_id = p.id AND pv.account_id IS NULL;
      `);

      // 2. Check for superadmin
      const { data: existingAdmin } = await supabase.from('users').select('id, password').eq('username', 'superadmin').maybeSingle();
      if (!existingAdmin) {
        console.log('[INIT] No super admin found. Creating default super admin...');
        const { data: account, error: accErr } = await supabase.from('accounts').insert([{ name: 'System Administration' }]).select().single();
        if (accErr) {
          console.error('[INIT] Failed to create system account:', accErr);
        } else if (account) {
          const hashedPassword = await bcrypt.hash('superpassword123', 10);
          const { error: userErr } = await supabase.from('users').insert([{
            account_id: account.id,
            username: 'superadmin',
            email: 'admin@stockflow.pro',
            password: hashedPassword,
            role: 'super_admin',
            name: 'System Admin'
          }]);
          if (userErr) {
            console.error('[INIT] Failed to create super admin user:', userErr);
          } else {
            console.log('[INIT] Default super admin created: superadmin / superpassword123');
          }
        }
      } else {
        console.log('[INIT] Super admin "superadmin" already exists.');
        // Update to hashed password if it's still plain text
        if (existingAdmin.password === 'superpassword123') {
          console.log('[INIT] Updating superadmin password to hashed version...');
          const hashedPassword = await bcrypt.hash('superpassword123', 10);
          await supabase.from('users').update({ password: hashedPassword }).eq('id', existingAdmin.id);
        }
      }

      // 3. Check for demo admin
      const { data: demoAdmin } = await supabase.from('users').select('id').eq('username', 'admin').maybeSingle();
      if (!demoAdmin) {
        console.log('[INIT] No demo admin found. Creating admin/admin123...');
        const { data: account } = await supabase.from('accounts').insert([{ name: 'Gryndee Demo Account' }]).select().single();
        if (account) {
          const hashedPassword = await bcrypt.hash('admin123', 10);
          await supabase.from('users').insert([{
            account_id: account.id,
            username: 'admin',
            email: 'admin@gryndee.com',
            password: hashedPassword,
            role: 'admin',
            name: 'Demo Admin'
          }]);
          
          await supabase.from('settings').insert([{
            account_id: account.id,
            business_name: 'Gryndee Demo',
            currency: 'NGN'
          }]);
          
          console.log('[INIT] Default admin created: admin / admin123');
        }
      }
    }
  } catch (e) {
    console.error('[INIT] Failed to ensure super admin:', e);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is listening on http://0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  return app;
}

const appPromise = createServer();

export default async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
};
