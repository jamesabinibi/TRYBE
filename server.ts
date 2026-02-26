import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from 'fs';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

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
  app.get(["/api/health", "/api/health/"], (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.get(["/api/diag", "/api/diag/"], (req, res) => {
    res.json({
      supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 10)}...` : 'MISSING',
      supabaseAnonKey: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : 'MISSING',
      supabaseInitialized: !!supabase,
      nodeEnv: process.env.NODE_ENV,
      currentTime: new Date().toISOString(),
      headers: req.headers,
      url: req.url,
      path: req.path,
      originalUrl: req.originalUrl
    });
  });

  app.get(["/api/test", "/api/test/"], (req, res) => {
    res.json({ message: "API is working", env: process.env.NODE_ENV });
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
      // Support login via username or email
      const { data: user, error: supabaseError } = await supabase
        .from('users')
        .select('id, username, email, role, name, password')
        .or(`username.ilike."${trimmedUsername}",email.ilike."${trimmedUsername}"`)
        .maybeSingle();

      if (supabaseError) {
        console.error(`[AUTH] Supabase query error:`, supabaseError);
        return res.status(500).json({ error: `Database error: ${supabaseError.message}` });
      }

      if (user) {
        console.log(`[AUTH] User found: "${user.username}" (ID: ${user.id}, Email: ${user.email})`);
        if (user.password === password) {
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

      const { data: newUser, error } = await supabase
        .from('users')
        .insert([{ 
          username: trimmedUsername, 
          email: trimmedEmail, 
          password, 
          role, 
          name: name?.trim() 
        }])
        .select()
        .single();

      if (error) throw error;

      const userId = newUser.id;
      console.log(`[AUTH] Register success: "${trimmedUsername}" (ID: ${userId}).`);

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

  app.post(["/api/forgot-password", "/api/forgot-password/"], (req, res) => {
    const { email } = req.body;
    res.json({ message: "Confirmation code sent to " + email, code: "123456" });
  });

  app.post(["/api/reset-password", "/api/reset-password/"], async (req, res) => {
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
  app.get(["/api/users", "/api/users/"], async (req, res) => {
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

  app.put(["/api/users/:id", "/api/users/:id/"], async (req, res) => {
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

  app.delete(["/api/users/:id", "/api/users/:id/"], async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { id } = req.params;
    try {
      // Don't allow deleting the last admin or yourself if we had auth context here
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Products
  app.get(["/api/products", "/api/products/"], async (req, res) => {
    if (!supabase) return res.json([]);
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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post(["/api/products", "/api/products/"], async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
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
        const imagesToInsert = images.map(img => ({ product_id: productId, image_data: img }));
        await supabase.from('product_images').insert(imagesToInsert);
      }

      res.json({ id: productId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put(["/api/products/:id", "/api/products/:id/"], async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { id } = req.params;
    const { name, category_id, description, cost_price, selling_price, supplier_name, variants, images } = req.body;
    
    try {
      const { error: productError } = await supabase
        .from('products')
        .update({ name, category_id, description, cost_price, selling_price, supplier_name })
        .eq('id', id);

      if (productError) throw productError;

      // Update variants: be smart about it to avoid foreign key violations
      const { data: existingVariants, error: fetchError } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', id);
      
      if (fetchError) throw fetchError;

      if (variants && Array.isArray(variants)) {
        // 1. Identify variants to delete (those in DB but not in new list)
        const variantsToDelete = existingVariants.filter((ev: any) => 
          !variants.some(v => v.size === ev.size && v.color === ev.color)
        );

        for (const ev of variantsToDelete) {
          const { error: delErr } = await supabase.from('product_variants').delete().eq('id', ev.id);
          if (delErr) {
            console.warn(`[PRODUCTS] Could not delete variant ${ev.id}, likely has sales history:`, delErr);
            // We don't throw here because we want to allow the rest of the update to proceed
          }
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
              .eq('id', existing.id);
            if (updErr) throw updErr;
          } else {
            // Insert new variant
            const { error: insErr } = await supabase.from('product_variants').insert([{
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
        const imagesToInsert = images.map(img => ({ product_id: id, image_data: img }));
        await supabase.from('product_images').insert(imagesToInsert);
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete(["/api/products/:id", "/api/products/:id/"], async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { id } = req.params;
    console.log(`[PRODUCTS] Attempting to delete product: ${id}`);
    try {
      // 1. Get all variant IDs for this product
      const { data: variants, error: vError } = await supabase.from('product_variants').select('id').eq('product_id', id);
      if (vError) throw vError;

      if (variants && variants.length > 0) {
        const variantIds = variants.map(v => v.id);
        console.log(`[PRODUCTS] Checking sales for variants: ${variantIds.join(', ')}`);
        
        // 2. Check if any of these variants are in sale_items
        const { count, error: sError } = await supabase
          .from('sale_items')
          .select('*', { count: 'exact', head: true })
          .in('variant_id', variantIds);
        
        if (sError) throw sError;
        
        if (count && count > 0) {
          console.log(`[PRODUCTS] Cannot delete product ${id}: found ${count} sale items`);
          return res.status(400).json({ 
            error: "Cannot delete product with sales history. This product has been sold and its records must be preserved for accounting. Try marking it as inactive or out of stock instead." 
          });
        }
      }

      // 3. Delete variants and images first (cascade-like)
      console.log(`[PRODUCTS] Deleting variants and images for product ${id}`);
      await supabase.from('product_variants').delete().eq('product_id', id);
      await supabase.from('product_images').delete().eq('product_id', id);
      
      // 4. Delete product
      const { error: pError } = await supabase.from('products').delete().eq('id', id);
      if (pError) throw pError;
      
      console.log(`[PRODUCTS] Successfully deleted product ${id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error(`[PRODUCTS] Delete failed for product ${id}:`, error);
      res.status(500).json({ error: error.message || "Failed to delete product" });
    }
  });

  // Categories
  app.get(["/api/categories", "/api/categories/"], async (req, res) => {
    if (!supabase) return res.json([]);
    const { data, error } = await supabase.from('categories').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post(["/api/categories", "/api/categories/"], async (req, res) => {
    const { name } = req.body;
    try {
      const { data, error } = await supabase.from('categories').insert([{ name }]).select().single();
      if (error) throw error;
      res.json(data);
    } catch (e) {
      res.status(400).json({ error: "Category already exists" });
    }
  });

  app.put(["/api/categories/:id", "/api/categories/:id/"], async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { id } = req.params;
    const { name } = req.body;
    const { data, error } = await supabase.from('categories').update({ name }).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete(["/api/categories/:id", "/api/categories/:id/"], async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { id } = req.params;
    try {
      // Check if category is in use
      const { count } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('category_id', id);
      if (count && count > 0) {
        return res.status(400).json({ error: "Category is in use by products" });
      }
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get(["/api/settings", "/api/settings/"], async (req, res) => {
    if (!supabase) return res.json({ business_name: 'StockFlow Pro', currency: 'NGN', vat_enabled: false, low_stock_threshold: 5 });
    try {
      const { data, error } = await supabase.from('settings').select('*').limit(1).maybeSingle();
      if (error) throw error;
      res.json(data || { business_name: 'StockFlow Pro', currency: 'NGN', vat_enabled: false, low_stock_threshold: 5 });
    } catch (error) {
      res.json({ business_name: 'StockFlow Pro', currency: 'NGN', vat_enabled: false, low_stock_threshold: 5 });
    }
  });

  app.post(["/api/settings", "/api/settings/"], async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { business_name, currency, vat_enabled, low_stock_threshold } = req.body;
    try {
      const { data: existing } = await supabase.from('settings').select('id').limit(1).maybeSingle();
      
      let result;
      if (existing) {
        result = await supabase.from('settings').update({ business_name, currency, vat_enabled, low_stock_threshold }).eq('id', existing.id).select().single();
      } else {
        result = await supabase.from('settings').insert([{ business_name, currency, vat_enabled, low_stock_threshold }]).select().single();
      }
      
      if (result.error) throw result.error;
      res.json(result.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sales
  app.post(["/api/sales", "/api/sales/"], async (req, res) => {
    const { items, payment_method, staff_id } = req.body;
    console.log(`[SALES] New sale request:`, JSON.stringify({ itemsCount: items?.length, payment_method, staff_id }));
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items in sale" });
    }

    const invoice_number = "INV-" + Date.now();
    let total_amount = 0;
    let total_profit = 0;
    
    try {
      // Ensure staff_id is a valid number or null
      const validStaffId = (staff_id && !isNaN(Number(staff_id))) ? Number(staff_id) : null;

      // Create the sale record
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([{ 
          invoice_number, 
          total_amount: 0, 
          total_profit: 0, 
          payment_method, 
          staff_id: validStaffId 
        }])
        .select()
        .single();

      if (saleError) {
        console.error(`[SALES] Sale creation error:`, saleError);
        throw new Error(saleError.message);
      }
      const saleId = sale.id;

      for (const item of items) {
        // Get variant and product info
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
        
        // Update stock
        await supabase
          .from('product_variants')
          .update({ quantity: variant.quantity - item.quantity })
          .eq('id', item.variant_id);

        // Record sale item
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
      
      // Update final sale totals
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

  app.get(["/api/sales", "/api/sales/"], async (req, res) => {
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

  app.delete(["/api/sales", "/api/sales/"], async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    try {
      // This is a dangerous operation, usually we'd check for admin role
      // For this app, we'll allow it if requested
      await supabase.from('sale_items').delete().neq('id', 0); // Delete all
      const { error } = await supabase.from('sales').delete().neq('id', 0); // Delete all
      if (error) throw error;
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete(["/api/sales/:id", "/api/sales/:id/"], async (req, res) => {
    if (!supabase) return res.status(503).json({ error: "Database not available" });
    const { id } = req.params;

    try {
      // 1. Get sale items to revert stock
      const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', id);

      if (itemsError) throw itemsError;

      // 2. Revert stock for each item
      for (const item of items) {
        const { data: variant } = await supabase
          .from('product_variants')
          .select('quantity')
          .eq('id', item.variant_id)
          .single();

        if (variant) {
          await supabase
            .from('product_variants')
            .update({ quantity: variant.quantity + item.quantity })
            .eq('id', item.variant_id);
        }
      }

      // 3. Delete sale items (Supabase might handle this with cascade, but let's be safe)
      await supabase.from('sale_items').delete().eq('sale_id', id);

      // 4. Delete the sale record
      const { error: saleError } = await supabase.from('sales').delete().eq('id', id);
      if (saleError) throw saleError;

      res.json({ success: true });
    } catch (e: any) {
      console.error(`[SALES] Delete failed:`, e);
      res.status(500).json({ error: e.message });
    }
  });

  // Notifications
  const checkLowStock = async (userId: string) => {
    if (!supabase) return;
    
    try {
      // 1. Get all variants and their product names
      const { data: variants, error: variantsError } = await supabase
        .from('product_variants')
        .select('*, products(name)');

      if (variantsError || !variants) return;

      // 2. Filter for low stock
      const lowStockVariants = variants.filter(v => 
        v.quantity !== null && 
        v.quantity < (v.low_stock_threshold || 5)
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

  app.get(["/api/notifications/:userId", "/api/notifications/:userId/"], async (req, res) => {
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

  app.post(["/api/notifications/:id/read", "/api/notifications/:id/read/"], async (req, res) => {
    if (!supabase) return res.json({ success: true });
    const { id } = req.params;
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Analytics
  app.get(["/api/analytics/summary", "/api/analytics/summary/"], async (req, res) => {
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

  app.get(["/api/analytics/trends", "/api/analytics/trends/"], async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('created_at, total_amount, total_profit')
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

  // API 404 handler
  app.all("/api/*", (req, res) => {
    console.log(`[API 404] ${req.method} ${req.url} - No route matched`);
    res.status(404).json({ 
      error: `API route not found: ${req.method} ${req.path}`,
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
