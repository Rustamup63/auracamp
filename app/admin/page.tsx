"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type Campaign = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  landing_url: string | null;
  reward: number;
  advertiser_payout: number;
  conversion_type: string | null;
  terms: string | null;
  daily_limit: number | null;
  total_limit: number | null;
  conversions_count: number;
  status: "draft" | "active" | "paused" | "ended";
  created_at: string;
};

type Withdrawal = {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  account_name: string | null;
  upi_id: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  status: string;
  admin_note: string | null;
  rejection_reason: string | null;
  created_at: string;
};

type AdminUser = {
  id: string;
  role: string;
  is_active: boolean;
};

type CampaignForm = {
  name: string;
  description: string;
  category: string;
  image_url: string;
  landing_url: string;
  reward: string;
  advertiser_payout: string;
  conversion_type: string;
  terms: string;
  daily_limit: string;
  total_limit: string;
};

const emptyCampaignForm: CampaignForm = {
  name: "",
  description: "",
  category: "Other",
  image_url: "",
  landing_url: "",
  reward: "",
  advertiser_payout: "",
  conversion_type: "Complete Offer",
  terms: "",
  daily_limit: "",
  total_limit: "",
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCampaignForm, setShowCampaignForm] =
    useState(false);

  const [editingCampaign, setEditingCampaign] =
    useState<Campaign | null>(null);

  const [campaignForm, setCampaignForm] =
    useState<CampaignForm>(emptyCampaignForm);

  const [savingCampaign, setSavingCampaign] =
    useState(false);

  const [withdrawals, setWithdrawals] =
    useState<Withdrawal[]>([]);

  const [selectedWithdrawal, setSelectedWithdrawal] =
    useState<Withdrawal | null>(null);

  const [withdrawalAction, setWithdrawalAction] =
    useState<"approve" | "reject" | null>(null);

  const [adminNote, setAdminNote] = useState("");

  const [processingWithdrawal, setProcessingWithdrawal] =
    useState(false);

  const [withdrawalLoading, setWithdrawalLoading] =
    useState(false);

  const [message, setMessage] = useState("");
  const [notification, setNotification] = useState("");

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: adminData, error } =
        await supabase
          .from("admin_users")
          .select("id, role, is_active")
          .eq("id", user.id)
          .eq("is_active", true)
          .maybeSingle();

      if (error || !adminData) {
        setAuthorized(false);
        return;
      }

      setAdmin(adminData);
      setAuthorized(true);

      await Promise.all([
        loadCampaigns(),
        loadWithdrawals(),
      ]);
    } catch (error) {
      console.error("Admin check error:", error);
      setAuthorized(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadCampaigns() {
    const { data, error } = await supabase
      .from("campaigns")
      .select(`
        id,
        name,
        slug,
        description,
        category,
        image_url,
        landing_url,
        reward,
        advertiser_payout,
        conversion_type,
        terms,
        daily_limit,
        total_limit,
        conversions_count,
        status,
        created_at
      `)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Campaign loading error:",
        error
      );
      return;
    }

    setCampaigns(
      (data as Campaign[]) || []
    );
  }

  async function loadWithdrawals() {
    setWithdrawalLoading(true);

    const { data, error } = await supabase
      .from("withdrawals")
      .select(`
        id,
        user_id,
        amount,
        method,
        account_name,
        upi_id,
        bank_name,
        account_number,
        ifsc_code,
        status,
        admin_note,
        rejection_reason,
        created_at
      `)
      .order("created_at", {
        ascending: false,
      })
      .limit(100);

    if (error) {
      console.error(
        "Withdrawal loading error:",
        error
      );

      setWithdrawalLoading(false);
      return;
    }

    setWithdrawals(
      (data as Withdrawal[]) || []
    );

    setWithdrawalLoading(false);
  }

  useEffect(() => {
    if (!authorized) return;

    const channel = supabase
      .channel("auracamp-withdrawals")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "withdrawals",
        },
        async (payload) => {
          console.log(
            "Realtime withdrawal:",
            payload
          );

          await loadWithdrawals();

          if (payload.eventType === "INSERT") {
            setNotification(
              "🔔 New withdrawal request received!"
            );

            if (
              typeof window !== "undefined" &&
              "Notification" in window
            ) {
              if (
                Notification.permission === "granted"
              ) {
                new Notification(
                  "AURACAMP Withdrawal",
                  {
                    body:
                      "New withdrawal request received.",
                  }
                );
              }
            }

            setTimeout(() => {
              setNotification("");
            }, 5000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authorized]);

  async function enableNotifications() {
    if (
      typeof window === "undefined" ||
      !("Notification" in window)
    ) {
      setNotification(
        "Browser notifications are not supported."
      );
      return;
    }

    const permission =
      await Notification.requestPermission();

    if (permission === "granted") {
      setNotification(
        "🔔 Browser notifications enabled."
      );
    } else {
      setNotification(
        "Notification permission was not granted."
      );
    }

    setTimeout(() => {
      setNotification("");
    }, 4000);
  }

  function updateCampaignForm(
    field: keyof CampaignForm,
    value: string
  ) {
    setCampaignForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function resetCampaignForm() {
    setCampaignForm({
      ...emptyCampaignForm,
    });

    setEditingCampaign(null);
    setShowCampaignForm(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={loadingStyle}>
          Loading AURACAMP Admin...
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main style={pageStyle}>
        <div style={deniedStyle}>
          <div style={lockIcon}>
            🔒
          </div>

          <h1>
            Access Denied
          </h1>

          <p>
            You do not have permission to
            access the AURACAMP Admin Panel.
          </p>

          <button
            onClick={() => {
              window.location.href = "/";
            }}
            style={primaryButton}
          >
            Go Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <header style={headerStyle}>
          <div>
            <div style={brandStyle}>
              AURACAMP
            </div>

            <div style={adminLabel}>
              ADMIN CONTROL PANEL
            </div>
          </div>

          <button
            onClick={logout}
            style={logoutButton}
          >
            Logout
          </button>
        </header>

        <div style={sectionStyle}>
          <h2>
            Admin Panel Setup
          </h2>

          <p>
            Authentication and database
            connection are ready.
          </p>

          <p>
            Campaign and withdrawal controls
            will be added in the next parts.
          </p>
        </div>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f5f7fb",
  color: "#111827",
  padding: "20px 14px",
  fontFamily:
    "Inter, Arial, sans-serif",
};

const containerStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 1200,
  margin: "0 auto",
};

const loadingStyle: React.CSSProperties = {
  minHeight: "80vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  fontWeight: 700,
};

const deniedStyle: React.CSSProperties = {
  maxWidth: 420,
  margin: "100px auto",
  background: "#ffffff",
  borderRadius: 22,
  padding: 35,
  textAlign: "center",
  boxShadow:
    "0 15px 50px rgba(0,0,0,0.08)",
};

const lockIcon: React.CSSProperties = {
  fontSize: 48,
  marginBottom: 15,
};

const headerStyle: React.CSSProperties = {
  background:
    "linear-gradient(135deg,#111827,#312e81)",
  color: "#ffffff",
  borderRadius: 22,
  padding: "22px 20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 15,
  marginBottom: 18,
};

const brandStyle: React.CSSProperties = {
  fontSize: 25,
  fontWeight: 900,
  letterSpacing: 1,
};

const adminLabel: React.CSSProperties = {
  fontSize: 10,
  opacity: 0.7,
  letterSpacing: 1.5,
  marginTop: 4,
};

const logoutButton: React.CSSProperties = {
  border: 0,
  borderRadius: 10,
  padding: "10px 16px",
  background: "#ffffff",
  color: "#111827",
  fontWeight: 800,
  cursor: "pointer",
};

const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 20,
  padding: 22,
  boxShadow:
    "0 8px 30px rgba(0,0,0,0.05)",
};

const primaryButton: React.CSSProperties = {
  border: 0,
  borderRadius: 11,
  padding: "12px 18px",
  background: "#111827",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
};
