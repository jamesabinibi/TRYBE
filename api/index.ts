import express from "express";
import { createClient } from '@supabase/supabase-js';
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

console.log(`[API] Supabase URL: ${supabaseUrl ? 'SET' : 'MISSING'}`);
console.log(`[API] Supabase Key: ${supabaseAnonKey ? 'SET' : 'MISSING'}`);

let supabase: any;
try {
  if (supabaseUrl && supabaseAnonKey) {
    if (!supabaseUrl.startsWith('http')) {
      console.error("[API] ERROR: SUPABASE_URL must start with http:// or https://");
    } else {
      supabase = createClient(supabaseUrl, supabaseAnonKey);
      console.log(`[API] Supabase client initialized`);
    }
  } else {
    console.warn(`[API] Supabase credentials missing`);
  }
} catch (e) {
  console.error("[API] Failed to initialize Supabase client:", e);
}

const app = express();
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
  console.log(`[API] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Health & Diag
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "2.4.2-stable", time: new Date().toISOString() });
});

app.get("/api/diag", async (req, res) => {
  let dbStatus = "Not tested";
  if (supabase) {
    try {
      const { error } = await supabase.from('users').select('id').limit(1);
      dbStatus = error ? `Error: ${error.message}` : "Connected";
    } catch (e: any) {
      dbStatus = `Exception: ${e.message}`;
    }
  }

  res.json({
    supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 10)}...` : 'MISSING',
    supabaseAnonKey: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : 'MISSING',
    supabaseInitialized: !!supabase,
    dbStatus,
    nodeEnv: process.env.NODE_ENV,
    currentTime: new Date().toISOString(),
    headers: req.headers,
    url: req.url,
    path: req.path,
    originalUrl: req.originalUrl,
    version: "2.4.2-stable"
  });
});

app.get("/api/test", (req, res) => {
  res.json({ message: "API is working", version: "2.4.2", env: process.env.NODE_ENV });
});

// Auth
app.post("/api/login", async (req, res) => {
  console.log(`[API] Login attempt`);
  const { username, password } = req.body;
  const trimmedUsername = username?.trim();

  if (!supabase) {
    return res.status(500).json({ error: "Server configuration error: Supabase client is not initialized." });
  }

  try {
    const { data: user, error: supabaseError } = await supabase
      .from('users')
      .select('id, username, email, role, name, password')
      .or(`username.ilike."${trimmedUsername}",email.ilike."${trimmedUsername}"`)
      .maybeSingle();

    if (supabaseError) {
      console.error(`[AUTH] Supabase query error:`, supabaseError);
      return res.status(500).json({ error: `Database error: ${supabaseError.message}` });
    }

    if (user && user.password === password) {
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } else {
      res.status(401).json({ error: "Invalid username or password" });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/register", async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: "Server configuration error: Supabase client is not initialized." });
  }
  const { username, email, password, name, role = 'staff' } = req.body;
  const trimmedUsername = username?.trim();
  const trimmedEmail = email?.trim()?.toLowerCase();
  try {
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .or(`username.ilike."${trimmedUsername}",email.ilike."${trimmedEmail}"`)
      .maybeSingle();

    if (existing) return res.status(400).json({ error: "Username or email already exists" });

    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{ username: trimmedUsername, email: trimmedEmail, password, role, name }])
      .select()
      .single();

    if (error) throw error;
    res.json(newUser);
  } catch (e) {
    res.status(400).json({ error: "Registration failed" });
  }
});

app.post("/api/forgot-password", (req, res) => {
  const { email } = req.body;
  res.json({ message: "Confirmation code sent to " + email, code: "123456" });
});

app.post("/api/reset-password", async (req, res) => {
  const { username, newPassword, code } = req.body;
  if (code !== "123456") return res.status(400).json({ error: "Invalid code" });
  if (!supabase) return res.status(503).json({ error: "Database not available" });
  
  const { data, error } = await supabase
    .from('users')
    .update({ password: newPassword })
    .or(`username.ilike."${username}",email.ilike."${username}"`)
    .select()
    .single();
    
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// Users Management
app.get("/api/users", async (req, res) => {
  if (!supabase) return res.json([]);
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, role, name, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/users/:id", async (req, res) => {
  if (!supabase) return res.status(503).json({ error: "Database not available" });
  const { id } = req.params;
  const { name, role, email } = req.body;
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ name, role, email })
      .eq('id', id)
      .select('id, username, email, role, name')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  if (!supabase) return res.status(503).json({ error: "Database not available" });
  const { id } = req.params;
  try {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Products
app.get("/api/products", async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: "Server configuration error: Supabase client is not initialized." });
  }
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        *,
        categories(name),
        product_variants(*),
        product_images(image_data)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const productsWithVariants = products.map(p => {
      const total_stock = p.product_variants?.reduce((acc: number, v: any) => acc + (v.quantity || 0), 0) || 0;
      return {
        ...p,
        category_name: p.categories?.name,
        variants: p.product_variants,
        images: p.product_images?.map((img: any) => img.image_data) || [],
        total_stock
      };
    });

    res.json(productsWithVariants);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.post("/api/products", async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: "Server configuration error: Supabase client is not initialized." });
  }
  try {
    const { name, category_id, description, cost_price, selling_price, supplier_name, unit, pieces_per_unit, product_type, variants, images } = req.body;
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert([{ name, category_id, description, cost_price, selling_price, supplier_name, unit, pieces_per_unit, product_type }])
      .select()
      .single();

    if (productError) throw productError;
    const productId = product.id;

    if (variants && Array.isArray(variants)) {
      const variantsToInsert = variants.map(v => ({
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
      const imagesToInsert = images.map(img => ({ product_id: productId, image_data: img }));
      await supabase.from('product_images').insert(imagesToInsert);
    }

    res.json({ id: productId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/products/:id", async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: "Server configuration error: Supabase client is not initialized." });
  }
  const { id } = req.params;
  const { name, category_id, description, cost_price, selling_price, supplier_name, unit, pieces_per_unit, product_type, variants, images } = req.body;
  
  try {
    const { error: productError } = await supabase
      .from('products')
      .update({ name, category_id, description, cost_price, selling_price, supplier_name, unit, pieces_per_unit, product_type })
      .eq('id', id);

    if (productError) throw productError;

    // Update variants: delete old ones and insert new ones
    await supabase.from('product_variants').delete().eq('product_id', id);
    if (variants && Array.isArray(variants)) {
      const variantsToInsert = variants.map(v => ({
        product_id: id,
        size: v.size,
        color: v.color,
        quantity: v.quantity,
        low_stock_threshold: v.low_stock_threshold,
        price_override: v.price_override
      }));
      await supabase.from('product_variants').insert(variantsToInsert);
    }

    // Update images: delete old ones and insert new ones
    await supabase.from('product_images').delete().eq('product_id', id);
    if (images && Array.isArray(images) && images.length > 0) {
      const imagesToInsert = images.map(img => ({ product_id: id, image_data: img }));
      await supabase.from('product_images').insert(imagesToInsert);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: "Server configuration error: Supabase client is not initialized." });
  }
  const { id } = req.params;
  try {
    // Supabase should handle cascading deletes if configured, but let's be safe
    await supabase.from('product_variants').delete().eq('product_id', id);
    await supabase.from('product_images').delete().eq('product_id', id);
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/categories/:id", async (req, res) => {
  if (!supabase) return res.status(503).json({ error: "Database not available" });
  const { id } = req.params;
  const { name } = req.body;
  const { data, error } = await supabase.from('categories').update({ name }).eq('id', id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete("/api/categories/:id", async (req, res) => {
  if (!supabase) return res.status(503).json({ error: "Database not available" });
  const { id } = req.params;
  try {
    // Check if category has products
    const { count } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('category_id', id);
    if (count && count > 0) {
      return res.status(400).json({ error: "Cannot delete category with associated products" });
    }
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Settings
app.get("/api/settings", async (req, res) => {
  if (!supabase) return res.json({ business_name: 'StockFlow Pro', currency: 'NGN', vat_enabled: false, low_stock_threshold: 5 });
  try {
    const { data, error } = await supabase.from('settings').select('*').limit(1).maybeSingle();
    if (error) throw error;
    res.json(data || { business_name: 'StockFlow Pro', currency: 'NGN', vat_enabled: false, low_stock_threshold: 5 });
  } catch (error) {
    res.json({ business_name: 'StockFlow Pro', currency: 'NGN', vat_enabled: false, low_stock_threshold: 5 });
  }
});

app.post("/api/settings", async (req, res) => {
  if (!supabase) return res.status(503).json({ error: "Database not available" });
  const { business_name, currency, vat_enabled, low_stock_threshold } = req.body;
  console.log(`[SETTINGS] Update request:`, JSON.stringify(req.body));
  try {
    const { data: existing, error: fetchError } = await supabase.from('settings').select('id').limit(1).maybeSingle();
    
    if (fetchError) {
      console.error(`[SETTINGS] Fetch error:`, fetchError);
      throw fetchError;
    }

    let result;
    if (existing) {
      console.log(`[SETTINGS] Updating existing record ID: ${existing.id}`);
      result = await supabase.from('settings').update({ business_name, currency, vat_enabled, low_stock_threshold }).eq('id', existing.id).select().single();
    } else {
      console.log(`[SETTINGS] Inserting new record`);
      result = await supabase.from('settings').insert([{ business_name, currency, vat_enabled, low_stock_threshold }]).select().single();
    }
    
    if (result.error) {
      console.error(`[SETTINGS] Save error:`, result.error);
      throw result.error;
    }
    res.json(result.data);
  } catch (error: any) {
    console.error(`[SETTINGS] Exception:`, error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Sales
app.post("/api/sales", async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: "Server configuration error: Supabase client is not initialized." });
  }
  const { items, payment_method, staff_id } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "No items in sale" });
  }

  const invoice_number = "INV-" + Date.now();
  let total_amount = 0;
  let total_profit = 0;
  
  try {
    const validStaffId = (staff_id && !isNaN(Number(staff_id))) ? Number(staff_id) : null;

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([{ invoice_number, total_amount: 0, total_profit: 0, payment_method, staff_id: validStaffId }])
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
          sale_id: saleId,
          variant_id: item.variant_id,
          quantity: item.quantity,
          selling_price: sellingPrice,
          cost_price: costPrice,
          profit: profit
        }]);
    }
    
    await supabase
      .from('sales')
      .update({ total_amount, total_profit })
      .eq('id', saleId);

    res.json({ saleId, invoice_number });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.delete("/api/sales", async (req, res) => {
  if (!supabase) return res.status(503).json({ error: "Database not available" });
  try {
    await supabase.from('sale_items').delete().neq('id', 0);
    const { error } = await supabase.from('sales').delete().neq('id', 0);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/sales/:id", async (req, res) => {
  if (!supabase) return res.status(503).json({ error: "Database not available" });
  const { id } = req.params;

  try {
    await supabase.from('sale_items').delete().eq('sale_id', id);
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Notifications
app.get("/api/notifications/:userId", async (req, res) => {
  if (!supabase) return res.json([]);
  const { userId } = req.params;
  
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/notifications/:id/read", async (req, res) => {
  if (!supabase) return res.json({ success: true });
  const { id } = req.params;
  try {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Analytics
app.get("/api/analytics/summary", async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: "Server configuration error: Supabase client is not initialized." });
  }
  try {
    const today = new Date().toISOString().split('T')[0];
    const { count: totalProducts } = await supabase.from('products').select('*', { count: 'exact', head: true });
    const { data: variants } = await supabase.from('product_variants').select('quantity, low_stock_threshold');
    const totalStock = variants?.reduce((acc, v) => acc + (v.quantity || 0), 0) || 0;
    const lowStockCount = variants?.filter(v => v.quantity <= v.low_stock_threshold).length || 0;

    const { data: todaySalesData } = await supabase
      .from('sales')
      .select('total_amount, total_profit')
      .gte('created_at', today);

    const todaySales = todaySalesData?.reduce((acc, s) => acc + (s.total_amount || 0), 0) || 0;
    const todayProfit = todaySalesData?.reduce((acc, s) => acc + (s.total_profit || 0), 0) || 0;

    res.json({
      total_products: totalProducts,
      total_stock: totalStock,
      low_stock_count: lowStockCount,
      today_sales: todaySales,
      today_profit: todayProfit
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/analytics/trends", async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: "Server configuration error: Supabase client is not initialized." });
  }
  try {
    const { data, error } = await supabase
      .from('sales')
      .select('created_at, total_amount, total_profit')
      .order('created_at', { ascending: true });

    if (error) throw error;

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

// API 404
app.all("/api/*", (req, res) => {
  res.status(404).json({ 
    error: `API route not found (v2.4.2): ${req.method} ${req.path}`,
    method: req.method,
    path: req.path,
    url: req.url 
  });
});

export default app;
