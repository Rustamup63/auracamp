"use client";

import { useState } from "react";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const sendOtp = () => {
    if (phone.length === 10) {
      setOtpSent(true);
    } else {
      alert("Please enter a valid 10-digit mobile number");
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f7f9fc",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "24px",
          padding: "32px 24px",
          boxShadow: "0 15px 40px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "36px",
              fontWeight: 800,
              color: "#173b8f",
            }}
          >
            AURA<span style={{ color: "#f28c28" }}>CAMP</span>
          </h1>

          <p
            style={{
              marginTop: "10px",
              color: "#666",
              fontSize: "15px",
            }}
          >
            Earn • Explore • Grow
          </p>
        </div>

        <h2
          style={{
            textAlign: "center",
            marginBottom: "8px",
            color: "#111827",
          }}
        >
          Welcome Back
        </h2>

        <p
          style={{
            textAlign: "center",
            color: "#6b7280",
            marginBottom: "25px",
          }}
        >
          Login to continue earning rewards
        </p>

        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: 600,
            color: "#374151",
          }}
        >
          Mobile Number
        </label>

        <div
          style={{
            display: "flex",
            border: "1px solid #d1d5db",
            borderRadius: "12px",
            overflow: "hidden",
            marginBottom: "16px",
          }}
        >
          <span
            style={{
              padding: "14px 12px",
              background: "#f3f4f6",
              color: "#374151",
            }}
          >
            +91
          </span>

          <input
            type="tel"
            placeholder="Enter mobile number"
            value={phone}
            onChange={(e) =>
              setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
            }
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              padding: "14px",
              fontSize: "16px",
            }}
          />
        </div>

        {!otpSent ? (
          <button
            onClick={sendOtp}
            style={{
              width: "100%",
              padding: "15px",
              border: "none",
              borderRadius: "12px",
              background:
