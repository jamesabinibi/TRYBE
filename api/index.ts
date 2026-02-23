import express from "express";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Vercel specific database path
const isVercel = process.env.VERCEL === '1';
const dbPath = isVercel 
  ? path.join("/tmp", "inventory.db") 
  : path.resolve(process.cwd(), "inventory.db");

console.log(`[INIT] Starting server at ${new Date().toISOString()}`);
console.log(`[INIT] Environment: ${process.env.NODE_ENV}`);
console.log(`[INIT] Database path: ${dbPath}`);

let db: any;
try {
  db = new Database(dbPath);
  console.log(`[INIT] Database opened successfully`);
} catch (err) {
  console.error(`[INIT] CRITICAL: Failed to open database:`, err);
}

// Initialize Database Schema
if (db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT CHECK(role IN ('admin', 'manager', 'staff')),
        name TEXT
      );
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
      );
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        category_id INTEGER,
        description TEXT,
        cost_price REAL,
        selling_price REAL,
        supplier_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(category_id) REFERENCES categories(id)
      );
      CREATE TABLE IF NOT EXISTS product_variants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        size TEXT,
        color TEXT,
        quantity INTEGER DEFAULT 0,
        low_stock_threshold INTEGER DEFAULT 5,
        price_override REAL,
        FOREIGN KEY(product_id) REFERENCES products(id)
      );
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE,
        total_amount REAL,
        total_profit REAL,
        payment_method TEXT,
        staff_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(staff_id) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER,
        variant_id INTEGER,
        quantity INTEGER,
        selling_price REAL,
        cost_price REAL,
        profit REAL,
        FOREIGN KEY(sale_id) REFERENCES sales(id),
        FOREIGN KEY(variant_id) REFERENCES product_variants(id)
      );
      CREATE TABLE IF NOT EXISTS product_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        image_data TEXT,
        FOREIGN KEY(product_id) REFERENCES products(id)
      );
      INSERT OR IGNORE INTO categories (name) VALUES ('Electronics'), ('Fashion'), ('Food'), ('General');
    `);
    
    // Migration: Add email column to users if it doesn't exist
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const hasEmail = tableInfo.some((col: any) => col.name === 'email');
    if (!hasEmail) {
      db.prepare("ALTER TABLE users ADD COLUMN email TEXT").run();
      db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)").run();
    }

    // Seed default admin
    const adminExists = db.prepare("SELECT * FROM users WHERE username = ?").get("admin");
    if (!adminExists) {
      db.prepare("INSERT INTO users (username, email, password, role, name) VALUES (?, ?, ?, ?, ?)").run(
        "admin",
        "admin@example.com",
        "admin123",
        "admin",
        "System Admin"
      );
    }
    console.log(`[INIT] Schema initialized successfully`);
  } catch (err) {
    console.error(`[INIT] Failed to initialize schema:`, err);
  }
}

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString(), isVercel });
});

app.get("/api/test", (req, res) => {
  res.json({ message: "API is working", env: process.env.NODE_ENV, isVercel });
});

// Auth
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const trimmedUsername = username?.trim();
  try {
    const user = db.prepare("SELECT id, username, role, name FROM users WHERE LOWER(username) = LOWER(?) AND password = ?").get(trimmedUsername, password);
    if (user) res.json(user);
    else res.status(401).json({ error: "Invalid username or password" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/register", (req, res) => {
  const { username, email, password, name, role = 'staff' } = req.body;
  const trimmedUsername = username?.trim();
  const trimmedEmail = email?.trim()?.toLowerCase();
  try {
    const existing = db.prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)").get(trimmedUsername, trimmedEmail);
    if (existing) return res.status(400).json({ error: "Username or email already exists" });

    const info = db.prepare("INSERT INTO users (username, email, password, role, name) VALUES (?, ?, ?, ?, ?)").run(trimmedUsername, trimmedEmail, password, role, name);
    res.json({ id: info.lastInsertRowid, username: trimmedUsername, email: trimmedEmail, role, name });
  } catch (e) {
    res.status(400).json({ error: "Registration failed" });
  }
});

// Products
app.get("/api/products", (req, res) => {
  try {
    const products = db.prepare(`
      SELECT p.*, c.name as category_name, 
      (SELECT SUM(quantity) FROM product_variants WHERE product_id = p.id) as total_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
    `).all();
    const productsWithVariants = products.map(p => {
      const variants = db.prepare("SELECT * FROM product_variants WHERE product_id = ?").all(p.id);
      const images = db.prepare("SELECT image_data FROM product_images WHERE product_id = ?").all(p.id);
      return { ...p, variants, images: images.map((img: any) => img.image_data) };
    });
    res.json(productsWithVariants);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.post("/api/products", (req, res) => {
  try {
    const { name, category_id, description, cost_price, selling_price, supplier_name, variants, images } = req.body;
    const info = db.prepare(`
      INSERT INTO products (name, category_id, description, cost_price, selling_price, supplier_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, category_id, description, cost_price, selling_price, supplier_name);
    const productId = info.lastInsertRowid;
    if (variants && Array.isArray(variants)) {
      const insertVariant = db.prepare(`INSERT INTO product_variants (product_id, size, color, quantity, low_stock_threshold, price_override) VALUES (?, ?, ?, ?, ?, ?)`);
      for (const v of variants) insertVariant.run(productId, v.size, v.color, v.quantity, v.low_stock_threshold, v.price_override);
    }
    if (images && Array.isArray(images)) {
      db.prepare(`INSERT INTO product_images (product_id, image_data) VALUES (?, ?)`).run(productId, images[0]);
    }
    res.json({ id: productId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Categories
app.get("/api/categories", (req, res) => {
  res.json(db.prepare("SELECT * FROM categories").all());
});

// Sales
app.post("/api/sales", (req, res) => {
  const { items, payment_method, staff_id } = req.body;
  const invoice_number = "INV-" + Date.now();
  let total_amount = 0;
  let total_profit = 0;
  try {
    const transaction = db.transaction(() => {
      const saleInfo = db.prepare(`INSERT INTO sales (invoice_number, total_amount, total_profit, payment_method, staff_id) VALUES (?, ?, ?, ?, ?)`).run(invoice_number, 0, 0, payment_method, staff_id);
      const saleId = saleInfo.lastInsertRowid;
      for (const item of items) {
        const variant = db.prepare("SELECT * FROM product_variants WHERE id = ?").get(item.variant_id);
        const product = db.prepare("SELECT * FROM products WHERE id = ?").get(variant.product_id);
        const sellingPrice = item.price_override || variant.price_override || product.selling_price;
        const costPrice = product.cost_price;
        const profit = (sellingPrice - costPrice) * item.quantity;
        total_amount += sellingPrice * item.quantity;
        total_profit += profit;
        db.prepare("UPDATE product_variants SET quantity = quantity - ? WHERE id = ?").run(item.quantity, item.variant_id);
        db.prepare(`INSERT INTO sale_items (sale_id, variant_id, quantity, selling_price, cost_price, profit) VALUES (?, ?, ?, ?, ?, ?)`).run(saleId, item.variant_id, item.quantity, sellingPrice, costPrice, profit);
      }
      db.prepare("UPDATE sales SET total_amount = ?, total_profit = ? WHERE id = ?").run(total_amount, total_profit, saleId);
      return { saleId, invoice_number };
    });
    res.json(transaction());
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/sales", (req, res) => {
  const sales = db.prepare(`SELECT s.*, u.name as staff_name FROM sales s LEFT JOIN users u ON s.staff_id = u.id ORDER BY s.created_at DESC`).all();
  res.json(sales);
});

// Analytics
app.get("/api/analytics/summary", (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const summary = db.prepare(`
    SELECT 
      (SELECT COUNT(*) FROM products) as total_products,
      (SELECT SUM(quantity) FROM product_variants) as total_stock,
      (SELECT COUNT(*) FROM product_variants WHERE quantity <= low_stock_threshold) as low_stock_count,
      (SELECT SUM(total_amount) FROM sales WHERE date(created_at) = ?) as today_sales,
      (SELECT SUM(total_profit) FROM sales WHERE date(created_at) = ?) as today_profit
    FROM (SELECT 1)
  `).get(today, today);
  res.json(summary);
});

app.get("/api/analytics/trends", (req, res) => {
  const trends = db.prepare(`SELECT date(created_at) as date, SUM(total_amount) as revenue, SUM(total_profit) as profit FROM sales GROUP BY date(created_at) ORDER BY date(created_at) ASC LIMIT 30`).all();
  res.json(trends);
});

// API 404
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: "API route not found", path: req.url });
});

export default app;
