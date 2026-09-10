"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (mode === "register") {
        if (!name.trim()) {
          setMessage("Please enter your name.");
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          setMessage("Password must be at least 6 characters.");
          setLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setMessage("Passwords do not match.");
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });

        if (error) {
          setMessage(error.message);
        } else {
          setMessage(
            "Account created. Check your email to confirm your account."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setMessage(error.message);
        } else {
          window.location.href = "/";
        }
      }
    } catch {
      setMessage("Something went wrong. Please try again.");
    }

    setLoading(false);
  }

  async function handleGoogleLogin() {
    setMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  }

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
          padding: "32px",
          borderRadius: "20px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1
          style={{
            textAlign: "center",
            color: "#173bff",
            fontSize: "32px",
            marginBottom: "6px",
          }}
        >
          AURA<span style={{ color: "#ff7a00" }}>CAMP</span>
        </h1>

        <p
          style={{
            textAlign: "center",
            color: "#777",
            marginBottom: "28px",
          }}
        >
          Earn • Explore • Grow
        </p>

        <h2
          style={{
            textAlign: "center",
            marginBottom: "8px",
          }}
        >
          {mode === "login" ? "Welcome Back" : "Create Account"}
        </h2>

        <p
          style={{
            textAlign: "center",
            color: "#777",
            marginBottom: "24px",
          }}
        >
          {mode === "login"
            ? "Login to continue earning rewards"
            : "Create your AURACAMP account"}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <>
              <label>Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
                required
              />
            </>
          )}

          <label>Email</label>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            required
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            required
          />

          {mode === "register" && (
            <>
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle}
                required
              />
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            style={primaryButtonStyle}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Login"
              : "Create Account"}
          </button>
        </form>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            margin: "22px 0",
            color: "#aaa",
          }}
        >
          <div style={{ flex: 1, height: "1px", background: "#ddd" }} />
          OR
          <div style={{ flex: 1, height: "1px", background: "#ddd" }} />
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={googleButtonStyle}
        >
          <span style={{ fontSize: "20px" }}>G</span>
          Continue with Google
        </button>

        {message && (
          <p
            style={{
              marginTop: "18px",
              textAlign: "center",
              color: "#555",
              fontSize: "14px",
            }}
          >
            {message}
          </p>
        )}

        <p
          style={{
            textAlign: "center",
            marginTop: "24px",
            color: "#777",
          }}
        >
          {mode === "login"
            ? "Don't have an account?"
            : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setMessage("");
            }}
            style={{
              border: "none",
              background: "transparent",
              color: "#173bff",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {mode === "login" ? "Create Account" : "Login"}
          </button>
        </p>
      </div>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "14px",
  marginTop: "8px",
  marginBottom: "16px",
  border: "1px solid #ddd",
  borderRadius: "10px",
  fontSize: "15px",
};

const primaryButtonStyle = {
  width: "100%",
  padding: "14px",
  border: "none",
  borderRadius: "10px",
  background: "#173bff",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold" as const,
  cursor: "pointer",
};

const googleButtonStyle = {
  width: "100%",
  padding: "14px",
  border: "1px solid #ddd",
  borderRadius: "10px",
  background: "#fff",
  color: "#222",
  fontSize: "15px",
  fontWeight: "bold" as const,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
};
