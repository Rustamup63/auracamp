"use client";

import { useState, type CSSProperties } from "react";
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

  const isLogin = mode === "login";

  return (
    <main style={styles.page}>
      <style>{globalStyles}</style>

      <div style={styles.glowOne} />
      <div style={styles.glowTwo} />

      <section style={styles.authCard} className="authCard">
        {/* Logo */}
        <div style={styles.brandArea}>
          <div style={styles.logo}>
            <span style={styles.logoAura}>AURA</span>
            <span style={styles.logoCamp}>CAMP</span>
          </div>

          <div style={styles.tagline}>Earn • Explore • Grow</div>
        </div>

        {/* Icon */}
        <div style={styles.topIcon} className="topIcon">
          {isLogin ? "👋" : "🚀"}
        </div>

        {/* Heading */}
        <div style={styles.headingArea}>
          <h1 style={styles.title}>
            {isLogin ? "Welcome Back" : "Create Account"}
          </h1>

          <p style={styles.subtitle}>
            {isLogin
              ? "Login to continue earning rewards"
              : "Join AURACAMP and start earning rewards"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div style={styles.fieldGroup} className="fieldAnimation">
              <label style={styles.label}>Full Name</label>

              <div style={styles.inputWrap}>
                <span style={styles.inputIcon}>👤</span>

                <input
                  type="text"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>
            </div>
          )}

          <div style={styles.fieldGroup} className="fieldAnimation">
            <label style={styles.label}>Email Address</label>

            <div style={styles.inputWrap}>
              <span style={styles.inputIcon}>✉️</span>

              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required
              />
            </div>
          </div>

          <div style={styles.fieldGroup} className="fieldAnimation">
            <label style={styles.label}>Password</label>

            <div style={styles.inputWrap}>
              <span style={styles.inputIcon}>🔒</span>

              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
              />
            </div>
          </div>

          {!isLogin && (
            <div style={styles.fieldGroup} className="fieldAnimation">
              <label style={styles.label}>Confirm Password</label>

              <div style={styles.inputWrap}>
                <span style={styles.inputIcon}>🔐</span>

                <input
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.primaryButton,
              opacity: loading ? 0.75 : 1,
            }}
            className="primaryButton"
          >
            {loading ? (
              <>
                <span style={styles.spinner} className="spinner" />
                Please wait...
              </>
            ) : (
              <>
                {isLogin ? "Login to AURACAMP" : "Create My Account"}
                <span style={styles.arrow}>→</span>
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div style={styles.divider}>
          <span style={styles.line} />
          <span style={styles.orText}>OR</span>
          <span style={styles.line} />
        </div>

        {/* Google */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={styles.googleButton}
          className="googleButton"
        >
          <span style={styles.googleIcon}>G</span>
          <span>Continue with Google</span>
        </button>

        {/* Message */}
        {message && (
          <div style={styles.messageBox}>
            {message}
          </div>
        )}

        {/* Switch */}
        <div style={styles.switchArea}>
          <span style={styles.switchText}>
            {isLogin
              ? "Don't have an account?"
              : "Already have an account?"}
          </span>

          <button
            type="button"
            onClick={() => {
              setMode(isLogin ? "register" : "login");
              setMessage("");
            }}
            style={styles.switchButton}
            className="switchButton"
          >
            {isLogin ? "Create Account" : "Login"}
          </button>
        </div>

        {/* Trust */}
        <div style={styles.trustRow}>
          <span>🔒 Secure</span>
          <span>•</span>
          <span>⚡ Fast</span>
          <span>•</span>
          <span>🛡️ Protected</span>
        </div>
      </section>

      <footer style={styles.footer}>
        © {new Date().getFullYear()} AURACAMP • Independent Rewards Platform
      </footer>
    </main>
  );
}

const globalStyles = `
  * {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    overflow-x: hidden;
  }

  button,
  input {
    font-family: inherit;
  }

  input::placeholder {
    color: #9aa4b2;
  }

  input:focus {
    outline: none;
  }

  .authCard {
    animation: cardEnter 0.7s ease both;
  }

  .topIcon {
    animation: floatIcon 3s ease-in-out infinite;
  }

  .fieldAnimation {
    animation: fieldEnter 0.55s ease both;
  }

  .primaryButton,
  .googleButton,
  .switchButton {
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease,
      border-color 0.2s ease;
  }

  .primaryButton:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 30px rgba(57, 73, 230, 0.30);
  }

  .primaryButton:active,
  .googleButton:active {
    transform: scale(0.98);
  }

  .googleButton:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 24px rgba(30, 41, 59, 0.10);
    border-color: #cbd5e1;
  }

  .switchButton:hover {
    transform: translateY(-1px);
  }

  @keyframes cardEnter {
    from {
      opacity: 0;
      transform: translateY(22px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes fieldEnter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes floatIcon {
    0%, 100% {
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
    .authCard {
      padding: 28px 20px !important;
      border-radius: 24px !important;
    }
  }

  @media (max-width: 360px) {
    .authCard {
      padding: 24px 16px !important;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .authCard,
    .topIcon,
    .fieldAnimation {
      animation: none !important;
    }

    .primaryButton,
    .googleButton,
    .switchButton {
      transition: none !important;
    }
  }
`;

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    width: "100%",
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(135deg, #eef4ff 0%, #f7f5ff 48%, #fff7f0 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "28px 16px 20px",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#111827",
  },

  glowOne: {
    position: "fixed",
    width: "300px",
    height: "300px",
    borderRadius: "50%",
    background: "rgba(37, 99, 235, 0.16)",
    filter: "blur(80px)",
    top: "-120px",
    left: "-100px",
    pointerEvents: "none",
  },

  glowTwo: {
    position: "fixed",
    width: "330px",
    height: "330px",
    borderRadius: "50%",
    background: "rgba(124, 58, 237, 0.13)",
    filter: "blur(90px)",
    bottom: "-150px",
    right: "-110px",
    pointerEvents: "none",
  },

  authCard: {
    width: "100%",
    maxWidth: "470px",
    position: "relative",
    zIndex: 2,
    background: "rgba(255,255,255,0.90)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.95)",
    borderRadius: "28px",
    padding: "34px",
    boxShadow:
      "0 25px 70px rgba(30, 64, 175, 0.13), 0 5px 20px rgba(15,23,42,0.05)",
  },

  brandArea: {
    textAlign: "center",
    marginBottom: "18px",
  },

  logo: {
    fontSize: "31px",
    fontWeight: 900,
    letterSpacing: "2px",
    lineHeight: 1.1,
  },

  logoAura: {
    color: "#2563eb",
  },

  logoCamp: {
    color: "#f97316",
    marginLeft: "7px",
  },

  tagline: {
    marginTop: "7px",
    color: "#7b8798",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.8px",
  },

  topIcon: {
    width: "58px",
    height: "58px",
    margin: "12px auto 16px",
    borderRadius: "19px",
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(124,58,237,0.14))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "27px",
    boxShadow: "0 10px 25px rgba(37,99,235,0.08)",
  },

  headingArea: {
    textAlign: "center",
    marginBottom: "25px",
  },

  title: {
    margin: 0,
    color: "#111827",
    fontSize: "29px",
    fontWeight: 850,
    letterSpacing: "-0.7px",
  },

  subtitle: {
    margin: "8px 0 0",
    color: "#718096",
    fontSize: "14px",
    lineHeight: 1.5,
  },

  fieldGroup: {
    marginBottom: "15px",
  },

  label: {
    display: "block",
    marginBottom: "7px",
    color: "#263244",
    fontSize: "13px",
    fontWeight: 750,
  },

  inputWrap: {
    width: "100%",
    minWidth: 0,
    height: "52px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    padding: "0 14px",
    transition: "all 0.2s ease",
  },

  inputIcon: {
    flex: "0 0 auto",
    fontSize: "17px",
    opacity: 0.8,
  },

  input: {
    width: "100%",
    minWidth: 0,
    height: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#111827",
    fontSize: "14px",
  },

  primaryButton: {
    width: "100%",
    minHeight: "53px",
    marginTop: "5px",
    border: "none",
    borderRadius: "14px",
    background:
      "linear-gradient(135deg, #2563eb 0%, #4f46e5 55%, #7c3aed 100%)",
    color: "#fff",
    padding: "14px 18px",
    fontSize: "15px",
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "9px",
    boxShadow: "0 10px 25px rgba(59, 70, 230, 0.22)",
  },

  arrow: {
    fontSize: "19px",
    lineHeight: 1,
  },

  spinner: {
    width: "17px",
    height: "17px",
    border: "2px solid rgba(255,255,255,0.4)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    display: "inline-block",
    animation: "spin 0.7s linear infinite",
  },

  divider: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    margin: "23px 0",
  },

  line: {
    flex: 1,
    height: "1px",
    background: "#e5e7eb",
  },

  orText: {
    color: "#9aa4b2",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "1px",
  },

  googleButton: {
    width: "100%",
    minHeight: "52px",
    border: "1px solid #e2e8f0",
    borderRadius: "14px",
    background: "#fff",
    color: "#1f2937",
    padding: "13px 18px",
    fontSize: "14px",
    fontWeight: 750,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "11px",
  },

  googleIcon: {
    width: "25px",
    height: "25px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#4285F4",
    fontSize: "20px",
    fontWeight: 800,
  },

  messageBox: {
    marginTop: "17px",
    padding: "12px 14px",
    borderRadius: "12px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#475569",
    textAlign: "center",
    fontSize: "12px",
    lineHeight: 1.45,
  },

  switchArea: {
    textAlign: "center",
    marginTop: "23px",
  },

  switchText: {
    color: "#718096",
    fontSize: "13px",
  },

  switchButton: {
    border: "none",
    background: "transparent",
    color: "#2563eb",
    fontSize: "14px",
    fontWeight: 850,
    cursor: "pointer",
    padding: "7px 4px",
    marginLeft: "4px",
  },

  trustRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "7px",
    marginTop: "20px",
    color: "#9aa4b2",
    fontSize: "10px",
    fontWeight: 650,
  },

  footer: {
    position: "relative",
    zIndex: 2,
    marginTop: "18px",
    textAlign: "center",
    color: "#94a3b8",
    fontSize: "10px",
  },
};
