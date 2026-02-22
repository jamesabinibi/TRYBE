import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("inventory.db");

// Initialize Database Schema
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

  -- Seed default categories
  INSERT OR IGNORE INTO categories (name) VALUES ('Electronics'), ('Fashion'), ('Food'), ('General');
`);

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
  db.prepare("INSERT INTO users (username, email, password, role, name) VALUES (?, ?, ?, ?, ?)").run(
    "admin",
    "admin@example.com",
    "admin123", // In a real app, hash this!
    "admin",
    "System Admin"
  );
} else if (!(adminExists as any).email) {
  // Update existing admin with default email if missing
  db.prepare("UPDATE users SET email = ? WHERE username = ?").run("admin@example.com", "admin");
}

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const PORT = 3000;

// --- API ROUTES ---

// Auth (Simple for demo)
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  console.log(`Login attempt for username: ${username}`);
  try {
    const user = db.prepare("SELECT id, username, role, name FROM users WHERE username = ? AND password = ?").get(username, password);
    if (user) {
      console.log(`Login successful for user: ${username}`);
      res.json(user);
    } else {
      console.log(`Login failed for user: ${username} - Invalid credentials`);
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.error(`Login error for user: ${username}`, error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/register", (req, res) => {
  const { username, email, password, name, role = 'staff' } = req.body;
  console.log(`Registration attempt for username: ${username}, email: ${email}`);
  try {
    const info = db.prepare("INSERT INTO users (username, email, password, role, name) VALUES (?, ?, ?, ?, ?)").run(
      username,
      email,
      password,
      role,
      name
    );
    console.log(`Registration successful for user: ${username}`);
    res.json({ id: info.lastInsertRowid, username, email, role, name });
  } catch (e: any) {
    console.error(`Registration failed for user: ${username}`, e);
    res.status(400).json({ error: "Username or email already exists" });
  }
});

app.post("/api/forgot-password", (req, res) => {
  const { email } = req.body;
  // In a real app, send an email. Here we just simulate it.
  res.json({ message: "Confirmation code sent to " + email, code: "123456" });
});

app.post("/api/reset-password", (req, res) => {
  const { username, newPassword, code } = req.body;
  if (code !== "123456") {
    return res.status(400).json({ error: "Invalid confirmation code" });
  }
  
  const result = db.prepare("UPDATE users SET password = ? WHERE username = ?").run(newPassword, username);
  if (result.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "User not found" });
  }
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
      for (const v of variants) {
        insertVariant.run(productId, v.size, v.color, v.quantity, v.low_stock_threshold, v.price_override);
      }
    }

    if (images && Array.isArray(images)) {
      const insertImage = db.prepare(`
        INSERT INTO product_images (product_id, image_data)
        VALUES (?, ?)
      `);
      for (const img of images) {
        insertImage.run(productId, img);
      }
    }
    
    res.json({ id: productId });
  } catch (error: any) {
    console.error("Error saving product:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/products/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { name, category_id, description, cost_price, selling_price, supplier_name, variants, images } = req.body;
    
    db.transaction(() => {
      // Update product
      db.prepare(`
        UPDATE products 
        SET name = ?, category_id = ?, description = ?, cost_price = ?, selling_price = ?, supplier_name = ?
        WHERE id = ?
      `).run(name, category_id, description, cost_price, selling_price, supplier_name, id);

      // Update variants (simplest approach: delete and re-insert)
      db.prepare("DELETE FROM product_variants WHERE product_id = ?").run(id);
      if (variants && Array.isArray(variants)) {
        const insertVariant = db.prepare(`
          INSERT INTO product_variants (product_id, size, color, quantity, low_stock_threshold, price_override)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const v of variants) {
          insertVariant.run(id, v.size, v.color, v.quantity, v.low_stock_threshold, v.price_override);
        }
      }

      // Update images (delete and re-insert)
      db.prepare("DELETE FROM product_images WHERE product_id = ?").run(id);
      if (images && Array.isArray(images)) {
        const insertImage = db.prepare(`
          INSERT INTO product_images (product_id, image_data)
          VALUES (?, ?)
        `);
        for (const img of images) {
          insertImage.run(id, img);
        }
      }
    })();
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating product:", error);
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
    console.error("Error deleting product:", error);
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
    const saleInfo = db.prepare(`
      INSERT INTO sales (invoice_number, total_amount, total_profit, payment_method, staff_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(invoice_number, 0, 0, payment_method, staff_id);
    
    const saleId = saleInfo.lastInsertRowid;
    
    for (const item of items) {
      const variant = db.prepare("SELECT * FROM product_variants WHERE id = ?").get(item.variant_id);
      const product = db.prepare("SELECT * FROM products WHERE id = ?").get(variant.product_id);
      
      const sellingPrice = item.price_override || variant.price_override || product.selling_price;
      const costPrice = product.cost_price;
      const profit = (sellingPrice - costPrice) * item.quantity;
      
      total_amount += sellingPrice * item.quantity;
      total_profit += profit;
      
      // Deduct stock
      db.prepare("UPDATE product_variants SET quantity = quantity - ? WHERE id = ?").run(item.quantity, item.variant_id);
      
      // Record item
      db.prepare(`
        INSERT INTO sale_items (sale_id, variant_id, quantity, selling_price, cost_price, profit)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(saleId, item.variant_id, item.quantity, sellingPrice, costPrice, profit);
    }
    
    // Update totals
    db.prepare("UPDATE sales SET total_amount = ?, total_profit = ? WHERE id = ?").run(total_amount, total_profit, saleId);
    
    return { saleId, invoice_number };
  });
  
  try {
    const result = transaction();
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/sales", (req, res) => {
  const sales = db.prepare(`
    SELECT s.*, u.name as staff_name
    FROM sales s
    LEFT JOIN users u ON s.staff_id = u.id
    ORDER BY s.created_at DESC
  `).all();
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
  const trends = db.prepare(`
    SELECT date(created_at) as date, SUM(total_amount) as revenue, SUM(total_profit) as profit
    FROM sales
    GROUP BY date(created_at)
    ORDER BY date(created_at) ASC
    LIMIT 30
  `).all();
  res.json(trends);
});

// API 404 handler
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// --- VITE MIDDLEWARE ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
