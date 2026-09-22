# สุกี้ผีน้อย — ระบบสั่งอาหารร้านบุฟเฟต์

โปรเจกต์ Next.js (App Router, JavaScript) สำหรับระบบสั่งอาหารร้านบุฟเฟต์
เชื่อมต่อกับ Supabase และ deploy บน Vercel

> 📌 ดูรายละเอียดเชิงเทคนิคที่สำคัญ (เช่น กฎเรื่อง `params` เป็น Promise ใน
> Next.js เวอร์ชันล่าสุด และโครงสร้างตารางฐานข้อมูล) ได้ที่ [`CLAUDE.md`](./CLAUDE.md)

## เริ่มต้นใช้งาน (Local Development)

1. ติดตั้ง dependency

   ```bash
   npm install
   ```

2. คัดลอกไฟล์ environment variables

   ```bash
   cp .env.local.example .env.local
   ```

   แล้วกรอกค่าจริงจาก Supabase Dashboard → Project Settings → API:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. รัน dev server

   ```bash
   npm run dev
   ```

   เปิด [http://localhost:3000](http://localhost:3000) — ควรเห็นหน้าแรกชื่อร้าน
   "สุกี้ผีน้อย" พร้อมลิงก์ไปหน้า `/generate-qr` และ `/kitchen`

## Deploy บน Vercel

1. Push โค้ดขึ้น GitHub repo
2. Import โปรเจกต์เข้า [Vercel](https://vercel.com/new)
3. ตั้งค่า Environment Variables บน Vercel (Project Settings → Environment Variables)
   ให้ตรงกับ `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy — Vercel จะรัน `npm run build` และ `npm run start` ให้อัตโนมัติ

## โครงสร้างฐานข้อมูล (Supabase)

ตารางทั้งหมดถูกสร้างไว้แล้วใน Supabase project (ไม่ต้องสร้างใหม่):

- `sessions` — ข้อมูล session การนั่งโต๊ะ (table_number, adult_count, child_count, status)
- `menu_categories` — หมวดหมู่เมนู (name, sort_order)
- `menu_items` — รายการเมนูอาหาร (category_id, name)
- `orders` — ออเดอร์ที่สั่ง (session_id, table_number, items เป็น jsonb, status)

รายละเอียด column ทั้งหมดดูได้ที่ [`CLAUDE.md`](./CLAUDE.md)

## หมายเหตุสำคัญสำหรับการพัฒนาต่อ

โปรเจกต์นี้ใช้ Next.js เวอร์ชันล่าสุดซึ่ง `params` ของ Dynamic Route เป็น
**Promise** ต้อง unwrap ด้วย `use()` จาก React เสมอ (ดูตัวอย่างใน `CLAUDE.md`)
จะใช้กฎนี้ตอนสร้างหน้าสั่งอาหารในขั้นตอนถัดไป
