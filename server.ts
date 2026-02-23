import express from "express";
import { createServer as createViteServer } from "vite";
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
  : path.resolve(__dirname, "inventory.db");

console.log(`[INIT] Starting server at ${new Date().toISOString()}`);
console.log(`[INIT] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[INIT] VERCEL: ${process.env.VERCEL}`);
console.log(`[INIT] Database path: ${dbPath}`);

let db: any;
try {
  db = new Database(dbPath);
  console.log(`[INIT] Database opened successfully`);
} catch (err) {
  console.error(`[INIT] CRITICAL: Failed to open database:`, err);
}

// Initialize Database Schema
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
  console.log(`[INIT] Schema initialized successfully`);
} catch (err) {
  console.error(`[INIT] Failed to initialize schema:`, err);
}

// Migration: Add email column to users if it doesn't exist
try {
  const tableInfo = db.prepare("PRAGMA table_info(users)").all();
  const hasEmail = tableInfo.some((col: any) => col.name === 'email');
  if (!hasEmail) {
    db.prepare("ALTER TABLE users ADD COLUMN email TEXT").run();
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)").run();
    console.log("Added email column and unique index to users table");
  }
} catch (e) {
  console.error("Migration error:", e);
}

// Seed default admin if not exists
const adminExists = db.prepare("SELECT * FROM users WHERE username = ?").get("admin");
if (!adminExists) {
  console.log("Seeding default admin user...");
  db.prepare("INSERT INTO users (username, email, password, role, name) VALUES (?, ?, ?, ?, ?)").run(
    "admin",
    "admin@example.com",
    "admin123", // In a real app, hash this!
    "admin",
    "System Admin"
  );
} else if (!(adminExists as any).email) {
  console.log("Updating existing admin with default email...");
  // Update existing admin with default email if missing
  db.prepare("UPDATE users SET email = ? WHERE username = ?").run("admin@example.com", "admin");
} else {
  console.log("Admin user already exists and is up to date.");
}

async function createServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.get("/api/test", (req, res) => {
    res.json({ message: "API is working", env: process.env.NODE_ENV });
  });

  // Auth
  const loginHandler = (req: any, res: any) => {
    const { username, password } = req.body;
    const trimmedUsername = username?.trim();
    console.log(`Login attempt for: ${trimmedUsername}`);
    try {
      const user = db.prepare("SELECT id, username, role, name FROM users WHERE LOWER(username) = LOWER(?) AND password = ?").get(trimmedUsername, password);
      if (user) {
        console.log(`Login success: ${trimmedUsername}`);
        res.json(user);
      } else {
        console.log(`Login failed: ${trimmedUsername} - Invalid credentials`);
        res.status(401).json({ error: "Invalid username or password" });
      }
    } catch (error) {
      console.error(`Login error:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  app.post("/api/login", loginHandler);
  app.post("/api/login/", loginHandler);

  const registerHandler = (req: any, res: any) => {
    const { username, email, password, name, role = 'staff' } = req.body;
    const trimmedUsername = username?.trim();
    const trimmedEmail = email?.trim()?.toLowerCase();
    console.log(`Register attempt: ${trimmedUsername} (${trimmedEmail})`);
    try {
      // Check if exists case-insensitively
      const existing = db.prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)").get(trimmedUsername, trimmedEmail);
      if (existing) {
        return res.status(400).json({ error: "Username or email already exists" });
      }

      const info = db.prepare("INSERT INTO users (username, email, password, role, name) VALUES (?, ?, ?, ?, ?)").run(
        trimmedUsername,
        trimmedEmail,
        password,
        role,
        name
      );
      console.log(`Register success: ${trimmedUsername}`);
      res.json({ id: info.lastInsertRowid, username: trimmedUsername, email: trimmedEmail, role, name });
    } catch (e: any) {
      console.error(`Register failed:`, e);
      res.status(400).json({ error: "Registration failed. Please try again." });
    }
  };

  app.post("/api/register", registerHandler);
  app.post("/api/register/", registerHandler);

  app.post("/api/forgot-password", (req, res) => {
    const { email } = req.body;
    res.json({ message: "Confirmation code sent to " + email, code: "123456" });
  });

  app.post("/api/reset-password", (req, res) => {
    const { username, newPassword, code } = req.body;
    if (code !== "123456") return res.status(400).json({ error: "Invalid code" });
    const result = db.prepare("UPDATE users SET password = ? WHERE username = ?").run(newPassword, username);
    if (result.changes > 0) res.json({ success: true });
    else res.status(404).json({ error: "User not found" });
  });

  // Products
  app.get("/api/products", (req, res) => {
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
        const insertVariant = db.prepare(`
          INSERT INTO product_variants (product_id, size, color, quantity, low_stock_threshold, price_override)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const v of variants) insertVariant.run(productId, v.size, v.color, v.quantity, v.low_stock_threshold, v.price_override);
      }
      if (images && Array.isArray(images)) {
        const insertImage = db.prepare(`INSERT INTO product_images (product_id, image_data) VALUES (?, ?)`).run(productId, images[0]); // Simplified for now
      }
      res.json({ id: productId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/products/:id", (req, res) => {
    try {
      const { id } = req.params;
      const { name, category_id, description, cost_price, selling_price, supplier_name, variants, images } = req.body;
      db.transaction(() => {
        db.prepare(`UPDATE products SET name = ?, category_id = ?, description = ?, cost_price = ?, selling_price = ?, supplier_name = ? WHERE id = ?`).run(name, category_id, description, cost_price, selling_price, supplier_name, id);
        db.prepare("DELETE FROM product_variants WHERE product_id = ?").run(id);
        if (variants && Array.isArray(variants)) {
          const insertVariant = db.prepare(`INSERT INTO product_variants (product_id, size, color, quantity, low_stock_threshold, price_override) VALUES (?, ?, ?, ?, ?, ?)`);
          for (const v of variants) insertVariant.run(id, v.size, v.color, v.quantity, v.low_stock_threshold, v.price_override);
        }
      })();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/products/:id", (req, res) => {
    try {
      const { id } = req.params;
      db.transaction(() => {
        db.prepare("DELETE FROM product_images WHERE product_id = ?").run(id);
        db.prepare("DELETE FROM product_variants WHERE product_id = ?").run(id);
        db.prepare("DELETE FROM products WHERE id = ?").run(id);
      })();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Categories
  app.get("/api/categories", (req, res) => {
    res.json(db.prepare("SELECT * FROM categories").all());
  });

  app.post("/api/categories", (req, res) => {
    const { name } = req.body;
    try {
      const info = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
      res.json({ id: info.lastInsertRowid, name });
    } catch (e) {
      res.status(400).json({ error: "Category already exists" });
    }
  });

  // Sales
  app.post("/api/sales", (req, res) => {
    const { items, payment_method, staff_id } = req.body;
    const invoice_number = "INV-" + Date.now();
    let total_amount = 0;
    let total_profit = 0;
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
    try {
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

  // API 404 handler
  app.all("/api/*", (req, res) => {
    console.log(`[API 404] ${req.method} ${req.url} - No route matched`);
    res.status(404).json({ 
      error: "API route not found",
      method: req.method,
      path: req.url 
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is listening on http://0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global error:", err);
    if (req.url.startsWith('/api/')) {
      res.status(500).json({ error: "Internal server error" });
    } else {
      next(err);
    }
  });

  return app;
}

const appPromise = createServer();

export default async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
};
