import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from 'fs';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
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
// Note: In a real app, use environment variables for credentials
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'mock_user',
    pass: process.env.SMTP_PASS || 'mock_pass',
  },
});

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
      from: `"StockFlow Pro" <${process.env.SMTP_FROM || 'noreply@stockflow.pro'}>`,
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
        let { data: systemAccount } = await supabase.from('accounts').select('id').eq('name', 'System Admin').maybeSingle();
        if (!systemAccount) {
          const { data: newAcc, error: accErr } = await supabase.from('accounts').insert([{ name: 'System Admin' }]).select().single();
          if (accErr) {
            console.error(`[AUTH] Failed to create System Admin account:`, accErr);
            // Fallback to a hardcoded ID if table exists but insert fails (unlikely)
            return { account_id: 0, role: 'super_admin' };
          }
          systemAccount = newAcc;
        }
        return { account_id: systemAccount?.id || 0, role: 'super_admin' };
      } catch (e) {
        console.error(`[AUTH] Exception in virtual superadmin account lookup:`, e);
        return { account_id: 0, role: 'super_admin' };
      }
    }
    
    try {
      let { data: user, error } = await supabase.from('users').select('account_id, role').eq('id', userId).single();
      if (error || !user) {
        // If table doesn't exist, don't log as error
        if (error?.message?.includes('relation "users" does not exist') || error?.code === '42P01') {
          console.warn(`[AUTH] Table "users" not found. Supabase might not be initialized.`);
          return null;
        }
        
        // If user not found (PGRST116), just return null without error log if it's a common ID like '1'
        if (error?.code === 'PGRST116' || !user) {
          console.log(`[AUTH] User ID ${userId} not found in users table.`);
          return null;
        }

        console.error(`[AUTH] Failed to find user for ID ${userId}:`, error);
        return null;
      }

      if (!user.account_id && user.role !== 'super_admin') {
        console.warn(`[AUTH] User ${userId} has no account_id! Proceeding with caution.`);
      }

      return user;
    } catch (e) {
      console.error(`[AUTH] Exception in getAccountId for ID ${userId}:`, e);
      return null;
    }
  };

  // Database Setup
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
        'settings', 'notifications', 'services'
      ];
      
      for (const table of tablesToDisableRLS) {
        await supabase.rpc('exec_sql', { sql_query: `ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;` }).catch(() => {});
      }

      const setupSql = `
-- 0. Accounts (Multi-tenancy)
CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id BIGINT,
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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='sales') AND 
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='account_id') THEN
    ALTER TABLE sales ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
    UPDATE sales SET account_id = (SELECT id FROM accounts LIMIT 1) WHERE account_id IS NULL;
  END IF;

  -- Expenses
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='expenses') AND 
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='account_id') THEN
    ALTER TABLE expenses ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
    UPDATE expenses SET account_id = (SELECT id FROM accounts LIMIT 1) WHERE account_id IS NULL;
  END IF;

  -- Customers
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='customers') AND 
     NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='account_id') THEN
    ALTER TABLE customers ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
    UPDATE customers SET account_id = (SELECT id FROM accounts LIMIT 1) WHERE account_id IS NULL;
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
    UPDATE sale_items si SET account_id = (SELECT account_id FROM sales s WHERE s.id = si.sale_id) WHERE account_id IS NULL;
    UPDATE sale_items SET account_id = (SELECT id FROM accounts LIMIT 1) WHERE account_id IS NULL;
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
  business_name TEXT DEFAULT 'StockFlow Pro',
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
  customer_id BIGINT,
  total_amount DECIMAL(12,2) NOT NULL,
  total_profit DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',
  status TEXT DEFAULT 'Completed',
  staff_id BIGINT,
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
  quantity INTEGER NOT NULL,
  price_at_sale DECIMAL(12,2) NOT NULL,
  cost_at_sale DECIMAL(12,2) NOT NULL DEFAULT 0,
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
        .select('id, amount, category, date, description, payment_method, account_id')
        .eq('account_id', userInfo.account_id)
        .order('date', { ascending: false });

      if (error) {
        console.error('[EXPENSES] Fetch error (specific columns):', error);
        // Fallback to select all if specific columns fail
        const fallback = await supabase
          .from('expenses')
          .select('*')
          .eq('account_id', userInfo.account_id)
          .order('date', { ascending: false });
        
        if (fallback.error) {
          console.error('[EXPENSES] Fetch error (fallback):', fallback.error);
          return res.status(500).json({ error: fallback.error.message });
        }
        data = fallback.data;
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
        .select('id, name, email, phone, address, loyalty_points, account_id')
        .eq('account_id', userInfo.account_id)
        .order('name', { ascending: true });

      if (error) {
        if (error.message?.includes('relation "customers" does not exist') || error.code === '42P01') {
          console.warn('[CUSTOMERS] Table "customers" not found. Returning empty array.');
          return res.json([]);
        }
        
        console.error('[CUSTOMERS] Fetch error (specific columns):', error);
        // Fallback to select all if specific columns fail
        const fallback = await supabase
          .from('customers')
          .select('*')
          .eq('account_id', userInfo.account_id)
          .order('name', { ascending: true });
        
        if (fallback.error) {
          if (fallback.error.message?.includes('relation "customers" does not exist') || fallback.error.code === '42P01') {
            console.warn('[CUSTOMERS] Table "customers" not found in fallback. Returning empty array.');
            return res.json([]);
          }
          console.error('[CUSTOMERS] Fetch error (fallback):', fallback.error);
          return res.status(500).json({ error: fallback.error.message });
        }
        data = fallback.data;
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


  app.get("/api/test", (req, res) => {
    res.json({ message: "API is working", version: "2.4.3", env: process.env.NODE_ENV });
  });

  // Categories (Moved to top)
  app.get("/api/categories", async (req, res) => {
    if (!supabase) return res.json([]);
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.json([]);

      let { data, error } = await supabase
        .from('categories')
        .select('id, name, account_id')
        .eq('account_id', userInfo.account_id)
        .order('name');

      if (error) {
        console.error('[CATEGORIES] Fetch error (specific columns):', error);
        // Fallback to select all if specific columns fail
        const fallback = await supabase
          .from('categories')
          .select('*')
          .eq('account_id', userInfo.account_id)
          .order('name');
        
        if (fallback.error) {
          console.error('[CATEGORIES] Fetch error (fallback):', fallback.error);
          return res.status(500).json({ error: fallback.error.message });
        }
        data = fallback.data;
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
      console.error('[AUTH] Supabase client not initialized');
      return res.status(500).json({ 
        error: "Server configuration error: Supabase client is not initialized. Please check your SUPABASE_URL and SUPABASE_ANON_KEY environment variables." 
      });
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
          let { data: systemAccount } = await supabase.from('accounts').select('id').eq('name', 'System Admin').maybeSingle();
          if (!systemAccount) {
            const { data: newAcc } = await supabase.from('accounts').insert([{ name: 'System Admin' }]).select().single();
            systemAccount = newAcc;
          }
          
          return res.json({
            id: '0',
            username: 'superadmin',
            email: 'admin@stockflow.pro',
            role: 'super_admin',
            name: 'System Super Admin',
            account_id: systemAccount?.id || 0
          });
        } else {
          return res.status(401).json({ error: "Invalid superadmin password" });
        }
      }

      // Support login via username or email
      console.log(`[AUTH] Querying Supabase for: "${trimmedUsername}"`);
      let { data: user, error: supabaseError } = await supabase
        .from('users')
        .select('id, username, email, role, name, password, account_id')
        .or(`username.ilike."${trimmedUsername}",email.ilike."${trimmedUsername}"`)
        .maybeSingle();

      if (supabaseError) {
        console.error(`[AUTH] Supabase query error (specific columns):`, supabaseError);
        // Fallback to select all if specific columns fail
        const fallback = await supabase
          .from('users')
          .select('*')
          .or(`username.ilike."${trimmedUsername}",email.ilike."${trimmedUsername}"`)
          .maybeSingle();
        
        if (fallback.error) {
          console.error(`[AUTH] Supabase query error (fallback):`, fallback.error);
          return res.status(500).json({ error: `Database error: ${fallback.error.message}` });
        }
        user = fallback.data;
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
    console.log(`Register attempt: ${trimmedUsername} (${trimmedEmail})`);
    if (!supabase) {
      return res.status(500).json({ error: "Server configuration error: Supabase client is not initialized." });
    }

    try {
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
        business_name: name ? `${name}'s Business` : 'StockFlow Pro',
        currency: 'NGN',
        brand_color: '#10b981'
      }]);

      const userId = newUser.id;
      console.log(`[AUTH] Register success: "${trimmedUsername}" (ID: ${userId}, Account: ${account.id}).`);

      // Send confirmation email
      sendEmail(
        trimmedEmail,
        'Welcome to StockFlow Pro!',
        `Hi ${name},\n\nYour account has been successfully created. You can now sign in with your username: ${trimmedUsername}.\n\nBest regards,\nThe StockFlow Team`,
        `<h1>Welcome to StockFlow Pro!</h1><p>Hi ${name},</p><p>Your account has been successfully created. You can now sign in with your username: <strong>${trimmedUsername}</strong>.</p><p>Best regards,<br>The StockFlow Team</p>`
      ).catch(err => console.error('Failed to send registration email:', err));

      // Create notification
      if (supabase) {
        await supabase
          .from('notifications')
          .insert([{
            user_id: userId,
            title: 'Welcome!',
            message: 'Your account has been successfully created. Welcome to StockFlow Pro!',
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

  app.post("/api/forgot-password", (req, res) => {
    const { email } = req.body;
    res.json({ message: "Confirmation code sent to " + email, code: "123456" });
  });

  app.post("/api/reset-password", async (req, res) => {
    const { username, newPassword, code } = req.body;
    if (code !== "123456") return res.status(400).json({ error: "Invalid code" });
    const { data, error } = await supabase
      .from('users')
      .update({ password: newPassword })
      .ilike('username', username)
      .select();
    if (error) return res.status(500).json({ error: error.message });
    if (data && data.length > 0) res.json({ success: true });
    else res.status(404).json({ error: "User not found" });
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
    if (!supabase) return res.json([]);
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.json([]);

      let { data: products, error } = await supabase
        .from('products')
        .select(`
          id, name, category_id, description, cost_price, selling_price, supplier_name, unit, pieces_per_unit, product_type, created_at,
          categories(name),
          product_variants:product_variants(*),
          product_images:product_images(image_data)
        `)
        .eq('account_id', userInfo.account_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[PRODUCTS] Fetch error (with joins):', error);
        
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
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role === 'staff') return res.status(403).json({ error: "Forbidden" });

      const { name, category_id, description, cost_price, selling_price, supplier_name, unit, pieces_per_unit, product_type, variants, images } = req.body;
      
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
    if (!supabase) return res.json({ business_name: 'StockFlow Pro', currency: 'NGN', vat_enabled: false, low_stock_threshold: 5, logo_url: null, brand_color: '#10b981' });
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.json({ business_name: 'StockFlow Pro', currency: 'NGN', vat_enabled: false, low_stock_threshold: 5, logo_url: null, brand_color: '#10b981' });

      const { data, error } = await supabase.from('settings').select('*').eq('account_id', userInfo.account_id);
      if (error) throw error;
      
      let settings = data[0] || { account_id: userInfo.account_id, business_name: 'StockFlow Pro', currency: 'NGN', vat_enabled: false, low_stock_threshold: 5, logo_url: null, brand_color: '#10b981' };
      
      res.json(settings);
    } catch (error) {
      res.json({ business_name: 'StockFlow Pro', currency: 'NGN', vat_enabled: false, low_stock_threshold: 5, logo_url: null, brand_color: '#10b981' });
    }
  });

  app.post(["/api/settings", "/api/settings/"], async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { business_name, currency, vat_enabled, low_stock_threshold, logo_url, brand_color } = req.body;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });
      
      // Allow staff to edit settings if they are the only user, or if they are admin
      // But actually, let's just check if they are admin/owner/super_admin
      // If the user is getting "Forbidden", we should check if they are the account owner
      if (userInfo.role !== 'admin' && userInfo.role !== 'owner' && userInfo.role !== 'super_admin') {
        // Check if this user is the owner of the account
        const { data: account } = await supabase.from('accounts').select('owner_id').eq('id', userInfo.account_id).single();
        if (account?.owner_id !== parseInt(userInfo.id as string)) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      const { data: existing } = await supabase.from('settings').select('id').eq('account_id', userInfo.account_id).maybeSingle();
      
      let result;
      if (existing) {
        result = await supabase.from('settings').update({ business_name, currency, vat_enabled, low_stock_threshold, logo_url, brand_color }).eq('id', existing.id).select().single();
      } else {
        result = await supabase.from('settings').insert([{ account_id: userInfo.account_id, business_name, currency, vat_enabled, low_stock_threshold, logo_url, brand_color }]).select().single();
      }
      
      if (result.error) throw result.error;
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
      let dateFilter = '';
      if (period === 'year') {
        dateFilter = `created_at >= '${new Date().getFullYear()}-01-01'`;
      } else if (period === 'month') {
        const now = new Date();
        dateFilter = `created_at >= '${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01'`;
      }

      // 1. Get total sales and VAT collected
      const salesQuery = supabase.from('sales').select('total_amount, vat_amount, cost_price_total').eq('account_id', userInfo.account_id);
      if (dateFilter) {
        // Supabase doesn't support raw SQL strings in .filter easily without rpc
        // but we can use .gte
        const startDate = period === 'year' ? `${new Date().getFullYear()}-01-01` : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
        salesQuery.gte('created_at', startDate);
      }
      
      const { data: sales, error: salesError } = await salesQuery;
      if (salesError) throw salesError;

      const totalTurnover = sales?.reduce((acc, s) => acc + (s.total_amount || 0), 0) || 0;
      const totalVatCollected = sales?.reduce((acc, s) => acc + (s.vat_amount || 0), 0) || 0;
      const totalCostOfSales = sales?.reduce((acc, s) => acc + (s.cost_price_total || 0), 0) || 0;

      // 2. Get expenses
      const expensesQuery = supabase.from('expenses').select('amount').eq('account_id', userInfo.account_id);
      if (dateFilter) {
        const startDate = period === 'year' ? `${new Date().getFullYear()}-01-01` : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
        expensesQuery.gte('created_at', startDate);
      }
      const { data: expenses, error: expError } = await expensesQuery;
      const totalExpenses = expenses?.reduce((acc, e) => acc + (e.amount || 0), 0) || 0;

      // 3. Calculate Profit
      const grossProfit = totalTurnover - totalCostOfSales;
      const netProfit = grossProfit - totalExpenses;

      // 4. Nigeria Tax Calculations (Finance Act 2023)
      // Turnover thresholds for CIT:
      // < N25m: 0%
      // N25m - N100m: 20%
      // > N100m: 30%
      let citRate = 0;
      if (totalTurnover > 100000000) citRate = 0.30;
      else if (totalTurnover > 25000000) citRate = 0.20;

      const estimatedCIT = Math.max(0, netProfit * citRate);
      
      // Education Tax (Tertiary Education Trust Fund - TETFUND)
      // 3% of assessable profit (net profit for simplicity here)
      const educationTax = Math.max(0, netProfit * 0.03);

      // VAT Compliance
      // Businesses with turnover < N25m are exempt from VAT registration/collection
      const vatExempt = totalTurnover < 25000000;

      res.json({
        period,
        turnover: totalTurnover,
        gross_profit: grossProfit,
        net_profit: netProfit,
        vat_collected: totalVatCollected,
        vat_exempt: vatExempt,
        estimated_cit: estimatedCIT,
        education_tax: educationTax,
        total_tax_liability: estimatedCIT + educationTax,
        cit_rate: citRate * 100,
        edu_tax_rate: 3,
        currency: 'NGN'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
    const { items, payment_method, staff_id, customer_id, customer_name, customer_phone } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items in sale" });
    }

    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      const invoice_number = "INV-" + Date.now();
      let total_amount = 0;
      let total_profit = 0;
      
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
            .insert([{ account_id: userInfo.account_id, name: customer_name, phone: customer_phone }])
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
          total_amount: 0, 
          total_profit: 0, 
          payment_method, 
          staff_id: validStaffId,
          customer_id: finalCustomerId
        }])
        .select()
        .single();

      if (saleError) throw saleError;
      const saleId = sale.id;

      for (const item of items) {
        const { data: variant, error: vError } = await supabase
          .from('product_variants')
          .select('*, products(*)')
          .eq('id', item.variant_id)
          .single();

        if (vError || !variant) throw new Error(`Variant not found: ${item.variant_id}`);
        
        const product = variant.products;
        const sellingPrice = item.price_override || variant.price_override || product.selling_price;
        const costPrice = product.cost_price;
        const profit = (sellingPrice - costPrice) * item.quantity;
        
        total_amount += sellingPrice * item.quantity;
        total_profit += profit;
        
        await supabase
          .from('product_variants')
          .update({ quantity: variant.quantity - item.quantity })
          .eq('id', item.variant_id);

        await supabase
          .from('sale_items')
          .insert([{
            account_id: userInfo.account_id,
            sale_id: saleId,
            variant_id: item.variant_id,
            quantity: item.quantity,
            unit_price: sellingPrice,
            cost_price: costPrice,
            total_price: sellingPrice * item.quantity,
            profit: profit
          }]);
      }
      
      await supabase
        .from('sales')
        .update({ total_amount, total_profit })
        .eq('id', saleId);

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
          customers (name),
          users (name)
        `)
        .eq('account_id', userInfo.account_id)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.message?.includes('relation "sales" does not exist') || error.code === '42P01') {
          console.warn('[SALES] Table "sales" not found. Returning empty array.');
          return res.json([]);
        }
        
        console.error('[SALES] Fetch error (with joins):', error);
        // Fallback to simple select if join fails
        const fallback = await supabase
          .from('sales')
          .select('*')
          .eq('account_id', userInfo.account_id)
          .order('created_at', { ascending: false });
        
        if (fallback.error) {
          if (fallback.error.message?.includes('relation "sales" does not exist') || fallback.error.code === '42P01') {
            console.warn('[SALES] Table "sales" not found in fallback. Returning empty array.');
            return res.json([]);
          }
          console.error('[SALES] Fetch error (fallback):', fallback.error);
          return res.status(500).json({ error: fallback.error.message });
        }
        data = fallback.data;
      }
      
      const flattened = (data || []).map((s: any) => ({
        ...s,
        customer_name: s.customers?.name || (Array.isArray(s.customers) ? s.customers[0]?.name : null) || 'Walk-in',
        staff_name: s.users?.name || (Array.isArray(s.users) ? s.users[0]?.name : null) || 'System'
      }));
      console.log(`[SALES] Returning ${flattened.length} sales`);
      res.json(flattened);
    } catch (error: any) {
      console.error('[SALES] API Error:', error);
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
        .select('*, users!owner_id(name, email)')
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

      const { data, error } = await supabase
        .from('sale_items')
        .select('quantity, unit_price, product_variants(products(name))')
        .eq('account_id', userInfo.account_id)
        .limit(100);
      
      if (error) throw error;
      
      const topSalesMap = new Map();
      data.forEach((item: any) => {
        const name = item.product_variants?.products?.name || 'Unknown';
        const existing = topSalesMap.get(name) || { name, quantity: 0, revenue: 0 };
        topSalesMap.set(name, {
          name,
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + (item.quantity * item.selling_price)
        });
      });
      
      const topSales = Array.from(topSalesMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
        
      res.json(topSales);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

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
