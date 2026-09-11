"use client";

import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

export default function AuthCallback() {
  useEffect(() => {
    let mounted = true;

    async function handleCallback() {
      try {
        const params =
          new URLSearchParams(
            window.location.search
          );

        const code =
          params.get("code");

        if (code) {
          const { error } =
            await supabase.auth.exchangeCodeForSession(
              code
            );

          if (error) {
            console.error(
              "Auth callback error:",
              error
            );

            if (mounted) {
              window.location.replace(
                "/login"
              );
            }

            return;
          }
        }

        const {
          data: { session },
        } =
          await supabase.auth.getSession();

        if (!session) {
          window.location.replace(
            "/login"
          );
          return;
        }

        /*
         * IMPORTANT:
         * Always enter the same AURA CAMP
         * mobile-app shell after login.
         */
        window.location.replace("/");
      } catch (error) {
        console.error(
          "Callback error:",
          error
        );

        if (mounted) {
          window.location.replace(
            "/login"
          );
        }
      }
    }

    handleCallback();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(145deg,#f1fbfc,#f7fbff,#faf7ff)",
        fontFamily:
          "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "280px",
          padding: "28px",
          borderRadius: "24px",
          background: "#fff",
          textAlign: "center",
          boxShadow:
            "0 20px 60px rgba(30,64,175,.10)",
        }}
      >
        <div
          style={{
            fontSize: "24px",
            fontWeight: 900,
            marginBottom: "16px",
          }}
        >
          <span
            style={{
              color: "#111827",
            }}
          >
            AURA
          </span>{" "}
          <span
            style={{
              color: "#16a34a",
            }}
          >
            CAMP
          </span>
        </div>

        <div
          style={{
            width: "30px",
            height: "30px",
            margin: "0 auto 13px",
            border:
              "3px solid #e5e7eb",
            borderTopColor:
              "#155eef",
            borderRightColor:
              "#16a34a",
            borderRadius: "50%",
            animation:
              "spin .7s linear infinite",
          }}
        />

        <p
          style={{
            margin: 0,
            color: "#71808a",
            fontSize: "11px",
          }}
        >
          Opening Aura Camp...
        </p>
      </div>

      <style>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}
