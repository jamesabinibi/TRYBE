import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();
console.log("SUPABASE_URL:", !!process.env.SUPABASE_URL);
console.log("SUPABASE_ANON_KEY:", !!process.env.SUPABASE_ANON_KEY);
try {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
  console.log("Client created successfully");
} catch (e: any) {
  console.error("Error creating client:", e.message);
}
