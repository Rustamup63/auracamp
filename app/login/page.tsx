"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

type Mode = "login" | "register" | "forgot" | "reset";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    initializeAuth();
  }, []);

  async function initializeAuth() {
    try {
      const params = new URLSearchParams(
        window.location.search
      );

      const recovery =
        params.get("mode") === "reset" ||
        window.location.hash.includes("type=recovery");

      if (recovery) {
        setMode("reset");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        window.location.replace("/");
      }
    } catch {
      // Keep login page silent if session check fails.
    }
  }

  function clearMessage() {
    setMessage("");
    setError(false);
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);

    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");

    setShowPassword(false);
    setShowConfirmPassword(false);

    clearMessage();

    if (nextMode !== "reset") {
      window.history.replaceState(
        {},
        "",
        "/login"
      );
    }
  }

  function friendlyError(message: string) {
    const text = message.toLowerCase();

    if (
      text.includes("invalid login credentials") ||
      text.includes("invalid credentials")
    ) {
      return "Incorrect email or password.";
    }

    if (text.includes("email not confirmed")) {
      return "Please verify your email before logging in.";
    }

    if (text.includes("user already registered")) {
      return "An account with this email already exists. Please login.";
    }

    if (text.includes("password should be at least")) {
      return "Password must contain at least 6 characters.";
    }

    if (
      text.includes("rate limit") ||
      text.includes("too many requests")
    ) {
      return "Too many attempts. Please wait a moment and try again.";
    }

    if (text.includes("network")) {
      return "Network error. Please check your internet connection.";
    }

    return message || "Something went wrong. Please try again.";
  }

  async function submit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    clearMessage();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setMessage("Please enter your email address.");
      setError(true);
      return;
    }

    if (!cleanEmail.includes("@")) {
      setMessage("Please enter a valid email address.");
      setError(true);
      return;
    }

    if (!password) {
      setMessage("Please enter your password.");
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

    if (mode === "register") {
      if (!name.trim()) {
        setMessage("Please enter your full name.");
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
      if (mode === "register") {
        const { data, error: signUpError } =
          await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                full_name: name.trim(),
              },
              emailRedirectTo:
                `${window.location.origin}/auth/callback`,
            },
          });

        if (signUpError) {
          throw signUpError;
        }

        /*
         * Email confirmation ON:
         * data.session === null
         *
         * Do NOT redirect.
         * User must verify email first.
         */
        if (data.session) {
          window.location.replace("/");
          return;
        }

        setMessage(
          "Account created. Please check your email and verify your account before logging in."
        );

        setError(false);
        setPassword("");
        setConfirmPassword("");
      } else {
        const { error: loginError } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

        if (loginError) {
          throw loginError;
        }

        setMessage(
          "Login successful. Redirecting..."
        );
        setError(false);

        setTimeout(() => {
          window.location.replace("/");
        }, 400);
      }
    } catch (err: unknown) {
      setError(true);

      setMessage(
        friendlyError(
          err instanceof Error
            ? err.message
            : "Something went wrong."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function googleLogin() {
    clearMessage();
    setGoogleLoading(true);

    try {
      const { error: googleError } =
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo:
              `${window.location.origin}/auth/callback`,
          },
        });

      if (googleError) {
        throw googleError;
      }
    } catch (err: unknown) {
      setError(true);

      setMessage(
        friendlyError(
          err instanceof Error
            ? err.message
            : "Unable to continue with Google."
        )
      );

      setGoogleLoading(false);
    }
  }

  async function sendResetEmail(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    clearMessage();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setMessage("Please enter your email address.");
      setError(true);
      return;
    }

    if (!cleanEmail.includes("@")) {
      setMessage("Please enter a valid email address.");
      setError(true);
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo:
              `${window.location.origin}/login?mode=reset`,
          }
        );

      if (resetError) {
        throw resetError;
      }

      setMessage(
        "Password reset link sent. Please check your email."
      );

      setError(false);
    } catch (err: unknown) {
      setError(true);

      setMessage(
        friendlyError(
          err instanceof Error
            ? err.message
            : "Unable to send reset link."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function updatePassword(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    clearMessage();

    if (!password) {
      setMessage("Please enter your new password.");
      setError(true);
      return;
    }

    if (password.length < 6) {
      setMessage(
        "New password must contain at least 6 characters."
      );
      setError(true);
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      setError(true);
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) {
        throw updateError;
      }

      setMessage(
        "Password updated successfully. Redirecting..."
      );

      setError(false);

      setTimeout(() => {
        window.location.replace("/");
      }, 900);
    } catch (err: unknown) {
      setError(true);

      setMessage(
        friendlyError(
          err instanceof Error
            ? err.message
            : "Unable to update password."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || googleLoading;

  return (
    <>
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          min-height: 100%;
          background: #f4f8ff;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        body {
          overflow-x: hidden;
        }

        button,
        input {
          font: inherit;
        }

        button {
          -webkit-tap-highlight-color: transparent;
        }

        input::placeholder {
          color: #9aa8ba;
        }

        .auth-page {
          min-height: 100svh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background:
            radial-gradient(
              circle at 8% 8%,
              rgba(37, 99, 235, 0.09),
              transparent 28%
            ),
            radial-gradient(
              circle at 92% 92%,
              rgba(79, 70, 229, 0.08),
              transparent 30%
            ),
            #f4f8ff;
        }

        .auth-shell {
          width: min(1050px, 100%);
          min-height: 650px;
          display: grid;
          grid-template-columns: 1fr 430px;
          overflow: hidden;
          border: 1px solid #e1e8f2;
          border-radius: 28px;
          background: #ffffff;
          box-shadow:
            0 30px 80px rgba(15, 23, 42, 0.10),
            0 10px 30px rgba(37, 99, 235, 0.06);
        }

        /* LEFT */

        .brand-panel {
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 52px;
          background:
            linear-gradient(
              145deg,
              #edf5ff 0%,
              #f3f6ff 55%,
              #fafbff 100%
            );
        }

        .brand-panel::before {
          content: "";
          position: absolute;
          width: 390px;
          height: 390px;
          border-radius: 50%;
          top: -210px;
          right: -160px;
          background: rgba(37, 99, 235, 0.07);
        }

        .brand-panel::after {
          content: "";
          position: absolute;
          width: 300px;
          height: 300px;
          border-radius: 50%;
          bottom: -190px;
          left: -140px;
          background: rgba(79, 70, 229, 0.06);
        }

        .brand-content,
        .brand-bottom {
          position: relative;
          z-index: 2;
        }

        .brand-logo {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-mark {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border-radius: 15px;
          color: #ffffff;
          font-size: 24px;
          font-weight: 900;
          background:
            linear-gradient(
              145deg,
              #1769ff,
              #4058ed 55%,
              #703de7
            );
          box-shadow:
            0 12px 25px rgba(37, 99, 235, 0.22),
            inset 0 1px 1px
              rgba(255, 255, 255, 0.55);
        }

        .brand-name {
          color: #101828;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.8px;
        }

        .brand-tagline {
          margin-top: 2px;
          color: #748196;
          font-size: 10px;
          letter-spacing: 0.3px;
        }

        .brand-title {
          max-width: 500px;
          margin: 78px 0 16px;
          color: #111827;
          font-size: clamp(40px, 4.2vw, 60px);
          line-height: 1.02;
          font-weight: 900;
          letter-spacing: -3px;
        }

        .brand-title span {
          color: #2864e9;
        }

        .brand-description {
          max-width: 450px;
          margin: 0;
          color: #66758a;
          font-size: 15px;
          line-height: 1.7;
        }

        .benefits {
          display: grid;
          gap: 12px;
          margin-top: 34px;
        }

        .benefit {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #344054;
          font-size: 13px;
          font-weight: 700;
        }

        .benefit-icon {
          width: 33px;
          height: 33px;
          display: grid;
          place-items: center;
          border: 1px solid #e0e7f0;
          border-radius: 10px;
          background: #ffffff;
          color: #2563eb;
          box-shadow:
            0 6px 16px rgba(15, 23, 42, 0.05);
        }

        .brand-bottom {
          color: #98a2b3;
          font-size: 10px;
          line-height: 1.5;
        }

        /* RIGHT */

        .auth-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 38px 34px;
          background: #ffffff;
        }

        .auth-card {
          width: 100%;
          max-width: 360px;
        }

        .mobile-brand {
          display: none;
        }

        .auth-icon {
          width: 56px;
          height: 56px;
          display: grid;
          place-items: center;
          margin: 0 auto 16px;
          border: 1px solid #dbe6ff;
          border-radius: 17px;
          color: #ffffff;
          font-size: 25px;
          font-weight: 900;
          background:
            linear-gradient(
              145deg,
              #1769ff,
              #4058ed 55%,
              #703de7
            );
          box-shadow:
            0 12px 26px rgba(37, 99, 235, 0.20),
            inset 0 1px 1px
              rgba(255, 255, 255, 0.55);
        }

        .auth-title {
          margin: 0;
          color: #101828;
          text-align: center;
          font-size: 27px;
          line-height: 1.15;
          font-weight: 900;
          letter-spacing: -0.9px;
        }

        .auth-subtitle {
          margin: 8px auto 24px;
          color: #667085;
          text-align: center;
          font-size: 12px;
          line-height: 1.55;
        }

        /* MESSAGE */

        .message {
          width: 100%;
          margin-bottom: 15px;
          padding: 11px 12px;
          border-radius: 12px;
          font-size: 11px;
          line-height: 1.5;
        }

        .message.error {
          color: #b42318;
          border: 1px solid #fecdca;
          background: #fff5f4;
        }

        .message.success {
          color: #087443;
          border: 1px solid #abefc6;
          background: #f0fdf4;
        }

        /* FIELDS */

        .field {
          margin-bottom: 14px;
        }

        .field-label {
          display: block;
          margin-bottom: 7px;
          color: #344054;
          font-size: 11px;
          font-weight: 800;
        }

        .input-wrap {
          width: 100%;
          min-height: 51px;
          display: flex;
          align-items: center;
          border: 1px solid #dce3ed;
          border-radius: 13px;
          background: #fafbfc;
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            background 0.18s ease;
        }

        .input-wrap:focus-within {
          border-color: #7898ed;
          background: #ffffff;
          box-shadow:
            0 0 0 4px
              rgba(37, 99, 235, 0.07);
        }

        .input-icon {
          width: 42px;
          flex: 0 0 42px;
          display: grid;
          place-items: center;
          color: #64748b;
          font-size: 14px;
        }

        .input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #101828;
          font-size: 13px;
          padding: 14px 5px 14px 0;
        }

        .password-toggle {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          border: 0;
          background: transparent;
          color: #667085;
          cursor: pointer;
          font-size: 16px;
        }

        .forgot-row {
          display: flex;
          justify-content: flex-end;
          margin: -2px 0 15px;
        }

        .link-button {
          padding: 2px;
          border: 0;
          background: transparent;
          color: #2458d7;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        /* PRIMARY */

        .primary-button {
          width: 100%;
          min-height: 51px;
          border: 0;
          border-radius: 13px;
          color: #ffffff;
          background:
            linear-gradient(
              100deg,
              #172033,
              #202b40
            );
          box-shadow:
            0 11px 24px
              rgba(15, 23, 42, 0.15),
            inset 0 1px 0
              rgba(255, 255, 255, 0.08);
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease,
            opacity 0.15s ease;
        }

        .primary-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow:
            0 15px 28px
              rgba(15, 23, 42, 0.18);
        }

        .primary-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .primary-button:disabled {
          opacity: 0.62;
          cursor: not-allowed;
        }

        /* DIVIDER */

        .divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 20px 0 14px;
        }

        .divider-line {
          flex: 1;
          height: 1px;
          background: #e8edf3;
        }

        .divider-text {
          color: #9aa5b5;
          font-size: 9px;
          font-weight: 800;
        }

        /* GOOGLE */

        .google-button {
          width: 100%;
          min-height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border: 1px solid #dce3ed;
          border-radius: 13px;
          background: #ffffff;
          color: #1d2939;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition:
            transform 0.15s ease,
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .google-button:hover:not(:disabled) {
          transform: translateY(-1px);
          border-color: #cbd5e1;
          box-shadow:
            0 8px 20px
              rgba(15, 23, 42, 0.06);
        }

        .google-button:disabled {
          opacity: 0.62;
          cursor: not-allowed;
        }

        .google-icon {
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          font-family: Arial, sans-serif;
          font-size: 18px;
          font-weight: 900;
          color: #4285f4;
        }

        /* SWITCH */

        .switch-text {
          margin-top: 19px;
          color: #667085;
          text-align: center;
          font-size: 11px;
        }

        .switch-text button {
          margin-left: 5px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #2458d7;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        /* LEGAL */

        .legal {
          margin-top: 19px;
          color: #98a2b3;
          text-align: center;
          font-size: 9px;
          line-height: 1.6;
        }

        .legal a {
          color: #5369c9;
          text-decoration: none;
          font-weight: 700;
        }

        /* SECURITY */

        .security {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 15px;
          padding-top: 14px;
          border-top: 1px solid #eef1f5;
          color: #98a2b3;
          font-size: 9px;
        }

        /* BACK */

        .back-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 18px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #667085;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        /* MOBILE */

        @media (max-width: 820px) {
          .auth-page {
            padding: 14px;
            align-items: flex-start;
          }

          .auth-shell {
            display: block;
            width: 100%;
            max-width: 500px;
            min-height: calc(100svh - 28px);
            border-radius: 24px;
          }

          .brand-panel {
            display: none;
          }

          .auth-panel {
            min-height: calc(100svh - 28px);
            padding: 26px 19px 24px;
          }

          .mobile-brand {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 9px;
            margin-bottom: 28px;
          }

          .mobile-brand .logo-mark {
            width: 40px;
            height: 40px;
            border-radius: 12px;
            font-size: 20px;
          }

          .mobile-brand-name {
            color: #101828;
            font-size: 19px;
            font-weight: 900;
            letter-spacing: -0.5px;
          }

          .auth-card {
            max-width: 390px;
          }
        }

        @media (max-width: 420px) {
          .auth-page {
            padding: 0;
          }

          .auth-shell {
            min-height: 100svh;
            border: 0;
            border-radius: 0;
            box-shadow: none;
          }

          .auth-panel {
            min-height: 100svh;
            padding: 22px 16px;
          }

          .auth-title {
            font-size: 25px;
          }
        }
      `}</style>

      <main className="auth-page">
        <div className="auth-shell">

          {/* =========================
              DESKTOP BRAND
          ========================== */}

          <section className="brand-panel">
            <div className="brand-content">

              <div className="brand-logo">
                <div className="logo-mark">
                  A
                </div>

                <div>
                  <div className="brand-name">
                    AURACAMP
                  </div>

                  <div className="brand-tagline">
                    Earn More. Do More.
                  </div>
                </div>
              </div>

              <h2 className="brand-title">
                Simple offers.
                <br />
                <span>Real rewards.</span>
              </h2>

              <p className="brand-description">
                Discover offers, complete simple tasks,
                earn rewards and manage your earnings
                from one place.
              </p>

              <div className="benefits">

                <div className="benefit">
                  <div className="benefit-icon">
                    ✓
                  </div>
                  Secure account authentication
                </div>

                <div className="benefit">
                  <div className="benefit-icon">
                    ⚡
                  </div>
                  Fast and simple earning experience
                </div>

                <div className="benefit">
                  <div className="benefit-icon">
                    ₹
                  </div>
                  Transparent rewards and withdrawals
                </div>

              </div>
            </div>

            <div className="brand-bottom">
              © {new Date().getFullYear()} AURACAMP
              <br />
              Independent Rewards Platform
            </div>
          </section>

          {/* =========================
              AUTH
          ========================== */}

          <section className="auth-panel">
            <div className="auth-card">

              {/* MOBILE BRAND */}

              <div className="mobile-brand">
                <div className="logo-mark">
                  A
                </div>

                <div className="mobile-brand-name">
                  AURACAMP
                </div>
              </div>

              {/* =========================
                  FORGOT PASSWORD
              ========================== */}

              {mode === "forgot" && (
                <>
                  <button
                    className="back-button"
                    type="button"
                    onClick={() =>
                      switchMode("login")
                    }
                  >
                    ← Back to Login
                  </button>

                  <div className="auth-icon">
                    A
                  </div>

                  <h1 className="auth-title">
                    Forgot Password?
                  </h1>

                  <p className="auth-subtitle">
                    Enter your registered email and
                    we&apos;ll send you a secure reset link.
                  </p>

                  {message && (
                    <div
                      className={`message ${
                        error
                          ? "error"
                          : "success"
                      }`}
                    >
                      {message}
                    </div>
                  )}

                  <form
                    onSubmit={sendResetEmail}
                  >
                    <div className="field">
                      <label className="field-label">
                        Email Address
                      </label>

                      <div className="input-wrap">
                        <span className="input-icon">
                          @
                        </span>

                        <input
                          className="input"
                          type="email"
                          value={email}
                          onChange={(e) =>
                            setEmail(
                              e.target.value
                            )
                          }
                          placeholder="Enter your email"
                          autoComplete="email"
                          disabled={busy}
                        />
                      </div>
                    </div>

                    <button
                      className="primary-button"
                      type="submit"
                      disabled={busy}
                    >
                      {loading
                        ? "Sending..."
                        : "Send Reset Link →"}
                    </button>
                  </form>

                  <div className="security">
                    Secure password recovery
                  </div>
                </>
              )}

              {/* =========================
                  RESET PASSWORD
              ========================== */}

              {mode === "reset" && (
                <>
                  <div className="auth-icon">
                    A
                  </div>

                  <h1 className="auth-title">
                    Create New Password
                  </h1>

                  <p className="auth-subtitle">
                    Choose a strong new password
                    for your AURACAMP account.
                  </p>

                  {message && (
                    <div
                      className={`message ${
                        error
                          ? "error"
                          : "success"
                      }`}
                    >
                      {message}
                    </div>
                  )}

                  <form
                    onSubmit={updatePassword}
                  >

                    <div className="field">
                      <label className="field-label">
                        New Password
                      </label>

                      <div className="input-wrap">
                        <span className="input-icon">
                          •
                        </span>

                        <input
                          className="input"
                          type={
                            showPassword
                              ? "text"
                              : "password"
                          }
                          value={password}
                          onChange={(e) =>
                            setPassword(
                              e.target.value
                            )
                          }
                          placeholder="Enter new password"
                          autoComplete="new-password"
                          disabled={busy}
                        />

                        <button
                          className="password-toggle"
                          type="button"
                          onClick={() =>
                            setShowPassword(
                              !showPassword
                            )
                          }
                          disabled={busy}
                        >
                          {showPassword
                            ? "●"
                            : "○"}
                        </button>
                      </div>
                    </div>

                    <div className="field">
                      <label className="field-label">
                        Confirm New Password
                      </label>

                      <div className="input-wrap">
                        <span className="input-icon">
                          •
                        </span>

                        <input
                          className="input"
                          type={
                            showConfirmPassword
                              ? "text"
                              : "password"
                          }
                          value={
                            confirmPassword
                          }
                          onChange={(e) =>
                            setConfirmPassword(
                              e.target.value
                            )
                          }
                          placeholder="Confirm new password"
                          autoComplete="new-password"
                          disabled={busy}
                        />

                        <button
                          className="password-toggle"
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(
                              !showConfirmPassword
                            )
                          }
                          disabled={busy}
                        >
                          {showConfirmPassword
                            ? "●"
                            : "○"}
                        </button>
                      </div>
                    </div>

                    <button
                      className="primary-button"
                      type="submit"
                      disabled={busy}
                    >
                      {loading
                        ? "Updating..."
                        : "Update Password →"}
                    </button>
                  </form>

                  <div className="security">
                    Your password stays private
                  </div>
                </>
              )}

              {/* =========================
                  LOGIN / REGISTER
              ========================== */}

              {(mode === "login" ||
                mode === "register") && (
                <>
                  <div className="auth-icon">
                    A
                  </div>

                  <h1 className="auth-title">
                    {mode === "register"
                      ? "Create Account"
                      : "Welcome Back"}
                  </h1>

                  <p className="auth-subtitle">
                    {mode === "register"
                      ? "Create your AURACAMP account and start earning."
                      : "Login to continue your earning journey."}
                  </p>

                  {message && (
                    <div
                      className={`message ${
                        error
                          ? "error"
                          : "success"
                      }`}
                    >
                      {message}
                    </div>
                  )}

                  <form onSubmit={submit}>

                    {/* NAME */}

                    {mode === "register" && (
                      <div className="field">
                        <label className="field-label">
                          Full Name
                        </label>

                        <div className="input-wrap">
                          <span className="input-icon">
                            •
                          </span>

                          <input
                            className="input"
                            type="text"
                            value={name}
                            onChange={(e) =>
                              setName(
                                e.target.value
                              )
                            }
                            placeholder="Enter your full name"
                            autoComplete="name"
                            disabled={busy}
                          />
                        </div>
                      </div>
                    )}

                    {/* EMAIL */}

                    <div className="field">
                      <label className="field-label">
                        Email Address
                      </label>

                      <div className="input-wrap">
                        <span className="input-icon">
                          @
                        </span>

                        <input
                          className="input"
                          type="email"
                          value={email}
                          onChange={(e) =>
                            setEmail(
                              e.target.value
                            )
                          }
                          placeholder="Enter your email"
                          autoComplete="email"
                          disabled={busy}
                        />
                      </div>
                    </div>

                    {/* PASSWORD */}

                    <div className="field">
                      <label className="field-label">
                        Password
                      </label>

                      <div className="input-wrap">
                        <span className="input-icon">
                          •
                        </span>

                        <input
                          className="input"
                          type={
                            showPassword
                              ? "text"
                              : "password"
                          }
                          value={password}
                          onChange={(e) =>
                            setPassword(
                              e.target.value
                            )
                          }
                          placeholder="Enter your password"
                          autoComplete={
                            mode === "register"
                              ? "new-password"
                              : "current-password"
                          }
                          disabled={busy}
                        />

                        <button
                          className="password-toggle"
                          type="button"
                          onClick={() =>
                            setShowPassword(
                              !showPassword
                            )
                          }
                          disabled={busy}
                          aria-label={
                            showPassword
                              ? "Hide password"
                              : "Show password"
                          }
                        >
                          {showPassword
                            ? "●"
                            : "○"}
                        </button>
                      </div>
                    </div>

                    {/* CONFIRM PASSWORD */}

                    {mode === "register" && (
                      <div className="field">
                        <label className="field-label">
                          Confirm Password
                        </label>

                        <div className="input-wrap">
                          <span className="input-icon">
                            •
                          </span>

                          <input
                            className="input"
                            type={
                              showConfirmPassword
                                ? "text"
                                : "password"
                            }
                            value={
                              confirmPassword
                            }
                            onChange={(e) =>
                              setConfirmPassword(
                                e.target.value
                              )
                            }
                            placeholder="Confirm your password"
                            autoComplete="new-password"
                            disabled={busy}
                          />

                          <button
                            className="password-toggle"
                            type="button"
                            onClick={() =>
                              setShowConfirmPassword(
                                !showConfirmPassword
                              )
                            }
                            disabled={busy}
                          >
                            {showConfirmPassword
                              ? "●"
                              : "○"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* FORGOT */}

                    {mode === "login" && (
                      <div className="forgot-row">
                        <button
                          type="button"
                          className="link-button"
                          onClick={() =>
                            switchMode(
                              "forgot"
                            )
                          }
                          disabled={busy}
                        >
                          Forgot Password?
                        </button>
                      </div>
                    )}

                    {/* SUBMIT */}

                    <button
                      className="primary-button"
                      type="submit"
                      disabled={busy}
                    >
                      {loading
                        ? "Please wait..."
                        : mode === "register"
                        ? "Create Account →"
                        : "Login →"}
                    </button>
                  </form>

                  {/* DIVIDER */}

                  <div className="divider">
                    <div className="divider-line" />

                    <span className="divider-text">
                      OR
                    </span>

                    <div className="divider-line" />
                  </div>

                  {/* GOOGLE */}

                  <button
                    className="google-button"
                    type="button"
                    onClick={googleLogin}
                    disabled={busy}
                  >
                    <span className="google-icon">
                      G
                    </span>

                    {googleLoading
                      ? "Connecting..."
                      : "Continue with Google"}
                  </button>

                  {/* SWITCH */}

                  <div className="switch-text">
                    {mode === "register"
                      ? "Already have an account?"
                      : "Don't have an account?"}

                    <button
                      type="button"
                      onClick={() =>
                        switchMode(
                          mode === "register"
                            ? "login"
                            : "register"
                        )
                      }
                      disabled={busy}
                    >
                      {mode === "register"
                        ? "Login"
                        : "Create Account"}
                    </button>
                  </div>

                  {/* TERMS */}

                  <div className="legal">
                    By continuing, you agree to our{" "}
                    <a href="/terms">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="/privacy">
                      Privacy Policy
                    </a>
                    .
                  </div>

                  {/* SECURITY */}

                  <div className="security">
                    Secure Login
                    <span>•</span>
                    Fast & Easy
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
