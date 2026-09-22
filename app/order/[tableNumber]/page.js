"use client";

import { use, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

const PRICE_ADULT = 289;
const PRICE_CHILD = 145;
const MAX_CART_ITEMS = 10;

const COLORS = {
  bg: "#f7f7f8",
  card: "#ffffff",
  border: "#e5e5e5",
  text: "#1a1a1a",
  muted: "#6b6b6b",
  primary: "#dc2626", // แดง สุกี้
  primaryDark: "#b91c1c",
  accent: "#f59e0b",
  success: "#16a34a",
  successDark: "#15803d",
};

export default function OrderPage({ params }) {
  // ⚠️ Next.js เวอร์ชันนี้ params เป็น Promise ต้อง unwrap ด้วย use() เสมอ
  const { tableNumber } = use(params);
  const tableNum = parseInt(tableNumber, 10);

  // สถานะการโหลด session
  const [sessionLoading, setSessionLoading] = useState(true);
  const [session, setSession] = useState(null); // { id, adult_count, child_count, ... }
  const [sessionNotFound, setSessionNotFound] = useState(false);
  const [sessionErrorMsg, setSessionErrorMsg] = useState("");

  // เมนู
  const [menuLoading, setMenuLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [itemsByCategory, setItemsByCategory] = useState({});
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [menuErrorMsg, setMenuErrorMsg] = useState("");

  // จำนวนที่เลือกไว้ต่อเมนู (ก่อนกด +)
  const [selectedQty, setSelectedQty] = useState({});

  // ตะกร้า: array ของ { id, name, quantity }
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartErrorMsg, setCartErrorMsg] = useState("");

  // ส่งออเดอร์
  const [submitting, setSubmitting] = useState(false);
  const [orderSentMsg, setOrderSentMsg] = useState("");

  // เรียกเก็บเงิน
  const [billingOpen, setBillingOpen] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingErrorMsg, setBillingErrorMsg] = useState("");
  const [paid, setPaid] = useState(false);

  // 1. เช็ค session ที่เปิดอยู่สำหรับโต๊ะนี้
  useEffect(() => {
    let isCancelled = false;

    async function loadSession() {
      setSessionLoading(true);
      setSessionNotFound(false);
      setSessionErrorMsg("");

      const { data, error } = await supabase
        .from("sessions")
        .select("id, table_number, adult_count, child_count, status, created_at")
        .eq("table_number", tableNum)
        .eq("status", "open")
        .limit(1);

      if (isCancelled) return;

      if (error) {
        setSessionErrorMsg("เกิดข้อผิดพลาดในการโหลดข้อมูลโต๊ะ: " + error.message);
        setSessionLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setSessionNotFound(true);
        setSessionLoading(false);
        return;
      }

      setSession(data[0]);
      setSessionLoading(false);
    }

    if (!isNaN(tableNum)) {
      loadSession();
    } else {
      setSessionNotFound(true);
      setSessionLoading(false);
    }

    return () => {
      isCancelled = true;
    };
  }, [tableNum]);

  // 2. โหลดเมนู (เฉพาะเมื่อเจอ session ที่เปิดอยู่)
  useEffect(() => {
    if (!session) return;
    let isCancelled = false;

    async function loadMenu() {
      setMenuLoading(true);
      setMenuErrorMsg("");

      const { data: categoriesData, error: categoriesError } = await supabase
        .from("menu_categories")
        .select("id, name, sort_order")
        .order("sort_order", { ascending: true });

      if (isCancelled) return;

      if (categoriesError) {
        setMenuErrorMsg("โหลดหมวดหมู่เมนูไม่สำเร็จ: " + categoriesError.message);
        setMenuLoading(false);
        return;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from("menu_items")
        .select("id, category_id, name");

      if (isCancelled) return;

      if (itemsError) {
        setMenuErrorMsg("โหลดรายการเมนูไม่สำเร็จ: " + itemsError.message);
        setMenuLoading(false);
        return;
      }

      const grouped = {};
      (itemsData || []).forEach((item) => {
        if (!grouped[item.category_id]) grouped[item.category_id] = [];
        grouped[item.category_id].push(item);
      });

      setCategories(categoriesData || []);
      setItemsByCategory(grouped);
      if (categoriesData && categoriesData.length > 0) {
        setActiveCategoryId(categoriesData[0].id);
      }
      setMenuLoading(false);
    }

    loadMenu();

    return () => {
      isCancelled = true;
    };
  }, [session]);

  const activeItems = useMemo(() => {
    if (!activeCategoryId) return [];
    return itemsByCategory[activeCategoryId] || [];
  }, [activeCategoryId, itemsByCategory]);

  const cartTotalQuantity = useMemo(
    () => cart.reduce((sum, row) => sum + row.quantity, 0),
    [cart]
  );

  function getSelectedQty(itemId) {
    return selectedQty[itemId] || 1;
  }

  function handleChangeSelectedQty(itemId, qty) {
    setSelectedQty((prev) => ({ ...prev, [itemId]: qty }));
  }

  function handleAddToCart(item) {
    setCartErrorMsg("");
    const qty = getSelectedQty(item.id);

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((row) => row.id === item.id);
      if (existingIndex >= 0) {
        // มีอยู่แล้ว -> รวมจำนวนเข้าไป ไม่เพิ่มจำนวน "รายการ"
        const updated = [...prevCart];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + qty,
        };
        return updated;
      }

      // เป็นรายการใหม่ -> เช็คว่าเกิน 10 รายการหรือยัง
      if (prevCart.length >= MAX_CART_ITEMS) {
        setCartErrorMsg(`ตะกร้าเต็มแล้ว (สูงสุด ${MAX_CART_ITEMS} รายการต่อการส่ง 1 ครั้ง)`);
        return prevCart;
      }

      return [...prevCart, { id: item.id, name: item.name, quantity: qty }];
    });
  }

  function handleRemoveFromCart(itemId) {
    setCart((prev) => prev.filter((row) => row.id !== itemId));
    setCartErrorMsg("");
  }

  async function handleSubmitOrder() {
    if (!session || cart.length === 0) return;
    setSubmitting(true);
    setCartErrorMsg("");

    try {
      const orderItems = cart.map((row) => ({
        name: row.name,
        quantity: row.quantity,
      }));

      const { error } = await supabase.from("orders").insert({
        session_id: session.id,
        table_number: tableNum,
        items: orderItems,
        status: "received",
      });

      if (error) {
        setCartErrorMsg("ส่งออเดอร์ไม่สำเร็จ: " + error.message);
        setSubmitting(false);
        return;
      }

      setCart([]);
      setCartOpen(false);
      setOrderSentMsg("ส่งออเดอร์แล้ว ✓ ทีมงานได้รับออเดอร์ของคุณเรียบร้อย");
      setTimeout(() => setOrderSentMsg(""), 4000);
    } catch (err) {
      setCartErrorMsg("เกิดข้อผิดพลาดที่ไม่คาดคิด: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const billTotal = session
    ? session.adult_count * PRICE_ADULT + session.child_count * PRICE_CHILD
    : 0;

  async function handleConfirmBilling() {
    if (!session) return;
    setBillingLoading(true);
    setBillingErrorMsg("");

    try {
      const { data, error } = await supabase
        .from("sessions")
        .update({ status: "closed" })
        .eq("id", session.id)
        .eq("status", "open")
        .select();

      if (error) {
        setBillingErrorMsg("ปิดโต๊ะไม่สำเร็จ: " + error.message);
        setBillingLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setBillingErrorMsg("โต๊ะนี้ถูกปิดไปแล้ว กรุณาแจ้งพนักงาน");
        setBillingLoading(false);
        return;
      }

      setBillingOpen(false);
      setPaid(true);
    } catch (err) {
      setBillingErrorMsg("เกิดข้อผิดพลาดที่ไม่คาดคิด: " + err.message);
    } finally {
      setBillingLoading(false);
    }
  }

  // ---------- หน้าจอ: กำลังโหลด ----------
  if (sessionLoading) {
    return (
      <FullScreenMessage>
        <p style={{ fontSize: "1.3rem", color: COLORS.muted }}>กำลังโหลดข้อมูลโต๊ะ...</p>
      </FullScreenMessage>
    );
  }

  // ---------- หน้าจอ: เกิดข้อผิดพลาดตอนโหลด session ----------
  if (sessionErrorMsg) {
    return (
      <FullScreenMessage>
        <p style={{ fontSize: "1.3rem", color: COLORS.primary, fontWeight: "bold" }}>
          เกิดข้อผิดพลาด
        </p>
        <p style={{ color: COLORS.muted }}>{sessionErrorMsg}</p>
      </FullScreenMessage>
    );
  }

  // ---------- หน้าจอ: โต๊ะยังไม่เปิดใช้งาน ----------
  if (sessionNotFound) {
    return (
      <FullScreenMessage>
        <p style={{ fontSize: "1.8rem", fontWeight: "bold", color: COLORS.text }}>
          โต๊ะนี้ยังไม่เปิดใช้งาน
        </p>
        <p style={{ fontSize: "1.2rem", color: COLORS.muted, marginTop: "0.5rem" }}>
          กรุณาแจ้งพนักงาน
        </p>
      </FullScreenMessage>
    );
  }

  // ---------- หน้าจอ: จ่ายเงินแล้ว ปิด session แล้ว ----------
  if (paid) {
    return (
      <FullScreenMessage>
        <p style={{ fontSize: "2rem", fontWeight: "bold", color: COLORS.success }}>
          ขอบคุณที่ใช้บริการ 🙏
        </p>
        <p style={{ fontSize: "1.1rem", color: COLORS.muted, marginTop: "0.5rem" }}>
          สุกี้ผีน้อย · โต๊ะ {tableNum}
        </p>
      </FullScreenMessage>
    );
  }

  // ---------- หน้าจอหลัก: สั่งอาหาร ----------
  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: "sans-serif",
        paddingBottom: cart.length > 0 ? "5.5rem" : "1rem",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: COLORS.primary,
          color: "#fff",
          padding: "0.9rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>สุกี้ผีน้อย</div>
          <div style={{ fontSize: "0.9rem", opacity: 0.9 }}>โต๊ะ {tableNum}</div>
        </div>
        <button
          onClick={() => {
            setBillingErrorMsg("");
            setBillingOpen(true);
          }}
          style={{
            background: "#fff",
            color: COLORS.primary,
            border: "none",
            borderRadius: 999,
            padding: "0.6rem 1rem",
            fontSize: "1rem",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          เรียกเก็บเงิน
        </button>
      </div>

      {/* แจ้งเตือนส่งออเดอร์สำเร็จ */}
      {orderSentMsg && (
        <div
          style={{
            background: COLORS.success,
            color: "#fff",
            padding: "0.85rem 1rem",
            textAlign: "center",
            fontSize: "1.05rem",
            fontWeight: "bold",
          }}
        >
          {orderSentMsg}
        </div>
      )}

      {/* แท็บหมวดหมู่ */}
      {menuLoading ? (
        <p style={{ padding: "1.5rem", color: COLORS.muted, fontSize: "1.1rem" }}>
          กำลังโหลดเมนู...
        </p>
      ) : menuErrorMsg ? (
        <p style={{ padding: "1.5rem", color: COLORS.primary, fontWeight: "bold" }}>
          {menuErrorMsg}
        </p>
      ) : (
        <>
          <div
            style={{
              position: "sticky",
              top: "3.6rem",
              zIndex: 15,
              background: COLORS.bg,
              display: "flex",
              overflowX: "auto",
              gap: "0.5rem",
              padding: "0.75rem 1rem",
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            {categories.map((cat) => {
              const isActive = cat.id === activeCategoryId;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategoryId(cat.id)}
                  style={{
                    flexShrink: 0,
                    padding: "0.6rem 1.1rem",
                    borderRadius: 999,
                    border: isActive ? "none" : `1px solid ${COLORS.border}`,
                    background: isActive ? COLORS.primary : "#fff",
                    color: isActive ? "#fff" : COLORS.text,
                    fontSize: "1rem",
                    fontWeight: "bold",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* รายการเมนูของหมวดที่เลือก */}
          <div
            style={{
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            {activeItems.length === 0 && (
              <p style={{ color: COLORS.muted, textAlign: "center", marginTop: "2rem" }}>
                ไม่มีเมนูในหมวดนี้
              </p>
            )}

            {activeItems.map((item) => (
              <div
                key={item.id}
                style={{
                  background: COLORS.card,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                  padding: "1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                }}
              >
                <span style={{ fontSize: "1.15rem", fontWeight: "bold" }}>{item.name}</span>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <select
                    value={getSelectedQty(item.id)}
                    onChange={(e) =>
                      handleChangeSelectedQty(item.id, parseInt(e.target.value, 10))
                    }
                    style={{
                      fontSize: "1.1rem",
                      padding: "0.5rem",
                      borderRadius: 8,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleAddToCart(item)}
                    style={{
                      background: COLORS.primary,
                      color: "#fff",
                      border: "none",
                      borderRadius: "50%",
                      width: "3rem",
                      height: "3rem",
                      fontSize: "1.5rem",
                      fontWeight: "bold",
                      cursor: "pointer",
                      lineHeight: 1,
                    }}
                    aria-label={`เพิ่ม ${item.name} ลงตะกร้า`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ตะกร้าลอยด้านล่าง */}
      {cart.length > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: COLORS.text,
            color: "#fff",
            border: "none",
            padding: "1rem",
            fontSize: "1.15rem",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            zIndex: 25,
          }}
        >
          <span>
            🛒 ตะกร้า {cart.length} รายการ ({cartTotalQuantity} ชิ้น)
          </span>
          <span>ดูตะกร้า →</span>
        </button>
      )}

      {/* Modal ตะกร้า */}
      {cartOpen && (
        <ModalOverlay onClose={() => setCartOpen(false)}>
          <h2 style={{ marginTop: 0, fontSize: "1.4rem" }}>ตะกร้าของคุณ</h2>

          {cart.length === 0 ? (
            <p style={{ color: COLORS.muted }}>ยังไม่มีรายการในตะกร้า</p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
                marginBottom: "1rem",
                maxHeight: "40vh",
                overflowY: "auto",
              }}
            >
              {cart.map((row) => (
                <div
                  key={row.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: `1px solid ${COLORS.border}`,
                    paddingBottom: "0.5rem",
                  }}
                >
                  <span style={{ fontSize: "1.05rem" }}>
                    {row.name} × {row.quantity}
                  </span>
                  <button
                    onClick={() => handleRemoveFromCart(row.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: COLORS.primary,
                      fontWeight: "bold",
                      cursor: "pointer",
                      fontSize: "0.95rem",
                    }}
                  >
                    ลบ
                  </button>
                </div>
              ))}
            </div>
          )}

          {cartErrorMsg && (
            <p style={{ color: COLORS.primary, fontWeight: "bold", marginBottom: "1rem" }}>
              {cartErrorMsg}
            </p>
          )}

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={() => setCartOpen(false)}
              style={{
                flex: 1,
                background: "#fff",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: "0.9rem",
                fontSize: "1.05rem",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              สั่งต่อ
            </button>
            <button
              onClick={handleSubmitOrder}
              disabled={cart.length === 0 || submitting}
              style={{
                flex: 1,
                background: submitting ? COLORS.successDark : COLORS.success,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "0.9rem",
                fontSize: "1.05rem",
                fontWeight: "bold",
                cursor: cart.length === 0 || submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "กำลังส่ง..." : "ส่งออเดอร์"}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* Modal เรียกเก็บเงิน */}
      {billingOpen && session && (
        <ModalOverlay onClose={() => !billingLoading && setBillingOpen(false)}>
          <h2 style={{ marginTop: 0, fontSize: "1.4rem" }}>ยืนยันเรียกเก็บเงิน</h2>

          <p style={{ fontSize: "1.05rem", marginBottom: "0.25rem" }}>
            ผู้ใหญ่ {session.adult_count} คน × {PRICE_ADULT} บาท
          </p>
          <p style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>
            เด็ก {session.child_count} คน × {PRICE_CHILD} บาท
          </p>
          <p
            style={{
              fontSize: "1.6rem",
              fontWeight: "bold",
              color: COLORS.primary,
              marginBottom: "1.25rem",
            }}
          >
            รวม {billTotal.toLocaleString()} บาท
          </p>

          {billingErrorMsg && (
            <p style={{ color: COLORS.primary, fontWeight: "bold", marginBottom: "1rem" }}>
              {billingErrorMsg}
            </p>
          )}

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={() => setBillingOpen(false)}
              disabled={billingLoading}
              style={{
                flex: 1,
                background: "#fff",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: "0.9rem",
                fontSize: "1.05rem",
                fontWeight: "bold",
                cursor: billingLoading ? "not-allowed" : "pointer",
              }}
            >
              ยกเลิก
            </button>
            <button
              onClick={handleConfirmBilling}
              disabled={billingLoading}
              style={{
                flex: 1,
                background: billingLoading ? COLORS.primaryDark : COLORS.primary,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "0.9rem",
                fontSize: "1.05rem",
                fontWeight: "bold",
                cursor: billingLoading ? "not-allowed" : "pointer",
              }}
            >
              {billingLoading ? "กำลังปิด..." : "ยืนยัน"}
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

function FullScreenMessage({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "2rem",
        fontFamily: "sans-serif",
        background: COLORS.bg,
        color: COLORS.text,
      }}
    >
      {children}
    </div>
  );
}

function ModalOverlay({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.card,
          borderRadius: "16px 16px 0 0",
          padding: "1.5rem",
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
