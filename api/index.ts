import express from "express";
import { createClient } from '@supabase/supabase-js';
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Auth
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const trimmedUsername = username?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: "Server configuration error: SUPABASE_URL or SUPABASE_ANON_KEY is missing." });
  }

  try {
    const { data: user, error: supabaseError } = await supabase
      .from('users')
      .select('id, username, email, role, name, password')
      .or(`username.ilike.${trimmedUsername},email.ilike.${trimmedUsername}`)
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

// Products
app.get("/api/products", async (req, res) => {
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

    const productsWithVariants = products.map(p => ({
      ...p,
      category_name: p.categories?.name,
      variants: p.product_variants,
      images: p.product_images?.map((img: any) => img.image_data) || []
    }));

    res.json(productsWithVariants);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const { name, category_id, description, cost_price, selling_price, supplier_name, variants, images } = req.body;
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert([{ name, category_id, description, cost_price, selling_price, supplier_name }])
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
      await supabase.from('product_images').insert([{ product_id: productId, image_data: images[0] }]);
    }

    res.json({ id: productId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Categories
app.get("/api/categories", async (req, res) => {
  const { data, error } = await supabase.from('categories').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/categories", async (req, res) => {
  const { name } = req.body;
  try {
    const { data, error } = await supabase.from('categories').insert([{ name }]).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: "Category already exists" });
  }
});

// Sales
app.post("/api/sales", async (req, res) => {
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

app.get("/api/sales", async (req, res) => {
  const { data, error } = await supabase
    .from('sales')
    .select('*, users(name)')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  
  const salesWithStaff = data.map(s => ({
    ...s,
    staff_name: s.users?.name
  }));
  res.json(salesWithStaff);
});

// Analytics
app.get("/api/analytics/summary", async (req, res) => {
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
  res.status(404).json({ error: "API route not found", path: req.url });
});

export default app;
