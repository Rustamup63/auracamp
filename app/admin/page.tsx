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
  category: string | null;
  reward: number;
  advertiser_payout: number;
  status: string;
  conversions_count: number;
  created_at: string;
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
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
  });

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: admin, error } = await supabase
        .from("admin_users")
        .select("id, role, is_active")
        .eq("id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !admin) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthorized(true);
      await loadCampaigns();
      setLoading(false);
    } catch {
      setAuthorized(false);
      setLoading(false);
    }
  }

  async function loadCampaigns() {
    const { data } = await supabase
      .from("campaigns")
      .select(
        "id,name,category,reward,advertiser_payout,status,conversions_count,created_at"
      )
      .order("created_at", { ascending: false });

    setCampaigns((data as Campaign[]) || []);
  }

  function updateForm(field: string, value: string) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) {
      setMessage("Campaign name required.");
      return;
    }

    if (!form.landing_url.trim()) {
      setMessage("Landing URL required.");
      return;
    }

    const reward = Number(form.reward);
    const payout = Number(form.advertiser_payout);

    if (reward < 0 || payout < 0) {
      setMessage("Reward and payout cannot be negative.");
      return;
    }

    if (reward > payout) {
      setMessage("User reward cannot be higher than advertiser payout.");
      return;
    }

    setSaving(true);
    setMessage("");

    const slug =
      form.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") +
      "-" +
      Date.now();

    const { error } = await supabase.from("campaigns").insert({
      name: form.name.trim(),
      slug,
      description: form.description.trim() || null,
      category: form.category,
      image_url: form.image_url.trim() || null,
      landing_url: form.landing_url.trim(),
      reward,
      advertiser_payout: payout,
      conversion_type: form.conversion_type,
      terms: form.terms.trim() || null,
      daily_limit: form.daily_limit
        ? Number(form.daily_limit)
        : null,
      total_limit: form.total_limit
        ? Number(form.total_limit)
        : null,
      status: "active",
    });

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Campaign created successfully.");

    setForm({
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
    });

    setShowCreate(false);
    await loadCampaigns();
  }

  async function changeCampaignStatus(
    id: string,
    status: "active" | "paused" | "ended"
  ) {
    const { error } = await supabase
      .from("campaigns")
      .update({ status })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadCampaigns();
  }

  async function deleteCampaign(id: string) {
    const confirmed = window.confirm(
      "Delete this campaign permanently?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadCampaigns();
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={loadingStyle}>Loading AURACAMP Admin...</div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main style={pageStyle}>
        <div style={deniedStyle}>
          <div style={lockIcon}>🔒</div>
          <h1 style={{ margin: "0 0 8px" }}>Access Denied</h1>
          <p style={{ color: "#666", marginBottom: 20 }}>
            You do not have permission to access the Admin Panel.
          </p>
          <button
            onClick={() => (window.location.href = "/")}
            style={primaryButton}
          >
            Go Home
          </button>
        </div>
      </main>
    );
  }

  const activeCampaigns = campaigns.filter(
    (c) => c.status === "active"
  ).length;

  const totalRewards = campaigns.reduce(
    (sum, c) => sum + Number(c.reward || 0),
    0
  );

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        {/* HEADER */}
        <header style={headerStyle}>
          <div>
            <div style={brandStyle}>AURACAMP</div>
            <div style={adminLabel}>ADMIN CONTROL PANEL</div>
          </div>

          <button onClick={logout} style={logoutButton}>
            Logout
          </button>
        </header>

        {/* STATS */}
        <section style={statsGrid}>
          <div style={statCard}>
            <span style={statTitle}>Total Campaigns</span>
            <strong style={statNumber}>{campaigns.length}</strong>
          </div>

          <div style={statCard}>
            <span style={statTitle}>Active Campaigns</span>
            <strong style={statNumber}>{activeCampaigns}</strong>
          </div>

          <div style={statCard}>
            <span style={statTitle}>Campaign Rewards</span>
            <strong style={statNumber}>
              ₹{totalRewards.toFixed(2)}
            </strong>
          </div>
        </section>

        {/* CAMPAIGNS */}
        <section style={sectionStyle}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>Campaign Management</h2>
              <p style={sectionDescription}>
                Create and control your own AURACAMP offers.
              </p>
            </div>

            <button
              onClick={() => {
                setMessage("");
                setShowCreate(!showCreate);
              }}
              style={primaryButton}
            >
              {showCreate ? "Close" : "+ Create Campaign"}
            </button>
          </div>

          {message && (
            <div style={messageStyle}>
              {message}
            </div>
          )}

          {/* CREATE CAMPAIGN */}
          {showCreate && (
            <form onSubmit={createCampaign} style={formStyle}>
              <h3 style={formTitle}>Create New Campaign</h3>

              <div style={formGrid}>
                <Input
                  label="Campaign Name *"
                  value={form.name}
                  onChange={(v) => updateForm("name", v)}
                  placeholder="Example: Earn ₹100"
                />

                <Input
                  label="Category"
                  value={form.category}
                  onChange={(v) => updateForm("category", v)}
                  placeholder="Entertainment"
                />

                <Input
                  label="Landing URL *"
                  value={form.landing_url}
                  onChange={(v) =>
                    updateForm("landing_url", v)
                  }
                  placeholder="https://example.com/offer"
                />

                <Input
                  label="Image URL"
                  value={form.image_url}
                  onChange={(v) =>
                    updateForm("image_url", v)
                  }
                  placeholder="https://..."
                />

                <Input
                  label="Advertiser Payout ₹"
                  type="number"
                  value={form.advertiser_payout}
                  onChange={(v) =>
                    updateForm("advertiser_payout", v)
                  }
                  placeholder="100"
                />

                <Input
                  label="User Reward ₹"
                  type="number"
                  value={form.reward}
                  onChange={(v) => updateForm("reward", v)}
                  placeholder="70"
                />

                <Input
                  label="Conversion Type"
                  value={form.conversion_type}
                  onChange={(v) =>
                    updateForm("conversion_type", v)
                  }
                  placeholder="Complete Registration"
                />

                <Input
                  label="Daily Limit"
                  type="number"
                  value={form.daily_limit}
                  onChange={(v) =>
                    updateForm("daily_limit", v)
                  }
                  placeholder="100"
                />

                <Input
                  label="Total Limit"
                  type="number"
                  value={form.total_limit}
                  onChange={(v) =>
                    updateForm("total_limit", v)
                  }
                  placeholder="1000"
                />
              </div>

              <label style={labelStyle}>
                Description
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    updateForm(
                      "description",
                      e.target.value
                    )
                  }
                  placeholder="Describe this campaign..."
                  style={textareaStyle}
                  rows={4}
                />
              </label>

              <label style={labelStyle}>
                Terms & Conditions
                <textarea
                  value={form.terms}
                  onChange={(e) =>
                    updateForm("terms", e.target.value)
                  }
                  placeholder="Campaign rules..."
                  style={textareaStyle}
                  rows={4}
                />
              </label>

              <div style={profitBox}>
                <span>AURACAMP Margin</span>
                <strong>
                  ₹
                  {Math.max(
                    0,
                    Number(form.advertiser_payout || 0) -
                      Number(form.reward || 0)
                  ).toFixed(2)}
                </strong>
              </div>

              <button
                type="submit"
                disabled={saving}
                style={{
                  ...primaryButton,
                  width: "100%",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Creating..." : "Create Campaign"}
              </button>
            </form>
          )}

          {/* CAMPAIGN LIST */}
          <div style={listStyle}>
            {campaigns.length === 0 ? (
              <div style={emptyStyle}>
                <div style={{ fontSize: 40 }}>📦</div>
                <h3>No campaigns yet</h3>
                <p>Create your first campaign from above.</p>
              </div>
            ) : (
              campaigns.map((campaign) => (
                <div key={campaign.id} style={campaignCard}>
                  <div style={{ flex: 1 }}>
                    <div style={campaignTop}>
                      <h3 style={campaignName}>
                        {campaign.name}
                      </h3>

                      <span
                        style={{
                          ...statusBadge,
                          ...(campaign.status === "active"
                            ? activeBadge
                            : campaign.status === "paused"
                            ? pausedBadge
                            : endedBadge),
                        }}
                      >
                        {campaign.status}
                      </span>
                    </div>

                    <div style={campaignMeta}>
                      {campaign.category || "Other"} · Reward ₹
                      {Number(campaign.reward).toFixed(2)} · Payout ₹
                      {Number(
                        campaign.advertiser_payout
                      ).toFixed(2)}
                    </div>

                    <div style={campaignMeta}>
                      Conversions:{" "}
                      {campaign.conversions_count || 0}
                    </div>
                  </div>

                  <div style={actionRow}>
                    {campaign.status === "active" ? (
                      <button
                        onClick={() =>
                          changeCampaignStatus(
                            campaign.id,
                            "paused"
                          )
                        }
                        style={secondaryButton}
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          changeCampaignStatus(
                            campaign.id,
                            "active"
                          )
                        }
                        style={secondaryButton}
                      >
                        Activate
                      </button>
                    )}

                    <button
                      onClick={() =>
                        deleteCampaign(campaign.id)
                      }
                      style={dangerButton}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label style={labelStyle}>
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </label>
  );
}

/* =========================
   STYLES
========================= */

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f6f7fb",
  color: "#111827",
  padding: "24px 16px",
  fontFamily: "Arial, sans-serif",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
};

const loadingStyle: React.CSSProperties = {
  minHeight: "80vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  fontWeight: 600,
};

const deniedStyle: React.CSSProperties = {
  maxWidth: 420,
  margin: "100px auto",
  background: "#fff",
  borderRadius: 20,
  padding: 40,
  textAlign: "center",
  boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
};

const lockIcon: React.CSSProperties = {
  fontSize: 48,
  marginBottom: 16,
};

const headerStyle: React.CSSProperties = {
  background: "#111827",
  color: "#fff",
  borderRadius: 20,
  padding: "22px 24px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 20,
};

const brandStyle: React.CSSProperties = {
  fontSize: 25,
  fontWeight: 800,
  letterSpacing: 1,
};

const adminLabel: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.65,
  marginTop: 4,
  letterSpacing: 1.5,
};

const logoutButton: React.CSSProperties = {
  background: "#fff",
  color: "#111827",
  border: 0,
  borderRadius: 10,
  padding: "10px 16px",
  fontWeight: 700,
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 14,
  marginBottom: 20,
};

const statCard: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 5px 20px rgba(0,0,0,0.04)",
};

const statTitle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#6b7280",
  marginBottom: 8,
};

const statNumber: React.CSSProperties = {
  fontSize: 27,
};

const sectionStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 20,
  padding: 22,
  boxShadow: "0 5px 25px rgba(0,0,0,0.04)",
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  marginBottom: 20,
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
};

const sectionDescription: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#6b7280",
  fontSize: 13,
};

const primaryButton: React.CSSProperties = {
  background: "#111827",
  color: "#fff",
  border: 0,
  borderRadius: 10,
  padding: "12px 18px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  background: "#f3f4f6",
  color: "#111827",
  border: 0,
  borderRadius: 8,
  padding: "8px 12px",
  fontWeight: 600,
  cursor: "pointer",
};

const dangerButton: React.CSSProperties = {
  background: "#fee2e2",
  color: "#b91c1c",
  border: 0,
  borderRadius: 8,
  padding: "8px 12px",
  fontWeight: 600,
  cursor: "pointer",
};

const messageStyle: React.CSSProperties = {
  background: "#f0fdf4",
  color: "#166534",
  padding: 12,
  borderRadius: 10,
  marginBottom: 15,
  fontSize: 14,
};

const formStyle: React.CSSProperties = {
  background: "#f9fafb",
  borderRadius: 16,
  padding: 18,
  marginBottom: 20,
};

const formTitle: React.CSSProperties = {
  marginTop: 0,
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 14,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "12px",
  background: "#fff",
  fontSize: 14,
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical",
};

const profitBox: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  background: "#ecfdf5",
  color: "#065f46",
  padding: 14,
  borderRadius: 10,
  marginBottom: 15,
};

const listStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const campaignCard: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 16,
  display: "flex",
  gap: 15,
  alignItems: "center",
  flexWrap: "wrap",
};

const campaignTop: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const campaignName: React.CSSProperties = {
  margin: 0,
  fontSize: 17,
};

const campaignMeta: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 13,
  marginTop: 6,
};

const statusBadge: React.CSSProperties = {
  borderRadius: 20,
  padding: "4px 9px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
};

const activeBadge: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
};

const pausedBadge: React.CSSProperties = {
  background: "#fef3c7",
  color: "#92400e",
};

const endedBadge: React.CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
};

const emptyStyle: React.CSSProperties = {
  textAlign: "center",
  padding: 50,
  color: "#6b7280",
};
