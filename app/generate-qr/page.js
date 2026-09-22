"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// สีหลักที่ใช้ในหน้านี้
const COLORS = {
  bg: "#f7f7f8",
  card: "#ffffff",
  border: "#e2e2e2",
  text: "#1a1a1a",
  muted: "#6b6b6b",
  primary: "#16a34a",
  primaryDark: "#15803d",
  warnBg: "#fff4e5",
  warnBorder: "#f59e0b",
  warnText: "#92400e",
  dangerBg: "#fef2f2",
  dangerBorder: "#ef4444",
  dangerText: "#991b1b",
  dangerBtn: "#dc2626",
  dangerBtnDark: "#b91c1c",
};

function formatElapsedMinutes(createdAt) {
  const createdMs = new Date(createdAt).getTime();
  const diffMs = Date.now() - createdMs;
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  return minutes;
}

export default function GenerateQrPage() {
  // ฟอร์มกรอกข้อมูล
  const [tableNumber, setTableNumber] = useState("");
  const [adultCount, setAdultCount] = useState("");
  const [childCount, setChildCount] = useState("");

  // สถานะการทำงาน
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // session เก่าที่เปิดค้างอยู่ (ถ้ามี)
  const [existingSession, setExistingSession] = useState(null);

  // กล่องยืนยันปิดโต๊ะเดิม
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [closingLoading, setClosingLoading] = useState(false);

  // ผลลัพธ์ QR หลังเปิดโต๊ะสำเร็จ
  const [qrResult, setQrResult] = useState(null);
  const [copied, setCopied] = useState(false);

  function resetForm() {
    setTableNumber("");
    setAdultCount("");
    setChildCount("");
    setFormError("");
    setExistingSession(null);
    setShowConfirmClose(false);
    setConfirmError("");
    setQrResult(null);
    setCopied(false);
  }

  function validateForm() {
    const tableNum = parseInt(tableNumber, 10);
    const adults = parseInt(adultCount, 10);
    const children = parseInt(childCount, 10);

    if (!tableNumber || isNaN(tableNum) || tableNum <= 0) {
      return "กรุณากรอกเลขโต๊ะเป็นตัวเลขที่มากกว่า 0";
    }
    if (adultCount === "" || isNaN(adults) || adults < 0) {
      return "กรุณากรอกจำนวนผู้ใหญ่เป็นตัวเลขที่ไม่ติดลบ";
    }
    if (childCount === "" || isNaN(children) || children < 0) {
      return "กรุณากรอกจำนวนเด็กเป็นตัวเลขที่ไม่ติดลบ";
    }
    return "";
  }

  async function handleOpenTable(e) {
    e.preventDefault();
    setFormError("");
    setExistingSession(null);
    setQrResult(null);

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const tableNum = parseInt(tableNumber, 10);
    const adults = parseInt(adultCount, 10);
    const children = parseInt(childCount, 10);

    setLoading(true);
    try {
      // 1. เช็คก่อนว่าโต๊ะนี้มี session ที่ status = 'open' อยู่แล้วหรือไม่
      const { data: openSessions, error: selectError } = await supabase
        .from("sessions")
        .select("id, table_number, adult_count, child_count, created_at")
        .eq("table_number", tableNum)
        .eq("status", "open")
        .limit(1);

      if (selectError) {
        setFormError("เกิดข้อผิดพลาดในการตรวจสอบโต๊ะ: " + selectError.message);
        setLoading(false);
        return;
      }

      if (openSessions && openSessions.length > 0) {
        // มี session เปิดค้างอยู่ -> แสดงกล่องเตือน ไม่ insert ใหม่
        setExistingSession(openSessions[0]);
        setLoading(false);
        return;
      }

      // 2. ไม่มี session เปิดค้าง -> insert แถวใหม่
      const { data: inserted, error: insertError } = await supabase
        .from("sessions")
        .insert({
          table_number: tableNum,
          adult_count: adults,
          child_count: children,
          status: "open",
        })
        .select()
        .single();

      if (insertError) {
        setFormError("เปิดโต๊ะไม่สำเร็จ: " + insertError.message);
        setLoading(false);
        return;
      }

      const origin = window.location.origin;
      const orderUrl = `${origin}/order/${tableNum}`;

      setQrResult({
        tableNumber: tableNum,
        adultCount: adults,
        childCount: children,
        url: orderUrl,
        sessionId: inserted?.id,
      });
      setCopied(false);
    } catch (err) {
      setFormError("เกิดข้อผิดพลาดที่ไม่คาดคิด: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenConfirmClose() {
    setConfirmError("");
    setShowConfirmClose(true);
  }

  function handleCancelConfirmClose() {
    setShowConfirmClose(false);
    setConfirmError("");
  }

  async function handleConfirmCloseOldSession() {
    if (!existingSession) return;
    setClosingLoading(true);
    setConfirmError("");
    try {
      // update เฉพาะแถวที่ยังเป็น 'open' อยู่จริง กันการกดซ้ำซ้อน
      const { data, error } = await supabase
        .from("sessions")
        .update({ status: "closed" })
        .eq("id", existingSession.id)
        .eq("status", "open")
        .select();

      if (error) {
        setConfirmError("ปิดโต๊ะเดิมไม่สำเร็จ: " + error.message);
        setClosingLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setConfirmError(
          "โต๊ะนี้ถูกปิดไปแล้วโดยคนอื่น กรุณาลองกดเปิดโต๊ะใหม่อีกครั้ง"
        );
        setClosingLoading(false);
        return;
      }

      // ปิดสำเร็จ -> ปิดกล่องยืนยัน + เอากล่องเตือนออก กลับไปที่ฟอร์มเดิม
      setShowConfirmClose(false);
      setExistingSession(null);
      setConfirmError("");
    } catch (err) {
      setConfirmError("เกิดข้อผิดพลาดที่ไม่คาดคิด: " + err.message);
    } finally {
      setClosingLoading(false);
    }
  }

  async function handleCopyLink() {
    if (!qrResult) return;
    try {
      await navigator.clipboard.writeText(qrResult.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setFormError("คัดลอกลิงก์ไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง");
    }
  }

  const elapsedMinutes = existingSession
    ? formatElapsedMinutes(existingSession.created_at)
    : null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        fontFamily: "sans-serif",
        color: COLORS.text,
        padding: "1.5rem",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480 }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>
          เปิดโต๊ะ — สุกี้ผีน้อย
        </h1>
        <p style={{ color: COLORS.muted, marginTop: 0, marginBottom: "1.5rem" }}>
          กรอกข้อมูลโต๊ะแล้วกด &quot;เปิดโต๊ะ&quot; เพื่อสร้าง QR ให้ลูกค้าสั่งอาหาร
        </p>

        {/* กล่องเตือน: โต๊ะนี้มี session เปิดค้างอยู่ */}
        {existingSession && !qrResult && (
          <div
            style={{
              background: COLORS.warnBg,
              border: `2px solid ${COLORS.warnBorder}`,
              borderRadius: 12,
              padding: "1.25rem",
              marginBottom: "1.5rem",
            }}
          >
            <p
              style={{
                margin: 0,
                marginBottom: "0.75rem",
                fontSize: "1.15rem",
                fontWeight: "bold",
                color: COLORS.warnText,
              }}
            >
              ⚠️ โต๊ะนี้มีลูกค้าอยู่ระหว่างทานอาหาร กรุณาปิดออเดอร์เดิมก่อน
            </p>
            <p style={{ margin: 0, marginBottom: "1rem", color: COLORS.warnText }}>
              โต๊ะ {existingSession.table_number} · ผู้ใหญ่{" "}
              {existingSession.adult_count} · เด็ก {existingSession.child_count}{" "}
              · เปิดมาแล้ว {formatElapsedMinutes(existingSession.created_at)} นาที
            </p>
            <button
              onClick={handleOpenConfirmClose}
              style={{
                background: COLORS.dangerBtn,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "0.75rem 1.25rem",
                fontSize: "1rem",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              ปิดออเดอร์เดิม
            </button>
          </div>
        )}

        {/* ฟอร์มกรอกข้อมูล (แสดงเมื่อยังไม่มี QR result) */}
        {!qrResult && (
          <form
            onSubmit={handleOpenTable}
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <span style={{ fontSize: "1.1rem", fontWeight: "bold" }}>เลขโต๊ะ</span>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="เช่น 7"
                style={inputStyle}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <span style={{ fontSize: "1.1rem", fontWeight: "bold" }}>จำนวนผู้ใหญ่</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={adultCount}
                onChange={(e) => setAdultCount(e.target.value)}
                placeholder="เช่น 2"
                style={inputStyle}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <span style={{ fontSize: "1.1rem", fontWeight: "bold" }}>จำนวนเด็ก</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={childCount}
                onChange={(e) => setChildCount(e.target.value)}
                placeholder="เช่น 1"
                style={inputStyle}
              />
            </label>

            {formError && (
              <p style={{ color: COLORS.dangerText, margin: 0, fontWeight: "bold" }}>
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? COLORS.primaryDark : COLORS.primary,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "1rem",
                fontSize: "1.2rem",
                fontWeight: "bold",
                cursor: loading ? "not-allowed" : "pointer",
                marginTop: "0.5rem",
              }}
            >
              {loading ? "กำลังเปิดโต๊ะ..." : "เปิดโต๊ะ"}
            </button>
          </form>
        )}

        {/* ผลลัพธ์ QR หลังเปิดโต๊ะสำเร็จ */}
        {qrResult && (
          <div
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1rem",
              textAlign: "center",
            }}
          >
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                qrResult.url
              )}`}
              alt={`QR code สำหรับโต๊ะ ${qrResult.tableNumber}`}
              width={300}
              height={300}
              style={{ maxWidth: "100%", height: "auto" }}
            />

            <p style={{ fontSize: "1.2rem", fontWeight: "bold", margin: 0 }}>
              โต๊ะ {qrResult.tableNumber} · ผู้ใหญ่ {qrResult.adultCount} · เด็ก{" "}
              {qrResult.childCount}
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  wordBreak: "break-all",
                  color: COLORS.muted,
                  fontSize: "0.95rem",
                }}
              >
                {qrResult.url}
              </span>
              <button
                onClick={handleCopyLink}
                style={{
                  background: "#eee",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 6,
                  padding: "0.35rem 0.7rem",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                {copied ? "คัดลอกแล้ว ✓" : "คัดลอกลิงก์"}
              </button>
            </div>

            <button
              onClick={resetForm}
              style={{
                background: COLORS.primary,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "0.9rem 1.5rem",
                fontSize: "1.1rem",
                fontWeight: "bold",
                cursor: "pointer",
                marginTop: "0.5rem",
              }}
            >
              เปิดโต๊ะใหม่
            </button>
          </div>
        )}
      </div>

      {/* กล่องยืนยันปิดโต๊ะเดิม (modal overlay) */}
      {showConfirmClose && existingSession && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: COLORS.dangerBg,
              border: `2px solid ${COLORS.dangerBorder}`,
              borderRadius: 12,
              padding: "1.5rem",
              maxWidth: 420,
              width: "100%",
            }}
          >
            <h2
              style={{
                margin: 0,
                marginBottom: "1rem",
                fontSize: "1.3rem",
                color: COLORS.dangerText,
              }}
            >
              ยืนยันปิดโต๊ะเดิม?
            </h2>

            <p style={{ margin: 0, marginBottom: "0.5rem", fontSize: "1.05rem" }}>
              โต๊ะ {existingSession.table_number} · ผู้ใหญ่{" "}
              {existingSession.adult_count} · เด็ก {existingSession.child_count}
            </p>
            <p
              style={{
                margin: 0,
                marginBottom: "1.25rem",
                fontSize: "1.05rem",
                fontWeight: "bold",
              }}
            >
              เปิดมาแล้ว {elapsedMinutes} นาที
            </p>

            {confirmError && (
              <p
                style={{
                  color: COLORS.dangerText,
                  fontWeight: "bold",
                  marginBottom: "1rem",
                }}
              >
                {confirmError}
              </p>
            )}

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={handleCancelConfirmClose}
                disabled={closingLoading}
                style={{
                  flex: 1,
                  background: "#fff",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  padding: "0.85rem",
                  fontSize: "1rem",
                  fontWeight: "bold",
                  cursor: closingLoading ? "not-allowed" : "pointer",
                }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmCloseOldSession}
                disabled={closingLoading}
                style={{
                  flex: 1,
                  background: closingLoading
                    ? COLORS.dangerBtnDark
                    : COLORS.dangerBtn,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "0.85rem",
                  fontSize: "1rem",
                  fontWeight: "bold",
                  cursor: closingLoading ? "not-allowed" : "pointer",
                }}
              >
                {closingLoading ? "กำลังปิด..." : "ยืนยันปิดโต๊ะเดิม"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const inputStyle = {
  fontSize: "1.3rem",
  padding: "0.75rem",
  borderRadius: 8,
  border: "1px solid #ccc",
  width: "100%",
  boxSizing: "border-box",
};
