import express from "express";
import { createServer as createHttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cors from "cors";
import nodemailer from 'nodemailer';
import axios from 'axios';

// IN-MEMORY LOGGING FOR DEBUGGING
const logHistory: string[] = [];
const serverStartTime = new Date().toISOString();
const originalLog = console.log;
const originalError = console.error;
console.log = (...args) => {
  logHistory.push(`[LOG] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
  if (logHistory.length > 200) logHistory.shift();
  originalLog(...args);
};
console.error = (...args) => {
  logHistory.push(`[ERR] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
  if (logHistory.length > 200) logHistory.shift();
  originalError(...args);
};

dotenv.config();
console.log("[INIT] Environment variable keys:", Object.keys(process.env).filter(k => !k.includes('SECRET') && !k.includes('KEY') && !k.includes('PASSWORD')).join(', '));
console.log("[INIT] Sensitive keys present:", {
  SUPABASE_URL: !!process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
  AWS_DB_PASSWORD: !!process.env.AWS_DB_PASSWORD,
  AWS_ACCESS_KEY_ID: !!process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: !!process.env.AWS_SECRET_ACCESS_KEY
});
console.log("[INIT] SUPABASE_URL exists:", !!process.env.SUPABASE_URL);
console.log("[INIT] SUPABASE_ANON_KEY exists:", !!process.env.SUPABASE_ANON_KEY);
import fs from 'fs';

import { createClient } from '@supabase/supabase-js';

// Supabase initialization
let supabase: any = null;
let supabase_status = 'disconnected';

if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    supabase_status = 'connected';
    console.log('[DB] Supabase client initialized successfully');
  } catch (e: any) {
    console.error('[DB] Failed to initialize Supabase client:', e.message);
    supabase_status = 'error';
  }
} else {
  console.warn('[DB] Supabase credentials missing. Supabase fallback will be disabled.');
}
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { GoogleGenAI } from "@google/genai";
import { v2 as cloudinary } from 'cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cloudinary Config
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('[INIT] Cloudinary initialized');
}

// Cloudinary Helper
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

// Helper to sanitize AWS region ID (e.g., "US East (N. Virginia) us-east-1" -> "us-east-1")
const getS3Region = () => {
  const region = process.env.AWS_REGION || "us-east-1";
  const match = region.match(/[a-z0-9-]+$/i);
  return match ? match[0].toLowerCase() : region.toLowerCase();
};

let s3Region = getS3Region();
let s3Client = new S3Client({
  region: s3Region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

function reinitializeS3() {
  s3Region = getS3Region();
  s3Client = new S3Client({
    region: s3Region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
  console.log(`[AWS S3] Client re-initialized for region: ${s3Region}`);
}

async function uploadToS3(base64Data: string, folder: string = 'products') {
  console.log(`[AWS S3] Attempting upload to folder: ${folder}. Bucket: ${process.env.AWS_S3_BUCKET_NAME}. Region: ${s3Region}`);
  if (!process.env.AWS_S3_BUCKET_NAME || !base64Data || !base64Data.startsWith('data:image')) {
    console.warn(`[AWS S3] Upload skipped: Missing bucket name or invalid data. Bucket: ${process.env.AWS_S3_BUCKET_NAME}, Data starts with data:image: ${base64Data?.startsWith('data:image')}`);
    return base64Data;
  }

  try {
    // Extract base64 data and mime type
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid base64 string');
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    
    // Generate a unique filename
    const extension = mimeType.split('/')[1] || 'jpg';
    const filename = `${folder}/${crypto.randomUUID()}.${extension}`;

    console.log(`[AWS S3] Sending PutObjectCommand for ${filename}`);
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: filename,
      Body: buffer,
      ContentType: mimeType,
    });

    await s3Client.send(command);
    
    // Construct the S3 URL
    const s3Url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${s3Region}.amazonaws.com/${filename}`;
    console.log(`[AWS S3] Upload successful: ${s3Url}`);
    return s3Url;
  } catch (error: any) {
    console.error('[AWS S3] Upload failed:', error.message || error);
    return base64Data;
  }
}

async function uploadToCloudinary(base64Data: string, folder: string = 'products') {
  // If AWS S3 is configured, use it instead of Cloudinary
  if (process.env.AWS_S3_BUCKET_NAME) {
    return uploadToS3(base64Data, folder);
  }

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

// Supabase removed

// Email transporter setup
let smtpHost = (process.env.SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com').trim();
// Fix common typos in the host
if (smtpHost.includes('emai-smtp') || smtpHost.includes('us.east-1')) {
  smtpHost = 'email-smtp.us-east-1.amazonaws.com';
}

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
    try {
      console.log('[DB] Connected to AWS RDS. Running schema check...');
      
      // Full schema check/init
      await client.query(`
        CREATE TABLE IF NOT EXISTS accounts (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          owner_id INTEGER,
          account_type TEXT DEFAULT 'personal',
          business_type TEXT,
          referral_code TEXT UNIQUE,
          referred_by_id INTEGER REFERENCES accounts(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        -- 12. Promo Codes
        CREATE TABLE IF NOT EXISTS promo_codes (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          duration_months INTEGER NOT NULL DEFAULT 1,
          is_active BOOLEAN DEFAULT TRUE,
          usage_count INTEGER DEFAULT 0,
          max_usages INTEGER DEFAULT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS promo_code_usages (
          id SERIAL PRIMARY KEY,
          promo_code_id BIGINT REFERENCES promo_codes(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
          used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS automated_email_templates (
          id SERIAL PRIMARY KEY,
          type TEXT UNIQUE NOT NULL,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          delay_hours INTEGER NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sent_automated_emails (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          template_type TEXT NOT NULL,
          sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO automated_email_templates (type, subject, body, delay_hours)
        VALUES 
          ('no_product_24h', 'Start your journey with Gryndee!', 'Hi {name},\n\nWe noticed you haven''t added any products or services yet. Adding your first item is the first step to growing your business!\n\nBest regards,\nThe Gryndee Team', 24),
          ('no_sales_48h', 'Boost your sales with Gryndee!', 'Hi {name},\n\nIt''s been a couple of days and you haven''t recorded any sales yet. Need help getting started? Check out our guides or reach out to support!\n\nBest regards,\nThe Gryndee Team', 48),
          ('premium_feature_promo', 'Unlock Premium Features with Gryndee!', 'Hi {name},\n\nDid you know Gryndee offers powerful premium features like AI-powered receipt scanning, automated bookkeeping, and advanced analytics?\n\nUpgrade today to take your business to the next level!\n\nBest regards,\nThe Gryndee Team', 72),
          ('referral_followup', 'Share the Love and Earn Rewards!', 'Hi {name},\n\nWe hope you''re enjoying Gryndee! Did you know you can earn rewards by referring your friends?\n\nYour unique referral code is: {referral_code}\n\nShare this code with others, and when they sign up, you both get benefits!\n\nBest regards,\nThe Gryndee Team', 168),
          ('tax_setup_reminder', 'Simplify Your Taxes with Gryndee!', 'Hi {name},\n\nDid you know Gryndee can help you manage your Nigerian tax obligations automatically? Setting up your tax profile takes less than a minute!\n\nHead over to the Tax Report page to specify your legal structure and see your estimated tax liability and filing deadlines.\n\nBest regards,\nThe Gryndee Team', 72),
          ('weekly_report', 'Your Weekly Business Report', 'Here is a summary of your business activity for the past week. Log in to your dashboard for more details.', 0)
        ON CONFLICT (type) DO NOTHING;
      `);

      // Add missing columns to promo_codes
      const promoCols = [
        { name: 'usage_count', type: 'INTEGER DEFAULT 0' },
        { name: 'max_usages', type: 'INTEGER DEFAULT NULL' }
      ];

      for (const col of promoCols) {
        try {
          const checkCol = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='promo_codes' AND column_name=$1
          `, [col.name]);
          
          if (checkCol.rows.length === 0) {
            console.log(`[DB] Adding missing column ${col.name} to promo_codes...`);
            await client.query(`ALTER TABLE promo_codes ADD COLUMN ${col.name} ${col.type}`);
          }
        } catch (e) {
          console.error(`[DB] Failed to add column ${col.name} to promo_codes:`, e);
        }
      }

      // Migration: Generate referral codes for existing accounts that don't have one
      try {
        const { rows: accountsWithoutCode } = await client.query(
          'SELECT id FROM accounts WHERE referral_code IS NULL OR referral_code = \'\''
        );
        
        if (accountsWithoutCode.length > 0) {
          console.log(`[DB] Generating referral codes for ${accountsWithoutCode.length} accounts...`);
          for (const acc of accountsWithoutCode) {
            const code = Math.random().toString(36).substring(2, 8).toUpperCase();
            await client.query('UPDATE accounts SET referral_code = $1 WHERE id = $2', [code, acc.id]);
          }
        }
      } catch (e) {
        console.error('[DB] Failed to migrate referral codes:', e);
      }

      // Add missing columns to accounts
      const accountCols = [
        { name: 'owner_id', type: 'INTEGER' },
        { name: 'is_active', type: 'BOOLEAN DEFAULT TRUE' },
        { name: 'subscription_plan', type: "TEXT DEFAULT 'free'" },
        { name: 'subscription_status', type: "TEXT DEFAULT 'active'" },
        { name: 'last_payment_date', type: 'TIMESTAMP WITH TIME ZONE' },
        { name: 'account_type', type: "TEXT DEFAULT 'personal'" },
        { name: 'business_type', type: 'TEXT' },
        { name: 'referral_code', type: 'TEXT UNIQUE' },
        { name: 'referred_by_id', type: 'INTEGER REFERENCES accounts(id)' },
        { name: 'invoice_terms', type: 'TEXT' },
        { name: 'trial_expiry', type: 'TIMESTAMP WITH TIME ZONE' },
        { name: 'invoice_count_month', type: 'INTEGER DEFAULT 0' },
        { name: 'last_invoice_reset', type: 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()' },
        { name: 'referral_count', type: 'INTEGER DEFAULT 0' },
        { name: 'referrals_for_reward', type: 'INTEGER DEFAULT 0' },
        { name: 'active_referral_count', type: 'INTEGER DEFAULT 0' },
        { name: 'legal_structure', type: 'TEXT' }
      ];

      for (const col of accountCols) {
        try {
          // Check if column exists first for better compatibility
          const checkCol = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='accounts' AND column_name=$1
          `, [col.name]);
          
          if (checkCol.rows.length === 0) {
            console.log(`[DB] Adding missing column ${col.name} to accounts...`);
            await client.query(`ALTER TABLE accounts ADD COLUMN ${col.name} ${col.type}`);
          }
        } catch (e) {
          console.error(`[DB] Failed to add column ${col.name} to accounts:`, e);
        }
      }

      // Add missing columns to sales
      const salesCols = [
        { name: 'invoice_terms', type: 'TEXT' }
      ];

      for (const col of salesCols) {
        try {
          const checkCol = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='sales' AND column_name=$1
          `, [col.name]);
          
          if (checkCol.rows.length === 0) {
            console.log(`[DB] Adding missing column ${col.name} to sales...`);
            await client.query(`ALTER TABLE sales ADD COLUMN ${col.name} ${col.type}`);
          }
        } catch (e) {
          console.error(`[DB] Failed to add column ${col.name} to sales:`, e);
        }
      }

      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          username TEXT UNIQUE,
          password TEXT NOT NULL,
          name TEXT,
          role TEXT DEFAULT 'user',
          account_id INTEGER REFERENCES accounts(id),
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Add missing columns to users
      const userCols = [
        { name: 'username', type: 'TEXT UNIQUE' },
        { name: 'name', type: 'TEXT' },
        { name: 'role', type: "TEXT DEFAULT 'user'" },
        { name: 'account_id', type: 'INTEGER REFERENCES accounts(id)' },
        { name: 'is_active', type: 'BOOLEAN DEFAULT TRUE' },
        { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP' },
        { name: 'reset_code', type: 'TEXT' },
        { name: 'reset_expires', type: 'TIMESTAMP WITH TIME ZONE' },
        { name: 'is_verified', type: 'BOOLEAN DEFAULT false' },
        { name: 'verification_code', type: 'TEXT' },
        { name: 'verification_expires', type: 'TIMESTAMP WITH TIME ZONE' },
        { name: 'permissions', type: "JSONB DEFAULT '{}'::jsonb" }
      ];

      for (const col of userCols) {
        try {
          const checkCol = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='users' AND column_name=$1
          `, [col.name]);
          
          if (checkCol.rows.length === 0) {
            console.log(`[DB] Adding missing column ${col.name} to users...`);
            await client.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
          }
        } catch (e) {
          console.error(`[DB] Failed to add column ${col.name} to users:`, e);
        }
      }

      await client.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id SERIAL PRIMARY KEY,
          account_id INTEGER REFERENCES accounts(id),
          user_id INTEGER REFERENCES users(id),
          guest_id TEXT,
          message TEXT NOT NULL,
          is_from_admin BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS guest_id TEXT;
      `);

      await client.query(`
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
          welcome_email_subject TEXT DEFAULT 'Welcome to Gryndee!',
          welcome_email_body TEXT DEFAULT 'Hi {name},\n\nYour account has been successfully created. You can now sign in with your username: {username}.\n\nBest regards,\nThe Gryndee Team',
          invoice_terms TEXT,
          bank_name TEXT,
          account_name TEXT,
          account_number TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS legal_documents (
          id SERIAL PRIMARY KEY,
          terms_and_conditions TEXT,
          privacy_policy TEXT,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Insert default legal docs if none exist
      const { rows: legalDocs } = await client.query('SELECT id FROM legal_documents LIMIT 1');
      if (legalDocs.length === 0) {
        await client.query('INSERT INTO legal_documents (terms_and_conditions, privacy_policy) VALUES ($1, $2)', [
          '<h1>Terms and Conditions</h1><p>Default terms...</p>',
          '<h1>Privacy Policy</h1><p>Default privacy policy...</p>'
        ]);
      }

      // Add missing columns to settings
      const settingsCols = [
        { name: 'invoice_terms', type: 'TEXT' },
        { name: 'bank_name', type: 'TEXT' },
        { name: 'account_name', type: 'TEXT' },
        { name: 'account_number', type: 'TEXT' }
      ];

      for (const col of settingsCols) {
        try {
          const checkCol = await client.query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='settings' AND column_name=$1
          `, [col.name]);
          
          if (checkCol.rows.length === 0) {
            console.log(`[DB] Adding missing column ${col.name} to settings...`);
            await client.query(`ALTER TABLE settings ADD COLUMN ${col.name} ${col.type}`);
          }
        } catch (e) {
          console.error(`[DB] Failed to add column ${col.name} to settings:`, e);
        }
      }

      await client.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          account_id INTEGER REFERENCES accounts(id),
          name TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Ensure categories columns exist
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='account_id') THEN
            ALTER TABLE categories ADD COLUMN account_id INTEGER REFERENCES accounts(id);
          END IF;
        END $$;
      `);

      await client.query(`
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
      `);

      // Ensure products columns exist
      await client.query(`
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
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='product_type') THEN
            ALTER TABLE products ADD COLUMN product_type TEXT DEFAULT 'one';
          END IF;
        END $$;
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS product_variants (
          id SERIAL PRIMARY KEY,
          account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
          product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
          size TEXT,
          color TEXT,
          sku TEXT,
          quantity INTEGER DEFAULT 0,
          low_stock_threshold INTEGER DEFAULT 5,
          price_override DECIMAL(12, 2),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Ensure product_variants columns exist
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_variants' AND column_name='account_id') THEN
            ALTER TABLE product_variants ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_variants' AND column_name='low_stock_threshold') THEN
            ALTER TABLE product_variants ADD COLUMN low_stock_threshold INTEGER;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_variants' AND column_name='price_override') THEN
            ALTER TABLE product_variants ADD COLUMN price_override DECIMAL(12, 2);
          END IF;
        END $$;
      `);

      // Migration: Remove default value and set existing 5s to null so global threshold applies
      await client.query(`
        ALTER TABLE product_variants ALTER COLUMN low_stock_threshold DROP DEFAULT;
        UPDATE product_variants SET low_stock_threshold = NULL WHERE low_stock_threshold = 5;
      `);

      await client.query(`
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
          customer_email TEXT,
          customer_address TEXT,
          total_profit DECIMAL(12, 2) DEFAULT 0,
          discount_percentage DECIMAL(12, 2) DEFAULT 0,
          invoice_number TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='invoice_number') THEN
            ALTER TABLE sales ADD COLUMN invoice_number TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='total_profit') THEN
            ALTER TABLE sales ADD COLUMN total_profit DECIMAL(12, 2) DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='customer_email') THEN
            ALTER TABLE sales ADD COLUMN customer_email TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='customer_address') THEN
            ALTER TABLE sales ADD COLUMN customer_address TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='discount_percentage') THEN
            ALTER TABLE sales ADD COLUMN discount_percentage DECIMAL(12, 2) DEFAULT 0;
          END IF;
        END $$;
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS sale_items (
          id SERIAL PRIMARY KEY,
          account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
          sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
          product_id INTEGER REFERENCES products(id),
          variant_id INTEGER REFERENCES product_variants(id),
          service_id INTEGER REFERENCES services(id),
          product_name TEXT,
          service_name TEXT,
          quantity INTEGER NOT NULL,
          unit_price DECIMAL(12, 2) NOT NULL,
          cost_price DECIMAL(12, 2) DEFAULT 0,
          total_price DECIMAL(12, 2) NOT NULL,
          profit DECIMAL(12, 2) DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='account_id') THEN
            ALTER TABLE sale_items ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='service_id') THEN
            ALTER TABLE sale_items ADD COLUMN service_id INTEGER REFERENCES services(id);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='product_name') THEN
            ALTER TABLE sale_items ADD COLUMN product_name TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='service_name') THEN
            ALTER TABLE sale_items ADD COLUMN service_name TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='cost_price') THEN
            ALTER TABLE sale_items ADD COLUMN cost_price DECIMAL(12, 2) DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='profit') THEN
            ALTER TABLE sale_items ADD COLUMN profit DECIMAL(12, 2) DEFAULT 0;
          END IF;
        END $$;
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS customers (
          id SERIAL PRIMARY KEY,
          account_id INTEGER REFERENCES accounts(id),
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          address TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Ensure customers columns exist
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='permissions') THEN
            ALTER TABLE users ADD COLUMN permissions JSONB DEFAULT '{}'::jsonb;
          END IF;
        END $$;
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS expenses (
          id SERIAL PRIMARY KEY,
          account_id INTEGER REFERENCES accounts(id),
          category TEXT,
          amount DECIMAL(12, 2) NOT NULL,
          description TEXT,
          date DATE DEFAULT CURRENT_DATE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS product_images (
          id SERIAL PRIMARY KEY,
          product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
          url TEXT NOT NULL,
          is_primary BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS services (
          id SERIAL PRIMARY KEY,
          account_id INTEGER REFERENCES accounts(id),
          name TEXT NOT NULL,
          description TEXT,
          price DECIMAL(12, 2) DEFAULT 0,
          duration_minutes INTEGER,
          category TEXT,
          image_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Ensure services columns exist
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='category') THEN
            ALTER TABLE services ADD COLUMN category TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='image_url') THEN
            ALTER TABLE services ADD COLUMN image_url TEXT;
          END IF;
        END $$;
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS bookkeeping (
          id SERIAL PRIMARY KEY,
          account_id INTEGER REFERENCES accounts(id),
          type TEXT NOT NULL, -- 'income' or 'expense'
          nature TEXT DEFAULT 'other',
          category TEXT,
          amount DECIMAL(12, 2) NOT NULL,
          description TEXT,
          reference_id TEXT, -- sale_id or expense_id
          date DATE DEFAULT CURRENT_DATE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookkeeping' AND column_name='nature') THEN
            ALTER TABLE bookkeeping ADD COLUMN nature TEXT DEFAULT 'other';
          END IF;
        END $$;
      `);

      await client.query(`
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
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sales_account_id ON sales(account_id);
        CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
        CREATE INDEX IF NOT EXISTS idx_sales_staff_id ON sales(staff_id);
        CREATE INDEX IF NOT EXISTS idx_sale_items_account_id ON sale_items(account_id);
        CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
        CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON expenses(account_id);
        CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
        CREATE INDEX IF NOT EXISTS idx_products_account_id ON products(account_id);
        CREATE INDEX IF NOT EXISTS idx_product_variants_account_id ON product_variants(account_id);
        CREATE INDEX IF NOT EXISTS idx_bookkeeping_account_id ON bookkeeping(account_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_account_id ON notifications(account_id);
        CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id);
        CREATE INDEX IF NOT EXISTS idx_customers_account_id ON customers(account_id);
      `);

      console.log('[DB] RDS Schema check complete.');
      
      // Ensure superadmin exists with the correct hashed password
      const hashedSuperPass = await bcrypt.hash('superpassword123', 10);
      
      // Check if superadmin already exists to avoid duplicate errors
      const { rows: existingSuper } = await client.query("SELECT id FROM users WHERE username = 'superadmin'");
      if (existingSuper.length === 0) {
        console.log('[DB] Creating superadmin with password: superpassword123');
        
        // Check if a "System Admin" account already exists without an owner
        const { rows: existingSysAccs } = await client.query("SELECT id FROM accounts WHERE name = 'System Admin' AND owner_id IS NULL LIMIT 1");
        
        let sysAccId;
        if (existingSysAccs.length > 0) {
          sysAccId = existingSysAccs[0].id;
          console.log(`[DB] Using existing orphaned System Admin account (ID: ${sysAccId})`);
        } else {
          const { rows: sysAccs } = await client.query("INSERT INTO accounts (name) VALUES ('System Admin') RETURNING id");
          sysAccId = sysAccs[0].id;
          console.log(`[DB] Created new System Admin account (ID: ${sysAccId})`);
        }

        const { rows: newUser } = await client.query(
          'INSERT INTO users (account_id, username, email, password, role, name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [sysAccId, 'superadmin', 'noreply@gryndee.com', hashedSuperPass, 'super_admin', 'System Admin']
        );
        
        // Update account owner
        await client.query('UPDATE accounts SET owner_id = $1 WHERE id = $2', [newUser[0].id, sysAccId]);
      }

      // Removed default admin creation for security
      console.log('[DB] RDS Initialization complete.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[DB] RDS Initialization failed (non-fatal):', err);
  }
}

initAwsDb();

function generateWeeklyReportHtml(data: {
  name: string;
  businessName: string;
  logoUrl?: string;
  sales: string;
  profit: string;
  expenses: string;
  startDate: string;
  endDate: string;
  introText?: string;
}) {
  const intro = data.introText 
    ? data.introText.replace(/\n/g, '<br>') 
    : `Here's your weekly performance summary for <strong>${data.businessName}</strong>. Take a look at how your business moved this week.`;

  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <h2 style="color: #111827; margin: 0 0 8px 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em;">Weekly Performance</h2>
      <p style="color: #6b7280; font-size: 15px; margin: 0;">${data.startDate} &mdash; ${data.endDate}</p>
    </div>
    
    <p style="font-size: 16px; color: #4b5563;">Hi <strong>${data.name}</strong>,</p>
    <p style="font-size: 16px; color: #4b5563; margin-bottom: 32px;">${intro}</p>
    
    <div style="background-color: #f0fdf4; border: 1px solid #dcfce7; padding: 32px; border-radius: 16px; margin-bottom: 24px; text-align: center;">
      <h3 style="color: #166534; margin: 0 0 8px 0; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">Estimated Net Profit</h3>
      <div style="font-size: 42px; font-weight: 800; color: #15803d; letter-spacing: -0.05em;">${data.profit}</div>
      <div style="height: 1px; background-color: #dcfce7; margin: 20px auto; width: 60px;"></div>
      <p style="font-size: 13px; color: #166534; margin: 0; opacity: 0.8;">Calculated from ${data.sales} in sales minus ${data.expenses} in expenses.</p>
    </div>
    
    <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
      <tr>
        <td width="50%" style="padding-right: 8px;">
          <div style="padding: 24px; background: #ffffff; border-radius: 16px; border: 1px solid #f3f4f6; text-align: center; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
            <div style="font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Total Revenue</div>
            <div style="font-size: 24px; font-weight: 700; color: #111827;">${data.sales}</div>
          </div>
        </td>
        <td width="50%" style="padding-left: 8px;">
          <div style="padding: 24px; background: #ffffff; border-radius: 16px; border: 1px solid #f3f4f6; text-align: center; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
            <div style="font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Total Expenses</div>
            <div style="font-size: 24px; font-weight: 700; color: #ef4444;">${data.expenses}</div>
          </div>
        </td>
      </tr>
    </table>
    
    <div style="background-color: #fffbeb; border: 1px solid #fef3c7; padding: 28px; border-radius: 16px; margin-bottom: 32px;">
      <h4 style="color: #92400e; margin: 0 0 16px 0; font-size: 16px; font-weight: 700;">💡 Business Insights</h4>
      <div style="color: #b45309; font-size: 14px; line-height: 1.6;">
        <div style="margin-bottom: 12px; display: flex; align-items: flex-start;">
          <span style="margin-right: 12px;">&bull;</span>
          <span><strong>Inventory Check:</strong> Keep an eye on your low stock alerts in the dashboard to ensure you never miss a sale.</span>
        </div>
        <div style="margin-bottom: 12px; display: flex; align-items: flex-start;">
          <span style="margin-right: 12px;">&bull;</span>
          <span><strong>Expense Tracking:</strong> Remember to record every small expense. Those little costs add up and affect your true profit.</span>
        </div>
        <div style="display: flex; align-items: flex-start;">
          <span style="margin-right: 12px;">&bull;</span>
          <span><strong>Customer Growth:</strong> Engaging with your top customers can lead to repeat business. Check your top customers list!</span>
        </div>
      </div>
    </div>
    
    <div style="text-align: center;">
      <a href="https://gryndee.com/dashboard" class="button">View Full Analytics</a>
    </div>
  `;
  
  return getEmailLayout(content, data.logoUrl, data.businessName);
}

// Background job for automated emails
setInterval(async () => {
  try {
    const client = await pool.connect();
    try {
      // Fetch active templates
      const { rows: templates } = await client.query('SELECT * FROM automated_email_templates WHERE is_active = TRUE');
      
      for (const template of templates) {
        if (template.type === 'no_product_24h') {
          // Find users who signed up > delay_hours ago, have 0 products, and haven't received this email
          const { rows: users } = await client.query(`
            SELECT u.id, u.email, u.name, u.username, s.logo_url, s.business_name
            FROM users u
            JOIN settings s ON u.account_id = s.account_id
            LEFT JOIN products p ON u.account_id = p.account_id
            LEFT JOIN sent_automated_emails sae ON u.id = sae.user_id AND sae.template_type = 'no_product_24h'
            WHERE u.created_at < NOW() - ($1 || ' hours')::INTERVAL
            AND sae.id IS NULL
            GROUP BY u.id, s.logo_url, s.business_name
            HAVING COUNT(p.id) = 0
          `, [template.delay_hours]);
          
          for (const user of users) {
            const body = template.body.replace('{name}', user.name || user.username || 'there').replace('{username}', user.username || '');
            await sendEmail(user.email, template.subject, body, undefined, user.logo_url, user.business_name);
            await client.query('INSERT INTO sent_automated_emails (user_id, template_type) VALUES ($1, $2)', [user.id, 'no_product_24h']);
            console.log(`[AUTOMATED EMAILS] Sent no_product_24h to ${user.email}`);
          }
        } else if (template.type === 'no_sales_48h') {
          // Find users who signed up > delay_hours ago, have 0 sales, and haven't received this email
          const { rows: users } = await client.query(`
            SELECT u.id, u.email, u.name, u.username, s.logo_url, s.business_name
            FROM users u
            JOIN settings s ON u.account_id = s.account_id
            LEFT JOIN sales s2 ON u.account_id = s2.account_id
            LEFT JOIN sent_automated_emails sae ON u.id = sae.user_id AND sae.template_type = 'no_sales_48h'
            WHERE u.created_at < NOW() - ($1 || ' hours')::INTERVAL
            AND sae.id IS NULL
            GROUP BY u.id, s.logo_url, s.business_name
            HAVING COUNT(s2.id) = 0
          `, [template.delay_hours]);
          
          for (const user of users) {
            const body = template.body.replace('{name}', user.name || user.username || 'there').replace('{username}', user.username || '');
            await sendEmail(user.email, template.subject, body, undefined, user.logo_url, user.business_name);
            await client.query('INSERT INTO sent_automated_emails (user_id, template_type) VALUES ($1, $2)', [user.id, 'no_sales_48h']);
            console.log(`[AUTOMATED EMAILS] Sent no_sales_48h to ${user.email}`);
          }
        } else if (template.type === 'premium_feature_promo') {
          // Find regular users who signed up > delay_hours ago and haven't received this email
          const { rows: users } = await client.query(`
            SELECT u.id, u.email, u.name, u.username, s.logo_url, s.business_name
            FROM users u
            JOIN settings s ON u.account_id = s.account_id
            LEFT JOIN sent_automated_emails sae ON u.id = sae.user_id AND sae.template_type = 'premium_feature_promo'
            WHERE u.role = 'user'
            AND u.created_at < NOW() - ($1 || ' hours')::INTERVAL
            AND sae.id IS NULL
          `, [template.delay_hours]);
          
          for (const user of users) {
            const body = template.body.replace('{name}', user.name || user.username || 'there').replace('{username}', user.username || '');
            await sendEmail(user.email, template.subject, body, undefined, user.logo_url, user.business_name);
            await client.query('INSERT INTO sent_automated_emails (user_id, template_type) VALUES ($1, $2)', [user.id, 'premium_feature_promo']);
            console.log(`[AUTOMATED EMAILS] Sent premium_feature_promo to ${user.email}`);
          }
        } else if (template.type === 'referral_followup') {
          // Find users who signed up > delay_hours ago and haven't received this email
          const { rows: users } = await client.query(`
            SELECT u.id, u.email, u.name, u.username, a.referral_code, s.logo_url, s.business_name
            FROM users u
            JOIN accounts a ON u.account_id = a.id
            JOIN settings s ON u.account_id = s.account_id
            LEFT JOIN sent_automated_emails sae ON u.id = sae.user_id AND sae.template_type = 'referral_followup'
            WHERE u.created_at < NOW() - ($1 || ' hours')::INTERVAL
            AND sae.id IS NULL
          `, [template.delay_hours]);
          
          for (const user of users) {
            const body = template.body
              .replace('{name}', user.name || user.username || 'there')
              .replace('{username}', user.username || '')
              .replace('{referral_code}', user.referral_code || 'N/A');
            await sendEmail(user.email, template.subject, body, undefined, user.logo_url, user.business_name);
            await client.query('INSERT INTO sent_automated_emails (user_id, template_type) VALUES ($1, $2)', [user.id, 'referral_followup']);
            console.log(`[AUTOMATED EMAILS] Sent referral_followup to ${user.email}`);
          }
        } else if (template.type === 'tax_setup_reminder') {
          // Find users who signed up > delay_hours ago, have no legal_structure set, and haven't received this email
          const { rows: users } = await client.query(`
            SELECT u.id, u.email, u.name, u.username, s.logo_url, s.business_name
            FROM users u
            JOIN accounts a ON u.account_id = a.id
            JOIN settings s ON u.account_id = s.account_id
            LEFT JOIN sent_automated_emails sae ON u.id = sae.user_id AND sae.template_type = 'tax_setup_reminder'
            WHERE u.created_at < NOW() - ($1 || ' hours')::INTERVAL
            AND (a.legal_structure IS NULL OR a.legal_structure = '')
            AND sae.id IS NULL
          `, [template.delay_hours]);
          
          for (const user of users) {
            const body = template.body.replace('{name}', user.name || user.username || 'there').replace('{username}', user.username || '');
            await sendEmail(user.email, template.subject, body, undefined, user.logo_url, user.business_name);
            await client.query('INSERT INTO sent_automated_emails (user_id, template_type) VALUES ($1, $2)', [user.id, 'tax_setup_reminder']);
            console.log(`[AUTOMATED EMAILS] Sent tax_setup_reminder to ${user.email}`);
          }
        } else if (template.type === 'weekly_report') {
          // Check if it's Sunday
          const now = new Date();
          if (now.getDay() === 0) { // 0 is Sunday
            // Find users who haven't received a weekly report in the last 6 days
            const { rows: users } = await client.query(`
              SELECT u.id, u.email, u.name, u.username, u.account_id, s.logo_url, s.business_name, s.currency
              FROM users u
              JOIN settings s ON u.account_id = s.account_id
              LEFT JOIN sent_automated_emails sae ON u.id = sae.user_id 
                AND sae.template_type = 'weekly_report' 
                AND sae.sent_at > NOW() - INTERVAL '6 days'
              WHERE sae.id IS NULL
            `);

            for (const user of users) {
              // Calculate weekly stats
              const { rows: stats } = await client.query(`
                SELECT 
                  COALESCE(SUM(total_amount), 0) as total_sales,
                  COALESCE(SUM(total_profit), 0) as total_profit
                FROM sales
                WHERE account_id = $1
                AND created_at > NOW() - INTERVAL '7 days'
              `, [user.account_id]);

              const { rows: expenses } = await client.query(`
                SELECT COALESCE(SUM(amount), 0) as total_expenses
                FROM expenses
                WHERE account_id = $1
                AND date > CURRENT_DATE - INTERVAL '7 days'
              `, [user.account_id]);

              const weeklySales = parseFloat(stats[0].total_sales);
              const weeklyProfit = parseFloat(stats[0].total_profit);
              const weeklyExpenses = parseFloat(expenses[0].total_expenses);
              const currency = user.currency || 'NGN';

              // Format currency
              const formatCurrency = (val: number) => {
                return new Intl.NumberFormat('en-NG', { style: 'currency', currency: currency }).format(val);
              };

              const html = generateWeeklyReportHtml({
                name: user.name || user.username || 'there',
                businessName: user.business_name || 'Gryndee',
                logoUrl: user.logo_url,
                sales: formatCurrency(weeklySales),
                profit: formatCurrency(weeklyProfit),
                expenses: formatCurrency(weeklyExpenses),
                startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
                endDate: new Date().toLocaleDateString(),
                introText: template.body.replace('{name}', user.name || user.username || 'there').replace('{business_name}', user.business_name || 'Gryndee')
              });

              await sendEmail(user.email, template.subject, template.body, html, user.logo_url, user.business_name);
              await client.query('INSERT INTO sent_automated_emails (user_id, template_type) VALUES ($1, $2)', [user.id, 'weekly_report']);
              console.log(`[AUTOMATED EMAILS] Sent weekly_report to ${user.email}`);
            }
          }
        }
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[AUTOMATED EMAILS] Job failed:', err);
  }
}, 1000 * 60 * 60); // Run every hour

async function getSystemSetting(key: string): Promise<string | null> {
  try {
    const res = await pool.query('SELECT value FROM system_settings WHERE key = $1', [key]);
    return res.rows[0]?.value || null;
  } catch (err) {
    console.error(`[DB] Error getting system setting ${key}:`, err);
    return null;
  }
}

async function getGeminiKey(): Promise<string | null> {
  // Try database first
  const dbKey = await getSystemSetting('GEMINI_API_KEY');
  if (dbKey) return dbKey;
  // Fallback to environment
  return process.env.GEMINI_API_KEY || process.env.API_KEY || null;
}

async function setSystemSetting(key: string, value: string) {
  try {
    await pool.query(
      'INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP',
      [key, value]
    );
  } catch (err) {
    console.error(`[DB] Error setting system setting ${key}:`, err);
  }
}

function getEmailLayout(content: string, logoUrl?: string, businessName: string = 'Gryndee') {
  const logoHtml = logoUrl 
    ? `<img src="${logoUrl}" alt="${businessName}" style="max-height: 40px; width: auto; display: block; margin: 0 auto;">` 
    : `<h1 style="color: #111827; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">${businessName}</h1>`;
  
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${businessName} Notification</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          
          body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            line-height: 1.6; 
            color: #374151; 
            margin: 0; 
            padding: 0; 
            background-color: #f3f4f6; 
            -webkit-font-smoothing: antialiased;
          }
          .wrapper {
            width: 100%;
            table-layout: fixed;
            background-color: #f3f4f6;
            padding-bottom: 40px;
          }
          .container { 
            max-width: 600px; 
            margin: 40px auto; 
            background: #ffffff; 
            border-radius: 16px; 
            overflow: hidden; 
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); 
          }
          .header { 
            padding: 40px 32px; 
            text-align: center; 
            background-color: #ffffff;
          }
          .content { 
            padding: 0 40px 40px 40px; 
            font-size: 16px;
            color: #4b5563;
          }
          .footer { 
            padding: 32px; 
            text-align: center; 
            font-size: 13px; 
            color: #9ca3af; 
            background-color: #f9fafb;
            border-top: 1px solid #f3f4f6;
          }
          .footer a {
            color: #6b7280;
            text-decoration: underline;
          }
          .button { 
            display: inline-block; 
            padding: 14px 28px; 
            background-color: #111827; 
            color: #ffffff !important; 
            text-decoration: none; 
            border-radius: 10px; 
            font-weight: 600; 
            font-size: 15px;
            margin-top: 24px;
            text-align: center;
          }
          .divider {
            height: 1px;
            background-color: #f3f4f6;
            margin: 32px 0;
          }
          @media only screen and (max-width: 600px) {
            .container { margin: 0; border-radius: 0; }
            .content { padding: 0 24px 32px 24px; }
            .header { padding: 32px 24px; }
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="container">
            <div class="header">
              ${logoHtml}
            </div>
            <div class="content">
              ${content}
            </div>
            <div class="footer">
              <p style="margin: 0 0 12px 0;">&copy; ${new Date().getFullYear()} <strong>${businessName}</strong>. All rights reserved.</p>
              <p style="margin: 0;">You are receiving this because you're a valued member of the ${businessName} community.</p>
              <p style="margin: 12px 0 0 0;"><a href="#">Unsubscribe</a> &bull; <a href="#">Privacy Policy</a></p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function sendEmail(to: string, subject: string, text: string, html?: string, logoUrl?: string, businessName: string = 'Gryndee') {
  console.log(`[EMAIL] Attempting to send email to: ${to}`);
  console.log(`[EMAIL] Subject: ${subject}`);
  try {
    // Check environment first, then database
    let user = process.env.SMTP_USER;
    let pass = process.env.SMTP_PASS;
    let host = process.env.SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com';
    let port = process.env.SMTP_PORT || '587';
    let secure = process.env.SMTP_SECURE === 'true';
    let fromAddress = process.env.SMTP_FROM || '"Gryndee" <noreply@gryndee.com>';

    if (!user || user === 'mock_user') {
      user = await getSystemSetting('SMTP_USER') || '';
    }
    if (!pass) {
      pass = await getSystemSetting('SMTP_PASS') || '';
    }
    if (!user) {
      console.warn('[EMAIL] SMTP_USER not set in ENV or DB. Cannot send real email.');
      throw new Error('SMTP_USER is not configured.');
    }

    // Sanitize fromAddress to remove escaped quotes if they exist
    if (fromAddress.includes('\\"')) {
      fromAddress = fromAddress.replace(/\\"/g, '"');
    }
    // If it's just a raw email, wrap it nicely
    if (!fromAddress.includes('<') && fromAddress.includes('@')) {
      fromAddress = `"${businessName}" <${fromAddress}>`;
    }

    console.log(`[EMAIL] Using From Address: ${fromAddress}`);
    console.log(`[EMAIL] SMTP Host: ${host}`);
    
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure,
      auth: {
        user,
        pass,
      },
    });

    // Wrap content in layout if it's not already a full HTML document
    const finalHtml = html?.includes('<!DOCTYPE html>') ? html : getEmailLayout(html || text.replace(/\n/g, '<br>'), logoUrl, businessName);

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text,
      html: finalHtml,
    });
    console.log(`[EMAIL] Successfully sent! MessageId: ${info.messageId}`);
    return info;
  } catch (error: any) {
    console.error(`[EMAIL] ERROR sending to ${to}:`, error);
    if (error.code) console.error(`[EMAIL] Error Code: ${error.code}`);
    if (error.command) console.error(`[EMAIL] SMTP Command: ${error.command}`);
    if (error.response) console.error(`[EMAIL] SMTP Response: ${error.response}`);
    throw error;
  }
}

async function sendTemplatedEmail(to: string, subject: string, content: string, accountId: number, html?: string) {
  try {
    const { rows } = await pool.query('SELECT logo_url, business_name FROM settings WHERE account_id = $1', [accountId]);
    const settings = rows[0] || { business_name: 'Gryndee' };
    return await sendEmail(to, subject, content, html, settings.logo_url, settings.business_name);
  } catch (err) {
    console.error('[EMAIL] Failed to send templated email:', err);
    return await sendEmail(to, subject, content, html);
  }
}

async function updateActiveReferralCount(accountId: string) {
  if (!process.env.AWS_DB_PASSWORD) return;
  try {
    // Count users referred by this account who have an active subscription or are on trial
    const { rows } = await pool.query(
      `SELECT COUNT(*) as count 
       FROM accounts 
       WHERE referred_by_id = $1 
       AND (subscription_status = 'active' OR (subscription_plan = 'professional' AND trial_expiry > NOW()))`,
      [accountId]
    );
    const count = parseInt(rows[0].count);
    await pool.query('UPDATE accounts SET active_referral_count = $1 WHERE id = $2', [count, accountId]);
  } catch (err) {
    console.error('Failed to update active referral count:', err);
  }
}

async function createServer() {
  const app = express();

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms - x-user-id: ${req.headers['x-user-id']}`);
    });
    next();
  });
  const PORT = 3000;

  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-requested-with']
  }));
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

  const requireSuperAdmin = async (req: any, res: any, next: any) => {
    console.log(`[AUTH] SuperAdmin check for: ${req.headers['x-user-id']}`);
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role !== 'super_admin') {
        console.warn(`[AUTH] SuperAdmin access denied for user:`, userInfo);
        return res.status(403).json({ error: "Forbidden" });
      }
      req.user = userInfo;
      next();
    } catch (error) {
      console.error('[AUTH] SuperAdmin check error:', error);
      res.status(403).json({ error: "Forbidden" });
    }
  };

  const requireAuth = async (req: any, res: any, next: any) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      req.user = userInfo;
      next();
    } catch (error) {
      console.error('[AUTH] Auth check error:', error);
      res.status(401).json({ error: "Unauthorized" });
    }
  };

  // Paystack Payment Routes
  app.post("/api/payments/initialize", requireAuth, async (req: any, res) => {
    const { amount, email, planId } = req.body;
    if (!amount || !email) {
      return res.status(400).json({ error: "Amount and email are required" });
    }

    try {
      const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecret) {
        console.error('[PAYSTACK] Secret key missing');
        return res.status(503).json({ error: "Payment gateway not configured" });
      }

      console.log(`[PAYSTACK] Initializing payment for ${email}, amount: ${amount}`);
      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
          amount: Math.round(amount * 100), // Paystack expects amount in kobo
          email,
          callback_url: `${process.env.APP_URL}/settings?payment=success`,
          metadata: {
            planId,
            accountId: req.user.accountId,
            userId: req.user.id
          }
        },
        {
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
            'Content-Type': 'application/json'
          }
        }
      );

      res.json(response.data);
    } catch (error: any) {
      const errorData = error.response?.data;
      console.error('[PAYSTACK] Initialization failed:', errorData || error.message);
      res.status(500).json({ 
        error: "Failed to initialize payment", 
        details: errorData?.message || error.message 
      });
    }
  });

  app.get("/api/payments/verify/:reference", requireAuth, async (req: any, res) => {
    const { reference } = req.params;
    
    try {
      const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecret) {
        return res.status(503).json({ error: "Payment gateway not configured" });
      }

      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${paystackSecret}`
          }
        }
      );

      const data = response.data.data;
      if (data.status === 'success') {
        // Update user's subscription status in database
        const { planId, accountId } = data.metadata;
        
        // Update account's subscription plan
        await pool.query(
          'UPDATE accounts SET subscription_plan = $1, subscription_status = $2, last_payment_date = $3 WHERE id = $4',
          [planId, 'active', new Date(), accountId]
        );
        
        console.log(`[PAYSTACK] Payment successful for account ${accountId}, plan ${planId}`);
      }

      res.json(response.data);
    } catch (error: any) {
      console.error('[PAYSTACK] Verification failed:', error.response?.data || error.message);
      res.status(500).json({ error: "Failed to verify payment" });
    }
  });

  // Data Migration Tool
  // Migration route removed as migration to AWS RDS is complete.

  // Chat Endpoints
  app.get('/api/chat/messages', requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    try {
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query('SELECT * FROM chat_messages WHERE user_id = $1 ORDER BY created_at ASC', [userId]);
        res.json(rows);
      } else {
        res.json([]);
      }
    } catch (err) {
      console.error('Failed to fetch chat messages:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/chat/guest/messages', async (req, res) => {
    const guestId = req.query.guestId;
    if (!guestId) return res.status(400).json({ error: 'guestId required' });
    try {
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query('SELECT * FROM chat_messages WHERE guest_id = $1 ORDER BY created_at ASC', [guestId]);
        res.json(rows);
      } else {
        res.json([]);
      }
    } catch (err) {
      console.error('Failed to fetch guest chat messages:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/chat/admin/sessions', requireSuperAdmin, async (req, res) => {
    try {
      if (process.env.AWS_DB_PASSWORD) {
        // Get unique users and guests who have sent messages
        const { rows } = await pool.query(`
          SELECT DISTINCT ON (COALESCE(user_id::text, guest_id))
            user_id, guest_id, account_id, guest_email, created_at, message
          FROM chat_messages
          ORDER BY COALESCE(user_id::text, guest_id), created_at DESC
        `);
        
        // Sort by latest message overall
        rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        res.json(rows);
      } else {
        res.json([]);
      }
    } catch (err) {
      console.error('Failed to fetch chat sessions:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/chat/admin/messages/:id', requireSuperAdmin, async (req, res) => {
    const id = req.params.id;
    try {
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query('SELECT * FROM chat_messages WHERE user_id::text = $1 OR guest_id = $1 ORDER BY created_at ASC', [id]);
        res.json(rows);
      } else {
        res.json([]);
      }
    } catch (err) {
      console.error('Failed to fetch admin chat messages:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/account/subscription", requireAuth, async (req: any, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT subscription_plan, subscription_status, last_payment_date FROM accounts WHERE id = $1',
        [req.user.accountId]
      );
      res.json(rows[0] || { subscription_plan: 'free', subscription_status: 'active' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Merge Accounts
  app.post("/api/admin/merge-accounts", requireSuperAdmin, async (req: any, res) => {
    const { sourceAccountId, targetAccountId } = req.body;
    if (!sourceAccountId || !targetAccountId) return res.status(400).json({ error: "Missing account IDs" });

    try {
      await pool.query('BEGIN');

      // Tables that have account_id
      const tables = ['users', 'products', 'categories', 'product_variants', 'product_images', 'sales', 'sale_items', 'expenses', 'customers', 'services', 'settings', 'notifications'];

      for (const table of tables) {
        await pool.query(`UPDATE ${table} SET account_id = $1 WHERE account_id = $2`, [targetAccountId, sourceAccountId]);
      }

      // Delete the source account
      await pool.query('DELETE FROM accounts WHERE id = $1', [sourceAccountId]);

      await pool.query('COMMIT');
      res.json({ success: true });
    } catch (error: any) {
      await pool.query('ROLLBACK');
      res.status(500).json({ error: error.message });
    }
  });

  // Debug route for searching users
  app.get("/api/debug/search-users/:query", async (req: any, res) => {
    const { query } = req.params;
    try {
      const { rows: users } = await pool.query("SELECT id, email, account_id, role, name FROM users WHERE email ILIKE $1", [`%${query}%`]);
      res.json({ users });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Debug route for users and accounts
  app.get("/api/debug/users", async (req: any, res) => {
    try {
      const { rows: users } = await pool.query("SELECT id, email, account_id, role, name FROM users ORDER BY account_id");
      const { rows: accounts } = await pool.query("SELECT id, name FROM accounts");
      res.json({ users, accounts });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Debug route for inventory visibility
  app.get("/api/debug/inventory/:email", async (req: any, res) => {
    const { email } = req.params;
    try {
      const { rows: users } = await pool.query("SELECT id, email, account_id, role, name FROM users WHERE email = $1", [email]);
      if (users.length === 0) return res.json({ error: "User not found" });

      const user = users[0];
      const { rows: accountUsers } = await pool.query("SELECT id, email, role, name FROM users WHERE account_id = $1", [user.account_id]);
      const { rows: products } = await pool.query("SELECT id, name, created_at FROM products WHERE account_id = $1 LIMIT 50", [user.account_id]);
      const { rows: productCount } = await pool.query("SELECT count(*) as count FROM products WHERE account_id = $1", [user.account_id]);

      res.json({
        user,
        accountUsers,
        products,
        totalProducts: productCount[0].count
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Helper to get account_id from headers or user_id
  const accountIdCache = new Map<string, { data: any, timestamp: number }>();
  const CACHE_TTL = 30000; // 30 seconds

  const _getAccountId = async (req: any, userId: string) => {
    // Handle virtual superadmin
    if (userId === '0') {
      console.log(`[AUTH] Virtual superadmin detected (ID: 0). Checking RDS status...`);
      try {
        // Try RDS first
        if (process.env.AWS_DB_PASSWORD) {
          console.log(`[AUTH] RDS enabled. Looking up System Admin account...`);
          try {
            const { rows } = await pool.query('SELECT id FROM accounts WHERE name = $1 LIMIT 1', ['System Admin']);
            let systemAccount = rows[0];
            if (!systemAccount) {
              console.log(`[AUTH] System Admin account not found in RDS. Creating...`);
              const insertRes = await pool.query('INSERT INTO accounts (name) VALUES ($1) RETURNING id', ['System Admin']);
              systemAccount = insertRes.rows[0];
            }
            console.log(`[AUTH] Virtual superadmin RDS lookup success. Account ID: ${systemAccount?.id}`);
            return { id: '0', account_id: systemAccount?.id || 1, role: 'super_admin' };
          } catch (rdsErr) {
            console.error(`[AUTH] RDS error in virtual superadmin lookup:`, rdsErr);
            // Fallback to ID 1 if RDS fails but we want to allow superadmin
            return { id: '0', account_id: 1, role: 'super_admin' };
          }
        }

        // Fallback to Supabase
        if (supabase) {
          try {
            let { data: systemAccount } = await supabase.from('accounts').select('id').eq('name', 'System Admin').maybeSingle();
            if (!systemAccount) {
              const { data: newAcc, error: accErr } = await supabase.from('accounts').insert([{ name: 'System Admin' }]).select().single();
              if (accErr) {
                console.error(`[AUTH] Failed to create System Admin account in Supabase:`, accErr);
                return { id: '0', account_id: 1, role: 'super_admin' };
              }
              systemAccount = newAcc;
            }
            return { id: '0', account_id: systemAccount?.id || 1, role: 'super_admin' };
          } catch (sbErr) {
            console.error(`[AUTH] Supabase error in virtual superadmin lookup:`, sbErr);
            return { id: '0', account_id: 1, role: 'super_admin' };
          }
        }
        
        return { id: '0', account_id: 1, role: 'super_admin' };
      } catch (e) {
        console.error(`[AUTH] Exception in virtual superadmin account lookup:`, e);
        return { id: '0', account_id: 1, role: 'super_admin' };
      }
    }
    
    try {
      // Try RDS first
      if (process.env.AWS_DB_PASSWORD && !isNaN(Number(userId))) {
        console.log(`[AUTH] Querying RDS for user ID: ${userId}`);
        const { rows } = await pool.query(`
          SELECT u.id, u.account_id, u.role, u.permissions, a.subscription_plan 
          FROM users u 
          JOIN accounts a ON u.account_id = a.id 
          WHERE u.id = $1
        `, [userId]);
        if (rows.length > 0) {
          const user = rows[0];
          if (user.email?.toLowerCase() === 'abinibimultimedia@yahoo.com') {
            user.role = 'super_admin';
          }
          console.log(`[AUTH] User ${userId} found in RDS. Role: ${user.role}, Plan: ${user.subscription_plan}`);
          return user;
        }
        console.log(`[AUTH] User ${userId} not found in RDS users table.`);
      }

      // Fallback to Supabase
      if (supabase) {
        let { data: user, error } = await supabase
          .from('users')
          .select('id, account_id, role, permissions, email, accounts(subscription_plan)')
          .eq('id', userId)
          .single();
        
        if (error || !user) {
          if (error?.code === 'PGRST116' || !user) {
            console.log(`[AUTH] User ID ${userId} not found in users table.`);
            return null;
          }
          console.error(`[AUTH] Failed to find user for ID ${userId}:`, error);
          return null;
        }
        
        if (user.email?.toLowerCase() === 'abinibimultimedia@yahoo.com') {
          user.role = 'super_admin';
        }
        
        // Flatten the subscription_plan from the joined accounts table
        const flattenedUser = {
          ...user,
          subscription_plan: (user as any).accounts?.subscription_plan || 'free'
        };
        return flattenedUser;
      }

      return null;
    } catch (e) {
      console.error(`[AUTH] Exception in getAccountId for ID ${userId}:`, e);
      return null;
    }
  };

  const getAccountId = async (req: any) => {
    let userId = req.headers['x-user-id'];
    console.log(`[AUTH] getAccountId: userId from header = ${userId}`);
    if (!userId) {
      console.log(`[AUTH] Missing x-user-id header for ${req.method} ${req.url}`);
      return null;
    }
    
    userId = String(userId).trim();

    const cached = accountIdCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const data = await _getAccountId(req, userId);
    if (data) {
      accountIdCache.set(userId, { data, timestamp: Date.now() });
    }
    return data;
  };

  const authenticateToken = async (req: any, res: any, next: any) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      req.user = userInfo;
      next();
    } catch (error) {
      console.error('[AUTH] Token authentication error:', error);
      res.status(401).json({ error: "Unauthorized" });
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
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || (userInfo.role !== 'admin' && userInfo.role !== 'super_admin')) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const runSql = async (sql: string) => {
        if (process.env.AWS_DB_PASSWORD) {
          try {
            await pool.query(sql);
          } catch (e: any) {
            console.warn(`[DIAG] RDS Setup warning: ${e.message}`);
          }
        }
        if (supabase) {
          const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
          if (error) console.warn(`[DIAG] Supabase Setup warning: ${error.message}`);
        }
      };

      // Ensure RLS is disabled on all tables to avoid join issues
      const tablesToDisableRLS = [
        'accounts', 'users', 'categories', 'products', 'product_variants', 
        'product_images', 'sales', 'sale_items', 'expenses', 'customers', 
        'settings', 'notifications', 'services', 'bookkeeping'
      ];

      const setupSql = `
-- 0. Accounts (Multi-tenancy)
CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
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
  -- Add is_active to accounts
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='is_active') THEN
    ALTER TABLE accounts ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;

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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='invoice_number') THEN
      ALTER TABLE sales ADD COLUMN invoice_number TEXT;
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='total_profit') THEN
      ALTER TABLE sales ADD COLUMN total_profit DECIMAL(12,2) DEFAULT 0;
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
  END IF;

  -- Settings
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='settings') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='account_id') THEN
      ALTER TABLE settings ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
      UPDATE settings SET account_id = (SELECT id FROM accounts LIMIT 1) WHERE account_id IS NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='invoice_terms') THEN
      ALTER TABLE settings ADD COLUMN invoice_terms TEXT;
    END IF;
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='category') THEN
      ALTER TABLE services ADD COLUMN category TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='services' AND column_name='image_url') THEN
      ALTER TABLE services ADD COLUMN image_url TEXT;
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='invoice_number') THEN
      ALTER TABLE sales ADD COLUMN invoice_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='total_profit') THEN
      ALTER TABLE sales ADD COLUMN total_profit DECIMAL(12,2) DEFAULT 0;
    END IF;
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
  category TEXT,
  image_url TEXT,
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
  product_name TEXT,
  service_name TEXT,
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
        await runSql(statement);
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Diagnostics
  app.get("/api/diag", async (req, res) => {
    let geminiKey = !!process.env.GEMINI_API_KEY;
    if (process.env.AWS_DB_PASSWORD) {
      const { rows } = await pool.query("SELECT value FROM system_settings WHERE key = 'GEMINI_API_KEY' LIMIT 1");
      if (rows.length > 0 && rows[0].value) geminiKey = true;
    }

    if (!supabase) {
      return res.json({
        version: "2.4.9-stable",
        supabase_connected: false,
        supabase_status,
        tables: {},
        env: {
          cloudinary: !!process.env.CLOUDINARY_CLOUD_NAME,
          aws_s3: !!process.env.AWS_S3_BUCKET_NAME,
          gemini: geminiKey,
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
        aws_s3: !!process.env.AWS_S3_BUCKET_NAME,
        gemini: !!process.env.GEMINI_API_KEY,
        smtp: !!process.env.SMTP_USER
      }
    });
  });

  // --- NEW FEATURES: EXPENSES, CUSTOMERS, SERVICES, AI (MOVED TO TOP OF API) ---

  app.get("/api/services", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.json([]);

      const { rows } = await pool.query('SELECT * FROM services WHERE account_id = $1 ORDER BY name ASC', [userInfo.account_id]);
      return res.json(rows || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/services", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role === 'staff') return res.status(403).json({ error: "Forbidden" });

      const { name, description, price, duration_minutes, category, image_url } = req.body;
      let finalImageUrl = image_url;
      if (image_url && image_url.startsWith('data:image')) {
        finalImageUrl = await uploadToCloudinary(image_url, 'services');
      }

      const { rows } = await pool.query(
        'INSERT INTO services (account_id, name, description, price, duration_minutes, category, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [userInfo.account_id, name, description, price, duration_minutes, category, finalImageUrl]
      );
      return res.json(rows[0]);
    } catch (error: any) {
      console.error('[SERVICES] Error in POST /api/services:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/services/:id", async (req, res) => {
    const { id } = req.params;
    const { name, description, price, duration_minutes, category, image_url } = req.body;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role === 'staff') return res.status(403).json({ error: "Forbidden" });

      let finalImageUrl = image_url;
      if (image_url && image_url.startsWith('data:image')) {
        finalImageUrl = await uploadToCloudinary(image_url, 'services');
      }

      const { rows } = await pool.query(
        'UPDATE services SET name = $1, description = $2, price = $3, duration_minutes = $4, category = $5, image_url = COALESCE($6, image_url) WHERE id = $7 AND account_id = $8 RETURNING *',
        [name, description, price, duration_minutes, category, finalImageUrl, id, userInfo.account_id]
      );
      return res.json(rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/services/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role === 'staff') return res.status(403).json({ error: "Forbidden" });

      await pool.query('DELETE FROM services WHERE id = $1 AND account_id = $2', [id, userInfo.account_id]);
      return res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Expenses API
  app.get("/api/expenses", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.json([]);
      
      if (!hasPermission(userInfo, 'can_view_expenses')) return res.status(403).json({ error: "Forbidden" });

      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query('SELECT * FROM expenses WHERE account_id = $1 ORDER BY date DESC', [userInfo.account_id]);
        return res.json(rows || []);
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
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
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || !hasPermission(userInfo, 'can_manage_expenses')) return res.status(403).json({ error: "Forbidden" });

      const { category, amount, description, date } = req.body;
      const finalDate = date || new Date().toISOString();

      if (process.env.AWS_DB_PASSWORD) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const { rows } = await client.query(
            'INSERT INTO expenses (account_id, category, amount, description, date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [userInfo.account_id, category, parseFloat(amount), description, finalDate]
          );
          
          await client.query(
            'INSERT INTO bookkeeping (account_id, type, nature, amount, description, date) VALUES ($1, $2, $3, $4, $5, $6)',
            [userInfo.account_id, 'Expense', 'expense', parseFloat(amount), `Expense - ${category}: ${description}`, finalDate.split('T')[0]]
          );
          
          await client.query('COMMIT');
          return res.json(rows[0]);
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
      const { data, error } = await supabase
        .from('expenses')
        .insert([{ 
          account_id: userInfo.account_id,
          category, amount, description, date: finalDate 
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
    const { id } = req.params;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || !hasPermission(userInfo, 'can_manage_expenses')) return res.status(403).json({ error: "Forbidden" });

      await pool.query('DELETE FROM expenses WHERE id = $1 AND account_id = $2', [id, userInfo.account_id]);
      return res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Customers API
  app.get("/api/customers", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.json([]);

      const { rows } = await pool.query('SELECT * FROM customers WHERE account_id = $1 ORDER BY name ASC', [userInfo.account_id]);
      return res.json(rows || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      const { name, phone, email, address } = req.body;

      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query(
          'INSERT INTO customers (account_id, name, phone, email, address) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [userInfo.account_id, name, phone, email, address]
        );
        return res.json(rows[0]);
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
      const customerData: any = { 
        account_id: userInfo.account_id,
        name, phone, email, address
      };
      
      let result = await supabase.from('customers').insert([customerData]).select().single();

      if (result.error) throw result.error;
      res.json(result.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/customers/:id", async (req, res) => {
    const { id } = req.params;
    const { name, phone, email, address } = req.body;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query(
          'UPDATE customers SET name = $1, phone = $2, email = $3, address = $4 WHERE id = $5 AND account_id = $6 RETURNING *',
          [name, phone, email, address, id, userInfo.account_id]
        );
        return res.json(rows[0]);
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
      const { data, error } = await supabase
        .from('customers')
        .update({ name, phone, email, address })
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

  app.delete("/api/customers/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      if (process.env.AWS_DB_PASSWORD) {
        await pool.query('DELETE FROM customers WHERE id = $1 AND account_id = $2', [id, userInfo.account_id]);
        return res.json({ success: true });
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)
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



  // Landing Page CMS API
  const DEFAULT_LANDING_CONFIG = {
    hero: {
      badge: "Empowering African MSMEs",
      title: "The Smartest Way To Run Your Business.",
      subtitle: "Gryndee simplifies your operations, automates your bookkeeping, and provides AI-powered insights to help your business thrive.",
      ctaText: "Get Started Free",
      image: "https://picsum.photos/seed/gryndee-dashboard/1200/1400",
      appStoreUrl: "#",
      playStoreUrl: "#"
    },
    logo: {
      text: "Gryndee",
      url: "",
      favicon: ""
    },
    brandColor: "#9c4608",
    features: [
      {
        id: 1,
        title: "Effortless Sales & POS Management.",
        description: "Record sales in seconds, whether you're online or offline. Our intuitive POS interface is designed for speed, helping you serve customers faster and never miss a transaction.",
        image: "https://picsum.photos/seed/gryndee-sales/1000/800"
      },
      {
        id: 2,
        title: "Automated Bookkeeping & Finance.",
        description: "Say goodbye to manual spreadsheets. Gryndee automatically tracks your income, expenses, and taxes, giving you a clear picture of your financial health at all times.",
        image: "https://picsum.photos/seed/gryndee-finance/1000/800"
      },
      {
        id: 3,
        title: "AI-Powered Business Insights.",
        description: "Get personalized advice from Gryndee AI. Our intelligent advisor analyzes your data to help you optimize pricing, manage stock, and grow your revenue.",
        image: "https://picsum.photos/seed/gryndee-ai/1000/800"
      }
    ],
    howItWorks: {
      title: "How Gryndee Works",
      subtitle: "Three simple steps to transform your business operations.",
      steps: [
        {
          id: 1,
          title: "Set Up Your Profile",
          description: "Create your account and customize your business settings in minutes."
        },
        {
          id: 2,
          title: "Record Your Data",
          description: "Start tracking sales, expenses, and inventory with ease."
        },
        {
          id: 3,
          title: "Grow Your Business",
          description: "Use AI insights and detailed reports to make smarter decisions."
        }
      ]
    },
    testimonials: [
      {
        id: 1,
        name: "Chidi Okafor",
        role: "Retail Store Owner",
        content: "Gryndee has completely changed how I manage my shop. I can now track every sale and know exactly how much profit I'm making each day."
      },
      {
        id: 2,
        name: "Amina Yusuf",
        role: "Boutique Owner",
        content: "The AI Advisor is like having a business consultant in my pocket. It helped me identify which products were my best sellers."
      }
    ],
    faq: [
      {
        id: 1,
        question: "Is Gryndee free to use?",
        answer: "Yes, Gryndee offers a free tier for small businesses to get started. As you grow, you can upgrade to a pro plan for more advanced features."
      },
      {
        id: 2,
        question: "Can I use Gryndee offline?",
        answer: "Absolutely! Gryndee's POS works offline, and your data will automatically sync once you're back online."
      }
    ],
    footer: {
      description: "The intelligent business management app for African MSMEs. Simple, smart, and stress-free.",
      socials: [
        { name: "Twitter", url: "#" },
        { name: "Instagram", url: "#" },
        { name: "LinkedIn", url: "#" },
        { name: "Facebook", url: "#" }
      ],
      copyright: "© 2026 Gryndee. All rights reserved."
    },
    pages: {
      about: {
        title: "About Us",
        content: "Gryndee is the intelligent business management app designed specifically for African MSMEs. Our mission is to simplify operations, automate bookkeeping, and provide AI-powered insights to help your business thrive.\n\nWe understand the unique challenges faced by small and medium-sized enterprises in Africa, from managing inventory across multiple locations to handling complex tax reporting. That's why we built Gryndee—a comprehensive, easy-to-use platform that brings all your business tools into one place.\n\nWhether you're running a retail store, a boutique, or a service-based business, Gryndee is here to support your growth every step of the way."
      },
      privacy: {
        title: "Privacy Policy",
        content: "At Gryndee, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our application.\n\nInformation We Collect:\nWe collect personal information that you voluntarily provide to us when registering for the app, expressing an interest in obtaining information about us or our products and services, or otherwise contacting us.\n\nHow We Use Your Information:\nWe use personal information collected via our app for a variety of business purposes described below. We process your personal information for these purposes in reliance on our legitimate business interests, in order to enter into or perform a contract with you, with your consent, and/or for compliance with our legal obligations.\n\nData Security:\nWe have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process. However, please also remember that we cannot guarantee that the internet itself is 100% secure."
      },
      terms: {
        title: "Terms of Service",
        content: "Welcome to Gryndee! These Terms of Service outline the rules and regulations for the use of Gryndee's Website and Application.\n\nBy accessing this app we assume you accept these terms and conditions. Do not continue to use Gryndee if you do not agree to take all of the terms and conditions stated on this page.\n\nLicense:\nUnless otherwise stated, Gryndee and/or its licensors own the intellectual property rights for all material on Gryndee. All intellectual property rights are reserved. You may access this from Gryndee for your own personal use subjected to restrictions set in these terms and conditions.\n\nUser Responsibilities:\nYou must not republish material from Gryndee, sell, rent or sub-license material from Gryndee, reproduce, duplicate or copy material from Gryndee, or redistribute content from Gryndee."
      },
      contact: {
        title: "Contact Support",
        content: "We're here to help! If you have any questions, concerns, or feedback, please don't hesitate to reach out to our support team.\n\nEmail Support:\nFor general inquiries and technical support, email us at support@gryndee.com. We aim to respond to all emails within 24 hours.\n\nPhone Support:\nNeed immediate assistance? Call our support hotline at +234 (0) 800 GRYNDEE during our business hours (Monday - Friday, 9:00 AM - 5:00 PM WAT).\n\nOffice Address:\nGryndee Headquarters\n123 Innovation Drive\nLagos, Nigeria"
      }
    }
  };

  app.get("/api/landing-config", async (req, res) => {
    try {
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query("SELECT value FROM system_settings WHERE key = 'LANDING_CONFIG' LIMIT 1");
        if (rows.length > 0 && rows[0].value) {
          return res.json(JSON.parse(rows[0].value));
        }
      }
      return res.json(DEFAULT_LANDING_CONFIG);
    } catch (error: any) {
      console.error('[CMS] Error fetching landing config:', error);
      res.json(DEFAULT_LANDING_CONFIG);
    }
  });

  app.post("/api/landing-config", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role !== 'super_admin') {
        return res.status(403).json({ error: "Forbidden: Only Super Admin can edit landing page" });
      }

      const config = req.body;
      if (process.env.AWS_DB_PASSWORD) {
        await pool.query(
          "INSERT INTO system_settings (key, value) VALUES ('LANDING_CONFIG', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()",
          [JSON.stringify(config)]
        );
        return res.json({ success: true });
      }
      res.status(503).json({ error: "Database not available" });
    } catch (error: any) {
      console.error('[CMS] Error updating landing config:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/upload", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      const isSuperAdmin = userInfo?.role === 'super_admin' || 
                           userInfo?.email?.toLowerCase() === 'abinibimultimedia@yahoo.com';
      
      if (!userInfo || !isSuperAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { image, folder } = req.body;
      if (!image) return res.status(400).json({ error: "Image is required" });

      const uploadedUrl = await uploadToCloudinary(image, folder || 'landing');
      if (uploadedUrl) {
        return res.json({ url: uploadedUrl });
      }
      throw new Error("Failed to upload image");
    } catch (error: any) {
      console.error('[UPLOAD] Error:', error);
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
      version: "2.5.2", 
      database: dbStatus,
      env: process.env.NODE_ENV 
    });
  });

  // TEMPORARY: Debug endpoint to check SMTP
  app.get("/api/debug/smtp", (req, res) => {
    res.json({
      hasUser: !!process.env.SMTP_USER,
      user: process.env.SMTP_USER,
      hasPass: !!process.env.SMTP_PASS,
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE,
      from: process.env.SMTP_FROM
    });
  });

  // TEMPORARY: Debug endpoint to read logs
  app.get("/api/debug/logs", async (req, res) => {
    if (req.headers.accept?.includes('application/json')) {
      return res.json({ logs: logHistory });
    }
    res.send(`<pre>${logHistory.join('\n')}</pre>`);
  });

  // TEMPORARY: Debug endpoint to test email
  app.get("/api/debug/test-email", async (req, res) => {
    try {
      const info = await sendEmail(
        'admin@gryndee.com',
        'Direct SMTP Test',
        'This is a direct test bypassing the UI.'
      );
      res.json({ success: true, info });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message, code: e.code });
    }
  });

  // Debug endpoint to list users
  app.get("/api/debug/list-users", requireSuperAdmin, async (req: any, res) => {
    try {
      let rdsUsers = [];
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query('SELECT id, username, email, role, account_id FROM users');
        rdsUsers = rows;
      }
      
      let supabaseUsers = [];
      if (supabase) {
        const { data } = await supabase.from('users').select('id, username, email, role, account_id');
        supabaseUsers = data || [];
      }

      res.json({ rds: rdsUsers, supabase: supabaseUsers });
    } catch (e: any) {
      res.status(500).send(e.message);
    }
  });

  // Categories (Moved to top)
  app.get("/api/categories", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });
      
      const { rows } = await pool.query('SELECT * FROM categories WHERE account_id = $1 ORDER BY name', [userInfo.account_id]);
      res.json(rows || []);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/categories", async (req, res) => {
    const { name } = req.body;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role === 'staff') return res.status(403).json({ error: "Forbidden" });

      const { rows } = await pool.query('INSERT INTO categories (account_id, name) VALUES ($1, $2) RETURNING *', [userInfo.account_id, name]);
      res.json(rows[0]);
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Category already exists" });
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role === 'staff') return res.status(403).json({ error: "Forbidden" });

      const { rows } = await pool.query('UPDATE categories SET name = $1 WHERE id = $2 AND account_id = $3 RETURNING *', [name, id, userInfo.account_id]);
      res.json(rows[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.role === 'staff') return res.status(403).json({ error: "Forbidden" });

      const { rows: products } = await pool.query('SELECT id FROM products WHERE category_id = $1 AND account_id = $2 LIMIT 1', [id, userInfo.account_id]);
      if (products.length > 0) {
        return res.status(400).json({ error: "Cannot delete category with associated products" });
      }
      await pool.query('DELETE FROM categories WHERE id = $1 AND account_id = $2', [id, userInfo.account_id]);
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

    const normalizedUsername = username?.trim()?.toLowerCase()?.replace(/\s+/g, '');
    console.log(`[AUTH] Login attempt for: "${normalizedUsername}"`);
    
    // Virtual superadmin login
    const superAdminPass = process.env.SUPERADMIN_PASSWORD;
    const isSuperAdminEmail = normalizedUsername === 'superadmin' || 
                             normalizedUsername === 'admin@gryndee.com' || 
                             normalizedUsername === 'abinibimultimedia@yahoo.com';
                             
    if (superAdminPass && isSuperAdminEmail && password === superAdminPass) {
      console.log(`[AUTH] Virtual superadmin login success: "${normalizedUsername}"`);
      return res.json({ id: '0', username: 'superadmin', email: normalizedUsername, role: 'super_admin', name: 'System Admin' });
    }

    if (!supabase) {
      console.warn('[AUTH] Supabase client not initialized, skipping Supabase check');
    } else {
      console.log(`[AUTH] Supabase client initialized`);
    }

    try {
      let user;
      // Try RDS first
      if (process.env.AWS_DB_PASSWORD) {
        console.log(`[AUTH] Querying AWS RDS for: "${normalizedUsername}"`);
        const { rows } = await pool.query(
          `SELECT u.id, u.username, u.email, u.role, u.name, u.password, u.account_id, u.is_active as user_active, 
                  a.is_active as account_active, a.subscription_plan, a.subscription_status, a.referral_code, 
                  a.referral_count, a.referrals_for_reward, a.active_referral_count, a.trial_expiry, a.invoice_count_month, a.last_payment_date
           FROM users u 
           LEFT JOIN accounts a ON u.account_id = a.id 
           WHERE u.username ILIKE $1 OR u.email ILIKE $1 LIMIT 1`,
          [normalizedUsername]
        );
        user = rows[0];
        if (user) {
          console.log(`[AUTH] User found in RDS: "${user.username}" (ID: ${user.id})`);
        } else {
          console.log(`[AUTH] User NOT found in RDS for: "${normalizedUsername}"`);
        }
      }

      // Fallback to Supabase if not found in RDS
      if (!user && supabase) {
        console.log(`[AUTH] Querying Supabase for: "${normalizedUsername}"`);
        let { data: supabaseUser, error: supabaseError } = await supabase
          .from('users')
          .select('id, username, email, role, name, password, account_id, is_active, accounts(is_active)')
          .or(`username.ilike."${normalizedUsername}",email.ilike."${normalizedUsername}"`)
          .maybeSingle();

        if (supabaseError) {
          console.error(`[AUTH] Supabase query error:`, supabaseError);
        }
        if (supabaseUser) {
          console.log(`[AUTH] User found in Supabase: "${supabaseUser.username}" (ID: ${supabaseUser.id})`);
          user = {
            ...supabaseUser,
            user_active: supabaseUser.is_active,
            account_active: supabaseUser.accounts?.is_active
          };
        } else {
          console.log(`[AUTH] User NOT found in Supabase for: "${normalizedUsername}"`);
        }
      }

      if (user) {
        if (user.account_active === false || user.user_active === false) {
          console.log(`[AUTH] Login failed: "${normalizedUsername}" - Account or User is deactivated.`);
          return res.status(403).json({ error: "Your account has been deactivated. Please contact support." });
        }

        console.log(`[AUTH] User found: "${user.username}" (ID: ${user.id}, Role: ${user.role}, Account: ${user.account_id})`);
        
        // Verify password
        let isPasswordValid = false;
        const storedPassword = user.password || '';
        console.log(`[AUTH] Stored password prefix: ${storedPassword.substring(0, 10)}... Input password length: ${password.length}`);
        
        if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
          isPasswordValid = await bcrypt.compare(password, storedPassword);
          console.log(`[AUTH] Bcrypt comparison result: ${isPasswordValid}`);
        } else {
          // Fallback for plain text passwords (legacy)
          isPasswordValid = storedPassword === password;
          console.log(`[AUTH] Plain text comparison result: ${isPasswordValid}`);
        }

        if (isPasswordValid) {
          console.log(`[AUTH] Login success: "${normalizedUsername}" (ID: ${user.id})`);
          
          // Promote specific user to super_admin
          if (user.email?.toLowerCase() === 'abinibimultimedia@yahoo.com') {
            user.role = 'super_admin';
            console.log(`[AUTH] User promoted to super_admin based on email: "${user.email}"`);
          }
          
          // Update active referral count in background
          if (user.account_id) {
            updateActiveReferralCount(user.account_id).catch(console.error);
          }

          // Don't send password back to client
          const { password: _, ...userWithoutPassword } = user;
          return res.json(userWithoutPassword);
        } else {
          console.log(`[AUTH] Login failed: "${normalizedUsername}" - Password mismatch.`);
          return res.status(401).json({ error: "Invalid username or password" });
        }
      } else {
        console.log(`[AUTH] Login failed: "${normalizedUsername}" - No user found with this username or email`);
        return res.status(401).json({ error: "Invalid username or password" });
      }
    } catch (error) {
      console.error(`[AUTH] Login error:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  app.post(["/api/login", "/api/login/"], loginHandler);

  const registerHandler = async (req: any, res: any) => {
    const { username, email, password, name, accountType, businessType, referralCode } = req.body;
    const normalizedUsername = username?.trim()?.toLowerCase()?.replace(/\s+/g, '');
    const trimmedEmail = email?.trim()?.toLowerCase();
  
  if (!normalizedUsername || !trimmedEmail || !password) {
    return res.status(400).json({ error: "Username, email and password are required" });
  }

  if (!isValidEmail(trimmedEmail)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  console.log(`Register attempt: ${normalizedUsername} (${trimmedEmail})`);

  try {
    // Try RDS first
    if (process.env.AWS_DB_PASSWORD) {
      const { rows: existing } = await pool.query(
        'SELECT id, username, email FROM users WHERE username ILIKE $1 OR email ILIKE $2 LIMIT 1',
        [normalizedUsername, trimmedEmail]
      );

      if (existing.length > 0) {
        console.warn(`[AUTH] Registration failed: User already exists in RDS. Found: ${JSON.stringify(existing[0])}`);
        return res.status(400).json({ error: "Username or email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Check if referral code is valid
        let referredByAccountId = null;
        if (referralCode) {
          const { rows: referrerRows } = await client.query(
            'SELECT id FROM accounts WHERE referral_code = $1 LIMIT 1',
            [referralCode.toUpperCase()]
          );
          if (referrerRows.length > 0) {
            referredByAccountId = referrerRows[0].id;
          }
        }

        // Generate a new unique referral code for this account
        const newReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        // 1. Create Account
        const { rows: accountRows } = await client.query(
          'INSERT INTO accounts (name, account_type, business_type, referral_code, referred_by_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [name || normalizedUsername, accountType || 'personal', businessType, newReferralCode, referredByAccountId]
        );
        const account = accountRows[0];

        // 2. Create User
        const { rows: userRows } = await client.query(
          'INSERT INTO users (account_id, username, email, password, role, name, verification_code, verification_expires, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false) RETURNING id',
          [account.id, normalizedUsername, trimmedEmail, hashedPassword, 'admin', name?.trim() || normalizedUsername, verificationCode, verificationExpires]
        );
        const newUser = userRows[0];

        // 3. Update Account owner
        await client.query('UPDATE accounts SET owner_id = $1 WHERE id = $2', [newUser.id, account.id]);

        // 4. Create settings
        let globalWelcomeSubject = 'Verify your Gryndee Account';
        let globalWelcomeBody = `Hi {name},\n\nYour account has been successfully created.\n\nPlease verify your email by entering the following 6-digit code:\n\n{verification_code}\n\nThis code will expire in 10 minutes.\n\nBest regards,\nThe Gryndee Team`;

        try {
          const { rows: superAdminRows } = await client.query(
            "SELECT s.welcome_email_subject, s.welcome_email_body FROM settings s JOIN users u ON s.account_id = u.account_id WHERE u.role = 'super_admin' LIMIT 1"
          );
          if (superAdminRows.length > 0) {
            if (superAdminRows[0].welcome_email_subject) globalWelcomeSubject = superAdminRows[0].welcome_email_subject;
            if (superAdminRows[0].welcome_email_body) globalWelcomeBody = superAdminRows[0].welcome_email_body;
          }
        } catch (err) {
          console.error('[AUTH] Failed to fetch global email template:', err);
        }

        const welcomeSubject = globalWelcomeSubject;
        const welcomeBody = (globalWelcomeBody || '')
          .replace(/{name}/g, name || normalizedUsername)
          .replace(/{username}/g, normalizedUsername)
          .replace(/{verification_code}/g, verificationCode);
        
        await client.query(
          'INSERT INTO settings (account_id, business_name, currency, brand_color, welcome_email_subject, welcome_email_body) VALUES ($1, $2, $3, $4, $5, $6)',
          [account.id, name || normalizedUsername || 'Gryndee', 'NGN', '#10b981', welcomeSubject, welcomeBody]
        );

        // 5. Referral Notifications & Benefits
        if (referredByAccountId) {
          try {
            // Update Referrer Stats
            await client.query(
              'UPDATE accounts SET referral_count = referral_count + 1, referrals_for_reward = referrals_for_reward + 1, active_referral_count = active_referral_count + 1 WHERE id = $1',
              [referredByAccountId]
            );

            // Check if referrer gets a reward (3 referrals = 1 month)
            const { rows: referrerRows } = await client.query(
              'SELECT referrals_for_reward, trial_expiry, owner_id FROM accounts WHERE id = $1',
              [referredByAccountId]
            );
            
            if (referrerRows.length > 0) {
              const r = referrerRows[0];
              if (r.referrals_for_reward >= 3) {
                // Grant 1 month reward
                let currentExpiry = r.trial_expiry ? new Date(r.trial_expiry) : new Date();
                if (currentExpiry < new Date()) currentExpiry = new Date();
                
                const newExpiry = new Date(currentExpiry);
                newExpiry.setMonth(newExpiry.getMonth() + 1);

                await client.query(
                  'UPDATE accounts SET trial_expiry = $1, referrals_for_reward = 0, subscription_plan = $2, subscription_status = $3 WHERE id = $4',
                  [newExpiry, 'professional', 'active', referredByAccountId]
                );

                // Notify Referrer of Reward
                await client.query(
                  'INSERT INTO notifications (account_id, user_id, title, message, type) VALUES ($1, $2, $3, $4, $5)',
                  [referredByAccountId, r.owner_id, 'Referral Reward!', `Congratulations! You've successfully referred 3 people. We've added 1 month of Pro features to your account!`, 'success']
                );
              } else {
                // Just notify of new referral
                await client.query(
                  'INSERT INTO notifications (account_id, user_id, title, message, type) VALUES ($1, $2, $3, $4, $5)',
                  [referredByAccountId, r.owner_id, 'New Referral!', `Someone just signed up using your referral code! ${3 - r.referrals_for_reward} more to get 1 month of Pro features free.`, 'success']
                );
              }
            }

            // Notify New User & Grant 14-day Pro Trial
            const trialExpiry = new Date();
            trialExpiry.setDate(trialExpiry.getDate() + 14);
            
            await client.query(
              'INSERT INTO notifications (account_id, user_id, title, message, type) VALUES ($1, $2, $3, $4, $5)',
              [account.id, newUser.id, 'Welcome to Gryndee!', `You've successfully used a referral code! You've been granted 14 days of Pro features for free.`, 'success']
            );

            // Update new account to Pro trial
            await client.query(
              'UPDATE accounts SET subscription_plan = $1, subscription_status = $2, trial_expiry = $3 WHERE id = $4',
              ['professional', 'trial', trialExpiry, account.id]
            );
          } catch (err) {
            console.error('[AUTH] Failed to process referral benefits:', err);
          }
        }

        // Send email BEFORE committing
        const verificationLink = `${req.protocol}://${req.get('host')}/verify-email?token=mock-token-${newUser.id}`;
        const emailHtml = `
          <div style="text-align: center; margin-bottom: 32px;">
            <h2 style="color: #111827; margin: 0 0 8px 0; font-size: 24px; font-weight: 800;">Welcome to Gryndee!</h2>
            <p style="color: #6b7280; font-size: 15px; margin: 0;">We're excited to have you on board.</p>
          </div>
          
          <p>Hi ${name || normalizedUsername},</p>
          <p>Your account has been successfully created. You can now start managing your business with ease. Your username is: <strong>${normalizedUsername}</strong></p>
          
          <p>To get started, please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${verificationLink}" class="button">Verify My Email</a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${verificationLink}</p>
          
          <div class="divider"></div>
          
          <p style="font-size: 14px;"><strong>Next steps:</strong></p>
          <ul style="font-size: 14px; color: #4b5563; padding-left: 20px;">
            <li>Set up your business profile</li>
            <li>Add your first product or service</li>
            <li>Record your first sale</li>
          </ul>
        `;

        await sendTemplatedEmail(
          trimmedEmail,
          welcomeSubject,
          welcomeBody,
          account.id,
          emailHtml
        );

        await client.query('COMMIT');
        console.log(`[AUTH] Register success (RDS): "${normalizedUsername}" (ID: ${newUser.id}, Account: ${account.id}).`);
        return res.json({ success: true, requiresVerification: true, email: trimmedEmail });
      } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Registration failed:', error);
        
        if (error.message && error.message.includes('Email address is not verified')) {
          return res.status(400).json({ 
            error: "AWS SES Sandbox Restriction: Your AWS SES account is in the sandbox. You can only send emails TO verified email addresses. Please verify your email address in the AWS SES console or request production access." 
          });
        }
        
        return res.status(500).json({ error: "Failed to send verification email: " + error.message });
      } finally {
        client.release();
      }
    }

    // Fallback to Supabase
    if (!supabase) {
      return res.status(500).json({ error: "Server configuration error: Supabase client is not initialized." });
    }

    // Check if exists case-insensitively
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id, username, email')
      .or(`username.ilike."${normalizedUsername}",email.ilike."${trimmedEmail}"`)
      .maybeSingle();

    if (checkError) {
      console.error('[AUTH] Registration check failed:', checkError);
      return res.status(500).json({ error: `Database error: ${checkError.message}` });
    }

    if (existing) {
      console.warn(`[AUTH] Registration failed: User already exists in Supabase. Found: ${JSON.stringify(existing)}`);
      return res.status(400).json({ error: "Username or email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Create Account first
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .insert([{ name: name?.trim() || normalizedUsername }])
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
        username: normalizedUsername, 
        email: trimmedEmail, 
        password: hashedPassword, 
        role: 'admin', // First user of a new account is ALWAYS admin
        name: name?.trim() || normalizedUsername
      }])
      .select()
      .single();

    if (error) throw error;

    // 3. Update Account with owner_id
    await supabase.from('accounts').update({ owner_id: newUser.id }).eq('id', account.id);

    // 4. Create default settings for this account
    const welcomeSubject = 'Welcome to Gryndee!';
    const welcomeBody = 'Hi {name},\n\nYour account has been successfully created. You can now sign in with your username: {username}.\n\nPlease verify your email by clicking the link below:\n{verification_link}\n\nBest regards,\nThe Gryndee Team';

    await supabase.from('settings').insert([{
      account_id: account.id,
      business_name: name?.trim() || normalizedUsername || 'Gryndee',
      currency: 'NGN',
      brand_color: '#10b981',
      welcome_email_subject: welcomeSubject,
      welcome_email_body: welcomeBody
    }]);

    const userId = newUser.id;
    console.log(`[AUTH] Register success: "${normalizedUsername}" (ID: ${userId}, Account: ${account.id}).`);

    // Send email
    const verificationLink = `${req.protocol}://${req.get('host')}/verify-email?token=mock-token-${newUser.id}`;
    const emailBody = welcomeBody
      .replace('{name}', name || normalizedUsername)
      .replace('{username}', normalizedUsername)
      .replace('{verification_link}', verificationLink);

    const emailHtml = `
      <div style="text-align: center; margin-bottom: 32px;">
        <h2 style="color: #111827; margin: 0 0 8px 0; font-size: 24px; font-weight: 800;">Welcome to Gryndee!</h2>
        <p style="color: #6b7280; font-size: 15px; margin: 0;">We're excited to have you on board.</p>
      </div>
      
      <p>Hi ${name || normalizedUsername},</p>
      <p>Your account has been successfully created. You can now start managing your business with ease. Your username is: <strong>${normalizedUsername}</strong></p>
      
      <p>To get started, please verify your email address by clicking the button below:</p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${verificationLink}" class="button">Verify My Email</a>
      </div>
      
      <p style="color: #6b7280; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${verificationLink}</p>
      
      <div class="divider"></div>
      
      <p style="font-size: 14px;"><strong>Next steps:</strong></p>
      <ul style="font-size: 14px; color: #4b5563; padding-left: 20px;">
        <li>Set up your business profile</li>
        <li>Add your first product or service</li>
        <li>Record your first sale</li>
      </ul>
    `;

    sendTemplatedEmail(
      trimmedEmail,
      welcomeSubject,
      emailBody,
      account.id,
      emailHtml
    ).catch(err => console.error('Failed to send registration email:', err));

    // Create notification
    await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        title: 'Welcome!',
        message: 'Your account has been successfully created. Welcome to Gryndee!',
        type: 'info'
      }]);

    return res.json({ id: newUser.id, username: normalizedUsername, email: trimmedEmail, account_id: account.id, role: 'admin' });
  } catch (e: any) {
    console.error(`Register failed:`, e);
    res.status(400).json({ error: e.message || "Registration failed. Please try again." });
  }
};

  app.post(["/api/register", "/api/register/"], registerHandler);

  // Verify Email Route
  app.post("/api/auth/verify-email", async (req: any, res: any) => {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: "Email and code are required" });
    }

    try {
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query(
          `SELECT u.id, u.username, u.role, u.account_id, u.name, u.verification_code, u.verification_expires,
                  a.subscription_plan, a.subscription_status, a.referral_code, a.referral_count, a.referrals_for_reward, a.active_referral_count, a.trial_expiry, a.invoice_count_month
           FROM users u 
           LEFT JOIN accounts a ON u.account_id = a.id
           WHERE u.email = $1`,
          [email]
        );

        if (rows.length === 0) {
          return res.status(400).json({ error: "User not found" });
        }

        const user = rows[0];

        if (user.verification_code !== code) {
          return res.status(400).json({ error: "Invalid verification code" });
        }

        if (new Date(user.verification_expires) < new Date()) {
          return res.status(400).json({ error: "Verification code expired" });
        }

        // Mark as verified
        await pool.query(
          'UPDATE users SET is_verified = true, verification_code = NULL, verification_expires = NULL WHERE id = $1',
          [user.id]
        );

        const { verification_code: _, verification_expires: __, ...userWithoutSecrets } = user;
        return res.json({ ...userWithoutSecrets, email });
      } else {
        return res.status(500).json({ error: "Supabase fallback not implemented for verification" });
      }
    } catch (error) {
      console.error('Verify email error:', error);
      res.status(500).json({ error: "Failed to verify email" });
    }
  });

  app.get("/api/debug/env", (req, res) => {
    res.json({
      SMTP_USER: process.env.SMTP_USER ? 'SET' : 'NOT_SET',
      SMTP_FROM: process.env.SMTP_FROM ? 'SET' : 'NOT_SET',
      AWS_DB_HOST: process.env.AWS_DB_HOST ? 'SET' : 'NOT_SET'
    });
  });

  app.get("/api/debug/users", async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT id, username, email, role FROM users ORDER BY created_at DESC LIMIT 10');
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: any, res) => {
    try {
      if (process.env.AWS_DB_PASSWORD) {
        // Update active referral count in background
        if (req.user.account_id) {
          await updateActiveReferralCount(req.user.account_id);
        }

        const { rows } = await pool.query(
          `SELECT u.id, u.username, u.email, u.role, u.name, u.account_id, u.is_active as user_active, 
                  a.is_active as account_active, a.subscription_plan, a.subscription_status, a.referral_code, 
                  a.referral_count, a.referrals_for_reward, a.active_referral_count, a.trial_expiry, a.invoice_count_month, a.last_payment_date
           FROM users u 
           LEFT JOIN accounts a ON u.account_id = a.id 
           WHERE u.id = $1 LIMIT 1`,
          [req.user.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: "User not found" });
        return res.json(rows[0]);
      } else {
        return res.status(500).json({ error: "RDS not configured" });
      }
    } catch (error) {
      console.error('Me endpoint error:', error);
      res.status(500).json({ error: "Failed to fetch user data" });
    }
  });

  app.post("/api/auth/resend-verification", async (req: any, res: any) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const trimmedEmail = email.trim().toLowerCase();

    try {
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query(
          'SELECT id, username, name, is_verified FROM users WHERE email = $1 LIMIT 1',
          [trimmedEmail]
        );

        if (rows.length === 0) {
          return res.status(400).json({ error: "User not found" });
        }

        const user = rows[0];

        if (user.is_verified) {
          return res.status(400).json({ error: "Account is already verified" });
        }

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await pool.query(
          'UPDATE users SET verification_code = $1, verification_expires = $2 WHERE id = $3',
          [verificationCode, verificationExpires, user.id]
        );

        let globalWelcomeSubject = 'Verify your Gryndee Account';
        let globalWelcomeBody = `Hi {name},\n\nPlease verify your email by entering the following 6-digit code:\n\n{verification_code}\n\nThis code will expire in 10 minutes.\n\nBest regards,\nThe Gryndee Team`;

        try {
          const { rows: superAdminRows } = await pool.query(
            "SELECT s.welcome_email_subject, s.welcome_email_body FROM settings s JOIN users u ON s.account_id = u.account_id WHERE u.role = 'super_admin' LIMIT 1"
          );
          if (superAdminRows.length > 0) {
            if (superAdminRows[0].welcome_email_subject) globalWelcomeSubject = superAdminRows[0].welcome_email_subject;
            if (superAdminRows[0].welcome_email_body) globalWelcomeBody = superAdminRows[0].welcome_email_body;
          }
        } catch (err) {
          console.error('[AUTH] Failed to fetch global email template:', err);
        }

        const welcomeSubject = globalWelcomeSubject;
        const welcomeBody = (globalWelcomeBody || '')
          .replace(/{name}/g, user.name || user.username)
          .replace(/{username}/g, user.username)
          .replace(/{verification_code}/g, verificationCode);

        await sendTemplatedEmail(
          trimmedEmail,
          welcomeSubject,
          welcomeBody,
          user.account_id
        );

        return res.json({ success: true });
      } else {
        return res.status(500).json({ error: "Supabase fallback not implemented for verification" });
      }
    } catch (error: any) {
      console.error('Resend verification error:', error);
      if (error.message && error.message.includes('Email address is not verified')) {
        return res.status(400).json({ 
          error: "AWS SES Sandbox Restriction: Your AWS SES account is in the sandbox. You can only send emails TO verified email addresses. Please verify your email address in the AWS SES console or request production access." 
        });
      }
      res.status(500).json({ error: "Failed to resend verification email: " + error.message });
    }
  });

  app.get("/verify-email", (req, res) => {
    res.send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
        <h1 style="color: #10b981; font-size: 32px; margin-bottom: 20px;">Email Verified!</h1>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">Your email has been successfully verified. You can now close this window and continue using Gryndee.</p>
        <div style="margin-top: 30px;">
          <a href="/" style="display: inline-block; padding: 12px 30px; background-color: #10b981; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; transition: all 0.2s;">Go to Dashboard</a>
        </div>
      </div>
    `);
  });

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
        const { rows } = await pool.query('UPDATE users SET reset_code = $1, reset_expires = $2 WHERE email = $3 RETURNING username, account_id', [code, expires, email]);
        user = rows[0];
      } else {
        const { data, error } = await supabase
          .from('users')
          .update({ reset_code: code, reset_expires: expires.toISOString() })
          .eq('email', email)
          .select('username, account_id')
          .maybeSingle();
        if (error) throw error;
        user = data;
      }

      if (!user) {
        // Don't reveal if user exists for security
        return res.json({ message: "If an account exists with this email, a code has been sent." });
      }

      await sendTemplatedEmail(
        email,
        'Password Reset Code - Gryndee',
        `Your password reset code is: ${code}. It expires in 30 minutes.`,
        user.account_id,
        `
        <div style="text-align: center; margin-bottom: 32px;">
          <h2 style="color: #111827; margin: 0 0 8px 0; font-size: 24px; font-weight: 800;">Reset Your Password</h2>
          <p style="color: #6b7280; font-size: 15px; margin: 0;">Security Verification</p>
        </div>
        
        <p>Hi ${user.username},</p>
        <p>We received a request to reset your password. Use the verification code below to continue. This code will expire in 30 minutes.</p>
        
        <div style="background-color: #f9fafb; border: 2px dashed #e5e7eb; padding: 32px; border-radius: 16px; margin: 32px 0; text-align: center;">
          <div style="font-size: 12px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px;">Your Reset Code</div>
          <div style="font-size: 48px; font-weight: 800; color: #111827; letter-spacing: 0.2em;">${code}</div>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email. Your account remains secure.</p>
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
  app.post("/api/admin/test-email", requireAuth, async (req: any, res) => {
    const { email, subject, body } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    try {
      const emailSubject = subject || 'Gryndee SMTP Test';
      const emailText = body ? body.replace(/{name}/g, 'Test User').replace(/{username}/g, 'testuser') : 'This is a test email from your Gryndee application. If you received this, your SMTP settings are working correctly!';
      const emailHtml = body 
        ? `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
            <p style="white-space: pre-wrap; font-size: 16px; color: #374151; line-height: 1.5;">${emailText}</p>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="font-size: 12px; color: #6b7280;">Sent at: ${new Date().toLocaleString()}</p>
          </div>
        `
        : `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
            <h2 style="color: #10b981; margin-top: 0;">SMTP Test Successful!</h2>
            <p>This is a test email from your <strong>Gryndee</strong> application.</p>
            <p>If you received this, your SMTP settings (AWS SES) are configured correctly.</p>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="font-size: 12px; color: #6b7280;">Sent at: ${new Date().toLocaleString()}</p>
          </div>
        `;

      await sendEmail(
        email,
        emailSubject,
        emailText,
        emailHtml
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
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query('SELECT id, username, email, role, name, permissions FROM users WHERE account_id = $1', [userInfo.account_id]);
        return res.json(rows || []);
      }

      if (!supabase) return res.json([]);
      // Try selecting specific columns first
      let { data, error } = await supabase
        .from('users')
        .select('id, username, email, role, name, permissions')
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
    const { username, password, name, role, email, permissions } = req.body;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || (userInfo.role !== 'admin' && userInfo.role !== 'super_admin' && userInfo.role !== 'owner')) return res.status(403).json({ error: "Forbidden" });

      // Check subscription limits for multi-user
      if (userInfo.subscription_plan === 'free') {
        if (process.env.AWS_DB_PASSWORD) {
          const { rows: countRows } = await pool.query('SELECT COUNT(*) FROM users WHERE account_id = $1', [userInfo.account_id]);
          if (parseInt(countRows[0].count) >= 1) {
            return res.status(403).json({ 
              error: "Multi-user support is only available on the Professional plan. Upgrade to add staff members.",
              limitReached: true 
            });
          }
        } else if (supabase) {
          const { count, error: countErr } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', userInfo.account_id);
          
          if (!countErr && count !== null && count >= 1) {
            return res.status(403).json({ 
              error: "Multi-user support is only available on the Professional plan. Upgrade to add staff members.",
              limitReached: true 
            });
          }
        }
      }

      // Hash password if provided
      const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query(
          'INSERT INTO users (account_id, username, password, name, role, email, permissions) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, username, email, role, name, permissions',
          [userInfo.account_id, username, hashedPassword, name, role, email, JSON.stringify(permissions || {})]
        );
        return res.json(rows[0]);
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
      const { data, error } = await supabase
        .from('users')
        .insert([{ 
          account_id: userInfo.account_id,
          username, 
          password: hashedPassword, 
          name, role, email,
          permissions: permissions || {}
        }])
        .select('id, username, email, role, name, permissions')
        .single();
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put(["/api/users/:id", "/api/users/:id/"], async (req, res) => {
    const { id } = req.params;
    const { username, password, name, role, email, permissions } = req.body;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || (userInfo.role !== 'admin' && userInfo.role !== 'super_admin' && userInfo.role !== 'owner')) return res.status(403).json({ error: "Forbidden" });

      const updateData: any = { username, name, role, email };
      if (permissions) updateData.permissions = permissions;
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }
      
      if (process.env.AWS_DB_PASSWORD) {
        let query = 'UPDATE users SET username = $1, name = $2, role = $3, email = $4';
        const params = [username, name, role, email];
        if (permissions) {
          params.push(JSON.stringify(permissions));
          query += `, permissions = $${params.length}`;
        }
        if (password) {
          params.push(updateData.password);
          query += `, password = $${params.length}`;
        }
        params.push(id, userInfo.account_id);
        query += ` WHERE id = $${params.length - 1} AND account_id = $${params.length} RETURNING id, username, email, role, name, permissions`;
        
        const { rows } = await pool.query(query, params);
        return res.json(rows[0]);
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .eq('account_id', userInfo.account_id)
        .select('id, username, email, role, name, permissions')
        .single();
      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete(["/api/users/:id", "/api/users/:id/"], async (req, res) => {
    const { id } = req.params;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || (userInfo.role !== 'admin' && userInfo.role !== 'super_admin' && userInfo.role !== 'owner')) return res.status(403).json({ error: "Forbidden" });

      if (process.env.AWS_DB_PASSWORD) {
        await pool.query('DELETE FROM users WHERE id = $1 AND account_id = $2', [id, userInfo.account_id]);
        return res.json({ success: true });
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
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
  const hasPermission = (userInfo: any, permission: string) => {
    if (userInfo.role === 'admin' || userInfo.role === 'super_admin' || userInfo.role === 'owner' || userInfo.role === 'manager') return true;
    if (!userInfo.permissions) return false;
    const perms = typeof userInfo.permissions === 'string' ? JSON.parse(userInfo.permissions) : userInfo.permissions;
    return !!perms[permission];
  };

  app.get("/api/products", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.json([]);

      const excludeImages = req.query.exclude_images === 'true';

      // Try RDS first
      if (process.env.AWS_DB_PASSWORD) {
        console.log(`[DB] Fetching products from AWS RDS for account ${userInfo.account_id} (excludeImages: ${excludeImages})`);
        const { rows: products } = await pool.query(
          'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.account_id = $1 ORDER BY p.created_at DESC',
          [userInfo.account_id]
        );
        
        if (products.length > 0) {
          const productIds = products.map(p => p.id);
          
          const { rows: allVariants } = await pool.query(
            'SELECT * FROM product_variants WHERE product_id = ANY($1)',
            [productIds]
          );
          
          let allImages: any[] = [];
          if (!excludeImages) {
            const { rows } = await pool.query(
              'SELECT product_id, image_data FROM product_images WHERE product_id = ANY($1)',
              [productIds]
            );
            allImages = rows;
          }

          for (const product of products) {
            const variants = allVariants.filter(v => v.product_id === product.id);
            const images = allImages.filter(i => i.product_id === product.id);
            
            product.product_variants = variants;
            product.categories = { name: product.category_name };
            product.variants = variants;
            product.total_stock = variants.reduce((acc: number, v: any) => acc + (v.quantity || 0), 0);
            product.images = images.map((img: any) => img.image_data);
          }
        }

        return res.json(products);
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
      if (!userInfo || !hasPermission(userInfo, 'can_manage_products')) return res.status(403).json({ error: "Forbidden" });

      const { name, category_id, description, cost_price, selling_price, supplier_name, unit, pieces_per_unit, product_type, variants, images } = req.body;

      // Check subscription limits for products
      if (userInfo.subscription_plan === 'free') {
        if (process.env.AWS_DB_PASSWORD) {
          const { rows: countRows } = await pool.query('SELECT COUNT(*) FROM products WHERE account_id = $1', [userInfo.account_id]);
          if (parseInt(countRows[0].count) >= 20) {
            return res.status(403).json({ 
              error: "Product limit reached for Starter plan (20 products). Upgrade to Professional for unlimited products.",
              limitReached: true 
            });
          }
        } else if (supabase) {
          const { count, error: countErr } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', userInfo.account_id);
          
          if (!countErr && count !== null && count >= 20) {
            return res.status(403).json({ 
              error: "Product limit reached for Starter plan (20 products). Upgrade to Professional for unlimited products.",
              limitReached: true 
            });
          }
        }
      }

      // Try RDS first
      if (process.env.AWS_DB_PASSWORD) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const { rows: productRows } = await client.query(
            'INSERT INTO products (account_id, name, category_id, description, cost_price, selling_price, supplier_name, unit, pieces_per_unit, product_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
            [userInfo.account_id, name, category_id, description, cost_price, selling_price, supplier_name, unit, pieces_per_unit, product_type]
          );
          const product = productRows[0];
          const productId = product.id;

          if (variants && Array.isArray(variants)) {
            for (const v of variants) {
              await client.query(
                'INSERT INTO product_variants (account_id, product_id, size, color, quantity, low_stock_threshold, price_override) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [userInfo.account_id, productId, v.size, v.color, v.quantity, v.low_stock_threshold, v.price_override]
              );
            }
          }

          if (images && Array.isArray(images) && images.length > 0) {
            for (const img of images) {
              const finalUrl = await uploadToCloudinary(img);
              await client.query(
                'INSERT INTO product_images (account_id, product_id, image_data) VALUES ($1, $2, $3)',
                [userInfo.account_id, productId, finalUrl]
              );
            }
          }

          await client.query('COMMIT');
          return res.json({ id: productId });
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
    const { id } = req.params;
    const { name, category_id, description, cost_price, selling_price, supplier_name, unit, pieces_per_unit, product_type, variants, images } = req.body;
    
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || !hasPermission(userInfo, 'can_manage_products')) return res.status(403).json({ error: "Forbidden" });

      if (process.env.AWS_DB_PASSWORD) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(
            'UPDATE products SET name = $1, category_id = $2, description = $3, cost_price = $4, selling_price = $5, supplier_name = $6, unit = $7, pieces_per_unit = $8 WHERE id = $9 AND account_id = $10',
            [name, category_id, description, cost_price, selling_price, supplier_name, unit, pieces_per_unit, id, userInfo.account_id]
          );

          if (variants && Array.isArray(variants)) {
            // Simple approach: delete and re-insert variants
            await client.query('DELETE FROM product_variants WHERE product_id = $1', [id]);
            for (const v of variants) {
              await client.query(
                'INSERT INTO product_variants (account_id, product_id, size, color, quantity, low_stock_threshold, price_override) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [userInfo.account_id, id, v.size, v.color, v.quantity, v.low_stock_threshold, v.price_override]
              );
            }
          }
          await client.query('COMMIT');
          return res.json({ success: true });
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
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
    const { id } = req.params;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || !hasPermission(userInfo, 'can_manage_products')) return res.status(403).json({ error: "Forbidden" });

      if (process.env.AWS_DB_PASSWORD) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          // Check if product is in any sales
          const { rows: sales } = await client.query(`
            SELECT si.id FROM sale_items si 
            JOIN product_variants pv ON si.variant_id = pv.id 
            WHERE pv.product_id = $1 AND si.account_id = $2 LIMIT 1
          `, [id, userInfo.account_id]);
          
          if (sales.length > 0) {
            return res.status(400).json({ error: "Cannot delete product with associated sales" });
          }

          await client.query('DELETE FROM product_variants WHERE product_id = $1', [id]);
          await client.query('DELETE FROM product_images WHERE product_id = $1', [id]);
          await client.query('DELETE FROM products WHERE id = $1 AND account_id = $2', [id, userInfo.account_id]);
          await client.query('COMMIT');
          return res.json({ success: true });
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
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
    let defaultSettings = { 
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
      phone_number: '',
      invoice_terms: ''
    };

    // Try to get defaults from landing config
    try {
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query("SELECT value FROM system_settings WHERE key = 'LANDING_CONFIG' LIMIT 1");
        if (rows.length > 0 && rows[0].value) {
          const landingConfig = JSON.parse(rows[0].value);
          if (landingConfig.brandColor) defaultSettings.brand_color = landingConfig.brandColor;
          if (landingConfig.logo?.url) defaultSettings.logo_url = landingConfig.logo.url;
          if (landingConfig.logo?.text) defaultSettings.business_name = landingConfig.logo.text;
        }
      }
    } catch (e) {
      console.error('[SETTINGS] Error fetching landing config for defaults:', e);
    }

    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.json(defaultSettings);

      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query(`
          SELECT a.business_type, a.legal_structure, s.*
          FROM accounts a
          LEFT JOIN settings s ON a.id = s.account_id
          WHERE a.id = $1
        `, [userInfo.account_id]);
        
        if (rows.length > 0) {
          const settings = rows[0];
          return res.json({
            ...defaultSettings,
            ...settings,
            account_id: userInfo.account_id,
            business_type: settings.business_type || '',
            legal_structure: settings.legal_structure || 'Sole Proprietorship / Business Name'
          });
        }
        
        return res.json({ 
          account_id: userInfo.account_id, 
          ...defaultSettings, 
          business_type: '',
          legal_structure: 'Sole Proprietorship / Business Name'
        });
      }

      if (!supabase) return res.json(defaultSettings);
      const { data: settingsData, error: settingsError } = await supabase.from('settings').select('*').eq('account_id', userInfo.account_id).maybeSingle();
      const { data: accountData, error: accountError } = await supabase.from('accounts').select('business_type, legal_structure').eq('id', userInfo.account_id).maybeSingle();
      
      if (settingsError) throw settingsError;
      
      let settings = {
        ...defaultSettings,
        ...(settingsData || {}),
        account_id: userInfo.account_id,
        business_type: accountData?.business_type || '',
        legal_structure: accountData?.legal_structure || 'Sole Proprietorship / Business Name'
      };
      res.json(settings);
    } catch (error) {
      console.error('[SETTINGS] GET error:', error);
      res.json(defaultSettings);
    }
  });

  app.post(["/api/settings", "/api/settings/"], async (req, res) => {
    const { 
      business_name, currency, vat_enabled, low_stock_threshold, logo_url, brand_color,
      slogan, address, email, website, phone_number, welcome_email_subject, welcome_email_body,
      invoice_terms, bank_name, account_name, account_number, business_type, legal_structure
    } = req.body;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });
      
      console.log(`[SETTINGS] POST for account ${userInfo.account_id}:`, req.body);
      
      if (process.env.AWS_DB_PASSWORD) {
        // Update business_type and legal_structure in accounts table
        if (business_type || legal_structure) {
          try {
            const updates = [];
            const values = [];
            if (business_type) {
              updates.push(`business_type = $${updates.length + 1}`);
              values.push(business_type);
            }
            if (legal_structure) {
              updates.push(`legal_structure = $${updates.length + 1}`);
              values.push(legal_structure);
            }
            values.push(userInfo.account_id);
            await pool.query(`UPDATE accounts SET ${updates.join(', ')} WHERE id = $${values.length}`, values);
            console.log(`[SETTINGS] Updated accounts table for ${userInfo.account_id}`);
          } catch (accErr) {
            console.error(`[SETTINGS] Failed to update accounts table:`, accErr);
            // Continue to update settings table even if accounts update fails, 
            // but we might want to know why it failed.
          }
        }

        const { rows: existing } = await pool.query('SELECT id FROM settings WHERE account_id = $1', [userInfo.account_id]);
        
        const settingsFields = {
          business_name, currency, vat_enabled, low_stock_threshold, logo_url, brand_color,
          slogan, address, email, website, phone_number, welcome_email_subject, welcome_email_body,
          invoice_terms, bank_name, account_name, account_number
        };

        if (existing.length > 0) {
          const updates = [];
          const values = [];
          for (const [key, value] of Object.entries(settingsFields)) {
            if (value !== undefined) {
              updates.push(`${key} = $${updates.length + 1}`);
              values.push(value);
            }
          }
          
          if (updates.length > 0) {
            values.push(userInfo.account_id);
            const { rows } = await pool.query(
              `UPDATE settings SET ${updates.join(', ')} WHERE account_id = $${values.length} RETURNING *`,
              values
            );
            return res.json(rows[0]);
          } else {
            const { rows } = await pool.query('SELECT * FROM settings WHERE account_id = $1', [userInfo.account_id]);
            return res.json(rows[0]);
          }
        } else {
          const fields = ['account_id'];
          const values = [userInfo.account_id];
          const placeholders = ['$1'];
          
          for (const [key, value] of Object.entries(settingsFields)) {
            if (value !== undefined) {
              fields.push(key);
              values.push(value);
              placeholders.push(`$${values.length}`);
            }
          }
          
          const { rows } = await pool.query(
            `INSERT INTO settings (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
            values
          );
          return res.json(rows[0]);
        }
      }

      if (supabase) {
        if (business_type || legal_structure) {
          const updates: any = {};
          if (business_type) updates.business_type = business_type;
          if (legal_structure) updates.legal_structure = legal_structure;
          await supabase.from('accounts').update(updates).eq('id', userInfo.account_id);
        }

        const { data: existing } = await supabase.from('settings').select('id').eq('account_id', userInfo.account_id).maybeSingle();
      
        let result;
        const settingsData: any = {};
        const fields = [
          'business_name', 'currency', 'vat_enabled', 'low_stock_threshold', 'logo_url', 'brand_color',
          'slogan', 'address', 'email', 'website', 'phone_number', 'welcome_email_subject', 'welcome_email_body',
          'invoice_terms', 'bank_name', 'account_name', 'account_number'
        ];

        fields.forEach(field => {
          if (req.body[field] !== undefined) {
            settingsData[field] = req.body[field];
          }
        });
        
        if (Object.keys(settingsData).length > 0) {
          if (existing) {
            result = await supabase.from('settings').update(settingsData).eq('id', existing.id).select().single();
          } else {
            result = await supabase.from('settings').insert([{ account_id: userInfo.account_id, ...settingsData }]).select().single();
          }
          
          if (result.error) throw result.error;
          return res.json(result.data);
        } else {
          const { data } = await supabase.from('settings').select('*').eq('account_id', userInfo.account_id).maybeSingle();
          return res.json(data || { account_id: userInfo.account_id });
        }
      }

      res.status(400).json({ error: "No database configured" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Nigeria Tax Report API
  app.get("/api/tax-report", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      const { period = 'year' } = req.query;
      const now = new Date();
      const startDate = period === 'year' ? `${now.getFullYear()}-01-01` : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      let sales: any[] = [];
      let expenses: any[] = [];
      let bookkeeping: any[] = [];
      let accountInfo: any = null;

      if (process.env.AWS_DB_PASSWORD) {
        const { rows: rdsSales } = await pool.query('SELECT * FROM sales WHERE account_id = $1 AND created_at >= $2', [userInfo.account_id, startDate]);
        const { rows: rdsExpenses } = await pool.query('SELECT * FROM expenses WHERE account_id = $1 AND date >= $2', [userInfo.account_id, startDate]);
        const { rows: rdsBookkeeping } = await pool.query('SELECT * FROM bookkeeping WHERE account_id = $1 AND date >= $2', [userInfo.account_id, startDate]);
        const { rows: rdsAccount } = await pool.query('SELECT * FROM accounts WHERE id = $1', [userInfo.account_id]);
        sales = rdsSales || [];
        expenses = rdsExpenses || [];
        bookkeeping = rdsBookkeeping || [];
        accountInfo = rdsAccount[0];
      } else if (supabase) {
        const { data: sSales } = await supabase.from('sales').select('*').eq('account_id', userInfo.account_id).gte('created_at', startDate);
        const { data: sExpenses } = await supabase.from('expenses').select('*').eq('account_id', userInfo.account_id).gte('date', startDate);
        const { data: sBookkeeping } = await supabase.from('bookkeeping').select('*').eq('account_id', userInfo.account_id).gte('date', startDate);
        const { data: sAccount } = await supabase.from('accounts').select('*').eq('id', userInfo.account_id).single();
        sales = sSales || [];
        expenses = sExpenses || [];
        bookkeeping = sBookkeeping || [];
        accountInfo = sAccount;
      } else {
        return res.status(503).json({ error: "Database not available" });
      }

      const totalTurnover = sales.reduce((acc: number, s: any) => acc + (parseFloat(s.total_amount) || 0), 0);
      const totalVatCollected = sales.reduce((acc: number, s: any) => acc + (parseFloat(s.vat_amount || 0) || 0), 0);
      const totalCostOfSales = sales.reduce((acc: number, s: any) => acc + (parseFloat(s.cost_price_total || 0) || 0), 0);
      const totalExpenses = expenses.reduce((acc: number, e: any) => acc + (parseFloat(e.amount) || 0), 0);
      const totalInflows = bookkeeping.reduce((acc: number, b: any) => acc + (parseFloat(b.amount) || 0), 0);

      const grossProfit = totalTurnover - totalCostOfSales;
      const netProfit = grossProfit - totalExpenses;

      const legalStructure = accountInfo?.legal_structure || 'Sole Proprietorship / Business Name';
      const isCompany = legalStructure.includes('Limited') || legalStructure.includes('PLC');
      const isNGO = legalStructure.includes('Trustees') || legalStructure.includes('NGO');

      let citRate = 0;
      let eduTaxRate = 0;
      let taxCategory = 'Personal Income Tax (PIT)';
      let taxAuthority = 'State Internal Revenue Service (SIRS)';
      let estimatedTaxLiability = 0;
      let taxBreakdown = '';
      let deductionsAmount = 0;

      if (isCompany) {
        taxCategory = 'Companies Income Tax (CIT)';
        taxAuthority = 'Federal Internal Revenue Service (FIRS)';
        if (totalTurnover > 100000000) {
          citRate = 0.30;
          eduTaxRate = 0.03;
          taxBreakdown = 'Large Company (30% CIT + 3% Education Tax)';
        } else if (totalTurnover > 25000000) {
          citRate = 0.20;
          eduTaxRate = 0.03;
          taxBreakdown = 'Medium Company (20% CIT + 3% Education Tax)';
        } else {
          citRate = 0;
          eduTaxRate = 0;
          taxBreakdown = 'Small Company (Exempt from CIT & Education Tax)';
        }
        estimatedTaxLiability = Math.max(0, netProfit * citRate) + Math.max(0, netProfit * eduTaxRate);
      } else if (isNGO) {
        taxCategory = 'Non-Profit / Exempt';
        taxAuthority = 'FIRS (for filing)';
        taxBreakdown = 'NGOs are generally tax-exempt but must file annual returns.';
      } else {
        // Sole Proprietorship / Business Name (PIT)
        // Simplified PIT calculation (progressive rates)
        // Consolidated Relief Allowance (CRA): Higher of 200k or 1% of Gross Income, plus 20% of Gross Income
        const grossIncome = totalTurnover;
        const cra = Math.max(200000, 0.01 * grossIncome) + (0.2 * grossIncome);
        const taxableIncome = Math.max(0, netProfit - cra);
        
        // Progressive rates: 7%, 11%, 15%, 19%, 21%, 24%
        let pit = 0;
        let remaining = taxableIncome;
        
        const brackets = [
          { amount: 300000, rate: 0.07 },
          { amount: 300000, rate: 0.11 },
          { amount: 500000, rate: 0.15 },
          { amount: 500000, rate: 0.19 },
          { amount: 1600000, rate: 0.21 },
          { amount: Infinity, rate: 0.24 }
        ];

        for (const bracket of brackets) {
          if (remaining <= 0) break;
          const taxableInBracket = Math.min(remaining, bracket.amount);
          pit += taxableInBracket * bracket.rate;
          remaining -= taxableInBracket;
        }

        estimatedTaxLiability = pit;
        taxBreakdown = taxableIncome > 0 ? 'Personal Income Tax (Progressive Rates after Reliefs)' : 'Below Taxable Threshold after Reliefs';
        deductionsAmount = cra;
      }

      const vatExempt = totalTurnover < 25000000;
      if (isCompany && vatExempt) {
        deductionsAmount = Math.max(0, netProfit);
      }

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
        estimated_cit: isCompany ? Math.max(0, netProfit * citRate) : 0,
        education_tax: isCompany ? Math.max(0, netProfit * eduTaxRate) : 0,
        total_tax_liability: estimatedTaxLiability,
        cit_rate: citRate * 100,
        edu_tax_rate: eduTaxRate * 100,
        currency: 'NGN',
        legal_structure: legalStructure,
        tax_category: taxCategory,
        tax_authority: taxAuthority,
        tax_breakdown: taxBreakdown,
        deductions_amount: deductionsAmount,
        deductions_info: isCompany 
          ? "Your business expenses (Operational Costs) have been deducted from your turnover to arrive at the taxable profit. You may also be eligible for Capital Allowance on your business assets."
          : "A Consolidated Relief Allowance (CRA) has been applied to your profit. This includes a flat 200,000 Naira (or 1% of income) plus 20% of your gross income, which is tax-free.",
        filing_deadlines: {
          cit: isCompany ? "June 30th (or 6 months after your financial year-end)" : "March 31st (Annual Returns for PIT)",
          vat: "21st of every month",
          annual_returns: "Within 42 days after Annual General Meeting (for Companies) or March 31st (for Business Names)"
        },
        compliance_status: {
          is_small_company: totalTurnover < 25000000,
          requires_vat_registration: totalTurnover >= 25000000,
          must_file_even_if_zero: true,
          tcc_info: "You must file your returns annually to obtain a Tax Clearance Certificate (TCC), which is required for government contracts, bank loans, and visa applications."
        }
      });
    } catch (err: any) {
      console.error("Tax report error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Bookkeeping API
  app.get("/api/bookkeeping", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query('SELECT * FROM bookkeeping WHERE account_id = $1 ORDER BY date DESC', [userInfo.account_id]);
        return res.json(rows || []);
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
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
    const { type, nature, amount, description, date } = req.body;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query(
          'INSERT INTO bookkeeping (account_id, type, nature, amount, description, date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
          [userInfo.account_id, type, nature || 'other', parseFloat(amount), description, date || new Date().toISOString().split('T')[0]]
        );
        return res.json(rows[0]);
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
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
    const { id } = req.params;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      if (process.env.AWS_DB_PASSWORD) {
        await pool.query('DELETE FROM bookkeeping WHERE id = $1 AND account_id = $2', [id, userInfo.account_id]);
        return res.json({ success: true });
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
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
    const { id } = req.params;
    const { name, email } = req.body;
    try {
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query(
          'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, username, email, role, name',
          [name, email, id]
        );
        return res.json(rows[0]);
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
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
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    try {
      let storedPassword = '';
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query('SELECT password FROM users WHERE id = $1', [id]);
        if (rows.length === 0) throw new Error("User not found");
        storedPassword = rows[0].password;
      } else {
        if (!supabase) return res.status(503).json({ error: "Database not available" });
        const { data: user, error: fetchError } = await supabase
          .from('users')
          .select('password')
          .eq('id', id)
          .single();
        if (fetchError || !user) throw new Error("User not found");
        storedPassword = user.password;
      }
      
      let isPasswordValid = false;
      if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
        isPasswordValid = await bcrypt.compare(currentPassword, storedPassword);
      } else {
        isPasswordValid = storedPassword === currentPassword;
      }

      if (!isPasswordValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      if (process.env.AWS_DB_PASSWORD) {
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);
      } else {
        const { error: updateError } = await supabase
          .from('users')
          .update({ password: hashedPassword })
          .eq('id', id);
        if (updateError) throw updateError;
      }
      
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
      invoice_number: custom_invoice_number,
      invoice_terms
    } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items in sale" });
    }

    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      // Check subscription limits for invoices
      if (userInfo.subscription_plan === 'free') {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        if (process.env.AWS_DB_PASSWORD) {
          const { rows: countRows } = await pool.query(
            'SELECT COUNT(*) FROM sales WHERE account_id = $1 AND created_at >= $2', 
            [userInfo.account_id, firstDayOfMonth]
          );
          if (parseInt(countRows[0].count) >= 5) {
            return res.status(403).json({ 
              error: "Monthly invoice limit reached for Starter plan (5 invoices). Upgrade to Professional for unlimited invoices.",
              limitReached: true 
            });
          }
        } else if (supabase) {
          const { count, error: countErr } = await supabase
            .from('sales')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', userInfo.account_id)
            .gte('created_at', firstDayOfMonth.toISOString());
          
          if (!countErr && count !== null && count >= 5) {
            return res.status(403).json({ 
              error: "Monthly invoice limit reached for Starter plan (5 invoices). Upgrade to Professional for unlimited invoices.",
              limitReached: true 
            });
          }
        }
      }

      let invoice_number = custom_invoice_number || ("INV-" + Date.now());

      if (process.env.AWS_DB_PASSWORD) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          // Check if invoice number exists
          const { rows: existingSales } = await client.query('SELECT id FROM sales WHERE account_id = $1 AND invoice_number = $2', [userInfo.account_id, invoice_number]);
          if (existingSales.length > 0) {
            if (custom_invoice_number) {
              await client.query('ROLLBACK');
              return res.status(400).json({ error: "Invoice number already exists. Please use a different one." });
            } else {
              invoice_number = "INV-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
            }
          }

          let finalCustomerId = customer_id;
          if (!finalCustomerId && customer_name && customer_phone) {
            const { rows: existingCustomers } = await client.query('SELECT id FROM customers WHERE account_id = $1 AND phone = $2', [userInfo.account_id, customer_phone]);
            if (existingCustomers.length > 0) {
              finalCustomerId = existingCustomers[0].id;
            } else {
              const { rows: newCustomers } = await client.query(
                'INSERT INTO customers (account_id, name, phone, email, address) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [userInfo.account_id, customer_name, customer_phone, customer_email, customer_address]
              );
              finalCustomerId = newCustomers[0].id;
            }
          }

          const validStaffId = (staff_id && !isNaN(Number(staff_id))) ? Number(staff_id) : null;
          const { rows: saleRows } = await client.query(
            'INSERT INTO sales (account_id, invoice_number, customer_name, customer_phone, customer_email, customer_address, total_amount, total_profit, cost_price_total, discount_amount, discount_percentage, vat_amount, payment_method, staff_id, customer_id, status, invoice_terms) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id',
            [userInfo.account_id, invoice_number, customer_name, customer_phone, customer_email, customer_address, 0, 0, 0, discount_amount, discount_percentage, vat_amount, payment_method, validStaffId, finalCustomerId, 'Completed', invoice_terms]
          );
          const saleId = saleRows[0].id;

          let total_amount = 0;
          let total_profit = 0;
          let cost_price_total = 0;

          const { rows: settingsRows } = await client.query('SELECT low_stock_threshold FROM settings WHERE account_id = $1', [userInfo.account_id]);
          const globalThreshold = settingsRows[0]?.low_stock_threshold || 5;

          for (const item of items) {
            let itemName = '';
            let sellingPrice = 0;
            let costPrice = 0;
            let profit = 0;

            if (item.variant_id) {
              const { rows: variants } = await client.query(`
                SELECT pv.*, p.name, p.cost_price, p.selling_price 
                FROM product_variants pv 
                JOIN products p ON pv.product_id = p.id 
                WHERE pv.id = $1
              `, [item.variant_id]);
              
              if (variants.length === 0) throw new Error(`Variant not found: ${item.variant_id}`);
              const v = variants[0];
              itemName = v.name;
              sellingPrice = item.price_override || v.selling_price;
              costPrice = v.cost_price || 0;
              profit = (sellingPrice - costPrice) * item.quantity;
              
              total_amount += sellingPrice * item.quantity;
              total_profit += profit;
              cost_price_total += costPrice * item.quantity;

              // Update stock
              const newQuantity = (v.quantity || 0) - item.quantity;
              await client.query('UPDATE product_variants SET quantity = $1 WHERE id = $2', [newQuantity, item.variant_id]);
              
              // Low stock check
              const threshold = v.low_stock_threshold !== null && v.low_stock_threshold !== undefined ? Number(v.low_stock_threshold) : Number(globalThreshold);
              if (newQuantity <= threshold) {
                console.log(`[SALES] Low stock alert for ${itemName}`);
              }

              await client.query(
                'INSERT INTO sale_items (account_id, sale_id, variant_id, product_name, quantity, unit_price, cost_price, total_price, profit) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                [userInfo.account_id, saleId, item.variant_id, itemName, item.quantity, sellingPrice, costPrice, sellingPrice * item.quantity, profit]
              );
            } else if (item.service_id) {
              const { rows: services } = await client.query('SELECT * FROM services WHERE id = $1', [item.service_id]);
              if (services.length === 0) throw new Error(`Service not found: ${item.service_id}`);
              const s = services[0];
              itemName = s.name;
              sellingPrice = item.price_override || s.price;
              costPrice = 0;
              profit = sellingPrice * item.quantity;
              
              total_amount += sellingPrice * item.quantity;
              total_profit += profit;

              await client.query(
                'INSERT INTO sale_items (account_id, sale_id, service_id, service_name, quantity, unit_price, cost_price, total_price, profit) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
                [userInfo.account_id, saleId, item.service_id, itemName, item.quantity, sellingPrice, costPrice, sellingPrice * item.quantity, profit]
              );
            }
          }

          const final_total_amount = total_amount - discount_amount + vat_amount;
          const final_total_profit = total_profit - discount_amount;

          await client.query(
            'UPDATE sales SET total_amount = $1, total_profit = $2, cost_price_total = $3 WHERE id = $4',
            [final_total_amount, final_total_profit, cost_price_total, saleId]
          );

          await client.query(
            'INSERT INTO bookkeeping (account_id, type, nature, amount, description, date) VALUES ($1, $2, $3, $4, $5, $6)',
            [userInfo.account_id, 'Income', 'sale', final_total_amount, `Sale - Invoice #${invoice_number}`, new Date().toISOString().split('T')[0]]
          );

          await client.query('COMMIT');
          return res.json({ saleId, invoice_number });
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
      
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
          status: 'Completed',
          invoice_terms
        }])
        .select()
        .single();

      if (saleError) throw saleError;
      const saleId = sale.id;

      const { data: settings } = await supabase.from('settings').select('low_stock_threshold').eq('account_id', userInfo.account_id).maybeSingle();
      const globalThreshold = settings?.low_stock_threshold || 5;

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
          const threshold = variant.low_stock_threshold !== null && variant.low_stock_threshold !== undefined ? Number(variant.low_stock_threshold) : Number(globalThreshold);
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
              sendTemplatedEmail(
                owner.email,
                `Low Stock Alert: ${itemName}`,
                `The stock for ${itemName} is low (${newQuantity} remaining). Please restock soon.`,
                userInfo.account_id,
                `
                <div style="text-align: center; margin-bottom: 24px;">
                  <h2 style="color: #f59e0b; margin: 0 0 8px 0; font-size: 24px; font-weight: 800;">Low Stock Alert</h2>
                  <p style="color: #6b7280; font-size: 15px; margin: 0;">Inventory Warning</p>
                </div>
                
                <p>Hi ${owner.name},</p>
                <p>The stock for <strong>${itemName}</strong> has reached the low threshold.</p>
                
                <div style="background-color: #fffbeb; border: 1px solid #fef3c7; padding: 24px; border-radius: 12px; margin: 24px 0; text-align: center;">
                  <div style="font-size: 12px; color: #92400e; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Current Quantity</div>
                  <div style="font-size: 36px; font-weight: 800; color: #b45309;">${newQuantity}</div>
                  <div style="font-size: 13px; color: #92400e; margin-top: 8px;">Threshold: ${threshold}</div>
                </div>
                
                <p>Please restock this item soon to avoid running out and missing potential sales.</p>
                
                <div style="text-align: center; margin-top: 32px;">
                  <a href="https://gryndee.com/inventory" class="button">Manage Inventory</a>
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

      // Notify admin of new sale
      const { data: adminUser } = await supabase
        .from('users')
        .select('email, name')
        .eq('account_id', userInfo.account_id)
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();

      if (adminUser && adminUser.email) {
        sendTemplatedEmail(
          adminUser.email,
          `New Sale Recorded: ${invoice_number}`,
          `A new sale of ${final_total_amount} NGN has been recorded. Invoice: ${invoice_number}`,
          userInfo.account_id,
          `
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #10b981; margin: 0 0 8px 0; font-size: 24px; font-weight: 800;">New Sale Recorded</h2>
            <p style="color: #6b7280; font-size: 15px; margin: 0;">Transaction Successful</p>
          </div>
          
          <p>Hi ${adminUser.name},</p>
          <p>A new transaction has been completed in your store.</p>
          
          <div style="background-color: #f0fdf4; border: 1px solid #dcfce7; padding: 24px; border-radius: 12px; margin: 24px 0;">
            <table width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="padding-bottom: 12px; color: #166534; font-size: 14px;">Invoice Number</td>
                <td style="padding-bottom: 12px; color: #111827; font-size: 14px; font-weight: 700; text-align: right;">${invoice_number}</td>
              </tr>
              <tr>
                <td style="padding-bottom: 12px; color: #166534; font-size: 14px;">Total Amount</td>
                <td style="padding-bottom: 12px; color: #111827; font-size: 18px; font-weight: 800; text-align: right;">${final_total_amount} NGN</td>
              </tr>
              <tr>
                <td style="color: #166534; font-size: 14px;">Payment Method</td>
                <td style="color: #111827; font-size: 14px; font-weight: 700; text-align: right;">${payment_method}</td>
              </tr>
            </table>
          </div>
          
          <p>You can view the full details and manage this sale in your dashboard.</p>
          
          <div style="text-align: center; margin-top: 32px;">
            <a href="https://gryndee.com/sales" class="button">View Sales History</a>
          </div>
          `
        ).catch(err => console.error('Failed to send sale notification email:', err));
      }

      res.json({ saleId, invoice_number });
    } catch (e: any) {
      console.error(`[SALES] Sale failed:`, e);
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/sales/:id/terms", requireAuth, async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      const saleId = req.params.id;
      const { invoice_terms } = req.body;

      if (process.env.AWS_DB_PASSWORD) {
        await pool.query(
          'UPDATE sales SET invoice_terms = $1 WHERE id = $2 AND account_id = $3',
          [invoice_terms, saleId, userInfo.account_id]
        );
        return res.json({ success: true });
      }

      if (supabase) {
        const { error } = await supabase
          .from('sales')
          .update({ invoice_terms })
          .eq('id', saleId)
          .eq('account_id', userInfo.account_id);
        
        if (error) throw error;
        return res.json({ success: true });
      }

      res.status(503).json({ error: "Database not available" });
    } catch (error: any) {
      console.error('Error updating invoice terms:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/public/invoice/:id", async (req, res) => {
    const { id } = req.params;
    try {
      if (process.env.AWS_DB_PASSWORD) {
        const { rows: sales } = await pool.query(`
          SELECT s.*, c.name as customer_name_from_table, u.name as staff_name 
          FROM sales s 
          LEFT JOIN customers c ON s.customer_id = c.id 
          LEFT JOIN users u ON s.staff_id = u.id 
          WHERE s.id = $1
        `, [id]);

        if (sales.length === 0) return res.status(404).json({ error: "Invoice not found" });
        const sale = sales[0];

        const { rows: items } = await pool.query(`
          SELECT si.*, pv.size, pv.color, p.name as product_name_from_table, sv.name as service_name_from_table
          FROM sale_items si
          LEFT JOIN product_variants pv ON si.variant_id = pv.id
          LEFT JOIN products p ON pv.product_id = p.id
          LEFT JOIN services sv ON si.service_id = sv.id
          WHERE si.sale_id = $1
        `, [id]);

        sale.sale_items = items;

        const { rows: settings } = await pool.query('SELECT * FROM settings WHERE account_id = $1', [sale.account_id]);
        sale.settings = settings[0] || {};

        return res.json(sale);
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
      
      const { data: sale, error } = await supabase
        .from('sales')
        .select(`
          *,
          customers ( name, email, phone, address ),
          users ( name ),
          sale_items (
            *,
            product_variants ( size, color, products ( name ) ),
            services ( name )
          )
        `)
        .eq('id', id)
        .single();

      if (error || !sale) return res.status(404).json({ error: "Invoice not found" });

      const { data: settings } = await supabase
        .from('settings')
        .select('*')
        .eq('account_id', sale.account_id)
        .single();

      sale.settings = settings || {};

      res.json(sale);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/sales", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) {
        console.log('[SALES] No user info found for sales fetch');
        return res.json([]);
      }

      if (process.env.AWS_DB_PASSWORD) {
        console.log(`[SALES] Fetching sales from AWS RDS for account: ${userInfo.account_id}`);
        
        let query = `
          SELECT s.*, c.name as customer_name_from_table, u.name as staff_name 
          FROM sales s 
          LEFT JOIN customers c ON s.customer_id = c.id 
          LEFT JOIN users u ON s.staff_id = u.id 
          WHERE s.account_id = $1 
        `;
        const params: any[] = [userInfo.account_id];

        if (!hasPermission(userInfo, 'can_view_account_data')) {
          query += ` AND s.staff_id = $2 `;
          params.push(userInfo.id);
        }

        query += ` ORDER BY s.created_at DESC LIMIT 1000`;

        const { rows: sales } = await pool.query(query, params);

        if (sales.length > 0) {
          const saleIds = sales.map(s => s.id);
          const { rows: items } = await pool.query(`
            SELECT si.*, pv.size, pv.color, p.name as product_name_from_table, sv.name as service_name_from_table
            FROM sale_items si
            LEFT JOIN product_variants pv ON si.variant_id = pv.id
            LEFT JOIN products p ON pv.product_id = p.id
            LEFT JOIN services sv ON si.service_id = sv.id
            WHERE si.sale_id = ANY($1)
          `, [saleIds]);

          sales.forEach(s => {
            s.sale_items = items.filter(item => item.sale_id === s.id).map(item => ({
              ...item,
              unit_price: item.unit_price || 0,
              cost_price: item.cost_price || 0,
              product_name: item.product_name || item.product_name_from_table || 'Item',
              service_name: item.service_name || item.service_name_from_table || 'Service',
              variant_info: `${item.size || ''} ${item.color || ''}`.trim()
            }));
            s.customer_name = s.customer_name || s.customer_name_from_table || 'Walk-in';
          });
        }
        return res.json(sales);
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
      console.log(`[SALES] Fetching sales for account: ${userInfo.account_id}`);
      let query = supabase
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
        .eq('account_id', userInfo.account_id);

      if (!hasPermission(userInfo, 'can_view_account_data')) {
        query = query.eq('staff_id', userInfo.id);
      }

      let { data, error } = await query.order('created_at', { ascending: false });

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
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      if (process.env.AWS_DB_PASSWORD) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('DELETE FROM sale_items WHERE account_id = $1', [userInfo.account_id]);
          await client.query('DELETE FROM sales WHERE account_id = $1', [userInfo.account_id]);
          await client.query('COMMIT');
          return res.json({ success: true });
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
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
    const { id } = req.params;

    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      if (process.env.AWS_DB_PASSWORD) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          // 1. Get sale items to revert stock
          const { rows: items } = await client.query('SELECT * FROM sale_items WHERE sale_id = $1 AND account_id = $2', [id, userInfo.account_id]);
          
          // 2. Revert stock for each item
          for (const item of items) {
            if (item.variant_id) {
              await client.query('UPDATE product_variants SET quantity = quantity + $1 WHERE id = $2', [item.quantity, item.variant_id]);
            }
          }

          // 3. Delete sale items
          await client.query('DELETE FROM sale_items WHERE sale_id = $1 AND account_id = $2', [id, userInfo.account_id]);

          // 4. Delete the sale record
          const { rowCount } = await client.query('DELETE FROM sales WHERE id = $1 AND account_id = $2', [id, userInfo.account_id]);
          
          if (rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Sale not found" });
          }

          await client.query('COMMIT');
          return res.json({ success: true });
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
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

  const checkLowStock = async (userId: string) => {
    if (!supabase && !process.env.AWS_DB_PASSWORD) return;
    
    try {
      let accountId: number | null = null;
      
      // Get accountId for this user first
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query('SELECT account_id FROM users WHERE id = $1', [userId]);
        if (rows.length > 0) accountId = rows[0].account_id;
      } else if (supabase) {
        const { data } = await supabase.from('users').select('account_id').eq('id', userId).maybeSingle();
        if (data) accountId = data.account_id;
      }

      if (!accountId) return;

      // 1. Get variants ONLY for this account
      let variants: any[] = [];
      let globalThreshold = 5;

      if (process.env.AWS_DB_PASSWORD) {
        const { rows: vRows } = await pool.query(`
          SELECT v.*, p.name as product_name 
          FROM product_variants v 
          JOIN products p ON v.product_id = p.id 
          WHERE v.account_id = $1
        `, [accountId]);
        variants = vRows;

        const { rows: sRows } = await pool.query('SELECT low_stock_threshold FROM settings WHERE account_id = $1 LIMIT 1', [accountId]);
        if (sRows.length > 0) globalThreshold = sRows[0].low_stock_threshold || 5;
      } else if (supabase) {
        const { data: vData, error: vError } = await supabase
          .from('product_variants')
          .select('*, products(name), account_id')
          .eq('account_id', accountId);
        
        if (vError) throw vError;
        variants = vData || [];

        const { data: sData } = await supabase
          .from('settings')
          .select('low_stock_threshold')
          .eq('account_id', accountId)
          .maybeSingle();
        
        globalThreshold = sData?.low_stock_threshold || 5;
      }

      if (variants.length === 0) return;

      // 2. Filter for low stock
      const lowStockVariants = variants.filter(v => {
        if (v.quantity === null) return false;
        const qty = Number(v.quantity) || 0;
        const threshold = v.low_stock_threshold !== null && v.low_stock_threshold !== undefined 
          ? Number(v.low_stock_threshold) 
          : Number(globalThreshold) || 5;
        return qty <= threshold;
      });
      
      if (lowStockVariants.length === 0) return;

      // 3. Get existing unread low stock notifications for this user
      let existingMessages = new Set<string>();
      if (process.env.AWS_DB_PASSWORD) {
        const { rows: nRows } = await pool.query(
          "SELECT message FROM notifications WHERE user_id = $1 AND title = 'Low Stock Alert' AND is_read = false",
          [userId]
        );
        existingMessages = new Set(nRows.map(n => n.message));
      } else if (supabase) {
        const { data: nData } = await supabase
          .from('notifications')
          .select('message')
          .eq('user_id', userId)
          .eq('title', 'Low Stock Alert')
          .eq('is_read', false);
        existingMessages = new Set(nData?.map(n => n.message) || []);
      }

      // 4. Prepare new notifications
      const newNotifications = lowStockVariants
        .map(variant => {
          const productName = variant.product_name || variant.products?.name || 'Unknown';
          const message = `Product "${productName}" (Size: ${variant.size}) is low on stock. Current quantity: ${variant.quantity}.`;
          return {
            user_id: userId,
            account_id: accountId,
            title: 'Low Stock Alert',
            message,
            type: 'warning',
            is_read: false
          };
        })
        .filter(n => !existingMessages.has(n.message));

      // 5. Batch insert new notifications
      if (newNotifications.length > 0) {
        if (process.env.AWS_DB_PASSWORD) {
          for (const n of newNotifications) {
            await pool.query(
              'INSERT INTO notifications (user_id, account_id, title, message, type, is_read) VALUES ($1, $2, $3, $4, $5, $6)',
              [n.user_id, n.account_id, n.title, n.message, n.type, n.is_read]
            );
          }
        } else if (supabase) {
          await supabase.from('notifications').insert(newNotifications);
        }
      }
    } catch (error: any) {
      if (error?.message?.includes('relation "notifications" does not exist')) return;
      console.error('[NOTIFICATIONS] Error checking low stock:', error);
    }
  };

  app.get("/api/alerts/:userId", async (req, res) => {
    const { userId } = req.params;
    
    if (!userId || userId === 'undefined' || userId === 'null' || userId === '[object Object]') {
      return res.json([]);
    }

    try {
      // Run low stock check in background - don't await to keep response fast
      checkLowStock(userId).catch(err => console.error('[NOTIFICATIONS] Background check failed:', err));

      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query(
          'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
          [userId]
        );
        return res.json(rows || []);
      }

      if (!supabase) return res.json([]);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (error) throw error;
      res.json(data || []);
    } catch (error: any) {
      console.error('[NOTIFICATIONS] Fetch error:', error);
      if (error?.code === 'PGRST116' || error?.message?.includes('relation "notifications" does not exist')) {
        return res.json([]);
      }
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.post("/api/alerts/:id/read", async (req, res) => {
    const { id } = req.params;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      if (process.env.AWS_DB_PASSWORD) {
        if (id === 'all') {
          await pool.query('UPDATE notifications SET is_read = true WHERE user_id = $1', [userInfo.id]);
        } else {
          await pool.query('UPDATE notifications SET is_read = true WHERE id = $1', [id]);
        }
        return res.json({ success: true });
      }

      if (!supabase) return res.json({ success: true });
      if (id === 'all') {
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', userInfo.id);
      } else {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update notifications" });
    }
  });

  app.delete("/api/alerts/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo || userInfo.id.toString() !== userId.toString()) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (process.env.AWS_DB_PASSWORD) {
        await pool.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
        return res.json({ success: true });
      }

      if (!supabase) return res.json({ success: true });
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
      
      if (process.env.AWS_DB_PASSWORD) {
        const { rows: productsCount } = await pool.query('SELECT COUNT(*) FROM products WHERE account_id = $1', [userInfo.account_id]);
        
        let salesCountQuery = 'SELECT COUNT(*) FROM sales WHERE account_id = $1';
        let todaySalesQuery = 'SELECT total_amount, total_profit FROM sales WHERE account_id = $1 AND created_at::date = $2';
        const salesParams: any[] = [userInfo.account_id];
        const todayParams: any[] = [userInfo.account_id, today];

        if (!hasPermission(userInfo, 'can_view_account_data')) {
          salesCountQuery += ' AND staff_id = $2';
          todaySalesQuery += ' AND staff_id = $3';
          salesParams.push(userInfo.id);
          todayParams.push(userInfo.id);
        }

        const { rows: salesCount } = await pool.query(salesCountQuery, salesParams);
        
        // Optimized stock calculation in SQL
        const { rows: settingsRows } = await pool.query('SELECT low_stock_threshold FROM settings WHERE account_id = $1', [userInfo.account_id]);
        const globalThreshold = settingsRows[0]?.low_stock_threshold || 5;
        
        const { rows: stockStats } = await pool.query(`
          SELECT 
            SUM(quantity) as total_stock,
            COUNT(*) FILTER (WHERE quantity <= COALESCE(low_stock_threshold, $2)) as low_stock_count
          FROM product_variants 
          WHERE account_id = $1
        `, [userInfo.account_id, globalThreshold]);
        
        const totalProducts = parseInt(productsCount[0].count);
        const totalSalesCount = parseInt(salesCount[0].count);
        const totalStock = parseInt(stockStats[0].total_stock) || 0;
        const low_stock_count = parseInt(stockStats[0].low_stock_count) || 0;

        const { rows: todaySalesData } = await pool.query(todaySalesQuery, todayParams);
        const todaySales = todaySalesData?.reduce((acc, s) => acc + (parseFloat(s.total_amount) || 0), 0) || 0;
        const todayProfit = todaySalesData?.reduce((acc, s) => acc + (parseFloat(s.total_profit) || 0), 0) || 0;

        let todayExpenses = 0;
        if (hasPermission(userInfo, 'can_view_expenses')) {
          const { rows: todayExpensesData } = await pool.query(
            'SELECT amount FROM expenses WHERE account_id = $1 AND date = $2',
            [userInfo.account_id, today]
          );
          todayExpenses = todayExpensesData?.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0) || 0;
        }

        return res.json({
          total_products: totalProducts,
          total_sales_count: totalSalesCount,
          total_stock: totalStock,
          low_stock_count: low_stock_count,
          today_sales: todaySales,
          today_profit: todayProfit,
          today_expenses: todayExpenses
        });
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });

      const { count: totalProducts } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('account_id', userInfo.account_id);
      
      let salesCountQuery = supabase.from('sales').select('*', { count: 'exact', head: true }).eq('account_id', userInfo.account_id);
      let todaySalesQuery = supabase.from('sales').select('total_amount, total_profit').eq('account_id', userInfo.account_id).gte('created_at', today);

      if (!hasPermission(userInfo, 'can_view_account_data')) {
        salesCountQuery = salesCountQuery.eq('staff_id', userInfo.id);
        todaySalesQuery = todaySalesQuery.eq('staff_id', userInfo.id);
      }

      const { count: totalSalesCount } = await salesCountQuery;
      
      const { data: variants } = await supabase.from('product_variants').select('quantity, low_stock_threshold').eq('account_id', userInfo.account_id);
      const totalStock = variants?.reduce((acc, v) => acc + (v.quantity || 0), 0) || 0;
      const { data: settings } = await supabase.from('settings').select('low_stock_threshold').eq('account_id', userInfo.account_id).maybeSingle();
      const globalThreshold = settings?.low_stock_threshold || 5;
      const lowStockCount = variants?.filter(v => {
        const qty = Number(v.quantity) || 0;
        const threshold = v.low_stock_threshold !== null && v.low_stock_threshold !== undefined 
          ? Number(v.low_stock_threshold) 
          : Number(globalThreshold) || 5;
        return qty <= threshold;
      }).length || 0;

      const { data: todaySalesData } = await todaySalesQuery;

      const todaySales = todaySalesData?.reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0) || 0;
      const todayProfit = todaySalesData?.reduce((acc, s) => acc + (Number(s.total_profit) || 0), 0) || 0;

      let todayExpenses = 0;
      if (hasPermission(userInfo, 'can_view_expenses')) {
        const { data: todayExpensesData } = await supabase
          .from('expenses')
          .select('amount')
          .eq('account_id', userInfo.account_id)
          .gte('date', today);
        todayExpenses = todayExpensesData?.reduce((acc, e) => acc + (Number(e.amount) || 0), 0) || 0;
      }

      res.json({
        version: "2.5.2",
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

      if (!hasPermission(userInfo, 'can_view_dashboard')) return res.status(403).json({ error: "Forbidden" });

      if (!process.env.AWS_DB_PASSWORD) {
        return res.status(503).json({ error: "Database not available (AWS RDS not configured)" });
      }

      let salesQuery = "SELECT created_at, total_amount FROM sales WHERE account_id = $1 AND created_at >= NOW() - INTERVAL '7 days'";
      const salesParams: any[] = [userInfo.account_id];

      if (!hasPermission(userInfo, 'can_view_account_data')) {
        salesQuery += ' AND staff_id = $2';
        salesParams.push(userInfo.id);
      }

      const { rows: sales } = await pool.query(
        salesQuery + ' ORDER BY created_at ASC',
        salesParams
      );

      let expenses: any[] = [];
      if (hasPermission(userInfo, 'can_view_expenses')) {
        const { rows: expensesRows } = await pool.query(
          "SELECT date, amount FROM expenses WHERE account_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days' ORDER BY date ASC",
          [userInfo.account_id]
        );
        expenses = expensesRows;
      }

      const trendsMap = new Map();
      
      // Pre-fill last 7 days with zeros to ensure a nice curve/line even with sparse data
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        trendsMap.set(dateStr, { revenue: 0, expenses: 0 });
      }

      sales.forEach(s => {
        const date = new Date(s.created_at).toISOString().split('T')[0];
        const existing = trendsMap.get(date) || { revenue: 0, expenses: 0 };
        trendsMap.set(date, {
          revenue: existing.revenue + (parseFloat(s.total_amount) || 0),
          expenses: existing.expenses
        });
      });

      expenses.forEach(e => {
        const date = new Date(e.date).toISOString().split('T')[0];
        const existing = trendsMap.get(date) || { revenue: 0, expenses: 0 };
        trendsMap.set(date, {
          revenue: existing.revenue,
          expenses: existing.expenses + (parseFloat(e.amount) || 0)
        });
      });

      const trends = Array.from(trendsMap.entries()).map(([date, values]) => ({
        date,
        ...values,
        profit: values.revenue - values.expenses
      })).sort((a, b) => a.date.localeCompare(b.date));

      res.json(trends);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analytics/top-sales", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      if (!hasPermission(userInfo, 'can_view_dashboard')) return res.status(403).json({ error: "Forbidden" });

      let data: any[] = [];
      if (process.env.AWS_DB_PASSWORD) {
        let query = `
          SELECT si.quantity, si.unit_price, si.total_price, si.product_name, si.service_name
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          WHERE si.account_id = $1
        `;
        const params: any[] = [userInfo.account_id];

        if (!hasPermission(userInfo, 'can_view_account_data')) {
          query += ' AND s.staff_id = $2';
          params.push(userInfo.id);
        }

        query += ' LIMIT 200';

        const { rows } = await pool.query(query, params);
        data = rows.map(item => ({
          ...item,
          product_variants: {
            products: {
              name: item.product_name || item.service_name || 'Unknown'
            }
          }
        }));
      } else if (supabase) {
        let query = supabase
          .from('sale_items')
          .select(`
            quantity, 
            unit_price, 
            total_price,
            product_name,
            service_name,
            sales!inner(staff_id),
            product_variants(
              products(name)
            )
          `)
          .eq('account_id', userInfo.account_id);

        if (!hasPermission(userInfo, 'can_view_account_data')) {
          query = query.eq('sales.staff_id', userInfo.id);
        }

        const { data: supabaseData, error } = await query.limit(200);
        
        if (error) throw error;
        data = supabaseData || [];
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
      let name = item.product_name || item.service_name;
      
      if (!name) {
        const variant = Array.isArray(item.product_variants) ? item.product_variants[0] : item.product_variants;
        const product = Array.isArray(variant?.products) ? variant.products[0] : variant?.products;
        name = product?.name || 'Unknown Product';
      }
      
      const existing = topSalesMap.get(name) || { name, quantity: 0, revenue: 0 };
      const price = parseFloat(item.unit_price) || (parseFloat(item.total_price) / item.quantity) || 0;
      topSalesMap.set(name, {
        name,
        quantity: existing.quantity + (parseInt(item.quantity) || 0),
        revenue: existing.revenue + ((parseInt(item.quantity) || 0) * price)
      });
    });
    
    return Array.from(topSalesMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  app.get("/api/analytics/top-expenses", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });
      
      if (userInfo.role === 'staff') return res.status(403).json({ error: "Forbidden" });

      let data: any[] = [];
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query(
          'SELECT category, amount FROM expenses WHERE account_id = $1 ORDER BY amount DESC LIMIT 5',
          [userInfo.account_id]
        );
        data = rows;
      } else if (supabase) {
        const { data: supabaseData, error } = await supabase
          .from('expenses')
          .select('category, amount')
          .eq('account_id', userInfo.account_id)
          .order('amount', { ascending: false })
          .limit(5);
        if (error) throw error;
        data = supabaseData || [];
      }
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- NEW FEATURES: EXPENSES, CUSTOMERS, SERVICES, AI ---
  // (REMOVED - MOVED UP)

  // Staff Performance API
  app.get("/api/analytics/staff-performance", async (req, res) => {
    try {
      const userInfo = await getAccountId(req);
      if (!userInfo) return res.status(401).json({ error: "Unauthorized" });

      let data: any[] = [];
      let users: any[] = [];

      if (process.env.AWS_DB_PASSWORD) {
        let salesQuery = "SELECT staff_id, total_amount, total_profit FROM sales WHERE account_id = $1 AND created_at >= NOW() - INTERVAL '30 days'";
        let usersQuery = 'SELECT id, name FROM users WHERE account_id = $1';
        const params: any[] = [userInfo.account_id];

        if (userInfo.role === 'staff') {
          salesQuery += ' AND staff_id = $2';
          usersQuery += ' AND id = $2';
          params.push(userInfo.id);
        }

        const { rows: salesRows } = await pool.query(salesQuery, params);
        data = salesRows;

        const { rows: usersRows } = await pool.query(usersQuery, params);
        users = usersRows;
      } else if (supabase) {
        let salesQuery = supabase
          .from('sales')
          .select('staff_id, total_amount, total_profit')
          .eq('account_id', userInfo.account_id);
        
        let usersQuery = supabase
          .from('users')
          .select('id, name')
          .eq('account_id', userInfo.account_id);

        if (userInfo.role === 'staff') {
          salesQuery = salesQuery.eq('staff_id', userInfo.id);
          usersQuery = usersQuery.eq('id', userInfo.id);
        }

        const { data: supabaseData, error } = await salesQuery;
        if (error) throw error;
        data = supabaseData || [];

        const { data: supabaseUsers } = await usersQuery;
        users = supabaseUsers || [];
      } else {
        return res.status(503).json({ error: "Database not available" });
      }

      const userMap = new Map(users?.map(u => [u.id?.toString(), u.name]));

      const performanceMap = new Map();
      data.forEach(s => {
        const staffName = userMap.get(s.staff_id?.toString()) || `Staff #${s.staff_id || 'Unknown'}`;
        const existing = performanceMap.get(staffName) || { sales: 0, profit: 0, count: 0 };
        performanceMap.set(staffName, {
          sales: existing.sales + (parseFloat(s.total_amount) || 0),
          profit: existing.profit + (parseFloat(s.total_profit) || 0),
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

  app.get("/api/ping", (req, res) => {
    res.json({ 
      host: req.headers.host, 
      url: req.url,
      server_start_time: serverStartTime,
      current_time: new Date().toISOString()
    });
  });

  app.get("/api/gemini-key", requireAuth, async (req, res) => {
    try {
      const apiKey = await getGeminiKey();
      res.json({ apiKey: apiKey || '' });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch Gemini key" });
    }
  });

  app.get("/api/admin/secrets", requireSuperAdmin, async (req, res) => {
    const secrets = {
      SUPABASE_URL: process.env.SUPABASE_URL || '',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
      AWS_REGION: process.env.AWS_REGION || 'us-east-1',
      AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET || '',
      PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || '',
      PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY || '',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || ''
    };
    res.json(secrets);
  });

  app.post("/api/admin/update-env", requireSuperAdmin, async (req, res) => {
    const { env } = req.body;
    if (!env || typeof env !== 'object') {
      return res.status(400).json({ error: "Invalid environment data" });
    }

    try {
      let envContent = '';
      if (fs.existsSync('.env')) {
        envContent = fs.readFileSync('.env', 'utf8');
      }

      for (const [key, value] of Object.entries(env)) {
        if (value === 'Configured') continue; // Skip masked values
        
        process.env[key] = String(value);
        
        const regex = new RegExp(`^${key}=.*`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
          envContent += `\n${key}=${value}`;
        }
      }

      fs.writeFileSync('.env', envContent.trim() + '\n');
      console.log("[INIT] Environment updated via API. Re-initializing clients...");

      if (env.SUPABASE_URL || env.SUPABASE_ANON_KEY) {
        if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
          supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
          supabase_status = 'connected';
        }
      }

      if (env.AWS_ACCESS_KEY_ID || env.AWS_SECRET_ACCESS_KEY || env.AWS_REGION) {
        reinitializeS3();
      }

      res.json({ success: true, message: "Environment updated and persisted to .env" });
    } catch (err: any) {
      console.error("[INIT] Failed to update environment:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/refresh-env", requireSuperAdmin, (req, res) => {
    console.log("[INIT] Refreshing environment variables...");
    dotenv.config();
    
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        supabase_status = 'connected';
        console.log('[DB] Supabase client re-initialized successfully');
      } catch (e: any) {
        console.error('[DB] Failed to re-initialize Supabase client:', e.message);
        supabase_status = 'error';
      }
    } else {
      console.warn('[DB] Supabase credentials still missing after refresh.');
    }
    
    res.json({ 
      success: true, 
      supabase_status, 
      supabase_initialized: !!supabase,
      env: {
        SUPABASE_URL: process.env.SUPABASE_URL ? "Present" : "Missing",
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? "Present" : "Missing"
      }
    });
  });

  app.get("/api/admin/debug-env", requireSuperAdmin, (req, res) => {
    res.json({
      supabase_status,
      supabase_initialized: !!supabase,
      server_start_time: serverStartTime,
      current_time: new Date().toISOString(),
      env: {
        SUPABASE_URL: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.substring(0, 10)}... (len: ${process.env.SUPABASE_URL.length})` : "Missing",
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? `${process.env.SUPABASE_ANON_KEY.substring(0, 10)}... (len: ${process.env.SUPABASE_ANON_KEY.length})` : "Missing",
        AWS_DB_PASSWORD: process.env.AWS_DB_PASSWORD ? "Present" : "Missing",
        AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME ? "Present" : "Missing",
        AWS_REGION: process.env.AWS_REGION ? "Present" : "Missing",
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? "Present" : "Missing",
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? "Present" : "Missing",
      },
      logs: logHistory.slice(-50)
    });
  });

  app.post("/api/admin/migrate-database", requireSuperAdmin, async (req: any, res) => {
    console.log(`[MIGRATE] Database migration triggered from host: ${req.headers.host}`);
    console.log("[MIGRATE] Migration started. Checking Supabase connection...");
    let activeSupabase = supabase;
    console.log("[MIGRATE] Initial supabase state:", !!activeSupabase);
    
    if (!activeSupabase) {
      console.log("[MIGRATE] Supabase not initialized globally. Attempting local initialization...");
      console.log("[MIGRATE] SUPABASE_URL exists:", !!process.env.SUPABASE_URL);
      console.log("[MIGRATE] SUPABASE_ANON_KEY exists:", !!process.env.SUPABASE_ANON_KEY);
      
      if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        try {
          activeSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
          console.log("[MIGRATE] Local supabase client created successfully");
        } catch (err: any) {
          console.error("[MIGRATE] Local supabase initialization failed:", err.message);
        }
      }
    }

    if (!activeSupabase) {
      console.error("[MIGRATE] Supabase connection failed.");
      console.log("[MIGRATE] SUPABASE_URL:", process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.substring(0, 10)}...` : "Missing");
      console.log("[MIGRATE] SUPABASE_ANON_KEY:", process.env.SUPABASE_ANON_KEY ? `${process.env.SUPABASE_ANON_KEY.substring(0, 10)}...` : "Missing");
      console.log("[MIGRATE] AWS_DB_PASSWORD:", process.env.AWS_DB_PASSWORD ? "Present" : "Missing");
      return res.status(503).json({ error: "Supabase not connected. Cannot read source data. Please check your SUPABASE_URL and SUPABASE_ANON_KEY in Secrets." });
    }
    if (!process.env.AWS_DB_PASSWORD) return res.status(503).json({ error: "AWS RDS not connected. Cannot write destination data." });
    
    try {
      const tables = [
        'accounts', 'users', 'settings', 'categories', 'customers', 'services',
        'products', 'product_variants', 'product_images', 'sales', 'sale_items',
        'expenses', 'bookkeeping', 'notifications'
      ];
      
      let totalMigrated = 0;
      const client = await pool.connect();
      
      const fetchAllData = async (table: string) => {
        let allData: any[] = [];
        let from = 0;
        const limit = 1000;
        while (true) {
          const { data, error } = await activeSupabase!.from(table).select('*').range(from, from + limit - 1);
          if (error) {
            console.warn(`[MIGRATE] Error reading from ${table}:`, error.message);
            break;
          }
          if (!data || data.length === 0) break;
          allData = allData.concat(data);
          if (data.length < limit) break;
          from += limit;
        }
        return allData;
      };

      try {
        await client.query('BEGIN');
        
        // Special handling for circular dependency between accounts and users
        console.log(`[MIGRATE] Migrating table: accounts (Phase 1)`);
        const accountsData = await fetchAllData('accounts');
        if (accountsData.length > 0) {
          for (const row of accountsData) {
            const { owner_id, ...rest } = row; // Omit owner_id for now
            const columns = Object.keys(rest);
            const values = Object.values(rest);
            const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
            const colNames = columns.map(c => `"${c}"`).join(', ');
            
            try {
              await client.query('SAVEPOINT sp1');
              await client.query(`
                INSERT INTO accounts (${colNames}) 
                VALUES (${placeholders}) 
                ON CONFLICT (id) DO NOTHING
              `, values);
              await client.query('RELEASE SAVEPOINT sp1');
              totalMigrated++;
            } catch (err: any) {
              await client.query('ROLLBACK TO SAVEPOINT sp1');
              console.warn(`[MIGRATE] Skipping row in accounts due to error:`, err.message);
            }
          }
        }

        // Now migrate the rest of the tables
        for (const table of tables) {
          if (table === 'accounts') continue; // Already handled phase 1
          
          console.log(`[MIGRATE] Migrating table: ${table}`);
          const data = await fetchAllData(table);
          
          if (data.length > 0) {
            for (let row of data) {
              // Handle schema differences between Supabase and RDS
              if (table === 'product_images') {
                if (row.url !== undefined) {
                  row.image_data = row.url;
                  delete row.url;
                }
                if (row.is_primary !== undefined) {
                  delete row.is_primary;
                }
              }
              
              const columns = Object.keys(row);
              const values = Object.values(row);
              const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
              const colNames = columns.map(c => `"${c}"`).join(', ');
              
              try {
                await client.query('SAVEPOINT sp2');
                await client.query(`
                  INSERT INTO ${table} (${colNames}) 
                  VALUES (${placeholders}) 
                  ON CONFLICT (id) DO NOTHING
                `, values);
                await client.query('RELEASE SAVEPOINT sp2');
                totalMigrated++;
              } catch (err: any) {
                await client.query('ROLLBACK TO SAVEPOINT sp2');
                console.warn(`[MIGRATE] Skipping row in ${table} due to error:`, err.message);
              }
            }
          }
        }

        // Phase 2 for accounts: update owner_id
        console.log(`[MIGRATE] Migrating table: accounts (Phase 2)`);
        if (accountsData.length > 0) {
          for (const row of accountsData) {
            if (row.owner_id) {
              await client.query(`UPDATE accounts SET owner_id = $1 WHERE id = $2`, [row.owner_id, row.id]);
            }
          }
        }
        
        // Update sequences so new inserts don't fail with duplicate key errors
        console.log(`[MIGRATE] Updating sequences`);
        for (const table of tables) {
          try {
            await client.query(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id)+1 FROM "${table}"), 1), false)`);
          } catch (seqErr: any) {
            console.warn(`[MIGRATE] Could not update sequence for ${table}:`, seqErr.message);
          }
        }

        await client.query('COMMIT');
        res.json({ success: true, results: { migrated: totalMigrated } });
      } catch (e: any) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error('[ADMIN] Database migration failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/check-rds-images", requireSuperAdmin, async (req: any, res) => {
    if (!process.env.AWS_DB_PASSWORD) return res.status(503).json({ error: "Database not available" });
    try {
      const { rows: productImages } = await pool.query('SELECT count(*) FROM product_images');
      const { rows: services } = await pool.query('SELECT count(*) FROM services WHERE image_url IS NOT NULL');
      const { rows: settings } = await pool.query('SELECT count(*) FROM settings WHERE logo_url IS NOT NULL');
      
      const { rows: productImagesData } = await pool.query('SELECT image_data FROM product_images LIMIT 5');
      const { rows: servicesData } = await pool.query('SELECT image_url FROM services WHERE image_url IS NOT NULL LIMIT 5');
      const { rows: settingsData } = await pool.query('SELECT logo_url FROM settings WHERE logo_url IS NOT NULL LIMIT 5');

      let s3Test = 'NOT RUN';
      if (process.env.AWS_S3_BUCKET_NAME && process.env.AWS_ACCESS_KEY_ID) {
        try {
          const testBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
          const testUrl = await uploadToCloudinary(testBase64, 'test');
          s3Test = testUrl.startsWith('http') ? 'SUCCESS' : 'FAILED: Returned base64';
        } catch (e: any) {
          s3Test = `ERROR: ${e.message}`;
        }
      }

      res.json({
        productImagesCount: productImages[0].count,
        servicesCount: services[0].count,
        settingsCount: settings[0].count,
        awsConfig: {
          bucketSet: !!process.env.AWS_S3_BUCKET_NAME,
          bucketName: process.env.AWS_S3_BUCKET_NAME ? `${process.env.AWS_S3_BUCKET_NAME.substring(0, 3)}...` : 'NOT SET',
          region: process.env.AWS_REGION || 'NOT SET',
          accessKeySet: !!process.env.AWS_ACCESS_KEY_ID,
          secretKeySet: !!process.env.AWS_SECRET_ACCESS_KEY,
          s3Test
        },
        samples: {
          productImages: productImagesData.map((r: any) => r.image_data?.substring(0, 50)),
          services: servicesData.map((r: any) => r.image_url?.substring(0, 50)),
          settings: settingsData.map((r: any) => r.logo_url?.substring(0, 50))
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/migrate-images", requireSuperAdmin, async (req: any, res) => {
    if (!process.env.AWS_DB_PASSWORD) return res.status(503).json({ error: "Database not available" });
    if (!process.env.AWS_S3_BUCKET_NAME) {
      console.error("[MIGRATE] AWS_S3_BUCKET_NAME is not configured.");
      return res.status(400).json({ error: "AWS S3 Bucket Name is not configured. Please add it in SuperAdmin secrets." });
    }
    
    try {
      const userInfo = req.user;
      let migratedCount = 0;

      // 1. Migrate Product Images
      const { rows: images } = await pool.query('SELECT * FROM product_images');
      console.log(`[MIGRATE] Found ${images?.length || 0} product images in RDS to check.`);
      if (images && images.length > 0) {
        for (const img of images) {
          if (img.image_data && img.image_data.startsWith('data:image')) {
            console.log(`[MIGRATE] Migrating base64 product image ${img.id}`);
            const uploadedUrl = await uploadToCloudinary(img.image_data);
            if (uploadedUrl && uploadedUrl.startsWith('http')) {
              await pool.query('UPDATE product_images SET image_data = $1 WHERE id = $2', [uploadedUrl, img.id]);
              migratedCount++;
              console.log(`[MIGRATE] Successfully migrated base64 product image ${img.id} to S3: ${uploadedUrl}`);
            } else {
              console.warn(`[MIGRATE] Failed to upload base64 product image ${img.id} to S3. Result: ${uploadedUrl?.substring(0, 50)}...`);
            }
          } else if (img.image_data && img.image_data.startsWith('http') && !img.image_data.includes('amazonaws.com')) {
            try {
              console.log(`[MIGRATE] Downloading product image from URL: ${img.image_data}`);
              const response = await fetch(img.image_data);
              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const contentType = response.headers.get('content-type') || 'image/jpeg';
                const base64Data = `data:${contentType};base64,${buffer.toString('base64')}`;
                
                const uploadedUrl = await uploadToCloudinary(base64Data);
                if (uploadedUrl && uploadedUrl.startsWith('http')) {
                  await pool.query('UPDATE product_images SET image_data = $1 WHERE id = $2', [uploadedUrl, img.id]);
                  migratedCount++;
                  console.log(`[MIGRATE] Successfully migrated product image ${img.id} to S3: ${uploadedUrl}`);
                } else {
                  console.warn(`[MIGRATE] Failed to upload downloaded product image ${img.id} to S3. Result: ${uploadedUrl?.substring(0, 50)}...`);
                }
              } else {
                console.error(`[MIGRATE] Failed to download product image ${img.id} from URL: ${response.statusText}`);
              }
            } catch (err) {
              console.error(`[MIGRATE] Error migrating product image ${img.id}:`, err);
            }
          } else {
            // Already on S3 or not a migratable format
            if (img.image_data?.includes('amazonaws.com')) {
              // console.log(`[MIGRATE] Product image ${img.id} already on S3.`);
            }
          }
        }
      }

      // 2. Migrate Services Images
      const { rows: services } = await pool.query('SELECT * FROM services WHERE image_url IS NOT NULL');
      console.log(`[MIGRATE] Found ${services?.length || 0} services with images in RDS to check.`);
      if (services && services.length > 0) {
        for (const srv of services) {
          if (srv.image_url && srv.image_url.startsWith('data:image')) {
            console.log(`[MIGRATE] Migrating base64 service image ${srv.id}`);
            const uploadedUrl = await uploadToCloudinary(srv.image_url, 'services');
            if (uploadedUrl && uploadedUrl.startsWith('http')) {
              await pool.query('UPDATE services SET image_url = $1 WHERE id = $2', [uploadedUrl, srv.id]);
              migratedCount++;
              console.log(`[MIGRATE] Successfully migrated base64 service image ${srv.id} to S3: ${uploadedUrl}`);
            } else {
              console.warn(`[MIGRATE] Failed to upload base64 service image ${srv.id} to S3. Result: ${uploadedUrl?.substring(0, 50)}...`);
            }
          } else if (srv.image_url && srv.image_url.startsWith('http') && !srv.image_url.includes('amazonaws.com')) {
            try {
              console.log(`[MIGRATE] Downloading service image from URL: ${srv.image_url}`);
              const response = await fetch(srv.image_url);
              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const contentType = response.headers.get('content-type') || 'image/jpeg';
                const base64Data = `data:${contentType};base64,${buffer.toString('base64')}`;
                
                const uploadedUrl = await uploadToCloudinary(base64Data, 'services');
                if (uploadedUrl && uploadedUrl.startsWith('http')) {
                  await pool.query('UPDATE services SET image_url = $1 WHERE id = $2', [uploadedUrl, srv.id]);
                  migratedCount++;
                  console.log(`[MIGRATE] Successfully migrated service image ${srv.id} to S3: ${uploadedUrl}`);
                } else {
                  console.warn(`[MIGRATE] Failed to upload downloaded service image ${srv.id} to S3. Result: ${uploadedUrl?.substring(0, 50)}...`);
                }
              } else {
                console.error(`[MIGRATE] Failed to download service image ${srv.id} from URL: ${response.statusText}`);
              }
            } catch (err) {
              console.error(`[MIGRATE] Error migrating service image ${srv.id}:`, err);
            }
          }
        }
      }

      // 3. Migrate Settings Logo
      const { rows: settings } = await pool.query('SELECT * FROM settings WHERE logo_url IS NOT NULL');
      console.log(`[MIGRATE] Found ${settings?.length || 0} settings with logos in RDS to check.`);
      if (settings && settings.length > 0) {
        for (const set of settings) {
          if (set.logo_url && set.logo_url.startsWith('data:image')) {
            console.log(`[MIGRATE] Migrating base64 logo ${set.id}`);
            const uploadedUrl = await uploadToCloudinary(set.logo_url, 'logos');
            if (uploadedUrl && uploadedUrl.startsWith('http')) {
              await pool.query('UPDATE settings SET logo_url = $1 WHERE id = $2', [uploadedUrl, set.id]);
              migratedCount++;
              console.log(`[MIGRATE] Successfully migrated base64 logo ${set.id} to S3: ${uploadedUrl}`);
            } else {
              console.warn(`[MIGRATE] Failed to upload base64 logo ${set.id} to S3. Result: ${uploadedUrl?.substring(0, 50)}...`);
            }
          } else if (set.logo_url && set.logo_url.startsWith('http') && !set.logo_url.includes('amazonaws.com')) {
            try {
              console.log(`[MIGRATE] Downloading logo from URL: ${set.logo_url}`);
              const response = await fetch(set.logo_url);
              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const contentType = response.headers.get('content-type') || 'image/jpeg';
                const base64Data = `data:${contentType};base64,${buffer.toString('base64')}`;
                
                const uploadedUrl = await uploadToCloudinary(base64Data, 'logos');
                if (uploadedUrl && uploadedUrl.startsWith('http')) {
                  await pool.query('UPDATE settings SET logo_url = $1 WHERE id = $2', [uploadedUrl, set.id]);
                  migratedCount++;
                  console.log(`[MIGRATE] Successfully migrated logo ${set.id} to S3: ${uploadedUrl}`);
                } else {
                  console.warn(`[MIGRATE] Failed to upload downloaded logo ${set.id} to S3. Result: ${uploadedUrl?.substring(0, 50)}...`);
                }
              } else {
                console.error(`[MIGRATE] Failed to download logo ${set.id} from URL: ${response.statusText}`);
              }
            } catch (err) {
              console.error(`[MIGRATE] Error migrating logo ${set.id}:`, err);
            }
          }
        }
      }

      res.json({ success: true, results: { migrated: migratedCount } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Super Admin Broadcast
  app.post("/api/admin/broadcast", requireSuperAdmin, async (req: any, res) => {
    try {
      const userInfo = req.user;

      const { message, title = "System Broadcast" } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });

      console.log(`[ADMIN] Broadcasting message: "${message}"`);

      if (process.env.AWS_DB_PASSWORD) {
        const { rows: users } = await pool.query('SELECT id, account_id, email FROM users');
        if (users && users.length > 0) {
          for (const user of users) {
            await pool.query(
              'INSERT INTO notifications (account_id, user_id, title, message, type, is_read) VALUES ($1, $2, $3, $4, $5, $6)',
              [user.account_id, user.id, title, message, 'info', false]
            );
            
            // Send email broadcast if user has an email
            if (user.email) {
              sendTemplatedEmail(
                user.email, 
                title, 
                message,
                user.account_id
              ).catch(e => console.error(`[ADMIN] Broadcast email failed for ${user.email}:`, e));
            }
          }
        }
        return res.json({ success: true, count: users.length });
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
      
      // Get all users to send notifications to
      const { data: users, error: userError } = await supabase.from('users').select('id, account_id, email');
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
        
        // Send email broadcasts
        for (const user of users) {
          if (user.email) {
            sendTemplatedEmail(
              user.email, 
              title, 
              message,
              user.account_id
            ).catch(e => console.error(`[ADMIN] Broadcast email failed for ${user.email}:`, e));
          }
        }
      }

      res.json({ success: true, count: users?.length || 0 });
    } catch (error: any) {
      console.error('[ADMIN] Broadcast failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        return await fn();
      } catch (error: any) {
        const errorMsg = error.message || String(error);
        const isRetryable = 
          errorMsg.includes('429') || 
          errorMsg.includes('503') ||
          errorMsg.toLowerCase().includes('rate limit') ||
          errorMsg.toLowerCase().includes('quota exceeded') ||
          errorMsg.toLowerCase().includes('high demand') ||
          errorMsg.toLowerCase().includes('unavailable');

        if (isRetryable && retries < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, retries);
          console.warn(`[AI] Retryable error hit on server. Retrying in ${delay}ms... (Attempt ${retries + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retries++;
        } else {
          throw error;
        }
      }
    }
    throw new Error('Max retries exceeded');
  }

  // Super Admin Generate Mobile Assets
  app.post("/api/admin/generate-mobile-assets", requireSuperAdmin, async (req: any, res) => {
    try {
      const { type } = req.body; // 'icon' or 'splash'
      const prompt = type === 'icon' 
        ? "A modern, minimalist app icon for a business management app named 'Gryndee'. Stylized letter 'G', professional, sleek, vibrant emerald green primary color, dark zinc background, 1024x1024, square."
        : "A professional splash screen for a mobile app named 'Gryndee'. Minimalist, featuring the 'Gryndee' logo (stylized 'G') centered on a dark zinc background. Vibrant emerald green logo. Text 'Gryndee' below in modern bold sans-serif. 1920x1080, landscape.";

      const apiKey = await getGeminiKey();
      if (!apiKey) {
        return res.status(400).json({ error: "Gemini API key not configured" });
      }

      const ai = new GoogleGenAI({ apiKey });
      console.log(`[ADMIN] Generating ${type} with prompt: ${prompt}`);
      
      const response = await retryWithBackoff(async () => {
        return await ai.models.generateContent({
          model: 'gemini-3.1-flash-image-preview',
          contents: { parts: [{ text: prompt }] },
          config: {
            imageConfig: {
              aspectRatio: type === 'icon' ? "1:1" : "16:9",
              imageSize: "1K"
            }
          }
        });
      });

      console.log(`[ADMIN] Gemini response candidates:`, response.candidates?.length);
      
      if (!response.candidates || response.candidates.length === 0) {
        throw new Error("No candidates returned from Gemini");
      }

      let base64Data = '';
      const parts = response.candidates[0].content.parts;
      console.log(`[ADMIN] Parts count:`, parts.length);

      for (const part of parts) {
        if (part.inlineData) {
          base64Data = part.inlineData.data;
          console.log(`[ADMIN] Found image data in parts`);
          break;
        }
        if (part.text) {
          console.log(`[ADMIN] Part text:`, part.text.substring(0, 100));
        }
      }

      if (!base64Data) {
        return res.status(500).json({ error: "Failed to generate image" });
      }

      res.json({ base64: base64Data });
    } catch (error: any) {
      console.error('[ADMIN] Asset generation error:', error);
      const errorMsg = error.message || "Failed to generate image";
      if (errorMsg.toLowerCase().includes('429') || errorMsg.toLowerCase().includes('quota') || errorMsg.toLowerCase().includes('rate')) {
        return res.status(429).json({ error: "AI service is currently busy or quota exceeded. Please try again later." });
      }
      res.status(500).json({ error: errorMsg });
    }
  });

  // Super Admin Stats
  app.get("/api/admin/email-templates", requireSuperAdmin, async (req: any, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM automated_email_templates ORDER BY id ASC');
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  app.post("/api/admin/email-templates", requireSuperAdmin, async (req: any, res) => {
    const { id, subject, body, delay_hours, is_active } = req.body;
    try {
      await pool.query(
        'UPDATE automated_email_templates SET subject = $1, body = $2, delay_hours = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5',
        [subject, body, delay_hours, is_active, id]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update template' });
    }
  });

  app.get("/api/admin/stats", requireSuperAdmin, async (req: any, res) => {
    try {
      const userInfo = req.user;

      if (process.env.AWS_DB_PASSWORD) {
        const { rows: userCountRows } = await pool.query('SELECT COUNT(*) FROM users');
        const { rows: activeUserRows } = await pool.query('SELECT COUNT(*) FROM users WHERE is_verified = true');
        const { rows: prodRows } = await pool.query('SELECT COUNT(*) FROM products');
        const { rows: saleRows } = await pool.query('SELECT COUNT(*) FROM sales');
        const { rows: recentAccs } = await pool.query(`
          SELECT a.*, u.name as user_name, u.email as user_email 
          FROM accounts a 
          LEFT JOIN users u ON u.account_id = a.id AND u.role = 'admin'
          ORDER BY a.created_at DESC 
          LIMIT 10
        `);

        return res.json({
          accounts: parseInt(userCountRows[0].count) || 0,
          users: parseInt(activeUserRows[0].count) || 0,
          products: parseInt(prodRows[0].count) || 0,
          sales: parseInt(saleRows[0].count) || 0,
          recentAccounts: recentAccs.map((a: any) => ({
            ...a,
            users: a.user_name ? [{ name: a.user_name, email: a.user_email }] : []
          }))
        });
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
      
      const { count: totalUserCount, error: userErr } = await supabase.from('users').select('*', { count: 'exact', head: true });
      if (userErr) console.warn('[ADMIN] Stats: Failed to count users:', userErr.message);
      
      const { count: verifiedUserCount, error: verifiedErr } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified', true);
      if (verifiedErr) console.warn('[ADMIN] Stats: Failed to count verified users:', verifiedErr.message);
      
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
        accounts: totalUserCount || 0,
        users: verifiedUserCount || 0,
        products: productCount || 0,
        sales: saleCount || 0,
        recentAccounts: recentAccounts || []
      });
    } catch (error: any) {
      console.error('[ADMIN] Stats failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/promo-codes", requireSuperAdmin, async (req: any, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT p.*, 
          COALESCE(
            (SELECT json_agg(json_build_object(
              'user_id', u.id,
              'username', u.username,
              'email', u.email,
              'used_at', pcu.used_at,
              'account_name', a.name
            ))
            FROM promo_code_usages pcu
            JOIN users u ON pcu.user_id = u.id
            JOIN accounts a ON pcu.account_id = a.id
            WHERE pcu.promo_code_id = p.id),
            '[]'::json
          ) as usages
        FROM promo_codes p 
        ORDER BY p.created_at DESC
      `);
      res.json(rows);
    } catch (error) {
      console.error('[ADMIN] Failed to fetch promo codes:', error);
      res.status(500).json({ error: 'Failed to fetch promo codes' });
    }
  });

  app.post("/api/admin/promo-codes", requireSuperAdmin, async (req: any, res) => {
    let { code, duration_months, max_usages } = req.body;
    
    // If code is not provided, generate a random one
    if (!code) {
      code = Math.random().toString(36).substring(2, 10).toUpperCase();
    }

    if (!duration_months) {
      return res.status(400).json({ error: 'Duration is required' });
    }

    try {
      const { rows } = await pool.query(
        'INSERT INTO promo_codes (code, duration_months, max_usages) VALUES ($1, $2, $3) RETURNING *',
        [code.toUpperCase(), duration_months, max_usages || null]
      );
      res.json(rows[0]);
    } catch (error) {
      console.error('[ADMIN] Failed to create promo code:', error);
      res.status(500).json({ error: 'Failed to create promo code' });
    }
  });

  app.delete("/api/admin/promo-codes/:id", requireSuperAdmin, async (req: any, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM promo_codes WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Failed to delete promo code:', error);
      res.status(500).json({ error: 'Failed to delete promo code' });
    }
  });

  app.post("/api/subscription/apply-promo", requireAuth, async (req: any, res) => {
    const { code } = req.body;
    const { account_id } = req.user;

    if (!code) {
      return res.status(400).json({ error: 'Promo code is required' });
    }

    try {
      // 1. Check if it's a valid promo code
      const { rows: promoRows } = await pool.query(
        'SELECT * FROM promo_codes WHERE code = $1 AND is_active = TRUE LIMIT 1',
        [code.toUpperCase()]
      );

      if (promoRows.length === 0) {
        return res.status(400).json({ error: 'Invalid or inactive promo code' });
      }

      const promo = promoRows[0];

      // Check max usages
      if (promo.max_usages !== null && promo.usage_count >= promo.max_usages) {
        return res.status(400).json({ error: 'This promo code has reached its maximum usage limit' });
      }

      const durationMonths = promo.duration_months;

      // Calculate new expiry date
      const { rows: accountRows } = await pool.query('SELECT trial_expiry, subscription_plan FROM accounts WHERE id = $1', [account_id]);
      const account = accountRows[0];
      
      let currentExpiry = account.trial_expiry ? new Date(account.trial_expiry) : new Date();
      if (currentExpiry < new Date()) {
        currentExpiry = new Date();
      }
      
      const newExpiry = new Date(currentExpiry);
      newExpiry.setMonth(newExpiry.getMonth() + durationMonths);

      await pool.query(
        'UPDATE accounts SET subscription_plan = $1, subscription_status = $2, trial_expiry = $3 WHERE id = $4',
        ['professional', 'active', newExpiry, account_id]
      );

      // Increment usage count
      await pool.query(
        'UPDATE promo_codes SET usage_count = usage_count + 1 WHERE id = $1',
        [promo.id]
      );

      // Record usage
      await pool.query(
        'INSERT INTO promo_code_usages (promo_code_id, user_id, account_id) VALUES ($1, $2, $3)',
        [promo.id, req.user.id, account_id]
      );

      res.json({ success: true, new_expiry: newExpiry });
    } catch (error) {
      console.error('[SUBSCRIPTION] Failed to apply promo code:', error);
      res.status(500).json({ error: 'Failed to apply promo code' });
    }
  });

  app.get("/api/admin/accounts", requireSuperAdmin, async (req: any, res) => {
    try {
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query(`
          SELECT a.*, 
                 json_agg(json_build_object('id', u.id, 'name', u.name, 'email', u.email, 'role', u.role)) as users
          FROM accounts a
          LEFT JOIN users u ON u.account_id = a.id
          GROUP BY a.id
          ORDER BY a.created_at DESC
        `);
        return res.json(rows);
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
      const { data, error } = await supabase
        .from('accounts')
        .select('*, users(id, name, email, role)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.json(data || []);
    } catch (error: any) {
      console.error('[ADMIN] Fetch accounts failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Super Admin Toggle Account Status
  app.post("/api/admin/accounts/:id/toggle-status", requireSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { is_active } = req.body;

      if (process.env.AWS_DB_PASSWORD) {
        await pool.query('UPDATE accounts SET is_active = $1 WHERE id = $2', [is_active, id]);
        return res.json({ success: true });
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
      const { error } = await supabase
        .from('accounts')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
      return res.json({ success: true });
    } catch (error: any) {
      console.error('[ADMIN] Toggle account status failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Super Admin Delete Account
  app.delete("/api/admin/accounts/:id", requireSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;

      if (process.env.AWS_DB_PASSWORD) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          // Delete all related records first to avoid foreign key constraint violations
          const tables = [
            'sale_items', 'sales', 'product_images', 'product_variants', 'products',
            'categories', 'expenses', 'bookkeeping', 'services', 'notifications',
            'customers', 'settings', 'users'
          ];
          for (const table of tables) {
            await client.query(`DELETE FROM ${table} WHERE account_id = $1`, [id]);
          }
          await client.query('DELETE FROM accounts WHERE id = $1', [id]);
          await client.query('COMMIT');
          return res.json({ success: true });
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
      
      // For Supabase, we also need to manually delete related records
      const tables = [
        'sale_items', 'sales', 'product_images', 'product_variants', 'products',
        'categories', 'expenses', 'bookkeeping', 'services', 'notifications',
        'customers', 'settings', 'users'
      ];
      
      for (const table of tables) {
        await supabase.from(table).delete().eq('account_id', id);
      }
      
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.json({ success: true });
    } catch (error: any) {
      console.error('[ADMIN] Delete account failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Super Admin Toggle User Status
  app.post("/api/admin/users/:id/toggle-status", requireSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { is_active } = req.body;

      if (process.env.AWS_DB_PASSWORD) {
        // Ensure is_active column exists
        await pool.query(`
          DO $$ 
          BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_active') THEN
              ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
            END IF;
          END $$;
        `);
        await pool.query('UPDATE users SET is_active = $1 WHERE id = $2', [is_active, id]);
        return res.json({ success: true });
      }

      return res.status(503).json({ error: "Database not available" });
    } catch (error: any) {
      console.error('[ADMIN] Toggle user status failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Super Admin Delete User
  app.delete("/api/admin/users/:id", requireSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;

      if (process.env.AWS_DB_PASSWORD) {
        // Handle foreign key constraints manually to avoid violation errors
        // 1. Set staff_id in sales to NULL
        await pool.query('UPDATE sales SET staff_id = NULL WHERE staff_id = $1', [id]);
        
        // 2. Set owner_id in accounts to NULL (if they were the owner)
        await pool.query('UPDATE accounts SET owner_id = NULL WHERE owner_id = $1', [id]);
        
        // 3. Delete notifications for this user
        await pool.query('DELETE FROM notifications WHERE user_id = $1', [id]);
        
        // 4. Finally delete the user
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        
        return res.json({ success: true });
      }

      return res.status(503).json({ error: "Database not available" });
    } catch (error: any) {
      console.error('[ADMIN] Delete user failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Public Legal Documents
  app.get("/api/legal-docs", async (req, res) => {
    try {
      let terms = '';
      let privacy = '';

      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query("SELECT key, value FROM system_settings WHERE key IN ('terms_and_conditions', 'privacy_policy')");
        rows.forEach(r => {
          if (r.key === 'terms_and_conditions') terms = r.value;
          if (r.key === 'privacy_policy') privacy = r.value;
        });
        return res.json({ terms_and_conditions: terms, privacy_policy: privacy });
      }
      
      if (supabase) {
        const { data, error } = await supabase.from('system_settings').select('key, value').in('key', ['terms_and_conditions', 'privacy_policy']);
        if (data) {
          data.forEach(r => {
            if (r.key === 'terms_and_conditions') terms = r.value;
            if (r.key === 'privacy_policy') privacy = r.value;
          });
        }
        return res.json({ terms_and_conditions: terms, privacy_policy: privacy });
      }
      
      res.json({ terms_and_conditions: '', privacy_policy: '' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Super Admin Legal Documents
  app.get("/api/admin/legal-docs", requireSuperAdmin, async (req, res) => {
    try {
      let terms = '';
      let privacy = '';

      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query("SELECT key, value FROM system_settings WHERE key IN ('terms_and_conditions', 'privacy_policy')");
        rows.forEach(r => {
          if (r.key === 'terms_and_conditions') terms = r.value;
          if (r.key === 'privacy_policy') privacy = r.value;
        });
        return res.json({ terms_and_conditions: terms, privacy_policy: privacy });
      }
      
      if (supabase) {
        const { data, error } = await supabase.from('system_settings').select('key, value').in('key', ['terms_and_conditions', 'privacy_policy']);
        if (data) {
          data.forEach(r => {
            if (r.key === 'terms_and_conditions') terms = r.value;
            if (r.key === 'privacy_policy') privacy = r.value;
          });
        }
        return res.json({ terms_and_conditions: terms, privacy_policy: privacy });
      }
      
      res.json({ terms_and_conditions: '', privacy_policy: '' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/legal-docs", requireSuperAdmin, async (req, res) => {
    const { terms_and_conditions, privacy_policy } = req.body;
    try {
      if (process.env.AWS_DB_PASSWORD) {
        await pool.query(
          `INSERT INTO system_settings (key, value) VALUES ('terms_and_conditions', $1) 
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [terms_and_conditions]
        );
        await pool.query(
          `INSERT INTO system_settings (key, value) VALUES ('privacy_policy', $1) 
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [privacy_policy]
        );
        return res.json({ success: true });
      }
      
      if (supabase) {
        const { error: err1 } = await supabase.from('system_settings').upsert({ key: 'terms_and_conditions', value: terms_and_conditions }, { onConflict: 'key' });
        if (err1) throw err1;
        const { error: err2 } = await supabase.from('system_settings').upsert({ key: 'privacy_policy', value: privacy_policy }, { onConflict: 'key' });
        if (err2) throw err2;
        return res.json({ success: true });
      }
      
      res.status(503).json({ error: "Database not available" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Super Admin List All Users
  app.get("/api/admin/users", requireSuperAdmin, async (req: any, res) => {
    try {
      const userInfo = req.user;
      console.log(`[ADMIN] Fetching all users for SuperAdmin: ${userInfo?.email || userInfo?.id}`);

      if (process.env.AWS_DB_PASSWORD) {
        console.log(`[ADMIN] Querying RDS for all users...`);
        try {
          // Use a more resilient query that checks for column existence or uses COALESCE
          // First, let's verify columns in accounts table to avoid 42703
          const colCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'accounts' AND table_schema = 'public'
          `);
          const columns = colCheck.rows.map(r => r.column_name);
          
          const hasAccountType = columns.includes('account_type');
          const hasBusinessType = columns.includes('business_type');
          
          const query = `
            SELECT 
              u.*, 
              a.name as account_name, 
              a.is_active as account_active_status
              ${hasAccountType ? ', a.account_type' : ", 'personal' as account_type"}
              ${hasBusinessType ? ', a.business_type' : ", NULL as business_type"}
            FROM users u 
            LEFT JOIN accounts a ON u.account_id = a.id 
            ORDER BY u.created_at DESC
          `;
          
          const { rows } = await pool.query(query);
          console.log(`[ADMIN] RDS fetch success. Found ${rows.length} users.`);
          
          // Map to match frontend expectations and remove sensitive data
          const mappedUsers = rows.map((u: any) => {
            const { password, ...userWithoutPassword } = u;
            return {
              ...userWithoutPassword,
              account_active: u.account_active_status !== undefined ? u.account_active_status : true,
              accounts: u.account_name ? { name: u.account_name } : null
            };
          });
          
          return res.json(mappedUsers);
        } catch (rdsErr: any) {
          console.error(`[ADMIN] RDS fetch users failed:`, rdsErr);
          // Don't throw yet, maybe fallback to Supabase if available
          if (!supabase) throw rdsErr;
          console.warn(`[ADMIN] Falling back to Supabase due to RDS error.`);
        }
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });

      console.log(`[ADMIN] Querying Supabase for all users...`);
      // Try simple select first to see if it's the join or order by causing issues
      let query = supabase.from('users').select('*, accounts(name, account_type, business_type)');
      
      const { data: users, error } = await query;

      if (error) {
        console.error('[ADMIN] Failed to fetch users with accounts from Supabase:', error);
        // Fallback to simple select without join or order
        const { data: simpleUsers, error: simpleError } = await supabase
          .from('users')
          .select('*');
        
        if (simpleError) {
          console.error('[ADMIN] Fallback fetch users from Supabase failed:', simpleError);
          throw simpleError;
        }
        
        // Remove passwords from fallback
        const safeSimpleUsers = (simpleUsers || []).map((u: any) => {
          const { password, ...rest } = u;
          return rest;
        });
        
        return res.json(safeSimpleUsers);
      }
      
      // Sort in memory if created_at might be missing or causing issues in SQL
      const sortedUsers = [...(users || [])].sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });

      // Remove passwords from Supabase results and flatten account_name
      const safeUsers = sortedUsers.map((u: any) => {
        const { password, ...rest } = u;
        const accountData = Array.isArray(u.accounts) ? u.accounts[0] : u.accounts;
        return {
          ...rest,
          account_active: accountData?.is_active !== undefined ? accountData.is_active : true,
          account_name: accountData?.name || null,
          account_type: accountData?.account_type || 'personal',
          business_type: accountData?.business_type || null,
          accounts: accountData ? { name: accountData.name } : null
        };
      });

      res.json(safeUsers);
    } catch (error: any) {
      console.error('[ADMIN] List users failed:', error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Super Admin Reset User Password
  app.post("/api/admin/reset-user-password", requireSuperAdmin, async (req: any, res) => {
    try {
      const userInfo = req.user;

      const { userId, newPassword } = req.body;
      if (!userId || !newPassword) {
        return res.status(400).json({ error: "Missing userId or newPassword" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      if (process.env.AWS_DB_PASSWORD) {
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
        return res.json({ success: true });
      }

      if (!supabase) return res.status(503).json({ error: "Database not available" });
      
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

  // SMTP Status for SuperAdmin
  app.get("/api/admin/smtp-status", requireSuperAdmin, async (req: any, res) => {
    const dbUser = await getSystemSetting('SMTP_USER');
    const dbHost = await getSystemSetting('SMTP_HOST');
    const dbFrom = await getSystemSetting('SMTP_FROM');
    const dbGemini = await getSystemSetting('GEMINI_API_KEY');
    
    res.json({
      configured: (!!process.env.SMTP_USER && process.env.SMTP_USER !== 'mock_user') || !!dbUser,
      geminiConfigured: !!(process.env.GEMINI_API_KEY || dbGemini),
      host: process.env.SMTP_HOST || dbHost || smtpHost,
      from: process.env.SMTP_FROM || dbFrom || '"Gryndee" <noreply@gryndee.com>',
      user: process.env.SMTP_USER || dbUser || 'Not set',
      env_keys: Object.keys(process.env).filter(k => k.startsWith('SMTP_')),
      is_db_config: !!dbUser
    });
  });

  app.post("/api/admin/update-gemini-config", requireSuperAdmin, async (req: any, res: any) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey) return res.status(400).json({ error: "API Key is required" });
      
      await setSystemSetting('GEMINI_API_KEY', apiKey);
      res.json({ success: true, message: "Gemini API Key updated in database" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update Gemini key" });
    }
  });

  app.post("/api/admin/update-smtp-config", requireSuperAdmin, async (req: any, res: any) => {
    try {
      const { user, pass, host, port, secure, from } = req.body;
      
      if (user) await setSystemSetting('SMTP_USER', user);
      if (pass) await setSystemSetting('SMTP_PASS', pass);
      if (host) await setSystemSetting('SMTP_HOST', host);
      if (port) await setSystemSetting('SMTP_PORT', port.toString());
      if (secure !== undefined) await setSystemSetting('SMTP_SECURE', secure.toString());
      if (from) await setSystemSetting('SMTP_FROM', from);

      res.json({ success: true, message: "SMTP configuration updated in database" });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update SMTP config" });
    }
  });

  app.post("/api/admin/refresh-env", requireSuperAdmin, async (req: any, res: any) => {
    try {
      // Force a reload of .env if it exists
      dotenv.config();
      console.log(`[ENV_REFRESH] Current keys: ${Object.keys(process.env).filter(k => k.startsWith('SMTP_')).join(', ')}`);
      res.json({ 
        success: true, 
        keys: Object.keys(process.env).filter(k => k.startsWith('SMTP_')) 
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to refresh environment" });
    }
  });

  app.post("/api/admin/test-smtp", requireSuperAdmin, async (req: any, res: any) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Recipient email is required" });

    // Force a quick reload of .env if it exists (for local/custom setups)
    dotenv.config();

    try {
      console.log(`[SMTP_TEST] Sending test email to ${email}`);
      await sendEmail(
        email,
        "Gryndee SMTP Test",
        "This is a test email to verify your SMTP configuration is working correctly.",
        "<h1>Gryndee SMTP Test</h1><p>This is a test email to verify your SMTP configuration is working correctly.</p>"
      );
      res.json({ success: true, message: "Test email sent successfully!" });
    } catch (error: any) {
      console.error('[SMTP_TEST] Failed:', error);
      res.status(500).json({ 
        error: error.message || "Failed to send test email",
        details: error.response || error.code || "No additional details"
      });
    }
  });

  app.post("/api/batch", async (req, res) => {
    try {
      const { endpoints } = req.body;
      if (!Array.isArray(endpoints)) {
        return res.status(400).json({ error: "endpoints array is required" });
      }

      const results = await Promise.all(endpoints.map(async (endpoint) => {
        try {
          const response = await fetch(`http://127.0.0.1:${PORT}${endpoint}`, {
            headers: {
              'Authorization': req.headers.authorization || '',
              'Content-Type': 'application/json',
              'Cookie': req.headers.cookie || '',
              'x-user-id': req.headers['x-user-id'] as string || ''
            }
          });
          
          if (!response.ok) {
            return { error: `Failed with status ${response.status}` };
          }
          
          return await response.json();
        } catch (err: any) {
          return { error: err.message };
        }
      }));

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/logs", (req, res) => {
    res.json(logHistory);
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
  
  const server = createHttpServer(app);
  
  if (process.env.NODE_ENV !== "production") {
    console.log(`[VITE] Starting in DEVELOPMENT mode`);
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: {
          server: server // Share the same HTTP server for HMR
        }
      },
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
    if (supabase || process.env.AWS_DB_PASSWORD) {
      // 1. Run basic migrations
      console.log('[INIT] Running startup migrations...');
      
      const runSql = async (sql: string) => {
        if (process.env.AWS_DB_PASSWORD) {
          try {
            await pool.query(sql);
          } catch (e: any) {
            console.warn(`[INIT] RDS Migration warning: ${e.message}`);
          }
        }
      };

      await runSql(`
        CREATE TABLE IF NOT EXISTS system_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

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
          welcome_email_subject TEXT DEFAULT 'Welcome to Gryndee!',
          welcome_email_body TEXT DEFAULT 'Hi {name},\n\nYour account has been successfully created. You can now sign in with your username: {username}.\n\nBest regards,\nThe Gryndee Team',
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(account_id)
        );
      `);

      // Add missing columns to settings if they don't exist
      const settingsCols = ['slogan', 'address', 'email', 'website', 'phone_number', 'welcome_email_subject', 'welcome_email_body'];
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
      const userCols = ['reset_code', 'reset_expires', 'is_verified', 'verification_code', 'verification_expires'];
      for (const col of userCols) {
        await runSql(`
          DO $$ 
          BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='${col}') THEN
              IF '${col}' = 'reset_expires' OR '${col}' = 'verification_expires' THEN
                ALTER TABLE users ADD COLUMN ${col} TIMESTAMPTZ;
              ELSIF '${col}' = 'is_verified' THEN
                ALTER TABLE users ADD COLUMN ${col} BOOLEAN DEFAULT false;
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
        CREATE TABLE IF NOT EXISTS categories (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(account_id, name)
        );
      `);

      // Fix categories if it was created with the wrong schema
      await runSql(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='account_id') THEN
            ALTER TABLE categories ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
          END IF;
        END $$;
      `);

      await runSql(`
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
      `);

      // Fix products if it was created with the wrong schema
      await runSql(`
        DO $$ 
        BEGIN 
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='price') THEN
            ALTER TABLE products ALTER COLUMN price DROP NOT NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='account_id') THEN
            ALTER TABLE products ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category_id') THEN
            ALTER TABLE products ADD COLUMN category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='cost_price') THEN
            ALTER TABLE products ADD COLUMN cost_price DECIMAL(12,2) DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='selling_price') THEN
            ALTER TABLE products ADD COLUMN selling_price DECIMAL(12,2) DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='supplier_name') THEN
            ALTER TABLE products ADD COLUMN supplier_name TEXT;
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
        END $$;
      `);

      await runSql(`
        CREATE TABLE IF NOT EXISTS product_images (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
          product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
          image_data TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Fix product_images if it was created with the wrong schema
      await runSql(`
        DO $$ 
        BEGIN 
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_images' AND column_name='url') THEN
            ALTER TABLE product_images RENAME COLUMN url TO image_data;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_images' AND column_name='account_id') THEN
            ALTER TABLE product_images ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
          END IF;
        END $$;
      `);

      await runSql(`
        CREATE TABLE IF NOT EXISTS services (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          price DECIMAL(12,2) NOT NULL,
          duration_minutes INTEGER DEFAULT 30,
          category TEXT,
          image_url TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await runSql(`
        CREATE TABLE IF NOT EXISTS product_variants (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
          product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
          size TEXT,
          color TEXT,
          sku TEXT,
          quantity INTEGER DEFAULT 0,
          low_stock_threshold INTEGER,
          price_override DECIMAL(12,2),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Fix product_variants if it was created with the wrong schema
      await runSql(`
        DO $$ 
        BEGIN 
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_variants' AND column_name='name') THEN
            ALTER TABLE product_variants ALTER COLUMN name DROP NOT NULL;
          END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_variants' AND column_name='price') THEN
            ALTER TABLE product_variants ALTER COLUMN price DROP NOT NULL;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_variants' AND column_name='account_id') THEN
            ALTER TABLE product_variants ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_variants' AND column_name='size') THEN
            ALTER TABLE product_variants ADD COLUMN size TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_variants' AND column_name='color') THEN
            ALTER TABLE product_variants ADD COLUMN color TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_variants' AND column_name='sku') THEN
            ALTER TABLE product_variants ADD COLUMN sku TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_variants' AND column_name='quantity') THEN
            ALTER TABLE product_variants ADD COLUMN quantity INTEGER DEFAULT 0;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_variants' AND column_name='low_stock_threshold') THEN
            ALTER TABLE product_variants ADD COLUMN low_stock_threshold INTEGER;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='product_variants' AND column_name='price_override') THEN
            ALTER TABLE product_variants ADD COLUMN price_override DECIMAL(12,2);
          END IF;
        END $$;
      `);

      // Migration: Remove default value and set existing 5s to null so global threshold applies
      await runSql(`
        ALTER TABLE product_variants ALTER COLUMN low_stock_threshold DROP DEFAULT;
        UPDATE product_variants SET low_stock_threshold = NULL WHERE low_stock_threshold = 5;
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
        CREATE TABLE IF NOT EXISTS chat_messages (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          account_id BIGINT REFERENCES accounts(id) ON DELETE CASCADE,
          user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
          guest_id TEXT,
          guest_email TEXT,
          message TEXT NOT NULL,
          is_from_admin BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS guest_email TEXT;
      `);

      await runSql(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='guest_id') THEN
            ALTER TABLE chat_messages ADD COLUMN guest_id TEXT;
          END IF;
        END $$;
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
        { table: 'bookkeeping', column: 'date', type: 'DATE DEFAULT CURRENT_DATE' },
        { table: 'expenses', column: 'date', type: 'DATE DEFAULT CURRENT_DATE' },
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
        { table: 'product_variants', column: 'size', type: 'TEXT' },
        { table: 'product_variants', column: 'color', type: 'TEXT' },
        { table: 'product_variants', column: 'sku', type: 'TEXT' },
        { table: 'product_variants', column: 'quantity', type: 'INTEGER DEFAULT 0' },
        { table: 'product_variants', column: 'low_stock_threshold', type: 'INTEGER DEFAULT 5' },
        { table: 'product_variants', column: 'price_override', type: 'DECIMAL(12,2)' },
        { table: 'product_images', column: 'account_id', type: 'BIGINT REFERENCES accounts(id) ON DELETE CASCADE' },
        { table: 'settings', column: 'invoice_terms', type: 'TEXT' },
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

      await runSql(`
        CREATE INDEX IF NOT EXISTS idx_sales_account_id ON sales(account_id);
        CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
        CREATE INDEX IF NOT EXISTS idx_sales_staff_id ON sales(staff_id);
        CREATE INDEX IF NOT EXISTS idx_sale_items_account_id ON sale_items(account_id);
        CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
        CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON expenses(account_id);
        CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
        CREATE INDEX IF NOT EXISTS idx_products_account_id ON products(account_id);
        CREATE INDEX IF NOT EXISTS idx_product_variants_account_id ON product_variants(account_id);
        CREATE INDEX IF NOT EXISTS idx_bookkeeping_account_id ON bookkeeping(account_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_account_id ON notifications(account_id);
        CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id);
        CREATE INDEX IF NOT EXISTS idx_customers_account_id ON customers(account_id);
      `);

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

      // 2. Check for superadmin (by username or email)
      let existingAdmin = null;
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1', ['superadmin', 'admin@gryndee.com']);
        if (rows.length > 0) existingAdmin = rows[0];
      }

      if (!existingAdmin) {
        console.log('[INIT] No super admin found. Creating default super admin...');
        const superPass = process.env.SUPERADMIN_PASSWORD;
        if (superPass) {
          const hashedPassword = await bcrypt.hash(superPass, 10);
          
          if (process.env.AWS_DB_PASSWORD) {
            const { rows: accRows } = await pool.query('INSERT INTO accounts (name) VALUES ($1) RETURNING id', ['System Administration']);
            const account = accRows[0];
            await pool.query(
              'INSERT INTO users (account_id, username, email, password, role, name) VALUES ($1, $2, $3, $4, $5, $6)',
              [account.id, 'superadmin', 'admin@gryndee.com', hashedPassword, 'super_admin', 'System Admin']
            );
          }
          console.log('[INIT] Default super admin created');
        } else {
          console.log('[INIT] SUPERADMIN_PASSWORD not set, skipping default super admin creation');
        }
      }

      // 3. Check for demo admin (by username or email)
      let demoAdmin = null;
      if (process.env.AWS_DB_PASSWORD) {
        const { rows } = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1', ['admin', 'admin@gryndee.com']);
        if (rows.length > 0) demoAdmin = rows[0];
      }

      if (!demoAdmin) {
        console.log('[INIT] No demo admin found. Skipping demo admin creation for security.');
      }
    }
  } catch (e) {
    console.error('[INIT] Failed to ensure super admin:', e);
  }

  const io = new SocketIOServer(server, {
    path: '/socket.io',
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const clients = new Map<string, any>();
  const lastEmailSent = new Map<string, number>();

  io.on('connection', (socket) => {
    console.log(`[WS] New connection attempt: ${socket.id}`);
    const userId = socket.handshake.query.userId as string;
    const accountId = socket.handshake.query.accountId as string;
    const guestId = socket.handshake.query.guestId as string;
    const isAdmin = socket.handshake.query.isAdmin === 'true';
    
    const clientId = userId || guestId;
    console.log(`[WS] Client ID resolved: ${clientId}, isAdmin: ${isAdmin}`);

    if (isAdmin) {
      socket.join('admins');
    }

    if (clientId) {
      socket.join(clientId);
      console.log(`[WS] Client ${clientId} connected and joined room.`);
    } else {
      console.log(`[WS] Connection without clientId`);
    }

    socket.on('chat_message', async (payload) => {
      try {
        const { message, targetUserId, isFromAdmin, guestEmail } = payload;

        let insertUserId = userId || null;
        let insertGuestId = guestId || null;
        let insertAccountId = accountId || null;
        let insertGuestEmail = guestEmail || null;

        if (isFromAdmin && targetUserId) {
          insertAccountId = null; // Don't link admin's account ID to the message
          if (String(targetUserId).startsWith('guest_')) {
            insertGuestId = targetUserId;
            insertUserId = null;
            // Try to find guest email from previous messages if not provided
            if (!insertGuestEmail && process.env.AWS_DB_PASSWORD) {
              const { rows } = await pool.query('SELECT guest_email FROM chat_messages WHERE guest_id = $1 AND guest_email IS NOT NULL LIMIT 1', [insertGuestId]);
              if (rows.length > 0) insertGuestEmail = rows[0].guest_email;
            }
          } else {
            insertUserId = targetUserId;
            insertGuestId = null;
          }
        }

        if (process.env.AWS_DB_PASSWORD) {
          await pool.query(
            'INSERT INTO chat_messages (account_id, user_id, guest_id, guest_email, message, is_from_admin) VALUES ($1, $2, $3, $4, $5, $6)',
            [insertAccountId, insertUserId, insertGuestId, insertGuestEmail, message, isFromAdmin]
          );
        }

        const messagePayload = {
          message,
          fromUserId: clientId,
          targetUserId,
          isFromAdmin,
          guestId: insertGuestId,
          guestEmail: insertGuestEmail,
          accountId: insertAccountId,
          created_at: new Date().toISOString()
        };

        // 1. Emit to the target user/guest (if admin is sending)
        if (isFromAdmin && targetUserId) {
          console.log(`[WS] Admin sending message to ${targetUserId}`);
          io.to(String(targetUserId)).emit('chat_message', messagePayload);
        }
        
        // 2. Emit to the sender's other tabs
        socket.to(String(clientId)).emit('chat_message', messagePayload);

        // 3. Emit to all admins
        io.to('admins').emit('chat_message', messagePayload);

        if (!isFromAdmin) {
          // Send email notification to superadmin
          const now = Date.now();
          const lastSent = lastEmailSent.get(clientId || 'unknown') || 0;
          if (now - lastSent > 5 * 60 * 1000) { // 5 minutes throttle
            lastEmailSent.set(clientId || 'unknown', now);
            try {
              const senderInfo = userId ? 'User ' + userId : `Guest ${guestId}${insertGuestEmail ? ' (' + insertGuestEmail + ')' : ''}`;
              await sendEmail(
                'abinibimultimedia@yahoo.com',
                'New Chat Message on Gryndee',
                `You have received a new chat message from ${senderInfo}:\n\n"${message}"\n\nLogin to the admin dashboard to reply.`
              );
            } catch (emailErr) {
              console.error('Failed to send chat notification email:', emailErr);
            }
          }
        }
      } catch (e) {
        console.error('WS Message Error:', e);
      }
    });

    socket.on('typing', (payload) => {
      const { targetUserId, isTyping } = payload;
      console.log(`[WS] Typing event from ${clientId} (isAdmin: ${isAdmin}): ${isTyping}, target: ${targetUserId}`);
      
      const typingPayload = {
        fromUserId: clientId,
        isTyping,
        isFromAdmin: isAdmin
      };

      if (isAdmin && targetUserId) {
        // Admin is typing to a specific user
        console.log(`[WS] Emitting typing to user room: ${targetUserId}`);
        io.to(String(targetUserId)).emit('typing', typingPayload);
      } else if (!isAdmin) {
        // User is typing, notify admins
        console.log(`[WS] Emitting typing to admins room`);
        io.to('admins').emit('typing', typingPayload);
      }
    });

    socket.on('end_chat', (payload) => {
      const { targetUserId } = payload;
      if (targetUserId) {
        io.to(targetUserId).emit('end_chat', {
          fromUserId: clientId
        });
      }
      if (!isAdmin) {
        socket.to('admins').emit('end_chat', {
          fromUserId: clientId
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Gryndee is running on port ${PORT}`);
    console.log(`[SERVER] Health check endpoint: http://localhost:${PORT}/api/test`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  return app;
}

const appPromise = createServer();

export default async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
};
