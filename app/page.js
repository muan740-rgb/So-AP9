import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        fontFamily: "sans-serif",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "2rem" }}>สุกี้ผีน้อย</h1>
      <p style={{ color: "#666" }}>ระบบสั่งอาหารร้านบุฟเฟต์ — Deploy สำเร็จแล้ว 🎉</p>

      <div style={{ display: "flex", gap: "1rem" }}>
        <Link
          href="/generate-qr"
          style={{
            padding: "0.75rem 1.25rem",
            border: "1px solid #333",
            borderRadius: "8px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          ไปหน้า Generate QR
        </Link>

        <Link
          href="/kitchen"
          style={{
            padding: "0.75rem 1.25rem",
            border: "1px solid #333",
            borderRadius: "8px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          ไปหน้า Kitchen
        </Link>
      </div>
    </main>
  );
}
