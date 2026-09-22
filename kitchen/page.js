"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const COLORS = {
  bg: "#111827",
  cardReceived: "#ffffff",
  cardCooking: "#f59e0b",
  border: "#374151",
  text: "#111827",
  textOnDark: "#f9fafb",
  muted: "#6b7280",
  startBtn: "#2563eb",
  startBtnDark: "#1d4ed8",
  serveBtn: "#16a34a",
  serveBtnDark: "#15803d",
  danger: "#dc2626",
};

function formatTime(createdAt) {
  const d = new Date(createdAt);
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function parseItems(items) {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  try {
    const parsed = JSON.parse(items);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // 1. โหลดออเดอร์ที่ยังไม่เสิร์ฟตอนเปิดหน้าครั้งแรก
  useEffect(() => {
    let isCancelled = false;

    async function loadOrders() {
      setLoading(true);
      setErrorMsg("");

      const { data, error } = await supabase
        .from("orders")
        .select("id, session_id, table_number, items, status, created_at")
        .in("status", ["received", "cooking"])
        .order("created_at", { ascending: true });

      if (isCancelled) return;

      if (error) {
        setErrorMsg("โหลดออเดอร์ไม่สำเร็จ: " + error.message);
        setLoading(false);
        return;
      }

      setOrders(data || []);
      setLoading(false);
    }

    loadOrders();

    return () => {
      isCancelled = true;
    };
  }, []);

  // helper: เพิ่ม/แก้ไข/ลบ ออเดอร์ใน state ให้ตรงกับ realtime event
  const upsertOrder = useCallback((row) => {
    setOrders((prev) => {
      const exists = prev.some((o) => o.id === row.id);

      // เสิร์ฟแล้ว -> เอาออกจากจอทันที
      if (row.status === "served" || row.status === "cancelled") {
        return prev.filter((o) => o.id !== row.id);
      }

      // ไม่ใช่ received/cooking (เผื่อกรณีอื่น) -> ไม่แสดงบนจอครัว
      if (row.status !== "received" && row.status !== "cooking") {
        return prev.filter((o) => o.id !== row.id);
      }

      if (exists) {
        return prev.map((o) => (o.id === row.id ? { ...o, ...row } : o));
      }

      // ออเดอร์ใหม่ -> ต่อไว้ท้ายสุด (ใหม่ล่าสุดอยู่หลังสุดตามลำดับเก่า -> ใหม่)
      return [...prev, row];
    });
  }, []);

  // 2. Supabase Realtime subscribe ฟัง INSERT และ UPDATE ของตาราง orders
  useEffect(() => {
    const channel = supabase
      .channel("kitchen-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => upsertOrder(payload.new)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => upsertOrder(payload.new)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [upsertOrder]);

  async function handleStartCooking(order) {
    // optimistic update
    setOrders((prev) =>
      prev.map((o) => (o.id === order.id ? { ...o, status: "cooking" } : o))
    );

    const { error } = await supabase
      .from("orders")
      .update({ status: "cooking" })
      .eq("id", order.id);

    if (error) {
      // rollback ถ้าไม่สำเร็จ
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: order.status } : o))
      );
      alert("เปลี่ยนสถานะไม่สำเร็จ: " + error.message);
    }
  }

  async function handleServed(order) {
    // เอาการ์ดออกจากจอทันที (optimistic)
    setOrders((prev) => prev.filter((o) => o.id !== order.id));

    const { error } = await supabase
      .from("orders")
      .update({ status: "served" })
      .eq("id", order.id);

    if (error) {
      // ถ้าไม่สำเร็จ ใส่การ์ดกลับเข้ามาใหม่
      setOrders((prev) => {
        if (prev.some((o) => o.id === order.id)) return prev;
        return [...prev, order].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );
      });
      alert("เปลี่ยนสถานะไม่สำเร็จ: " + error.message);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.textOnDark,
        fontFamily: "sans-serif",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <h1 style={{ fontSize: "2.2rem", margin: 0 }}>🍲 จอครัว — สุกี้ผีน้อย</h1>
        <span style={{ fontSize: "1.3rem", color: "#9ca3af" }}>
          {orders.length} ออเดอร์รอดำเนินการ
        </span>
      </div>

      {loading && (
        <p style={{ fontSize: "1.4rem", color: "#9ca3af" }}>กำลังโหลดออเดอร์...</p>
      )}

      {errorMsg && (
        <p style={{ fontSize: "1.3rem", color: "#fca5a5", fontWeight: "bold" }}>
          {errorMsg}
        </p>
      )}

      {!loading && !errorMsg && orders.length === 0 && (
        <p style={{ fontSize: "1.5rem", color: "#6b7280", textAlign: "center", marginTop: "4rem" }}>
          ยังไม่มีออเดอร์ที่ต้องทำ 🎉
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {orders.map((order) => {
          const isCooking = order.status === "cooking";
          const items = parseItems(order.items);

          return (
            <div
              key={order.id}
              style={{
                background: isCooking ? COLORS.cardCooking : COLORS.cardReceived,
                color: COLORS.text,
                borderRadius: 16,
                padding: "1.25rem",
                border: `4px solid ${isCooking ? "#d97706" : "#2563eb"}`,
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "3rem", fontWeight: "bold", lineHeight: 1 }}>
                  โต๊ะ {order.table_number}
                </span>
                <span style={{ fontSize: "1.2rem", color: COLORS.muted, fontWeight: "bold" }}>
                  {formatTime(order.created_at)}
                </span>
              </div>

              {isCooking && (
                <span
                  style={{
                    alignSelf: "flex-start",
                    background: "#d97706",
                    color: "#fff",
                    borderRadius: 8,
                    padding: "0.2rem 0.7rem",
                    fontSize: "1rem",
                    fontWeight: "bold",
                  }}
                >
                  กำลังทำ
                </span>
              )}

              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.4rem",
                }}
              >
                {items.length === 0 && (
                  <li style={{ fontSize: "1.1rem", color: COLORS.muted }}>
                    (ไม่มีรายการอาหาร)
                  </li>
                )}
                {items.map((it, idx) => (
                  <li
                    key={idx}
                    style={{
                      fontSize: "1.4rem",
                      fontWeight: "bold",
                      display: "flex",
                      justifyContent: "space-between",
                      borderBottom: "1px solid rgba(0,0,0,0.1)",
                      paddingBottom: "0.2rem",
                    }}
                  >
                    <span>{it.name}</span>
                    <span>× {it.quantity}</span>
                  </li>
                ))}
              </ul>

              <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.5rem" }}>
                {!isCooking && (
                  <button
                    onClick={() => handleStartCooking(order)}
                    style={{
                      flex: 1,
                      background: COLORS.startBtn,
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      padding: "1rem",
                      fontSize: "1.25rem",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    เริ่มทำ
                  </button>
                )}
                <button
                  onClick={() => handleServed(order)}
                  style={{
                    flex: 1,
                    background: COLORS.serveBtn,
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    padding: "1rem",
                    fontSize: "1.25rem",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  จัดเสิร์ฟแล้ว
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
