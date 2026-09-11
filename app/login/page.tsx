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
    checkExistingSession();
  }, []);

  async function checkExistingSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      window.location.replace("/");
    }
  }

  function notify(
    text: string,
    type: "success" | "error"
  ) {
    setMessage(text);
    setMessageType(type);
  }

  function switchMode() {
    setMode((current) =>
      current === "login" ? "register" : "login"
    );

    setMessage("");
    setName("");
    setPassword("");
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setMessage("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanEmail) {
      notify(
        "Please enter your email address.",
        "error"
      );
      return;
    }

    if (
      mode === "register" &&
      !cleanName
    ) {
      notify(
        "Please enter your full name.",
        "error"
      );
      return;
    }

    if (password.length < 6) {
      notify(
        "Password must be at least 6 characters.",
        "error"
      );
      return;
    }

    setLoading(true);

    try {
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
            errorText.includes(
              "email not confirmed"
            )
          ) {
            notify(
              "Please verify your email before signing in.",
              "error"
            );
          } else if (
            errorText.includes(
              "invalid login credentials"
            )
          ) {
            notify(
              "Incorrect email or password.",
              "error"
            );
          } else {
            notify(
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

      /*
       * REGISTER
       */
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
          errorText.includes(
            "already registered"
          ) ||
          errorText.includes(
            "user already registered"
          )
        ) {
          notify(
            "An account with this email already exists. Please sign in.",
            "error"
          );
        } else {
          notify(
            error.message,
            "error"
          );
        }

        return;
      }

      /*
       * EMAIL CONFIRMATION ENABLED
       *
       * Supabase gives user but no session.
       */
      if (data.user && !data.session) {
        notify(
          "Account created successfully. Please check your email and verify your account.",
          "success"
        );

        return;
      }

      /*
       * EMAIL CONFIRMATION DISABLED
       */
      if (data.session) {
        window.location.replace("/");
      }
    } catch (error) {
      console.error(error);

      notify(
        "Something went wrong. Please try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogle() {
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
        notify(
          error.message,
          "error"
        );
        setLoading(false);
      }
    } catch {
      notify(
        "Google sign-in failed. Please try again.",
        "error"
      );

      setLoading(false);
    }
  }

  async function forgotPassword() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      notify(
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
        notify(
          error.message,
          "error"
        );
        return;
      }

      notify(
        "Password reset link has been sent to your email.",
        "success"
      );
    } catch {
      notify(
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

          {/* BRAND */}
          <div className="brand">
            <img
              src="/aura-camp-logo.png"
              alt="Aura Camp"
            />
          </div>

          {/* AUTH CARD */}
          <section className="auth-card">

            {/* LOGO */}
            <div className="logo-box">
              <img
                src="/aura-camp-logo.png"
                alt="Aura Camp"
              />
            </div>

            {/* HEADING */}
            <div className="heading">

              <span className="eyebrow">
                {mode === "login"
                  ? "WELCOME BACK"
                  : "JOIN AURA CAMP"}
              </span>

              <h1>
                {mode === "login"
                  ? "Welcome Back"
                  : "Create Account"}
              </h1>

              <p>
                {mode === "login"
                  ? "Sign in to continue your earning journey."
                  : "Create your account and start earning rewards."}
              </p>

            </div>

            {/* MESSAGE */}
            {message && (
              <div
                className={`message ${
                  messageType === "success"
                    ? "message-success"
                    : "message-error"
                }`}
              >
                <span>
                  {messageType === "success"
                    ? "✓"
                    : "!"}
                </span>

                <div>{message}</div>
              </div>
            )}

            {/* FORM */}
            <form onSubmit={handleSubmit}>

              {mode === "register" && (
                <label>
                  Full Name

                  <div className="input-box">
                    <span className="input-icon">
                      <svg
                        viewBox="0 0 24 24"
                      >
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
                        setName(
                          e.target.value
                        )
                      }
                      autoComplete="name"
                    />
                  </div>
                </label>
              )}

              <label>
                Email Address

                <div className="input-box">
                  <span className="input-icon">
                    <svg
                      viewBox="0 0 24 24"
                    >
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
                      setEmail(
                        e.target.value
                      )
                    }
                    autoComplete="email"
                  />
                </div>
              </label>

              <label>

                <div className="password-heading">
                  <span>Password</span>

                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={
                        forgotPassword
                      }
                    >
                      Forgot password?
                    </button>
                  )}
                </div>

                <div className="input-box">
                  <span className="input-icon">
                    <svg
                      viewBox="0 0 24 24"
                    >
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
                      <svg
                        viewBox="0 0 24 24"
                      >
                        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                        <circle
                          cx="12"
                          cy="12"
                          r="2.5"
                        />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                      >
                        <path d="M3 3l18 18" />
                        <path d="M10.6 6.2A10.5 10.5 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.1 3.8" />
                        <path d="M6.2 6.3C3.5 8.2 2 12 2 12s3.5 6 10 6c1.2 0 2.3-.2 3.2-.5" />
                      </svg>
                    )}
                  </button>
                </div>
              </label>

              {/* LOGIN / REGISTER */}
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

            {/* DIVIDER */}
            <div className="divider">
              <span />
              <b>or continue with</b>
              <span />
            </div>

            {/* GOOGLE */}
            <button
              type="button"
              className="google-button"
              onClick={
                continueWithGoogle
              }
              disabled={loading}
            >
              <span className="google-logo">
                G
              </span>

              <span>
                Continue with Google
              </span>
            </button>

            {/* SWITCH */}
            <div className="switch-account">

              <span>
                {mode === "login"
                  ? "New to Aura Camp?"
                  : "Already have an account?"}
              </span>

              <button
                type="button"
                onClick={
                  switchMode
                }
              >
                {mode === "login"
                  ? "Create account"
                  : "Sign in"}
              </button>

            </div>

          </section>

          {/* TERMS */}
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

          {/* SECURITY */}
          <div className="security">

            <span>
              <i>✓</i>
              Secure Login
            </span>

            <b>•</b>

            <span>
              <i>⚡</i>
              Fast & Easy
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

  background: #eef9f8;
  color: #172033;
}

button,
input {
  font: inherit;
}

button {
  -webkit-tap-highlight-color: transparent;
}

.auth-page {
  min-height: 100svh;

  display: flex;
  justify-content: center;

  padding:
    26px 16px 35px;

  background:
    radial-gradient(
      circle at 8% 5%,
      rgba(0, 174, 153, .12),
      transparent 30%
    ),
    radial-gradient(
      circle at 95% 85%,
      rgba(40, 110, 220, .10),
      transparent 32%
    ),
    linear-gradient(
      145deg,
      #effbff 0%,
      #f4fcf8 100%
    );
}

.auth-container {
  width: min(470px, 100%);
}

.brand {
  display: flex;
  justify-content: center;
  align-items: center;

  margin-bottom: 17px;
}

.brand img {
  width: 190px;
  height: 70px;
  object-fit: contain;
  display: block;
}

.auth-card {
  width: 100%;

  padding:
    27px 27px 25px;

  border:
    1px solid rgba(215, 226, 230, .95);

  border-radius: 27px;

  background:
    rgba(255,255,255,.96);

  box-shadow:
    0 25px 70px rgba(24,55,74,.09),
    0 4px 14px rgba(24,55,74,.035);
}

.logo-box {
  width: 66px;
  height: 66px;

  margin: 0 auto 15px;

  display: grid;
  place-items: center;

  overflow: hidden;

  border:
    1px solid #edf1f2;

  border-radius: 20px;

  background: white;

  box-shadow:
    0 10px 28px rgba(25,60,75,.09);
}

.logo-box img {
  width: 59px;
  height: 59px;
  object-fit: contain;
}

.heading {
  text-align: center;
}

.eyebrow {
  display: block;

  margin-bottom: 5px;

  color: #70818b;

  font-size: 9px;
  font-weight: 900;

  letter-spacing: 1.7px;
}

.heading h1 {
  margin: 0;

  color: #172033;

  font-size:
    clamp(30px, 8vw, 39px);

  line-height: 1.08;

  letter-spacing: -1.5px;
}

.heading p {
  margin:
    9px auto 23px;

  max-width: 340px;

  color: #788893;

  font-size: 12px;

  line-height: 1.55;
}

.message {
  display: flex;
  align-items: flex-start;

  gap: 9px;

  margin-bottom: 16px;
  padding: 11px 12px;

  border-radius: 12px;

  font-size: 11px;
  font-weight: 650;

  line-height: 1.45;
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

.message-success {
  color: #087443;
  background: #effdf5;
  border: 1px solid #bcebd0;
}

.message-success > span {
  background: #d7f8e3;
}

.message-error {
  color: #b42318;
  background: #fff6f5;
  border: 1px solid #f3c7c3;
}

.message-error > span {
  background: #ffe2df;
}

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

.input-box {
  height: 56px;

  display: flex;
  align-items: center;

  border:
    1px solid #dbe4e8;

  border-radius: 15px;

  background: #fbfdfe;

  transition:
    border-color .15s ease,
    box-shadow .15s ease;
}

.input-box:focus-within {
  border-color: #2aa293;

  box-shadow:
    0 0 0 4px
    rgba(42,162,147,.09);
}

.input-icon {
  width: 44px;

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
    0 11px 0 0;

  border: 0;
  outline: 0;

  background: transparent;

  color: #172033;

  font-size: 13px;
}

.input-box input::placeholder {
  color: #a0adb6;
}

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

  display: grid;
  place-items: center;

  flex: 0 0 43px;

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
    transform .15s ease,
    box-shadow .15s ease;
}

.primary-button:hover {
  transform: translateY(-1px);

  box-shadow:
    0 14px 28px
    rgba(21,48,65,.20);
}

.primary-button:disabled {
  opacity: .58;
  cursor: wait;
  transform: none;
}

.primary-button b {
  font-size: 17px;
}

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

  background: white;

  color: #172033;

  font-size: 12px;
  font-weight: 800;

  cursor: pointer;

  transition:
    background .15s ease,
    box-shadow .15s ease;
}

.google-button:hover {
  background: #fbfcfc;

  box-shadow:
    0 7px 18px
    rgba(20,40,60,.06);
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

.switch-account {
  display: flex;
  align-items: center;
  justify-content: center;

  gap: 4px;

  margin-top: 19px;

  color: #788792;

  font-size: 11px;
}

.switch-account button {
  padding: 0;

  border: 0;

  background: transparent;

  color: #1777b6;

  font-weight: 850;

  cursor: pointer;
}

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

.security i {
  font-style: normal;
}

.security b {
  color: #c1c9ce;
}

@media (min-width: 700px) {

  .auth-page {
    align-items: center;
    padding: 35px 20px;
  }

  .auth-card {
    padding:
      31px 35px 28px;
  }
}

@media (max-width: 430px) {

  .auth-page {
    padding:
      18px 12px 27px;
  }

  .brand img {
    width: 180px;
    height: 65px;
  }

  .auth-card {
    padding:
      25px 18px 22px;

    border-radius: 24px;
  }

  .logo-box {
    width: 61px;
    height: 61px;
  }

  .logo-box img {
    width: 54px;
    height: 54px;
  }

  .heading h1 {
    font-size: 31px;
  }

  .heading p {
    margin-bottom: 21px;
  }

  .input-box,
  .primary-button,
  .google-button {
    height: 54px;
  }
}

@media (max-width: 350px) {

  .auth-card {
    padding-left: 15px;
    padding-right: 15px;
  }

  .brand img {
    width: 165px;
  }
}

`;
