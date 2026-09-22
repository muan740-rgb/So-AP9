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
│   ├── page.js                        (หน้าแรก — ทดสอบ deploy)
│   ├── generate-qr/page.js            (พนักงานเปิดโต๊ะ + generate QR แล้ว)
│   ├── order/[tableNumber]/page.js    (ลูกค้าสั่งอาหาร + เรียกเก็บเงิน แล้ว)
│   └── kitchen/page.js                (placeholder รอพัฒนา)
├── lib/
│   └── supabaseClient.js
├── .env.local.example
├── .gitignore
├── next.config.js
├── package.json
└── README.md
```

## ราคาต่อหัว (hardcode ไว้ใน `app/order/[tableNumber]/page.js`)
- ผู้ใหญ่ (`adult_count`): **289 บาท/คน**
- เด็ก (`child_count`): **145 บาท/คน**
- ยอดรวมคำนวณจาก `adult_count × 289 + child_count × 145` ตอนกด "เรียกเก็บเงิน"
- ถ้าราคาเปลี่ยนในอนาคต ให้แก้ค่าคงที่ `PRICE_ADULT` / `PRICE_CHILD` ที่ต้นไฟล์นั้น

## กฎธุรกิจสำคัญที่ implement ไว้แล้วใน `/order/[tableNumber]`
- เข้าหน้านี้ต้องเจอ `sessions` ที่ `table_number` ตรงกันและ `status = 'open'` เท่านั้น ไม่งั้นแสดง "โต๊ะนี้ยังไม่เปิดใช้งาน"
- ตะกร้าจำกัดสูงสุด **10 รายการ (แถว) ต่อการส่งออเดอร์ 1 ครั้ง** — ถ้าเพิ่มเมนูเดิมที่มีอยู่แล้วในตะกร้า จะรวมจำนวนเข้าไปในแถวเดิม ไม่กินโควตา 10 รายการ
- กด "ส่งออเดอร์" = insert 1 แถวใหม่ใน `orders` (ไม่ update แถวเดิม) แต่ละครั้งที่ส่งจะเป็นออเดอร์ใหม่เสมอ
- กด "เรียกเก็บเงิน" → ยืนยัน → `update sessions set status='closed'` แบบเช็คซ้ำ `.eq('status','open')` ก่อน เพื่อกันปิดซ้ำ — ถ้า race แล้วมีคนปิดไปก่อน จะแจ้ง error ให้แจ้งพนักงานแทน

## ขั้นตอนถัดไปที่วางแผนไว้
- พัฒนาหน้า `/kitchen` ให้ subscribe realtime ออเดอร์ใหม่จาก Supabase (ตาราง `orders`, filter ตาม `status`)
- พิจารณาเพิ่มหน้า "ประวัติออเดอร์ของโต๊ะ" ให้ลูกค้าดูรายการที่สั่งไปแล้วทั้งหมดใน session
- พิจารณาย้ายราคาต่อหัว (`PRICE_ADULT` / `PRICE_CHILD`) ไปเก็บในฐานข้อมูลแทน hardcode ถ้าต้องปรับราคาบ่อย
