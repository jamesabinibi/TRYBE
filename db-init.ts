import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.AWS_DB_HOST || 'gryndee-db.cevskqcic97b.us-east-1.rds.amazonaws.com',
  port: parseInt(process.env.AWS_DB_PORT || '5432'),
  user: process.env.AWS_DB_USER || 'postgres',
  password: process.env.AWS_DB_PASSWORD,
  database: process.env.AWS_DB_NAME || 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

const schema = `
-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  owner_id INTEGER
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'user',
  account_id INTEGER REFERENCES accounts(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id),
  business_name TEXT,
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

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Products table
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

-- Product Variants table
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

-- Services table
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sales table
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id),
  customer_id INTEGER REFERENCES customers(id),
  staff_id INTEGER REFERENCES users(id),
  total_amount DECIMAL(12, 2) NOT NULL,
  discount_amount DECIMAL(12, 2) DEFAULT 0,
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',
  invoice_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sale Items table
CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES product_variants(id),
  service_id INTEGER REFERENCES services(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  total DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id),
  category TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

async function initDb() {
  try {
    console.log('[DB] Connecting to AWS RDS...');
    const client = await pool.connect();
    console.log('[DB] Connected. Running schema migration...');
    await client.query(schema);
    console.log('[DB] Schema migration complete.');
    client.release();
  } catch (err) {
    console.error('[DB] Migration failed:', err);
  } finally {
    await pool.end();
  }
}

initDb();
