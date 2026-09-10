"use client";

import { useState } from "react";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");

  function sendOtp() {
    if (phone.length !== 10) {
      alert("Please enter a valid 10-digit mobile number");
      return;
    }

    setOtpSent(true);
  }

  function verifyOtp() {
    if (otp.length !== 6) {
      alert("Please enter a 6-digit OTP");
      return;
    }

    alert("OTP verified successfully!");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f7f9fc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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
            AURA<span style={{ color: "#f28c28"
