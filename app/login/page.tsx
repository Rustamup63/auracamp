"use client";

import { useState } from "react";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f7f9fc",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        fontFamily: "Arial",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "#fff",
          padding: "30px",
          borderRadius: "20px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        }}
      >
        <h1
          style={{
            textAlign: "center",
            color: "#173b8f",
            fontSize: "34px",
          }}
        >
          AURA<span style={{ color: "#f28c28" }}>CAMP</span>
        </h1>

        <p style={{ textAlign: "center", color: "#666" }}>
          Earn • Explore • Grow
        </p>

        <h2 style={{ textAlign: "center", marginTop: "30px" }}>
          Welcome Back
        </h2>

        <p style={{ textAlign: "center", color: "#777" }}>
          Login to continue earning rewards
        </p>

        <label>Mobile Number</label>

        <input
          type="tel"
          placeholder="Enter 10-digit mobile number"
          value={phone}
          onChange={(e) =>
            setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
          }
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "14px",
            marginTop: "8px",
            marginBottom: "15px",
            border: "1px solid #ddd",
            borderRadius: "10px",
            fontSize: "16px",
          }}
        />

        {!otpSent ? (
          <button
            onClick={() => {
              if (phone.length === 10) {
                setOtpSent(true);
              } else {
                alert("Enter a valid 10-digit mobile number");
              }
            }}
            style={{
              width: "100%",
              padding: "14px",
              background: "#173b8f",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              fontSize: "16px",
              fontWeight: "bold",
            }}
          >
            Send OTP
          </button>
        ) : (
          <>
            <input
              type="text"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "14px",
                marginBottom: "12px",
                border: "1px solid #ddd",
                borderRadius: "10px",
                fontSize: "16px",
              }}
            />

            <button
              onClick={() => alert("OTP verified")}
              style={{
                width: "100%",
                padding: "14px",
                background: "#173b8f",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                fontSize: "16px",
                fontWeight: "bold",
              }}
            >
              Verify OTP
            </button>
          </>
        )}

        <div
          style={{
            textAlign: "center",
            margin: "20px 0",
            color: "#999",
          }}
        >
          OR
        </div>

        <button
          style={{
            width: "100%",
            padding: "14px",
            background: "#fff",
            color: "#222",
            border: "1px solid #ddd",
            borderRadius: "10px",
            fontSize: "15px",
            fontWeight: "bold",
          }}
        >
          Continue with Google
        </button>
      </div>
    </main>
  );
}
