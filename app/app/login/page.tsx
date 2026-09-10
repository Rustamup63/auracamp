"use client";

import { useState } from "react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f7f9fc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          padding: 30,
          borderRadius: 20,
          boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 34 }}>
            <span style={{ color: "#173b8f" }}>AURA</span>
            <span style={{ color: "#f28c28" }}>CAMP</span>
          </h1>

          <p style={{ color: "#667085", marginTop: 8 }}>
            {mode === "login"
              ? "Welcome back"
              : "Create your AURACAMP account"}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            background: "#f2f4f7",
            padding: 4,
            borderRadius: 10,
            marginBottom: 24,
          }}
        >
          <button
            onClick={() => setMode("login")}
            style={{
              flex: 1,
              padding: 12,
              border: 0,
              borderRadius: 8,
              background: mode === "login" ? "#fff" : "transparent",
              fontWeight: 700,
            }}
          >
            Login
          </button>

          <button
            onClick={() => setMode("register")}
            style={{
              flex: 1,
              padding: 12,
              border: 0,
              borderRadius: 8,
              background: mode === "register" ? "#fff" : "transparent",
              fontWeight: 700,
            }}
          >
            Register
          </button>
        </div>

        <label>Mobile Number</label>

        <input
          type="tel"
          placeholder="+91 9876543210"
          style={{
            width: "100%",
            padding: 14,
            marginTop: 8,
            marginBottom: 18,
            border: "1px solid #d0d5dd",
            borderRadius: 10,
            fontSize: 16,
          }}
        />

        {mode === "register" && (
          <>
            <label>Name</label>

            <input
              type="text"
              placeholder="Your name"
              style={{
                width: "100%",
                padding: 14,
                marginTop: 8,
                marginBottom: 18,
                border: "1px solid #d0d5dd",
                borderRadius: 10,
                fontSize: 16,
              }}
            />
          </>
        )}

        <button
          style={{
            width: "100%",
            padding: 15,
            border: 0,
            borderRadius: 10,
            background: "#173b8f",
            color: "#fff",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          Send OTP
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            margin: "22px 0",
            color: "#98a2b3",
          }}
        >
          <div style={{ flex: 1, height: 1, background: "#eaecf0" }} />
          OR
          <div style={{ flex: 1, height: 1, background: "#eaecf0" }} />
        </div>

        <button
          style={{
            width: "100%",
            padding: 14,
            border: "1px solid #d0d5dd",
            borderRadius: 10,
            background: "#fff",
            fontWeight: 700,
          }}
        >
          Continue with Google
        </button>

        <p
          style={{
            textAlign: "center",
            color: "#667085",
            fontSize: 13,
            marginTop: 22,
          }}
        >
          By continuing, you agree to AURACAMP's Terms & Privacy Policy.
        </p>
      </div>
    </main>
  );
}
