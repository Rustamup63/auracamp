"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      flowType: "pkce",
    },
  }
);

export default function LoginPage() {
  const [register, setRegister] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] =
    useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function submit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setMessage("");
    setError(false);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setMessage("Please enter email and password.");
      setError(true);
      return;
    }

    if (password.length < 6) {
      setMessage(
        "Password must contain at least 6 characters."
      );
      setError(true);
      return;
    }

    if (register) {
      if (!name.trim()) {
        setMessage("Please enter your name.");
        setError(true);
        return;
      }

      if (password !== confirmPassword) {
        setMessage("Passwords do not match.");
        setError(true);
        return;
      }
    }

    setLoading(true);

    try {
      if (register) {
        const { data, error: signUpError } =
          await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                full_name: name.trim(),
              },
            },
          });

        if (signUpError) {
          throw signUpError;
        }

        if (data.session) {
          window.location.href = "/";
          return;
        }

        setMessage(
          "Account created. Check your email to verify it."
        );
        setError(false);
      } else {
        const { error: loginError } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

        if (loginError) {
          throw loginError;
        }

        window.location.href = "/";
        return;
      }
    } catch (err: unknown) {
      setError(true);

      setMessage(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function googleLogin() {
    setMessage("");
    setError(false);
    setGoogleLoading(true);

    const { error: googleError } =
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo:
            `${window.location.origin}/auth/callback`,
        },
      });

    if (googleError) {
      setMessage(googleError.message);
      setError(true);
      setGoogleLoading(false);
    }
  }

  return (
  <main
    style={{
      minHeight: "100svh",
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
      overflowX: "hidden",
      background:
        "linear-gradient(135deg,#eef4ff,#f8f5ff,#fff8f1)",
      padding: "20px 12px",
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: "420px",
        boxSizing: "border-box",
        margin: "0 auto",
      }}
    >

        {/* LOGO */}

        <div
          style={{
            textAlign: "center",
            padding: "18px 0 20px",
          }}
        >
          <div
            style={{
              fontSize: "30px",
              fontWeight: 900,
              letterSpacing: "-1px",
              background:
                "linear-gradient(90deg,#2563eb,#4f46e5,#f97316)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            AURA CAMP
          </div>

          <div
            style={{
              marginTop: "6px",
              color: "#94a3b8",
              fontSize: "11px",
              letterSpacing: "0.5px",
            }}
          >
            Earn • Explore • Grow
          </div>
        </div>

        {/* CARD */}

        <div
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "#ffffff",
            borderRadius: "24px",
            padding: "25px 18px",
            boxShadow:
              "0 18px 55px rgba(30,64,175,0.12)",
            border: "1px solid #e5eaf3",
          }}
        >

          {/* ICON */}

          <div
            style={{
              width: "58px",
              height: "58px",
              margin: "0 auto 14px",
              borderRadius: "18px",
              background:
                "linear-gradient(135deg,#eef4ff,#f4efff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "27px",
            }}
          >
            {register ? "🚀" : "👋"}
          </div>

          {/* TITLE */}

          <h1
            style={{
              margin: 0,
              textAlign: "center",
              fontSize: "25px",
              color: "#111827",
              fontWeight: 900,
              letterSpacing: "-0.5px",
            }}
          >
            {register
              ? "Create Account"
              : "Welcome Back"}
          </h1>

          <p
            style={{
              margin: "8px auto 21px",
              textAlign: "center",
              color: "#64748b",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            {register
              ? "Join AURA CAMP and start earning rewards."
              : "Login to continue your earning journey."}
          </p>

          {/* MESSAGE */}

          {message && (
            <div
              style={{
                width: "100%",
                padding: "10px 11px",
                marginBottom: "14px",
                borderRadius: "11px",
                background: error
                  ? "#fef2f2"
                  : "#ecfdf5",
                border: error
                  ? "1px solid #fecaca"
                  : "1px solid #a7f3d0",
                color: error
                  ? "#b91c1c"
                  : "#047857",
                fontSize: "11px",
                lineHeight: 1.4,
              }}
            >
              {message}
            </div>
          )}

          {/* FORM */}

          <form onSubmit={submit}>

            {register && (
              <div style={{ marginBottom: "13px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    color: "#334155",
                    fontSize: "11px",
                    fontWeight: 800,
                  }}
                >
                  Full Name
                </label>

                <div
                  style={{
                    width: "100%",
                    minHeight: "49px",
                    display: "flex",
                    alignItems: "center",
                    borderRadius: "12px",
                    border: "1px solid #dbe3ef",
                    background: "#f8fafc",
                    padding: "0 11px",
                  }}
                >
                  <span
                    style={{
                      marginRight: "8px",
                      fontSize: "14px",
                    }}
                  >
                    👤
                  </span>

                  <input
                    type="text"
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                    placeholder="Enter your full name"
                    autoComplete="name"
                    disabled={loading}
                    style={{
                      width: "100%",
                      minWidth: 0,
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      color: "#111827",
                      fontSize: "13px",
                      padding: "13px 0",
                    }}
                  />
                </div>
              </div>
            )}

            {/* EMAIL */}

            <div style={{ marginBottom: "13px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  color: "#334155",
                  fontSize: "11px",
                  fontWeight: 800,
                }}
              >
                Email Address
              </label>

              <div
                style={{
                  width: "100%",
                  minHeight: "49px",
                  display: "flex",
                  alignItems: "center",
                  borderRadius: "12px",
                  border: "1px solid #dbe3ef",
                  background: "#f8fafc",
                  padding: "0 11px",
                }}
              >
                <span
                  style={{
                    marginRight: "8px",
                    fontSize: "14px",
                  }}
                >
                  ✉️
                </span>

                <input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  placeholder="Enter your email"
                  autoComplete="email"
                  disabled={loading}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: "#111827",
                    fontSize: "13px",
                    padding: "13px 0",
                  }}
                />
              </div>
            </div>

            {/* PASSWORD */}

            <div style={{ marginBottom: "13px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "6px",
                  color: "#334155",
                  fontSize: "11px",
                  fontWeight: 800,
                }}
              >
                Password
              </label>

              <div
                style={{
                  width: "100%",
                  minHeight: "49px",
                  display: "flex",
                  alignItems: "center",
                  borderRadius: "12px",
                  border: "1px solid #dbe3ef",
                  background: "#f8fafc",
                  padding: "0 11px",
                }}
              >
                <span
                  style={{
                    marginRight: "8px",
                    fontSize: "14px",
                  }}
                >
                  🔒
                </span>

                <input
                  type="password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="Enter your password"
                  autoComplete={
                    register
                      ? "new-password"
                      : "current-password"
                  }
                  disabled={loading}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: "#111827",
                    fontSize: "13px",
                    padding: "13px 0",
                  }}
                />
              </div>
            </div>

            {register && (
              <div style={{ marginBottom: "15px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    color: "#334155",
                    fontSize: "11px",
                    fontWeight: 800,
                  }}
                >
                  Confirm Password
                </label>

                <div
                  style={{
                    width: "100%",
                    minHeight: "49px",
                    display: "flex",
                    alignItems: "center",
                    borderRadius: "12px",
                    border: "1px solid #dbe3ef",
                    background: "#f8fafc",
                    padding: "0 11px",
                  }}
                >
                  <span
                    style={{
                      marginRight: "8px",
                      fontSize: "14px",
                    }}
                  >
                    🔐
                  </span>

                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(
                        e.target.value
                      )
                    }
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    disabled={loading}
                    style={{
                      width: "100%",
                      minWidth: 0,
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      color: "#111827",
                      fontSize: "13px",
                      padding: "13px 0",
                    }}
                  />
                </div>
              </div>
            )}            {/* LOGIN / REGISTER BUTTON */}

            <button
              type="submit"
              disabled={loading || googleLoading}
              style={{
                width: "100%",
                minHeight: "51px",
                border: "none",
                borderRadius: "12px",
                background:
                  "linear-gradient(90deg,#2563eb,#4f46e5,#7c3aed)",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 800,
                cursor:
                  loading || googleLoading
                    ? "not-allowed"
                    : "pointer",
                boxShadow:
                  "0 10px 25px rgba(37,99,235,0.22)",
                opacity:
                  loading || googleLoading ? 0.7 : 1,
              }}
            >
              {loading
                ? "Please wait..."
                : register
                ? "Create Account"
                : "Login"}
              {!loading && (
                <span style={{ marginLeft: "9px" }}>
                  →
                </span>
              )}
            </button>
          </form>

          {/* DIVIDER */}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "9px",
              margin: "19px 0 14px",
            }}
          >
            <div
              style={{
                flex: 1,
                height: "1px",
                background: "#e5e7eb",
              }}
            />

            <span
              style={{
                color: "#94a3b8",
                fontSize: "9px",
                fontWeight: 700,
              }}
            >
              OR
            </span>

            <div
              style={{
                flex: 1,
                height: "1px",
                background: "#e5e7eb",
              }}
            />
          </div>

          {/* GOOGLE BUTTON */}

          <button
            type="button"
            onClick={googleLogin}
            disabled={loading || googleLoading}
            style={{
              width: "100%",
              minHeight: "50px",
              borderRadius: "12px",
              border: "1px solid #dbe3ef",
              background: "#ffffff",
              color: "#1f2937",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              fontSize: "13px",
              fontWeight: 700,
              cursor:
                loading || googleLoading
                  ? "not-allowed"
                  : "pointer",
              opacity:
                loading || googleLoading ? 0.65 : 1,
            }}
          >
            <span
              style={{
                color: "#4285F4",
                fontSize: "19px",
                fontWeight: 900,
                fontFamily: "Arial, sans-serif",
              }}
            >
              G
            </span>

            {googleLoading
              ? "Connecting..."
              : "Continue with Google"}
          </button>

          {/* SWITCH LOGIN / REGISTER */}

          <div
            style={{
              marginTop: "18px",
              textAlign: "center",
              fontSize: "11px",
              color: "#64748b",
            }}
          >
            <span>
              {register
                ? "Already have an account?"
                : "Don't have an account?"}
            </span>

            <button
              type="button"
              onClick={() => {
                setRegister(!register);
                setMessage("");
                setError(false);
                setPassword("");
                setConfirmPassword("");
              }}
              disabled={loading || googleLoading}
              style={{
                marginLeft: "5px",
                border: "none",
                background: "transparent",
                color: "#2563eb",
                fontSize: "11px",
                fontWeight: 800,
                cursor: "pointer",
                padding: 0,
              }}
            >
              {register
                ? "Login"
                : "Create Account"}
            </button>
          </div>

          {/* SECURITY */}

          <div
            style={{
              marginTop: "18px",
              paddingTop: "13px",
              borderTop: "1px solid #eef2f7",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "9px",
              color: "#94a3b8",
              fontSize: "9px",
            }}
          >
            <span>🔒 Secure Login</span>
            <span>•</span>
            <span>⚡ Fast & Easy</span>
          </div>
        </div>

        {/* FOOTER */}

        <div
          style={{
            textAlign: "center",
            marginTop: "15px",
            paddingBottom: "4px",
            color: "#94a3b8",
            fontSize: "9px",
            lineHeight: 1.5,
          }}
        >
          <div>
            © {new Date().getFullYear()} AURA CAMP
          </div>

          <div style={{ marginTop: "3px" }}>
            Independent Rewards Platform
          </div>
        </div>
      </div>
    </main>
  );
}
