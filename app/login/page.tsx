"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { CSSProperties } from "react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      flowType: "pkce",
    },
  }
);

type Mode = "login" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] =
    useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | ""
  >("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");
    setMessageType("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setMessage("Please enter your email and password.");
      setMessageType("error");
      return;
    }

    if (password.length < 6) {
      setMessage(
        "Password must be at least 6 characters."
      );
      setMessageType("error");
      return;
    }

    if (mode === "register") {
      if (!fullName.trim()) {
        setMessage("Please enter your full name.");
        setMessageType("error");
        return;
      }

      if (password !== confirmPassword) {
        setMessage("Passwords do not match.");
        setMessageType("error");
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "register") {
        const { data, error } =
          await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                full_name: fullName.trim(),
              },
              emailRedirectTo:
                `${window.location.origin}/auth/callback`,
            },
          });

        if (error) {
          throw error;
        }

        if (data.session) {
          window.location.href = "/";
          return;
        }

        setMessage(
          "Account created. Please check your email to verify your account."
        );
        setMessageType("success");
      } else {
        const { error } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

        if (error) {
          throw error;
        }

        window.location.href = "/";
        return;
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";

      setMessage(errorMessage);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setMessage("");
    setMessageType("");
    setGoogleLoading(true);

    try {
      const { error } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo:
              `${window.location.origin}/auth/callback`,
          },
        });

      if (error) {
        throw error;
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Google login failed. Please try again.";

      setMessage(errorMessage);
      setMessageType("error");
      setGoogleLoading(false);
    }
  }

  function switchMode() {
    setMessage("");
    setMessageType("");

    setMode(
      mode === "login"
        ? "register"
        : "login"
    );

    setPassword("");
    setConfirmPassword("");
  }

  const isRegister = mode === "register";

  return (
    <main style={styles.page}>

            <div style={styles.glowOne} />
      <div style={styles.glowTwo} />

      <section style={styles.shell}>

        {/* LOGO */}

        <div style={styles.logoArea}>
          <div style={styles.logo}>
            <span>AURA</span>{" "}
            <b>CAMP</b>
          </div>

          <div style={styles.logoTagline}>
            Earn • Explore • Grow
          </div>
        </div>

        {/* CARD */}

        <div
          className="authCard"
          style={styles.card}
        >
          {/* TOP ICON */}

          <div
            className="topIcon"
            style={styles.topIcon}
          >
            {isRegister ? "🚀" : "👋"}
          </div>

          <h1 style={styles.title}>
            {isRegister
              ? "Create Account"
              : "Welcome Back"}
          </h1>

          <p style={styles.subtitle}>
            {isRegister
              ? "Join AURA CAMP and start earning rewards."
              : "Login to continue your earning journey."}
          </p>

          {/* MESSAGE */}

          {message && (
            <div
              style={{
                ...styles.message,
                ...(messageType === "success"
                  ? styles.successMessage
                  : styles.errorMessage),
              }}
            >
              <span>
                {messageType === "success"
                  ? "✓"
                  : "!"}
              </span>

              <span>{message}</span>
            </div>
          )}

          {/* FORM */}

          <form
            onSubmit={handleSubmit}
            style={styles.form}
          >

            {/* FULL NAME */}

            {isRegister && (
              <div style={styles.field}>
                <label style={styles.label}>
                  Full Name
                </label>

                <div style={styles.inputWrap}>
                  <span style={styles.inputIcon}>
                    👤
                  </span>

                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) =>
                      setFullName(e.target.value)
                    }
                    placeholder="Enter your full name"
                    autoComplete="name"
                    style={styles.input}
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {/* EMAIL */}

            <div style={styles.field}>
              <label style={styles.label}>
                Email Address
              </label>

              <div style={styles.inputWrap}>
                <span style={styles.inputIcon}>
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
                  style={styles.input}
                  disabled={loading}
                />
              </div>
            </div>

            {/* PASSWORD */}

            <div style={styles.field}>
              <label style={styles.label}>
                Password
              </label>

              <div style={styles.inputWrap}>
                <span style={styles.inputIcon}>
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
                    isRegister
                      ? "new-password"
                      : "current-password"
                  }
                  style={styles.input}
                  disabled={loading}
                />
              </div>
            </div>

            {/* CONFIRM PASSWORD */}

            {isRegister && (
              <div style={styles.field}>
                <label style={styles.label}>
                  Confirm Password
                </label>

                <div style={styles.inputWrap}>
                  <span style={styles.inputIcon}>
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
                    style={styles.input}
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {/* LOGIN BUTTON */}

            <button
              type="submit"
              className="primaryButton"
              style={styles.primaryButton}
              disabled={
                loading || googleLoading
              }
            >
              {loading ? (
                <>
                  <span
                    style={styles.buttonSpinner}
                  />
                  {isRegister
                    ? "Creating Account..."
                    : "Signing In..."}
                </>
              ) : (
                <>
                  {isRegister
                    ? "Create Account"
                    : "Login"}
                  <span style={styles.buttonArrow}>
                    →
                  </span>
                </>
              )}
            </button>
          </form>

          {/* DIVIDER */}

          <div style={styles.divider}>
            <span style={styles.dividerLine} />
            <span style={styles.dividerText}>
              OR
            </span>
            <span style={styles.dividerLine} />
          </div>

          {/* GOOGLE */}

          <button
            type="button"
            className="googleButton"
            style={styles.googleButton}
            onClick={handleGoogleLogin}
            disabled={
              loading || googleLoading
            }
          >
            {googleLoading ? (
              <>
                <span
                  style={{
                    ...styles.buttonSpinner,
                    borderTopColor: "#4285F4",
                    borderRightColor: "#34A853",
                  }}
                />
                Connecting...
              </>
            ) : (
              <>
                <span style={styles.googleIcon}>
                  G
                </span>

                <span>
                  Continue with Google
                </span>
              </>
            )}
          </button>

          {/* SWITCH MODE */}

          <div style={styles.switchArea}>
            <span style={styles.switchText}>
              {isRegister
                ? "Already have an account?"
                : "Don't have an account?"}
            </span>

            <button
              type="button"
              className="switchButton"
              style={styles.switchButton}
              onClick={switchMode}
              disabled={
                loading || googleLoading
              }
            >
              {isRegister
                ? "Login"
                : "Create Account"}
            </button>
          </div>

          {/* TRUST */}

          <div style={styles.trustRow}>
            <div style={styles.trustItem}>
              <span>🔒</span>
              <span>Secure Login</span>
            </div>

            <div style={styles.trustDot}>
              •
            </div>

            <div style={styles.trustItem}>
              <span>⚡</span>
              <span>Fast & Easy</span>
            </div>
          </div>
        </div>

        {/* FOOTER */}

        <div style={styles.footer}>
          <span>
            © {new Date().getFullYear()} AURA CAMP
          </span>

          <span>
            Independent Rewards Platform
          </span>
        </div>
      </section>
    </main>
  );
}

/* =====================================================
   GLOBAL CSS
===================================================== */

const globalStyles = `
* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  min-height: 100%;
}

body {
  overflow-x: hidden;
}

button,
input {
  font-family: inherit;
}

input::placeholder {
  color: #94a3b8;
}

input:focus {
  outline: none;
}

.primaryButton,
.googleButton,
.switchButton {
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
}

.primaryButton:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow:
    0 14px 30px rgba(37, 99, 235, 0.30);
}

.googleButton:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow:
    0 10px 24px rgba(15, 23, 42, 0.08);
}

.switchButton:hover:not(:disabled) {
  text-decoration: underline;
}

.primaryButton:active:not(:disabled),
.googleButton:active:not(:disabled) {
  transform: scale(0.98);
}

.primaryButton:disabled,
.googleButton:disabled,
.switchButton:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.inputWrap:focus-within {
  border-color: #6366f1 !important;
  box-shadow:
    0 0 0 4px rgba(99, 102, 241, 0.09);
}

.authCard {
  animation: cardIn 0.65s ease both;
}

.topIcon {
  animation: iconFloat 3s ease-in-out infinite;
}

@keyframes cardIn {
  from {
    opacity: 0;
    transform: translateY(22px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes iconFloat {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-5px);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 520px) {

  .page {
    min-height: 100svh !important;
    padding:
      22px 12px 18px !important;
  }

  .shell {
    width: 100% !important;
    max-width: 100% !important;
  }

  .logo {
    font-size: 28px !important;
  }

  .logoTagline {
    font-size: 10px !important;
  }

  .card {
    width: 100% !important;
    padding:
      25px 18px 20px !important;
    border-radius: 25px !important;
  }

  .topIcon {
    width: 58px !important;
    height: 58px !important;
    font-size: 26px !important;
  }

  .title {
    font-size: 25px !important;
  }

  .subtitle {
    font-size: 12px !important;
    line-height: 1.55 !important;
  }

  .input {
    font-size: 14px !important;
  }

  .primaryButton {
    min-height: 52px !important;
    font-size: 14px !important;
  }

  .googleButton {
    min-height: 50px !important;
    font-size: 13px !important;
  }

  .footer {
    flex-direction: column !important;
    gap: 5px !important;
    text-align: center !important;
  }
}

@media (max-width: 360px) {

  .page {
    padding:
      16px 9px 14px !important;
  }

  .card {
    padding:
      21px 14px 17px !important;
  }

  .logo {
    font-size: 25px !important;
  }

  .title {
    font-size: 22px !important;
  }

  .inputWrap {
    min-height: 47px !important;
  }

  .input {
    font-size: 13px !important;
  }

  .trustRow {
    font-size: 9px !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    width: "100%",
    padding: "30px 16px 20px",
    background:
      "linear-gradient(135deg, #eef5ff 0%, #f8f6ff 50%, #fff7ef 100%)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    fontFamily:
      "Georgia, 'Times New Roman', serif",
  },

  glowOne: {
    position: "fixed",
    width: "320px",
    height: "320px",
    borderRadius: "50%",
    background:
      "rgba(37, 99, 235, 0.10)",
    filter: "blur(80px)",
    top: "-150px",
    left: "-140px",
    pointerEvents: "none",
  },

  glowTwo: {
    position: "fixed",
    width: "330px",
    height: "330px",
    borderRadius: "50%",
    background:
      "rgba(124, 58, 237, 0.09)",
    filter: "blur(85px)",
    bottom: "-160px",
    right: "-150px",
    pointerEvents: "none",
  },

  shell: {
    width: "100%",
    maxWidth: "430px",
    position: "relative",
    zIndex: 1,
  },

  logoArea: {
    textAlign: "center",
    marginBottom: "18px",
  },

  logo: {
    fontSize: "32px",
    fontWeight: 900,
    letterSpacing: "-1px",
    lineHeight: 1.05,
    background:
      "linear-gradient(90deg, #155eef 0%, #4f46e5 55%, #f97316 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },

  logoTagline: {
    color: "#94a3b8",
    fontSize: "11px",
    marginTop: "7px",
    letterSpacing: "0.5px",
  },

  card: {
    width: "100%",
    background:
      "rgba(255,255,255,0.94)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    border:
      "1px solid rgba(226,232,240,0.9)",
    borderRadius: "28px",
    padding: "30px 28px 23px",
    boxShadow:
      "0 25px 70px rgba(30,64,175,0.13)",
    textAlign: "center",
  },

  topIcon: {
    width: "64px",
    height: "64px",
    margin: "0 auto 14px",
    borderRadius: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "29px",
    background:
      "linear-gradient(135deg, #eff6ff, #f5f3ff)",
    boxShadow:
      "0 10px 25px rgba(79,70,229,0.10)",
  },

  title: {
    margin: 0,
    color: "#111827",
    fontSize: "28px",
    lineHeight: 1.15,
    fontWeight: 900,
    letterSpacing: "-0.6px",
  },

  subtitle: {
    margin:
      "8px auto 22px",
    maxWidth: "320px",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.55,
  },

  message: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: "12px",
    marginBottom: "15px",
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    textAlign: "left",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, sans-serif",
    fontSize: "11px",
    lineHeight: 1.45,
  },

  successMessage: {
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    color: "#047857",
  },

  errorMessage: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    textAlign: "left",
  },

  field: {
    width: "100%",
  },

  label: {
    display: "block",
    color: "#334155",
    fontSize: "11px",
    fontWeight: 800,
    marginBottom: "6px",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, sans-serif",
  },

  inputWrap: {
    width: "100%",
    minHeight: "50px",
    borderRadius: "13px",
    border:
      "1px solid #dbe3ef",
    background: "#f8fafc",
    display: "flex",
    alignItems: "center",
    padding: "0 12px",
    transition:
      "border-color 0.2s ease, box-shadow 0.2s ease",
  },

  inputIcon: {
    width: "25px",
    minWidth: "25px",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginRight: "7px",
  },

  input: {
    width: "100%",
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#111827",
    fontSize: "13px",
    padding: "13px 0",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, sans-serif",
  },

  primaryButton: {
    width: "100%",
    minHeight: "52px",
    border: "none",
    borderRadius: "13px",
    marginTop: "3px",
    background:
      "linear-gradient(90deg, #2563eb 0%, #4f46e5 55%, #7c3aed 100%)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    fontSize: "14px",
    fontWeight: 850,
    cursor: "pointer",
    boxShadow:
      "0 10px 24px rgba(37,99,235,0.22)",
  },

  buttonArrow: {
    fontSize: "17px",
    lineHeight: 1,
  },

  buttonSpinner: {
    width: "17px",
    height: "17px",
    borderRadius: "50%",
    border:
      "2px solid rgba(255,255,255,0.35)",
    borderTopColor: "#fff",
    animation:
      "spin 0.7s linear infinite",
    display: "inline-block",
  },

    divider: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    margin: "20px 0 15px",
  },

  dividerLine: {
    height: "1px",
    background: "#e5e7eb",
    flex: 1,
  },

  dividerText: {
    color: "#94a3b8",
    fontSize: "9px",
    fontWeight: 800,
    fontFamily:
      "Inter, ui-sans-serif, system-ui, sans-serif",
  },

  googleButton: {
    width: "100%",
    minHeight: "50px",
    borderRadius: "13px",
    border: "1px solid #dbe3ef",
    background: "#fff",
    color: "#1f2937",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 750,
    fontFamily:
      "Inter, ui-sans-serif, system-ui, sans-serif",
  },

  googleIcon: {
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#4285F4",
    fontWeight: 900,
    fontSize: "17px",
    fontFamily: "Arial, sans-serif",
  },

  switchArea: {
    marginTop: "20px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "5px",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, sans-serif",
  },

  switchText: {
    color: "#64748b",
    fontSize: "11px",
  },

  switchButton: {
    border: "none",
    background: "transparent",
    color: "#2563eb",
    padding: 0,
    fontSize: "11px",
    fontWeight: 850,
    cursor: "pointer",
  },

  trustRow: {
    marginTop: "19px",
    paddingTop: "14px",
    borderTop: "1px solid #eef2f7",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "9px",
    color: "#94a3b8",
    fontSize: "10px",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, sans-serif",
  },

  trustItem: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },

  trustDot: {
    color: "#cbd5e1",
  },

  footer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "15px",
    color: "#94a3b8",
    fontSize: "9px",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, sans-serif",
  },
};
      
