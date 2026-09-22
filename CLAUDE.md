# CLAUDE.md — บันทึกสำคัญสำหรับพัฒนาโปรเจกต์นี้ต่อ

โปรเจกต์: **สุกี้ผีน้อย** — ระบบสั่งอาหารร้านบุฟเฟต์
Stack: Next.js (App Router, JavaScript ล้วน ไม่ใช้ TypeScript) + Supabase, deploy บน Vercel

---

## ⚠️ กฎสำคัญ: Dynamic Route params เป็น Promise

โปรเจกต์นี้ใช้ **Next.js เวอร์ชันล่าสุด** (Next.js 15+) ซึ่งเปลี่ยนพฤติกรรมของ
Dynamic Route Segments: **`params` (และ `searchParams`) ที่ส่งเข้า Page/Layout
component ไม่ใช่ object ธรรมดาอีกต่อไป แต่เป็น `Promise`**

ดังนั้นทุกครั้งที่สร้างหน้าที่มี dynamic segment เช่น `/order/[sessionId]`
หรือ `/table/[tableNumber]` **ต้อง unwrap ด้วย `use()` จาก React เสมอ**
ห้าม destructure `params` ตรง ๆ แบบเก่า

### ตัวอย่างที่ถูกต้อง (Client Component)

```jsx
"use client";
import { use } from "react";

export default function OrderPage({ params }) {
  const { sessionId } = use(params); // ✅ unwrap ด้วย use()
  // ...
}
```

### ตัวอย่างที่ถูกต้อง (Server Component / async)

```jsx
export default async function OrderPage({ params }) {
  const { sessionId } = await params; // ✅ await ได้เช่นกันเพราะเป็น async component
  // ...
}
```

### ❌ ตัวอย่างที่ผิด (จะพังหรือ warning บน Next.js เวอร์ชันนี้)

```jsx
export default function OrderPage({ params }) {
  const { sessionId } = params; // ❌ params เป็น Promise ไม่ใช่ object แล้ว
}
```

กฎนี้ใช้กับทุกหน้าที่มี dynamic segment ในวงเล็บเหลี่ยม `[...]` รวมถึง
`searchParams` ในหน้าที่ต้องอ่าน query string ด้วย

---

## โครงสร้างฐานข้อมูล Supabase (มีอยู่แล้ว — ห้ามสร้างซ้ำ)

ใช้ตารางเดิมที่มีอยู่แล้วใน Supabase project ตามนี้เสมอเวลาต่อยอดโค้ด:

### `sessions`
| column       | type      | หมายเหตุ                          |
|--------------|-----------|-----------------------------------|
| id           | uuid/int  | primary key                       |
| table_number | text/int  | เลขโต๊ะ                            |
| adult_count  | int       | จำนวนผู้ใหญ่                       |
| child_count  | int       | จำนวนเด็ก                          |
| status       | text      | สถานะ session (เช่น active/closed)|
| created_at   | timestamp | เวลาสร้าง                         |

### `menu_categories`
| column     | type | หมายเหตุ           |
|------------|------|--------------------|
| id         | uuid/int | primary key    |
| name       | text | ชื่อหมวดหมู่เมนู    |
| sort_order | int  | ลำดับการแสดงผล      |

### `menu_items`
| column      | type | หมายเหตุ                              |
|-------------|------|---------------------------------------|
| id          | uuid/int | primary key                       |
| category_id | uuid/int | FK → menu_categories.id           |
| name        | text | ชื่อเมนู                               |

### `orders`
| column       | type      | หมายเหตุ                                 |
|--------------|-----------|-------------------------------------------|
| id           | uuid/int  | primary key                                |
| session_id   | uuid/int  | FK → sessions.id                           |
| table_number | text/int  | เลขโต๊ะ (denormalized ไว้เพื่อ query ง่าย)  |
| items        | jsonb     | รายการอาหารที่สั่ง (array ของ item + qty)  |
| status       | text      | สถานะออเดอร์ (เช่น pending/cooking/served) |
| created_at   | timestamp | เวลาสั่ง                                   |

> อ้างอิงตารางเหล่านี้ผ่าน `supabase` client ที่ import จาก `lib/supabaseClient.js`
> เท่านั้น อย่าสร้าง client ซ้ำที่อื่น

---

## โครงสร้างโปรเจกต์ปัจจุบัน

```
suki-phi-noi/
├── app/
│   ├── layout.js
│   ├── page.js              (หน้าแรก — ทดสอบ deploy)
│   ├── generate-qr/page.js  (placeholder รอพัฒนา)
│   └── kitchen/page.js      (placeholder รอพัฒนา)
├── lib/
│   └── supabaseClient.js
├── .env.local.example
├── .gitignore
├── next.config.js
├── package.json
└── README.md
```

## ขั้นตอนถัดไปที่วางแผนไว้
- สร้างหน้าสั่งอาหารแบบ dynamic route (เช่น `/order/[sessionId]`) — **ต้องใช้ `use()` unwrap params ตามกฎด้านบน**
- ต่อ query จริงกับตาราง `menu_categories` / `menu_items` เพื่อแสดงเมนู
- สร้างฟอร์มสั่งอาหารที่ insert เข้า `orders`
- พัฒนาหน้า `/generate-qr` ให้ generate QR code จริงตาม `table_number`
- พัฒนาหน้า `/kitchen` ให้ subscribe realtime ออเดอร์ใหม่จาก Supabase
