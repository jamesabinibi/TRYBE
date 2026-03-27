import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

async function test() {
  try {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    const { data, error } = await supabase.from('users').select('*').limit(1);
    if (error) {
      console.error("Supabase query error:", error);
    } else {
      console.log("Supabase query successful, found", data?.length, "users");
    }
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}
test();
