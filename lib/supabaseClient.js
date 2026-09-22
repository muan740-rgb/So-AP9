import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // ไม่ throw error ตอน build เพื่อไม่ให้ next build ล้มถ้ายังไม่ตั้งค่า env
  // แต่จะเห็น warning นี้ใน log เพื่อเตือนว่ายังไม่ได้ตั้งค่า
  console.warn(
    "[supabaseClient] Missing NEXT_PUBLIC_SUPABASE_URL หรือ NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "ตรวจสอบว่าได้ตั้งค่าใน .env.local (dev) หรือ Environment Variables บน Vercel (prod) แล้ว"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
