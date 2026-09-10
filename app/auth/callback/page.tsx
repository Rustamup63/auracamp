"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function AuthCallback() {
  const router = useRouter();
  const [message, setMessage] = useState("Signing you in...");

  useEffect(() => {
    async function completeLogin() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (!code) {
        setMessage("Authentication code missing.");
        return;
      }

      const { error } =
        await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error(error);
        setMessage("Login failed. Please try again.");
        return;
      }

      const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  router.replace("/");
  return;
}

const { data: admin } = await supabase
  .from("admin_users")
  .select("id, role, is_active")
  .eq("id", user.id)
  .eq("is_active", true)
  .maybeSingle();

if (admin) {
  setMessage("Admin login successful. Opening Admin Panel...");

  setTimeout(() => {
    router.replace("/admin");
  }, 500);
} else {
  setMessage("Login successful. Opening AURACAMP...");

  setTimeout(() => {
    router.replace("/");
  }, 500);
}
    }

    completeLogin();
  }, [router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f6f7fb",
        fontFamily: "Arial, sans-serif",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: 35,
          borderRadius: 20,
          textAlign: "center",
          maxWidth: 380,
          width: "100%",
          boxShadow: "0 10px 35px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ marginBottom: 10 }}>AURACAMP</h1>
        <p style={{ color: "#666" }}>{message}</p>
      </div>
    </main>
  );
}
