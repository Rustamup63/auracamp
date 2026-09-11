"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      flowType: "pkce",
    },
  }
);

type Mode = "login" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState<"success" | "error">("error");

  useEffect(() => {
    let active = true;

    async function checkExistingSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (session?.user) {
        window.location.replace("/");
      }
    }

    checkExistingSession();

    return () => {
      active = false;
    };
  }, []);

  function showMessage(
    text: string,
    type: "success" | "error"
  ) {
    setMessage(text);
    setMessageType(type);
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setMessage("");
    setPassword("");

    if (nextMode === "login") {
      setName("");
    }
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (loading) return;

    setMessage("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanEmail) {
      showMessage(
        "Please enter your email address.",
        "error"
      );
      return;
    }

    if (mode === "register" && !cleanName) {
      showMessage(
        "Please enter your full name.",
        "error"
      );
      return;
    }

    if (password.length < 6) {
      showMessage(
        "Password must be at least 6 characters.",
        "error"
      );
      return;
    }

    setLoading(true);

    try {
      /* =========================
         LOGIN
      ========================= */

      if (mode === "login") {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

        if (error) {
          const errorText =
            error.message.toLowerCase();

          if (
            errorText.includes("email not confirmed")
          ) {
            showMessage(
              "Please verify your email before signing in.",
              "error"
            );
          } else if (
            errorText.includes(
              "invalid login credentials"
            )
          ) {
            showMessage(
              "Incorrect email or password.",
              "error"
            );
          } else {
            showMessage(
              error.message,
              "error"
            );
          }

          return;
        }

        if (data.session) {
          window.location.replace("/");
        }

        return;
      }

      /* =========================
         REGISTER
      ========================= */

      const { data, error } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: cleanName,
            },
            emailRedirectTo:
              `${window.location.origin}/auth/callback`,
          },
        });

      if (error) {
        const errorText =
          error.message.toLowerCase();

        if (
          errorText.includes("already registered") ||
          errorText.includes(
            "user already registered"
          )
        ) {
          showMessage(
            "An account with this email already exists. Please sign in.",
            "error"
          );
        } else {
          showMessage(
            error.message,
            "error"
          );
        }

        return;
      }

      /*
       * Email confirmation is enabled.
       * User exists but session is not available.
       */
      if (data.user && !data.session) {
        showMessage(
          "Account created successfully. Please check your email and verify your account.",
          "success"
        );

        return;
      }

      /*
       * Email confirmation disabled.
       */
      if (data.session) {
        window.location.replace("/");
      }
    } catch {
      showMessage(
        "Something went wrong. Please try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     GOOGLE LOGIN
  ========================= */

  async function googleSignIn() {
    if (loading) return;

    setLoading(true);
    setMessage("");

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
        showMessage(
          error.message,
          "error"
        );

        setLoading(false);
      }
    } catch {
      showMessage(
        "Google sign-in failed. Please try again.",
        "error"
      );

      setLoading(false);
    }
  }

  /* =========================
     FORGOT PASSWORD
  ========================= */

  async function forgotPassword() {
    if (loading) return;

    const cleanEmail =
      email.trim().toLowerCase();

    if (!cleanEmail) {
      showMessage(
        "Enter your email address first.",
        "error"
      );
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo:
              `${window.location.origin}/reset-password`,
          }
        );

      if (error) {
        showMessage(
          error.message,
          "error"
        );
        return;
      }

      showMessage(
        "Password reset link has been sent to your email.",
        "success"
      );
    } catch {
      showMessage(
        "Unable to send reset link. Please try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{styles}</style>

      <main className="auth-page">

        <div className="auth-container">

          {/* =================================
              ONLY ONE LOGO
          ================================= */}

          <div className="logo-wrap">
            <img
              src="/aura-camp-logo.png"
              alt="Aura Camp"
              className="logo"
            />
          </div>

          {/* =================================
              AUTH CARD
          ================================= */}

          <section className="auth-card">

            <div className="heading">

              <span className="eyebrow">
                {mode === "login"
                  ? "WELCOME BACK"
                  : "WELCOME TO AURA CAMP"}
              </span>

              {/* Welcome Back removed */}
              <h1>Aura Camp</h1>

              <p>
                {mode === "login"
                  ? "Sign in to continue your earning journey."
                  : "Create your account and start earning rewards."}
              </p>

            </div>

            {/* =================================
                SUCCESS / ERROR MESSAGE
            ================================= */}

            {message && (
              <div
                className={
                  messageType === "success"
                    ? "message success"
                    : "message error"
                }
              >
                <span>
                  {messageType === "success"
                    ? "✓"
                    : "!"}
                </span>

                <div>{message}</div>
              </div>
            )}

            {/* =================================
                FORM
            ================================= */}

            <form onSubmit={handleSubmit}>

              {/* FULL NAME */}

              {mode === "register" && (
                <label>

                  <span>Full Name</span>

                  <div className="input-box">

                    <span className="input-icon">
                      <svg viewBox="0 0 24 24">
                        <circle
                          cx="12"
                          cy="8"
                          r="4"
                        />

                        <path
                          d="M4 21c.8-4 3.5-6 8-6s7.2 2 8 6"
                        />
                      </svg>
                    </span>

                    <input
                      type="text"
                      value={name}
                      placeholder="Enter your full name"
                      onChange={(e) =>
                        setName(e.target.value)
                      }
                      autoComplete="name"
                    />

                  </div>

                </label>
              )}

              {/* EMAIL */}

              <label>

                <span>Email Address</span>

                <div className="input-box">

                  <span className="input-icon">
                    <svg viewBox="0 0 24 24">
                      <rect
                        x="3"
                        y="5"
                        width="18"
                        height="14"
                        rx="2"
                      />

                      <path d="m3 7 9 6 9-6" />
                    </svg>
                  </span>

                  <input
                    type="email"
                    value={email}
                    placeholder="Enter your email"
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    autoComplete="email"
                  />

                </div>

              </label>

              {/* PASSWORD */}

              <label>

                <div className="password-heading">

                  <span>Password</span>

                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={forgotPassword}
                      disabled={loading}
                    >
                      Forgot password?
                    </button>
                  )}

                </div>

                <div className="input-box">

                  <span className="input-icon">
                    <svg viewBox="0 0 24 24">
                      <rect
                        x="5"
                        y="10"
                        width="14"
                        height="10"
                        rx="2"
                      />

                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    </svg>
                  </span>

                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    placeholder="Enter your password"
                    onChange={(e) =>
                      setPassword(
                        e.target.value
                      )
                    }
                    autoComplete={
                      mode === "login"
                        ? "current-password"
                        : "new-password"
                    }
                  />

                  <button
                    type="button"
                    className="show-password"
                    onClick={() =>
                      setShowPassword(
                        (value) => !value
                      )
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >

                    {showPassword ? (
                      <svg viewBox="0 0 24 24">
                        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />

                        <circle
                          cx="12"
                          cy="12"
                          r="2.5"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24">
                        <path d="M3 3l18 18" />

                        <path d="M10.6 6.2A10.5 10.5 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.1 3.8" />

                        <path d="M6.2 6.3C3.5 8.2 2 12 2 12s3.5 6 10 6c1.2 0 2.3-.2 3.2-.5" />
                      </svg>
                    )}

                  </button>

                </div>

              </label>

              {/* SIGN IN / REGISTER */}

              <button
                type="submit"
                className="primary-button"
                disabled={loading}
              >

                <span>
                  {loading
                    ? "Please wait..."
                    : mode === "login"
                    ? "Sign In"
                    : "Create Account"}
                </span>

                {!loading && (
                  <b>→</b>
                )}

              </button>

            </form>

            {/* =================================
                DIVIDER
            ================================= */}

            <div className="divider">

              <span />

              <b>
                or continue with
              </b>

              <span />

            </div>

            {/* =================================
                GOOGLE
            ================================= */}

            <button
              type="button"
              className="google-button"
              onClick={googleSignIn}
              disabled={loading}
            >

              <span className="google-logo">
                G
              </span>

              <span>
                Continue with Google
              </span>

            </button>

            {/* =================================
                SWITCH LOGIN / REGISTER
            ================================= */}

            <div className="switch-account">

              <span>
                {mode === "login"
                  ? "New to Aura Camp?"
                  : "Already have an account?"}
              </span>

              <button
                type="button"
                onClick={() =>
                  switchMode(
                    mode === "login"
                      ? "register"
                      : "login"
                  )
                }
              >
                {mode === "login"
                  ? "Create account"
                  : "Sign in"}
              </button>

            </div>

          </section>

          {/* =================================
              TERMS
          ================================= */}

          <p className="terms">

            By continuing, you agree to our{" "}

            <a href="/terms">
              Terms of Service
            </a>{" "}

            and{" "}

            <a href="/privacy">
              Privacy Policy
            </a>

            .

          </p>

          {/* =================================
              SECURITY
          ================================= */}

          <div className="security">

            <span>
              ✓ Secure Login
            </span>

            <b>•</b>

            <span>
              ⚡ Fast & Easy
            </span>

          </div>

        </div>

      </main>
    </>
  );
}

const styles = `

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  min-height: 100%;
}

body {
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;

  color: #172033;

  background: #edf8f8;
}

button,
input {
  font: inherit;
}

button {
  -webkit-tap-highlight-color: transparent;
}

/* =========================================
   PAGE
========================================= */

.auth-page {
  min-height: 100svh;

  display: flex;
  justify-content: center;

  padding:
    24px 14px 34px;

  background:
    radial-gradient(
      circle at 8% 5%,
      rgba(0,174,153,.12),
      transparent 30%
    ),
    radial-gradient(
      circle at 96% 90%,
      rgba(35,110,220,.10),
      transparent 32%
    ),
    linear-gradient(
      145deg,
      #effbff 0%,
      #f3fcf8 100%
    );
}

/* =========================================
   CONTAINER
========================================= */

.auth-container {
  width: min(470px, 100%);
}

/* =========================================
   SINGLE LOGO
========================================= */

.logo-wrap {
  width: 82px;
  height: 82px;

  margin:
    0 auto 18px;

  display: flex;
  align-items: center;
  justify-content: center;

  overflow: hidden;

  border:
    1px solid
    rgba(215,226,230,.9);

  border-radius: 23px;

  background: #ffffff;

  box-shadow:
    0 13px 32px
    rgba(30,80,90,.10);

  animation:
    logoEnter .6s ease both;
}

.logo {
  width: 75px;
  height: 75px;

  display: block;

  object-fit: contain;
}

/* =========================================
   CARD
========================================= */

.auth-card {
  width: 100%;

  padding:
    29px 27px 25px;

  border:
    1px solid
    rgba(215,226,230,.95);

  border-radius: 28px;

  background:
    rgba(255,255,255,.97);

  box-shadow:
    0 25px 70px
    rgba(24,55,74,.09),

    0 4px 14px
    rgba(24,55,74,.035);

  animation:
    cardEnter .55s ease both;
}

/* =========================================
   HEADING
========================================= */

.heading {
  text-align: center;

  animation:
    headingEnter .65s ease both;
}

.eyebrow {
  display: block;

  margin-bottom: 6px;

  color: #70828c;

  font-size: 9px;

  font-weight: 900;

  letter-spacing: 1.7px;
}

.heading h1 {
  margin: 0;

  color: #172033;

  font-size:
    clamp(32px, 8vw, 40px);

  line-height: 1.08;

  letter-spacing: -1.5px;
}

.heading p {
  max-width: 350px;

  margin:
    9px auto 24px;

  color: #788993;

  font-size: 12px;

  line-height: 1.55;
}

/* =========================================
   MESSAGE
========================================= */

.message {
  display: flex;
  align-items: flex-start;

  gap: 9px;

  margin-bottom: 16px;

  padding:
    11px 12px;

  border-radius: 12px;

  font-size: 11px;

  font-weight: 650;

  line-height: 1.45;

  animation:
    messageEnter .25s ease both;
}

.message > span {
  width: 21px;
  height: 21px;

  flex: 0 0 21px;

  display: grid;
  place-items: center;

  border-radius: 50%;

  font-weight: 900;
}

.message.success {
  color: #087443;

  background: #effdf5;

  border:
    1px solid #bcebd0;
}

.message.success > span {
  background: #d7f8e3;
}

.message.error {
  color: #b42318;

  background: #fff6f5;

  border:
    1px solid #f3c7c3;
}

.message.error > span {
  background: #ffe2df;
}

/* =========================================
   FORM
========================================= */

form {
  display: grid;

  gap: 16px;
}

label {
  display: grid;

  gap: 7px;

  color: #273444;

  font-size: 11px;

  font-weight: 850;
}

/* =========================================
   INPUT
========================================= */

.input-box {
  height: 56px;

  display: flex;

  align-items: center;

  border:
    1px solid #dbe4e8;

  border-radius: 15px;

  background: #fbfdfe;

  transition:
    border-color .18s ease,
    box-shadow .18s ease;
}

.input-box:focus-within {
  border-color: #2aa293;

  box-shadow:
    0 0 0 4px
    rgba(42,162,147,.09);
}

.input-icon {
  width: 44px;

  flex: 0 0 44px;

  display: grid;

  place-items: center;

  color: #8a99a3;
}

.input-icon svg {
  width: 17px;
  height: 17px;

  fill: none;

  stroke: currentColor;

  stroke-width: 1.7;

  stroke-linecap: round;

  stroke-linejoin: round;
}

.input-box input {
  width: 100%;
  height: 100%;

  min-width: 0;

  padding:
    0 9px 0 0;

  border: 0;
  outline: 0;

  background: transparent;

  color: #172033;

  font-size: 13px;
}

.input-box input::placeholder {
  color: #a0adb6;
}

/* =========================================
   PASSWORD
========================================= */

.password-heading {
  display: flex;

  align-items: center;

  justify-content: space-between;
}

.password-heading button {
  padding: 0;

  border: 0;

  background: transparent;

  color: #1777b6;

  font-size: 10px;

  font-weight: 850;

  cursor: pointer;
}

.show-password {
  width: 43px;
  height: 100%;

  flex: 0 0 43px;

  display: grid;

  place-items: center;

  padding: 0;

  border: 0;

  background: transparent;

  color: #667783;

  cursor: pointer;
}

.show-password svg {
  width: 19px;
  height: 19px;

  fill: none;

  stroke: currentColor;

  stroke-width: 1.7;

  stroke-linecap: round;

  stroke-linejoin: round;
}

/* =========================================
   PRIMARY BUTTON
========================================= */

.primary-button {
  width: 100%;
  height: 55px;

  display: flex;

  align-items: center;

  justify-content: center;

  gap: 9px;

  margin-top: 2px;

  border: 0;

  border-radius: 15px;

  color: white;

  background:
    linear-gradient(
      135deg,
      #142b3d,
      #1d3c4d
    );

  box-shadow:
    0 11px 24px
    rgba(21,48,65,.16);

  font-size: 13px;

  font-weight: 850;

  cursor: pointer;

  transition:
    transform .18s ease,
    box-shadow .18s ease;
}

.primary-button:hover {
  transform:
    translateY(-1px);

  box-shadow:
    0 15px 28px
    rgba(21,48,65,.20);
}

.primary-button:active {
  transform:
    translateY(0);
}

.primary-button:disabled {
  opacity: .58;

  cursor: wait;

  transform: none;
}

.primary-button b {
  font-size: 17px;
}

/* =========================================
   DIVIDER
========================================= */

.divider {
  display: flex;

  align-items: center;

  gap: 10px;

  margin:
    21px 0 14px;
}

.divider span {
  height: 1px;

  flex: 1;

  background: #e5eaed;
}

.divider b {
  color: #8b98a1;

  font-size: 9px;

  font-weight: 700;

  white-space: nowrap;
}

/* =========================================
   GOOGLE
========================================= */

.google-button {
  width: 100%;
  height: 55px;

  display: flex;

  align-items: center;

  justify-content: center;

  gap: 10px;

  border:
    1px solid #dbe3e7;

  border-radius: 15px;

  background: #ffffff;

  color: #172033;

  font-size: 12px;

  font-weight: 800;

  cursor: pointer;

  transition:
    background .18s ease,
    box-shadow .18s ease,
    transform .18s ease;
}

.google-button:hover {
  background: #fbfcfc;

  box-shadow:
    0 7px 18px
    rgba(20,40,60,.06);

  transform:
    translateY(-1px);
}

.google-button:disabled {
  opacity: .58;

  cursor: wait;
}

.google-logo {
  width: 30px;
  height: 30px;

  display: grid;

  place-items: center;

  border:
    1px solid #e1e6e9;

  border-radius: 50%;

  color: #4285f4;

  background: white;

  font-size: 17px;

  font-weight: 900;
}

/* =========================================
   SWITCH ACCOUNT
========================================= */

.switch-account {
  display: flex;

  align-items: center;

  justify-content: center;

  gap: 5px;

  margin-top: 20px;

  color: #788792;

  font-size: 12px;
}

.switch-account button {
  padding: 0;

  border: 0;

  background: transparent;

  color: #1777b6;

  font-size: 14px;

  font-weight: 850;

  cursor: pointer;
}

/* =========================================
   TERMS
========================================= */

.terms {
  max-width: 400px;

  margin:
    17px auto 0;

  color: #89959e;

  text-align: center;

  font-size: 9px;

  line-height: 1.65;
}

.terms a {
  color: #1777b6;

  font-weight: 750;
}

/* =========================================
   SECURITY
========================================= */

.security {
  display: flex;

  align-items: center;

  justify-content: center;

  gap: 8px;

  margin-top: 15px;

  color: #8c989f;

  font-size: 8px;

  font-weight: 700;
}

.security b {
  color: #c1c9ce;
}

/* =========================================
   ANIMATIONS
========================================= */

@keyframes logoEnter {
  from {
    opacity: 0;

    transform:
      translateY(-10px)
      scale(.94);
  }

  to {
    opacity: 1;

    transform:
      translateY(0)
      scale(1);
  }
}

@keyframes cardEnter {
  from {
    opacity: 0;

    transform:
      translateY(12px);
  }

  to {
    opacity: 1;

    transform:
      translateY(0);
  }
}

@keyframes headingEnter {
  from {
    opacity: 0;

    transform:
      translateY(6px);
  }

  to {
    opacity: 1;

    transform:
      translateY(0);
  }
}

@keyframes messageEnter {
  from {
    opacity: 0;

    transform:
      translateY(-4px);
  }

  to {
    opacity: 1;

    transform:
      translateY(0);
  }
}

/* =========================================
   MOBILE
========================================= */

@media (max-width: 430px) {

  .auth-page {
    padding:
      17px 12px 27px;
  }

  .logo-wrap {
    width: 72px;
    height: 72px;

    margin-bottom: 15px;
  }

  .logo {
    width: 66px;
    height: 66px;
  }

  .auth-card {
    padding:
      25px 18px 22px;

    border-radius: 24px;
  }

  .heading h1 {
    font-size: 32px;
  }

  .heading p {
    margin-bottom: 21px;
  }

  .input-box,
  .primary-button,
  .google-button {
    height: 54px;
  }

  .switch-account {
    font-size: 12px;
  }

  .switch-account button {
    font-size: 14px;
  }
}

/* =========================================
   SMALL PHONES
========================================= */

@media (max-width: 350px) {

  .auth-card {
    padding-left: 15px;
    padding-right: 15px;
  }

  .logo-wrap {
    width: 68px;
    height: 68px;
  }

  .logo {
    width: 62px;
    height: 62px;
  }
}

/* =========================================
   DESKTOP
========================================= */

@media (min-width: 700px) {

  .auth-page {
    align-items: center;

    padding:
      35px 20px;
  }

  .auth-card {
    padding:
      31px 35px 28px;
  }
}

`;
