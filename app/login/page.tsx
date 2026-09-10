"use client";

import { useEffect, useState } from "react";
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

type Mode = "login" | "register" | "forgot" | "reset";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("mode") === "reset") {
      setMode("reset");
    }

    checkExistingSession();
  }, []);

  async function checkExistingSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session && !window.location.search.includes("mode=reset")) {
      window.location.href = "/";
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
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
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
      setMessage("Password must contain at least 6 characters.");
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
          "Account created. Please check your email to verify your account."
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

        window.location.href = "/";
        return;
      }
    } catch (err: unknown) {
      setError(true);

      const text =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";

      setMessage(getFriendlyError(text));
    } finally {
      setLoading(false);
    }
  }

  async function googleLogin() {
    clearMessage();
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
      setMessage(getFriendlyError(googleError.message));
      setError(true);
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
        err instanceof Error
          ? getFriendlyError(err.message)
          : "Unable to send reset link."
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
        window.location.href = "/";
      }, 900);
    } catch (err: unknown) {
      setError(true);

      setMessage(
        err instanceof Error
          ? getFriendlyError(err.message)
          : "Unable to update password."
      );
    } finally {
      setLoading(false);
    }
  }

  const isBusy = loading || googleLoading;

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
          background: #f7f9fc;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        button,
        input {
          font: inherit;
        }

        button {
          -webkit-tap-highlight-color: transparent;
        }

        input::placeholder {
          color: #9aa6b8;
        }

        .auth-page {
          min-height: 100svh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px 18px;
          overflow-x: hidden;
          background:
            radial-gradient(
              circle at 12% 10%,
              rgba(79, 70, 229, 0.08),
              transparent 28%
            ),
            radial-gradient(
              circle at 90% 88%,
              rgba(37, 99, 235, 0.08),
              transparent 30%
            ),
            #f7f9fc;
        }

        .auth-shell {
          width: min(1040px, 100%);
          min-height: 650px;
          display: grid;
          grid-template-columns: 1fr 430px;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid #e6eaf1;
          border-radius: 30px;
          overflow: hidden;
          box-shadow:
            0 30px 80px rgba(15, 23, 42, 0.10),
            0 8px 25px rgba(37, 99, 235, 0.05);
        }

        .brand-panel {
          position: relative;
          overflow: hidden;
          padding: 52px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background:
            linear-gradient(
              145deg,
              #f4f7ff 0%,
              #eef3ff 52%,
              #f9f8ff 100%
            );
        }

        .brand-panel::before {
          content: "";
          position: absolute;
          width: 330px;
          height: 330px;
          border-radius: 50%;
          background: rgba(99, 102, 241, 0.08);
          top: -150px;
          right: -120px;
          filter: blur(4px);
        }

        .brand-panel::after {
          content: "";
          position: absolute;
          width: 250px;
          height: 250px;
          border-radius: 50%;
          background: rgba(37, 99, 235, 0.07);
          bottom: -120px;
          left: -100px;
        }

        .brand-content,
        .brand-bottom {
          position: relative;
          z-index: 2;
        }

        .brand-logo {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .logo-mark {
          width: 48px;
          height: 48px;
          border-radius: 15px;
          display: grid;
          place-items: center;
          color: white;
          font-size: 24px;
          font-weight: 900;
          background:
            linear-gradient(
              145deg,
              #2563eb,
              #4f46e5 58%,
              #7c3aed
            );
          box-shadow:
            0 12px 24px rgba(37, 99, 235, 0.22),
            inset 0 1px 1px rgba(255, 255, 255, 0.55);
          transform: translateY(-1px);
        }

        .brand-name {
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.7px;
          color: #111827;
        }

        .brand-tagline {
          margin-top: 2px;
          color: #718096;
          font-size: 11px;
          letter-spacing: 0.4px;
        }

        .brand-title {
          max-width: 470px;
          margin: 70px 0 16px;
          color: #111827;
          font-size: clamp(38px, 4vw, 58px);
          line-height: 1.03;
          letter-spacing: -2.8px;
          font-weight: 900;
        }

        .brand-title span {
          background:
            linear-gradient(
              90deg,
              #2563eb,
              #4f46e5,
              #7c3aed
            );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .brand-description {
          max-width: 440px;
          margin: 0;
          color: #64748b;
          font-size: 15px;
          line-height: 1.7;
        }

        .benefits {
          display: grid;
          gap: 11px;
          margin-top: 34px;
          max-width: 430px;
        }

        .benefit {
          display: flex;
          align-items: center;
          gap: 12px;
          color: #334155;
          font-size: 13px;
          font-weight: 700;
        }

        .benefit-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: white;
          border: 1px solid #e2e8f0;
          box-shadow: 0 5px 14px rgba(15, 23, 42, 0.05);
          font-size: 14px;
        }

        .brand-bottom {
          color: #94a3b8;
          font-size: 10px;
        }

        .auth-panel {
          padding: 38px 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
        }

        .auth-card {
          width: 100%;
          max-width: 360px;
        }

        .mobile-brand {
          display: none;
        }

        .auth-icon {
          width: 54px;
          height: 54px;
          margin: 0 auto 15px;
          border-radius: 17px;
          display: grid;
          place-items: center;
          color: white;
          font-size: 23px;
          font-weight: 900;
          background:
            linear-gradient(
              145deg,
              #2563eb,
              #4f46e5,
              #7c3aed
            );
          box-shadow:
            0 12px 25px rgba(37, 99, 235, 0.20),
            inset 0 1px 1px rgba(255, 255, 255, 0.5);
        }

        .auth-title {
          margin: 0;
          text-align: center;
          color: #111827;
          font-size: 27px;
          line-height: 1.15;
          letter-spacing: -0.8px;
          font-weight: 900;
        }

        .auth-subtitle {
          margin: 8px auto 23px;
          text-align: center;
          color: #718096;
          font-size: 12px;
          line-height: 1.55;
        }

        .message {
          width: 100%;
          margin-bottom: 15px;
          padding: 11px 12px;
          border-radius: 12px;
          font-size: 11px;
          line-height: 1.45;
        }

        .message.error {
          color: #b42318;
          background: #fff4f2;
          border: 1px solid #ffd2cc;
        }

        .message.success {
          color: #087443;
          background: #effbf5;
          border: 1px solid #b8efd3;
        }

        .field {
          margin-bottom: 14px;
        }

        .field-label {
          display: block;
          margin-bottom: 7px;
          color: #334155;
          font-size: 11px;
          font-weight: 800;
        }

        .input-wrap {
          width: 100%;
          min-height: 50px;
          display: flex;
          align-items: center;
          border: 1px solid #dfe5ee;
          border-radius: 13px;
          background: #f9fafc;
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease,
            background 0.18s ease;
        }

        .input-wrap:focus-within {
          border-color: #7c8ff5;
          background: #fff;
          box-shadow:
            0 0 0 4px rgba(79, 70, 229, 0.07);
        }

        .input-icon {
          width: 42px;
          flex: 0 0 42px;
          display: grid;
          place-items: center;
          color: #64748b;
          font-size: 15px;
        }

        .input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #111827;
          font-size: 13px;
          padding: 14px 5px 14px 0;
        }

        .password-toggle {
          flex: 0 0 42px;
          width: 42px;
          height: 42px;
          border: 0;
          background: transparent;
          color: #64748b;
          cursor: pointer;
          font-size: 15px;
        }

        .forgot-row {
          display: flex;
          justify-content: flex-end;
          margin: -3px 0 15px;
        }

        .link-button {
          border: 0;
          background: transparent;
          padding: 2px;
          color: #3657d6;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .primary-button {
          width: 100%;
          min-height: 51px;
          border: 0;
          border-radius: 13px;
          color: white;
          background:
            linear-gradient(
              100deg,
              #172033,
              #202b40
            );
          box-shadow:
            0 11px 22px rgba(15, 23, 42, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
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
            0 15px 28px rgba(15, 23, 42, 0.18);
        }

        .primary-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .primary-button:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 20px 0 14px;
        }

        .divider-line {
          flex: 1;
          height: 1px;
          background: #e7ebf1;
        }

        .divider-text {
          color: #a0aabd;
          font-size: 9px;
          font-weight: 800;
        }

        .google-button {
          width: 100%;
          min-height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border: 1px solid #dfe5ee;
          border-radius: 13px;
          background: white;
          color: #1f2937;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            transform 0.15s ease;
        }

        .google-button:hover:not(:disabled) {
          border-color: #cbd5e1;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
          transform: translateY(-1px);
        }

        .google-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .google-icon {
          width: 21px;
          height: 21px;
          display: grid;
          place-items: center;
          font-size: 18px;
          font-weight: 900;
          font-family: Arial, sans-serif;
          color: #4285f4;
        }

        .switch-text {
          margin-top: 19px;
          text-align: center;
          color: #718096;
          font-size: 11px;
        }

        .switch-text button {
          margin-left: 5px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #3657d6;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .legal {
          margin-top: 20px;
          color: #9aa6b8;
          text-align: center;
          font-size: 9px;
          line-height: 1.6;
        }

        .legal a {
          color: #5369c9;
          text-decoration: none;
          font-weight: 700;
        }

        .security {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          margin-top: 15px;
          padding-top: 14px;
          border-top: 1px solid #eef1f5;
          color: #9aa6b8;
          font-size: 9px;
        }

        .back-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 18px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        @media (max-width: 820px) {
          .auth-page {
            padding: 14px;
            align-items: flex-start;
          }

          .auth-shell {
            display: block;
            min-height: auto;
            max-width: 500px;
            border-radius: 24px;
          }

          .brand-panel {
            display: none;
          }

          .auth-panel {
            min-height: calc(100svh - 28px);
            padding: 25px 18px 22px;
            align-items: center;
          }

          .mobile-brand {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 9px;
            margin-bottom: 28px;
          }

          .mobile-brand .logo-mark {
            width: 39px;
            height: 39px;
            border-radius: 12px;
            font-size: 19px;
          }

          .mobile-brand-name {
            color: #111827;
            font-size: 18px;
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
            width: 100%;
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

          {/* DESKTOP BRAND PANEL */}
          <section className="brand-panel">
            <div className="brand-content">
              <div className="brand-logo">
                <div className="logo-mark">A</div>

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
                earn rewards and withdraw your earnings
                directly from AURACAMP.
              </p>

              <div className="benefits">
                <div className="benefit">
                  <div className="benefit-icon">✓</div>
                  Secure account authentication
                </div>

                <div className="benefit">
                  <div className="benefit-icon">⚡</div>
                  Fast and simple earning experience
                </div>

                <div className="benefit">
                  <div className="benefit-icon">₹</div>
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

          {/* AUTH PANEL */}
          <section className="auth-panel">
            <div className="auth-card">

              {/* MOBILE BRAND */}
              <div className="mobile-brand">
                <div className="logo-mark">A</div>

                <div className="mobile-brand-name">
                  AURACAMP
                </div>
              </div>

              {/* FORGOT PASSWORD */}
              {mode === "forgot" && (
                <>
                  <button
                    className="back-button"
                    type="button"
                    onClick={() => switchMode("login")}
                  >
                    ← Back to Login
                  </button>

                  <div className="auth-icon">
                    🔐
                  </div>

                  <h1 className="auth-title">
                    Reset Password
                  </h1>

                  <p className="auth-subtitle">
                    Enter your registered email and
                    we&apos;ll send you a secure reset link.
                  </p>

                  {message && (
                    <div
                      className={`message ${
                        error ? "error" : "success"
                      }`}
                    >
                      {message}
                    </div>
                  )}

                  <form onSubmit={sendResetEmail}>
                    <div className="field">
                      <label className="field-label">
                        Email Address
                      </label>

                      <div className="input-wrap">
                        <span className="input-icon">
                          ✉
                        </span>

                        <input
                          className="input"
                          type="email"
                          value={email}
                          onChange={(e) =>
                            setEmail(e.target.value)
                          }
                          placeholder="Enter your email"
                          autoComplete="email"
                          disabled={isBusy}
                        />
                      </div>
                    </div>

                    <button
                      className="primary-button"
                      type="submit"
                      disabled={isBusy}
                    >
                      {loading
                        ? "Sending..."
                        : "Send Reset Link"}
                    </button>
                  </form>

                  <div className="security">
                    🔒 Secure password recovery
                  </div>
                </>
              )}

              {/* RESET PASSWORD */}
              {mode === "reset" && (
                <>
                  <div className="auth-icon">
                    🔑
                  </div>

                  <h1 className="auth-title">
                    Create New Password
                  </h1>

                  <p className="auth-subtitle">
                    Choose a strong new password for
                    your AURACAMP account.
                  </p>

                  {message && (
                    <div
                      className={`message ${
                        error ? "error" : "success"
                      }`}
                    >
                      {message}
                    </div>
                  )}

                  <form onSubmit={updatePassword}>
                    <div className="field">
                      <label className="field-label">
                        New Password
                      </label>

                      <div className="input-wrap">
                        <span className="input-icon">
                          🔒
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
                            setPassword(e.target.value)
                          }
                          placeholder="Enter new password"
                          autoComplete="new-password"
                          disabled={isBusy}
                        />

                        <button
                          className="password-toggle"
                          type="button"
                          onClick={() =>
                            setShowPassword(
                              !showPassword
                            )
                          }
                          disabled={isBusy}
                          aria-label={
                            showPassword
                              ? "Hide password"
                              : "Show password"
                          }
                        >
                          {showPassword ? "◉" : "◌"}
                        </button>
                      </div>
                    </div>

                    <div className="field">
                      <label className="field-label">
                        Confirm New Password
                      </label>

                      <div className="input-wrap">
                        <span className="input-icon">
                          🔐
                        </span>

                        <input
                          className="input"
                          type={
                            showConfirmPassword
                              ? "text"
                              : "password"
                          }
                          value={confirmPassword}
                          onChange={(e) =>
                            setConfirmPassword(
                              e.target.value
                            )
                          }
                          placeholder="Confirm new password"
                          autoComplete="new-password"
                          disabled={isBusy}
                        />

                        <button
                          className="password-toggle"
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(
                              !showConfirmPassword
                            )
                          }
                          disabled={isBusy}
                          aria-label={
                            showConfirmPassword
                              ? "Hide password"
                              : "Show password"
                          }
                        >
                          {showConfirmPassword ? "◉" : "◌"}
                        </button>
                      </div>
                    </div>

                    <button
                      className="primary-button"
                      type="submit"
                      disabled={isBusy}
                    >
                      {loading
                        ? "Updating..."
                        : "Update Password"}
                    </button>
                  </form>

                  <div className="security">
                    🔒 Your password stays private
                  </div>
                </>
              )}

              {/* LOGIN / REGISTER */}
              {(mode === "login" ||
                mode === "register") && (
                <>
                  <div className="auth-icon">
                    {mode === "register" ? "A" : "A"}
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
                        error ? "error" : "success"
                      }`}
                    >
                      {message}
                    </div>
                  )}

                  <form onSubmit={submit}>

                    {/* FULL NAME */}
                    {mode === "register" && (
                      <div className="field">
                        <label className="field-label">
                          Full Name
                        </label>

                        <div className="input-wrap">
                          <span className="input-icon">
                            👤
                          </span>

                          <input
                            className="input"
                            type="text"
                            value={name}
                            onChange={(e) =>
                              setName(e.target.value)
                            }
                            placeholder="Enter your full name"
                            autoComplete="name"
                            disabled={isBusy}
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
                          ✉
                        </span>

                        <input
                          className="input"
                          type="email"
                          value={email}
                          onChange={(e) =>
                            setEmail(e.target.value)
                          }
                          placeholder="Enter your email"
                          autoComplete="email"
                          disabled={isBusy}
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
                          🔒
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
                            setPassword(e.target.value)
                          }
                          placeholder="Enter your password"
                          autoComplete={
                            mode === "register"
                              ? "new-password"
                              : "current-password"
                          }
                          disabled={isBusy}
                        />

                        <button
                          className="password-toggle"
                          type="button"
                          onClick={() =>
                            setShowPassword(
                              !showPassword
                            )
                          }
                          disabled={isBusy}
                          aria-label={
                            showPassword
                              ? "Hide password"
                              : "Show password"
                          }
                        >
                          {showPassword ? "◉" : "◌"}
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
                            🔐
                          </span>

                          <input
                            className="input"
                            type={
                              showConfirmPassword
                                ? "text"
                                : "password"
                            }
                            value={confirmPassword}
                            onChange={(e) =>
                              setConfirmPassword(
                                e.target.value
                              )
                            }
                            placeholder="Confirm your password"
                            autoComplete="new-password"
                            disabled={isBusy}
                          />

                          <button
                            className="password-toggle"
                            type="button"
                            onClick={() =>
                              setShowConfirmPassword(
                                !showConfirmPassword
                              )
                            }
                            disabled={isBusy}
                            aria-label={
                              showConfirmPassword
                                ? "Hide password"
                                : "Show password"
                            }
                          >
                            {showConfirmPassword
                              ? "◉"
                              : "◌"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* FORGOT PASSWORD */}
                    {mode === "login" && (
                      <div className="forgot-row">
                        <button
                          type="button"
                          className="link-button"
                          onClick={() =>
                            switchMode("forgot")
                          }
                          disabled={isBusy}
                        >
                          Forgot Password?
                        </button>
                      </div>
                    )}

                    {/* MAIN BUTTON */}
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={isBusy}
                    >
                      {loading
                        ? "Please wait..."
                        : mode === "register"
                        ? "Create Account  →"
                        : "Login  →"}
                    </button>
                  </form>

                  {/* GOOGLE */}
                  <div className="divider">
                    <div className="divider-line" />
                    <span className="divider-text">
                      OR
                    </span>
                    <div className="divider-line" />
                  </div>

                  <button
                    className="google-button"
                    type="button"
                    onClick={googleLogin}
                    disabled={isBusy}
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
                      disabled={isBusy}
                    >
                      {mode === "register"
                        ? "Login"
                        : "Create Account"}
                    </button>
                  </div>

                  {/* LEGAL */}
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

                  <div className="security">
                    🔒 Secure Login
                    <span>•</span>
                    ⚡ Fast & Easy
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

function getFriendlyError(message: string) {
  const text = message.toLowerCase();

  if (
    text.includes("invalid login credentials") ||
    text.includes("invalid credentials")
  ) {
    return "Incorrect email or password.";
  }

  if (text.includes("user already registered")) {
    return "An account with this email already exists. Please login.";
  }

  if (text.includes("email not confirmed")) {
    return "Please verify your email before logging in.";
  }

  if (text.includes("password should be at least")) {
    return "Password must contain at least 6 characters.";
  }

  if (text.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again.";
  }

  if (text.includes("network")) {
    return "Network error. Please check your internet connection.";
  }

  return message;
}
