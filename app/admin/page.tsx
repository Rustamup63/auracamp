"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { CSSProperties } from "react";

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
  landing_url: string;
  reward: number;
  advertiser_payout: number;
  conversion_type: string | null;
  terms: string | null;
  daily_limit: number | null;
  total_limit: number | null;
  conversions_count: number;
  status: string;
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
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  wallet_balance: number;
  pending_balance: number;
  total_earned: number;
  total_withdrawn: number;
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

const emptyForm: CampaignForm = {
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

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  const [activeTab, setActiveTab] = useState<
    "overview" | "campaigns" | "withdrawals"
  >("overview");

  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [editingCampaign, setEditingCampaign] =
    useState<Campaign | null>(null);

  const [form, setForm] = useState<CampaignForm>(emptyForm);

  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [selectedWithdrawal, setSelectedWithdrawal] =
    useState<Withdrawal | null>(null);

  const [withdrawalAction, setWithdrawalAction] = useState<
    "approve" | "reject" | null
  >(null);

  const [withdrawalNote, setWithdrawalNote] = useState("");

  useEffect(() => {
    checkAdmin();
  }, []);

  useEffect(() => {
    if (!authorized) return;

    const channel = supabase
      .channel("auracamp-admin-withdrawals")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "withdrawals",
        },
        () => {
          loadWithdrawals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authorized]);

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
      .select(
        [
          "id",
          "name",
          "slug",
          "description",
          "category",
          "image_url",
          "landing_url",
          "reward",
          "advertiser_payout",
          "conversion_type",
          "terms",
          "daily_limit",
          "total_limit",
          "conversions_count",
          "status",
          "created_at",
        ].join(",")
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Campaign load error:", error);
      return;
    }

    setCampaigns((data as Campaign[]) || []);
  }

  async function loadWithdrawals() {
    const { data, error } = await supabase
      .from("withdrawals")
      .select(
        [
          "id",
          "user_id",
          "amount",
          "method",
          "account_name",
          "upi_id",
          "bank_name",
          "account_number",
          "ifsc_code",
          "status",
          "admin_note",
          "rejection_reason",
          "processed_by",
          "processed_at",
          "created_at",
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Withdrawal load error:", error);
      return;
    }

    const list = (data as Withdrawal[]) || [];

    setWithdrawals(list);

    const userIds = Array.from(
      new Set(list.map((item) => item.user_id))
    );

    if (userIds.length === 0) {
      setProfiles({});
      return;
    }

    const { data: profileData, error: profileError } =
      await supabase
        .from("profiles")
        .select(
          "id,full_name,email,wallet_balance,pending_balance,total_earned,total_withdrawn"
        )
        .in("id", userIds);

    if (profileError) {
      console.error("Profile load error:", profileError);
      return;
    }

    const map: Record<string, Profile> = {};

    ((profileData as Profile[]) || []).forEach((profile) => {
      map[profile.id] = profile;
    });

    setProfiles(map);
  }

  function updateForm(
    field: keyof CampaignForm,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingCampaign(null);
    setShowCampaignForm(false);
  }

  function openCreateCampaign() {
    setErrorMessage("");
    setMessage("");
    setEditingCampaign(null);
    setForm(emptyForm);
    setShowCampaignForm(true);
  }

  function openEditCampaign(campaign: Campaign) {
    setErrorMessage("");
    setMessage("");

    setEditingCampaign(campaign);

    setForm({
      name: campaign.name || "",
      description: campaign.description || "",
      category: campaign.category || "Other",
      image_url: campaign.image_url || "",
      landing_url: campaign.landing_url || "",
      reward: String(campaign.reward ?? ""),
      advertiser_payout: String(
        campaign.advertiser_payout ?? ""
      ),
      conversion_type:
        campaign.conversion_type || "Complete Offer",
      terms: campaign.terms || "",
      daily_limit:
        campaign.daily_limit === null
          ? ""
          : String(campaign.daily_limit),
      total_limit:
        campaign.total_limit === null
          ? ""
          : String(campaign.total_limit),
    });

    setShowCampaignForm(true);
  }

  function createSlug(name: string) {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return `${base || "campaign"}-${Date.now()}`;
  }

  function validateCampaignForm() {
    if (!form.name.trim()) {
      return "Campaign name is required.";
    }

    if (!form.landing_url.trim()) {
      return "Landing URL is required.";
    }

    const reward = Number(form.reward);
    const payout = Number(form.advertiser_payout);

    if (!Number.isFinite(reward) || reward < 0) {
      return "Enter a valid user reward.";
    }

    if (!Number.isFinite(payout) || payout < 0) {
      return "Enter a valid advertiser payout.";
    }

    if (reward > payout) {
      return "User reward cannot be higher than advertiser payout.";
    }

    if (
      form.daily_limit &&
      (!Number.isFinite(Number(form.daily_limit)) ||
        Number(form.daily_limit) < 0)
    ) {
      return "Enter a valid daily limit.";
    }

    if (
      form.total_limit &&
      (!Number.isFinite(Number(form.total_limit)) ||
        Number(form.total_limit) < 0)
    ) {
      return "Enter a valid total limit.";
    }

    return null;
  }

  async function saveCampaign(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const validationError = validateCampaignForm();

    if (validationError) {
      setErrorMessage(validationError);
      setMessage("");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setMessage("");

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || "Other",
      image_url: form.image_url.trim() || null,
      landing_url: form.landing_url.trim(),
      reward: Number(form.reward),
      advertiser_payout: Number(form.advertiser_payout),
      conversion_type:
        form.conversion_type.trim() || "Complete Offer",
      terms: form.terms.trim() || null,
      daily_limit: form.daily_limit
        ? Number(form.daily_limit)
        : null,
      total_limit: form.total_limit
        ? Number(form.total_limit)
        : null,
    };

    try {
      if (editingCampaign) {
        const { error } = await supabase
          .from("campaigns")
          .update(payload)
          .eq("id", editingCampaign.id);

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        setMessage("Campaign updated successfully.");
      } else {
        const { error } = await supabase
          .from("campaigns")
          .insert({
            ...payload,
            slug: createSlug(form.name),
            status: "active",
          });

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        setMessage("Campaign created successfully.");
      }

      resetForm();
      await loadCampaigns();
    } catch (error) {
      console.error("Campaign save error:", error);
      setErrorMessage("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function changeCampaignStatus(
    campaign: Campaign,
    status: "active" | "paused" | "ended"
  ) {
    const labels = {
      active: "activate",
      paused: "pause",
      ended: "end",
    };

    const confirmed = window.confirm(
      `Are you sure you want to ${labels[status]} "${campaign.name}"?`
    );

    if (!confirmed) return;

    setActionId(campaign.id);
    setErrorMessage("");
    setMessage("");

    const { error } = await supabase
      .from("campaigns")
      .update({ status })
      .eq("id", campaign.id);

    setActionId(null);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setMessage(
      `Campaign ${labels[status]}d successfully.`
    );

    await loadCampaigns();
  }

  async function deleteCampaign(campaign: Campaign) {
    const confirmed = window.confirm(
      `Delete "${campaign.name}" permanently?`
    );

    if (!confirmed) return;

    setActionId(campaign.id);
    setErrorMessage("");
    setMessage("");

    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", campaign.id);

    setActionId(null);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setMessage("Campaign deleted successfully.");

    await loadCampaigns();
  }

  function openWithdrawalAction(
    withdrawal: Withdrawal,
    action: "approve" | "reject"
  ) {
    setSelectedWithdrawal(withdrawal);
    setWithdrawalAction(action);
    setWithdrawalNote("");
    setErrorMessage("");
    setMessage("");
  }

  function closeWithdrawalAction() {
    setSelectedWithdrawal(null);
    setWithdrawalAction(null);
    setWithdrawalNote("");
  }

  async function processWithdrawal() {
    if (!selectedWithdrawal || !withdrawalAction) {
      return;
    }

    const withdrawal = selectedWithdrawal;

    if (withdrawal.status !== "pending") {
      setErrorMessage(
        "This withdrawal has already been processed."
      );
      return;
    }

    if (
      withdrawalAction === "reject" &&
      !withdrawalNote.trim()
    ) {
      setErrorMessage(
        "Please enter a rejection reason."
      );
      return;
    }

    setActionId(withdrawal.id);
    setErrorMessage("");
    setMessage("");

    try {
      /*
       * The database RPC is the correct place for withdrawal
       * balance/refund logic. This page only sends the admin
       * action to the existing RPC.
       *
       * Expected RPC:
       * admin_process_withdrawal(
       *   p_withdrawal_id,
       *   p_action,
       *   p_admin_note
       * )
       */

      const { error } = await supabase.rpc(
        "admin_process_withdrawal",
        {
          p_withdrawal_id: withdrawal.id,
          p_action: withdrawalAction,
          p_admin_note: withdrawalNote.trim() || null,
        }
      );

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setMessage(
        withdrawalAction === "approve"
          ? "Withdrawal approved successfully."
          : "Withdrawal rejected successfully."
      );

      closeWithdrawalAction();

      await loadWithdrawals();
    } catch (error) {
      console.error("Withdrawal action error:", error);
      setErrorMessage("Unable to process withdrawal.");
    } finally {
      setActionId(null);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getUserName(userId: string) {
    return profiles[userId]?.full_name || "User";
  }

  function getUserEmail(userId: string) {
    return profiles[userId]?.email || userId;
  }

  function withdrawalStatusStyle(status: string) {
    if (status === "paid" || status === "approved") {
      return {
        ...styles.status,
        ...styles.statusSuccess,
      };
    }

    if (status === "rejected") {
      return {
        ...styles.status,
        ...styles.statusDanger,
      };
    }

    if (status === "processing") {
      return {
        ...styles.status,
        ...styles.statusWarning,
      };
    }

    return {
      ...styles.status,
      ...styles.statusPending,
    };
  }

  function campaignStatusStyle(status: string) {
    if (status === "active") {
      return {
        ...styles.status,
        ...styles.statusSuccess,
      };
    }

    if (status === "paused") {
      return {
        ...styles.status,
        ...styles.statusWarning,
      };
    }

    return {
      ...styles.status,
      ...styles.statusDanger,
    };
  }

  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.status === "active"
  ).length;

  const pausedCampaigns = campaigns.filter(
    (campaign) => campaign.status === "paused"
  ).length;

  const pendingWithdrawals = withdrawals.filter(
    (withdrawal) => withdrawal.status === "pending"
  );

  const pendingWithdrawalAmount = pendingWithdrawals.reduce(
    (sum, withdrawal) =>
      sum + Number(withdrawal.amount || 0),
    0
  );

  const totalCampaignRewards = campaigns.reduce(
    (sum, campaign) =>
      sum + Number(campaign.reward || 0),
    0
  );

  if (loading) {
    return (
      <>
        <style>{globalStyles}</style>

        <main style={styles.page}>
          <div style={styles.loadingCard}>
            <div style={styles.spinner} />
            <div style={styles.loadingTitle}>
              AURACAMP
            </div>
            <div style={styles.loadingText}>
              Loading Admin Panel...
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!authorized) {
    return (
      <>
        <style>{globalStyles}</style>

        <main style={styles.page}>
          <div style={styles.deniedCard}>
            <div style={styles.deniedIcon}>🔒</div>

            <h1 style={styles.deniedTitle}>
              Access Denied
            </h1>

            <p style={styles.deniedText}>
              You do not have permission to access
              the AURACAMP Admin Panel.
            </p>

            <button
              type="button"
              onClick={() => {
                window.location.href = "/";
              }}
              style={styles.primaryButton}
            >
              Go Home
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <style>{globalStyles}</style>

      <main style={styles.page}>
        <div style={styles.container}>
          <header style={styles.header}>
            <div>
              <div style={styles.brand}>
                AURACAMP
              </div>

              <div style={styles.adminLabel}>
                ADMIN CONTROL PANEL
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              style={styles.logoutButton}
            >
              Logout
            </button>
          </header>

          <nav style={styles.tabs}>
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              style={{
                ...styles.tab,
                ...(activeTab === "overview"
                  ? styles.tabActive
                  : {}),
              }}
            >
              Overview
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("campaigns")}
              style={{
                ...styles.tab,
                ...(activeTab === "campaigns"
                  ? styles.tabActive
                  : {}),
              }}
            >
              Campaigns
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab("withdrawals")
              }
              style={{
                ...styles.tab,
                ...(activeTab === "withdrawals"
                  ? styles.tabActive
                  : {}),
              }}
            >
              Withdrawals
              {pendingWithdrawals.length > 0 && (
                <span style={styles.tabBadge}>
                  {pendingWithdrawals.length}
                </span>
              )}
            </button>
          </nav>

          {message && (
            <div style={styles.successMessage}>
              ✓ {message}
            </div>
          )}

          {errorMessage && (
            <div style={styles.errorMessage}>
              {errorMessage}
            </div>
          )}

          {activeTab === "overview" && (
            <>
              <section style={styles.heroCard}>
                <div>
                  <div style={styles.heroEyebrow}>
                    AURACAMP CONTROL CENTER
                  </div>

                  <h1 style={styles.heroTitle}>
                    Manage your platform
                  </h1>

                  <p style={styles.heroText}>
                    
                    Campaigns, withdrawals and
                    platform operations in one place.
                  </p>
                </div>

                <div style={styles.heroIcon}>
                  ⚡
                </div>
              </section>

              <section style={styles.statsGrid}>
                <StatCard
                  icon="📦"
                  title="Total Campaigns"
                  value={String(campaigns.length)}
                  subtitle="All campaigns"
                />

                <StatCard
                  icon="🟢"
                  title="Active Campaigns"
                  value={String(activeCampaigns)}
                  subtitle="Currently live"
                />

                <StatCard
                  icon="⏸️"
                  title="Paused"
                  value={String(pausedCampaigns)}
                  subtitle="Currently paused"
                />

                <StatCard
                  icon="💸"
                  title="Pending Withdrawals"
                  value={`₹${pendingWithdrawalAmount.toFixed(
                    2
                  )}`}
                  subtitle={`${pendingWithdrawals.length} request${
                    pendingWithdrawals.length === 1
                      ? ""
                      : "s"
                  }`}
                />
              </section>

              <section style={styles.card}>
                <div style={styles.sectionHeader}>
                  <div>
                    <h2 style={styles.sectionTitle}>
                      Quick Actions
                    </h2>

                    <p style={styles.sectionDescription}>
                      Frequently used admin controls.
                    </p>
                  </div>
                </div>

                <div style={styles.quickGrid}>
                  <button
                    type="button"
                    onClick={openCreateCampaign}
                    style={styles.quickAction}
                  >
                    <span style={styles.quickIcon}>
                      ➕
                    </span>

                    <span>
                      <strong>
                        Create Campaign
                      </strong>

                      <small>
                        Add a new AURACAMP offer
                      </small>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveTab("campaigns")
                    }
                    style={styles.quickAction}
                  >
                    <span style={styles.quickIcon}>
                      📋
                    </span>

                    <span>
                      <strong>
                        Manage Campaigns
                      </strong>

                      <small>
                        Edit, pause or activate offers
                      </small>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveTab("withdrawals")
                    }
                    style={styles.quickAction}
                  >
                    <span style={styles.quickIcon}>
                      💰
                    </span>

                    <span>
                      <strong>
                        Withdrawals
                      </strong>

                      <small>
                        Review pending requests
                      </small>
                    </span>
                  </button>
                </div>
              </section>

              <section style={styles.card}>
                <div style={styles.sectionHeader}>
                  <div>
                    <h2 style={styles.sectionTitle}>
                      Platform Summary
                    </h2>

                    <p style={styles.sectionDescription}>
                      Current campaign statistics.
                    </p>
                  </div>
                </div>

                <div style={styles.summaryGrid}>
                  <div style={styles.summaryItem}>
                    <span>
                      Total reward value
                    </span>

                    <strong>
                      ₹
                      {totalCampaignRewards.toFixed(
                        2
                      )}
                    </strong>
                  </div>

                  <div style={styles.summaryItem}>
                    <span>
                      Pending withdrawals
                    </span>

                    <strong>
                      {pendingWithdrawals.length}
                    </strong>
                  </div>

                  <div style={styles.summaryItem}>
                    <span>
                      Withdrawal amount
                    </span>

                    <strong>
                      ₹
                      {pendingWithdrawalAmount.toFixed(
                        2
                      )}
                    </strong>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === "campaigns" && (
            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>
                    Campaign Management
                  </h2>

                  <p style={styles.sectionDescription}>
                    Create and control your own
                    AURACAMP offers.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (showCampaignForm) {
                      resetForm();
                    } else {
                      openCreateCampaign();
                    }
                  }}
                  style={styles.primaryButton}
                >
                  {showCampaignForm
                    ? "Close"
                    : "+ Create Campaign"}
                </button>
              </div>

              {showCampaignForm && (
                <form
                  onSubmit={saveCampaign}
                  style={styles.form}
                >
                  <div style={styles.formHeader}>
                    <div>
                      <h3 style={styles.formTitle}>
                        {editingCampaign
                          ? "Edit Campaign"
                          : "Create New Campaign"}
                      </h3>

                      <p style={styles.formDescription}>
                        {editingCampaign
                          ? "Update campaign details."
                          : "Add a new offer to AURACAMP."}
                      </p>
                    </div>
                  </div>

                  <div style={styles.formGrid}>
                    <Input
                      label="Campaign Name *"
                      value={form.name}
                      onChange={(value) =>
                        updateForm("name", value)
                      }
                      placeholder="Example: Earn ₹100"
                    />

                    <Input
                      label="Category"
                      value={form.category}
                      onChange={(value) =>
                        updateForm(
                          "category",
                          value
                        )
                      }
                      placeholder="Entertainment"
                    />

                    <Input
                      label="Landing URL *"
                      value={form.landing_url}
                      onChange={(value) =>
                        updateForm(
                          "landing_url",
                          value
                        )
                      }
                      placeholder="https://example.com/offer"
                    />

                    <Input
                      label="Image URL"
                      value={form.image_url}
                      onChange={(value) =>
                        updateForm(
                          "image_url",
                          value
                        )
                      }
                      placeholder="https://..."
                    />

                    <Input
                      label="Advertiser Payout ₹"
                      type="number"
                      value={
                        form.advertiser_payout
                      }
                      onChange={(value) =>
                        updateForm(
                          "advertiser_payout",
                          value
                        )
                      }
                      placeholder="100"
                    />

                    <Input
                      label="User Reward ₹"
                      type="number"
                      value={form.reward}
                      onChange={(value) =>
                        updateForm("reward", value)
                      }
                      placeholder="70"
                    />

                    <Input
                      label="Conversion Type"
                      value={
                        form.conversion_type
                      }
                      onChange={(value) =>
                        updateForm(
                          "conversion_type",
                          value
                        )
                      }
                      placeholder="Complete Registration"
                    />

                    <Input
                      label="Daily Limit"
                      type="number"
                      value={
                        form.daily_limit
                      }
                      onChange={(value) =>
                        updateForm(
                          "daily_limit",
                          value
                        )
                      }
                      placeholder="100"
                    />

                    <Input
                      label="Total Limit"
                      type="number"
                      value={
                        form.total_limit
                      }
                      onChange={(value) =>
                        updateForm(
                          "total_limit",
                          value
                        )
                      }
                      placeholder="1000"
                    />
                  </div>

                  <Textarea
                    label="Description"
                    value={form.description}
                    onChange={(value) =>
                      updateForm(
                        "description",
                        value
                      )
                    }
                    placeholder="Describe this campaign..."
                  />

                  <Textarea
                    label="Terms & Conditions"
                    value={form.terms}
                    onChange={(value) =>
                      updateForm("terms", value)
                    }
                    placeholder="Campaign rules..."
                  />

                  <div style={styles.profitBox}>
                    <div>
                      <span
                        style={
                          styles.profitLabel
                        }
                      >
                        AURACAMP Margin
                      </span>

                      <small
                        style={
                          styles.profitHint
                        }
                      >
                        Advertiser payout minus
                        user reward
                      </small>
                    </div>

                    <strong
                      style={
                        styles.profitValue
                      }
                    >
                      ₹
                      {Math.max(
                        0,
                        Number(
                          form.advertiser_payout ||
                            0
                        ) -
                          Number(
                            form.reward || 0
                          )
                      ).toFixed(2)}
                    </strong>
                  </div>

                  <div style={styles.formActions}>
                    <button
                      type="button"
                      onClick={resetForm}
                      style={styles.secondaryButton}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      style={{
                        ...styles.primaryButton,
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      {saving
                        ? "Saving..."
                        : editingCampaign
                        ? "Update Campaign"
                        : "Create Campaign"}
                    </button>
                  </div>
                </form>
              )}

              <div style={styles.list}>
                {campaigns.length === 0 ? (
                  <EmptyState
                    icon="📦"
                    title="No campaigns yet"
                    text="Create your first campaign from above."
                  />
                ) : (
                  campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      style={styles.campaignCard}
                    >
                      <div
                        style={
                          styles.campaignMain
                        }
                      >
                        {campaign.image_url ? (
                          <img
                            src={
                              campaign.image_url
                            }
                            alt=""
                            style={
                              styles.campaignImage
                            }
                            onError={(event) => {
                              event.currentTarget.style.display =
                                "none";
                            }}
                          />
                        ) : (
                          <div
                            style={
                              styles.campaignImageFallback
                            }
                          >
                            ⚡
                          </div>
                        )}

                        <div
                          style={
                            styles.campaignInfo
                          }
                        >
                          <div
                            style={
                              styles.campaignTitleRow
                            }
                          >
                            <h3
                              style={
                                styles.campaignName
                              }
                            >
                              {campaign.name}
                            </h3>

                            <span
                              style={campaignStatusStyle(
                                campaign.status
                              )}
                            >
                              {campaign.status}
                            </span>
                          </div>

                          <div
                            style={
                              styles.campaignMeta
                            }
                          >
                            {campaign.category ||
                              "Other"}
                            {" • "}
                            Reward ₹
                            {Number(
                              campaign.reward
                            ).toFixed(2)}
                            {" • "}
                            Payout ₹
                            {Number(
                              campaign.advertiser_payout
                            ).toFixed(2)}
                          </div>

                          <div
                            style={
                              styles.campaignMeta
                            }
                          >
                            Conversions:{" "}
                            {campaign.conversions_count ||
                              0}
                          </div>

                          {campaign.description && (
                            <p
                              style={
                                styles.campaignDescription
                              }
                            >
                              {
                                campaign.description
                              }
                            </p>
                          )}
                        </div>
                      </div>

                      <div
                        style={
                          styles.actionRow
                        }
                      >
                        <button
                          type="button"
                          onClick={() =>
                            openEditCampaign(
                              campaign
                            )
                          }
                          style={
                            styles.secondaryButton
                          }
                          disabled={
                            actionId ===
                            campaign.id
                          }
                        >
                          Edit
                        </button>

                        {campaign.status ===
                        "active" ? (
                          <button
                            type="button"
                            onClick={() =>
                              changeCampaignStatus(
                                campaign,
                                "paused"
                              )
                            }
                            style={
                              styles.secondaryButton
                            }
                            disabled={
                              actionId ===
                              campaign.id
                            }
                          >
                            Pause
                          </button>
                        ) : campaign.status ===
                          "paused" ? (
                          <button
                            type="button"
                            onClick={() =>
                              changeCampaignStatus(
                                campaign,
                                "active"
                              )
                            }
                            style={
                              styles.secondaryButton
                            }
                            disabled={
                              actionId ===
                              campaign.id
                            }
                          >
                            Activate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              changeCampaignStatus(
                                campaign,
                                "active"
                              )
                            }
                            style={
                              styles.secondaryButton
                            }
                            disabled={
                              actionId ===
                              campaign.id
                            }
                          >
                            Reactivate
                          </button>
                        )}

                        {campaign.status !==
                          "ended" && (
                          <button
                            type="button"
                            onClick={() =>
                              changeCampaignStatus(
                                campaign,
                                "ended"
                              )
                            }
                            style={
                              styles.warningButton
                            }
                            disabled={
                              actionId ===
                              campaign.id
                            }
                          >
                            End
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            deleteCampaign(
                              campaign
                            )
                          }
                          style={
                            styles.dangerButton
                          }
                          disabled={
                            actionId ===
                            campaign.id
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {activeTab === "withdrawals" && (
            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>
                    Withdrawal Management
                  </h2>

                  <p style={styles.sectionDescription}>
                    Review and process user
                    withdrawal requests.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadWithdrawals}
                  style={styles.secondaryButton}
                >
                  ↻ Refresh
                </button>
              </div>

              <div style={styles.withdrawalStats}>
                <div style={styles.withdrawalStat}>
                  <span>Pending</span>
                  <strong>
                    {pendingWithdrawals.length}
                  </strong>
                </div>

                <div style={styles.withdrawalStat}>
                  <span>Pending Amount</span>
                  <strong>
                    ₹
                    {pendingWithdrawalAmount.toFixed(
                      2
                    )}
                  </strong>
                </div>

                <div style={styles.withdrawalStat}>
                  <span>Total Requests</span>
                  <strong>
                    {withdrawals.length}
                  </strong>
                </div>
              </div>

              <div style={styles.list}>
                {withdrawals.length === 0 ? (
                  <EmptyState
                    icon="💸"
                    title="No withdrawals"
                    text="Withdrawal requests will appear here."
                  />
                ) : (
                  withdrawals.map(
                    (withdrawal) => {
                      const profile =
                        profiles[
                          withdrawal.user_id
                        ];

                      return (
                        <div
                          key={
                            withdrawal.id
                          }
                          style={
                            styles.withdrawalCard
                          }
                        >
                          <div
                            style={
                              styles.withdrawalTop
                            }
                          >
                            <div>
                              <div
                                style={
                                  styles.withdrawalAmount
                                }
                              >
                                ₹
                                {Number(
                                  withdrawal.amount
                                ).toFixed(2)}
                              </div>

                              <div
                                style={
                                  styles.withdrawalUser
                                }
                              >
                                {getUserName(
                                  withdrawal.user_id
                                )}
                              </div>

                              <div
                                style={
                                  styles.withdrawalEmail
                                }
                              >
                                {getUserEmail(
                                  withdrawal.user_id
                                )}
                              </div>
                            </div>

                            <span
                              style={withdrawalStatusStyle(
                                withdrawal.status
                              )}
                            >
                              {
                                withdrawal.status
                              }
                            </span>
                          </div>

                          <div
                            style={
                              styles.paymentBox
                            }
                          >
                            <div
                              style={
                                styles.paymentTitle
                              }
                            >
                              {withdrawal.method ===
                              "upi"
                                ? "📱 UPI Payment"
                                : "🏦 Bank Payment"}
                            </div>

                            <div
                              style={
                                styles.paymentGrid
                              }
                            >
                              <PaymentField
                                label="Account Name"
                                value={
                                  withdrawal.account_name ||
                                  "-"
                                }
                              />

                              {withdrawal.method ===
                              "upi" ? (
                                <PaymentField
                                  label="UPI ID"
                                  value={
                                    withdrawal.upi_id ||
                                    "-"
                                  }
                                />
                              ) : (
                                <>
                                  <PaymentField
                                    label="Bank"
                                    value={
                                      withdrawal.bank_name ||
                                      "-"
                                    }
                                  />

                                  <PaymentField
                                    label="Account Number"
                                    value={
                                      withdrawal.account_number
                                        ? `••••${withdrawal.account_number.slice(
                                            -4
                                          )}`
                                        : "-"
                                    }
                                  />

                                  <PaymentField
                                    label="IFSC"
                                    value={
                                      withdrawal.ifsc_code ||
                                      "-"
                                    }
                                  />
                                </>
                              )}
                            </div>
                          </div>

                          <div
                            style={
                              styles.withdrawalFooter
                            }
                          >
                            <span
                              style={
                                styles.withdrawalDate
                              }
                            >
                              {formatDate(
                                withdrawal.created_at
                              )}
                            </span>

                            {withdrawal.status ===
                              "pending" && (
                              <div
                                style={
                                  styles.actionRow
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    openWithdrawalAction(
                                      withdrawal,
                                      "reject"
                                    )
                                  }
                                  style={
                                    styles.dangerButton
                                  }
                                  disabled={
                                    actionId ===
                                    withdrawal.id
                                  }
                                >
                                  Reject
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openWithdrawalAction(
                                      withdrawal,
                                      "approve"
                                    )
                                  }
                                  style={
                                    styles.successButton
                                  }
                                  disabled={
                                    actionId ===
                                    withdrawal.id
                                  }
                                >
                                  Approve
                                </button>
                              </div>
                            )}
                          </div>

                          {withdrawal.status ===
                            "rejected" &&
                            withdrawal.rejection_reason && (
                              <div
                                style={
                                  styles.rejectionBox
                                }
                              >
                                <strong>
                                  Rejection reason:
                                </strong>{" "}
                                {
                                  withdrawal.rejection_reason
                                }
                              </div>
                            )}

                          {profile && (
                            <div
                              style={
                                styles.userBalance
                              }
                            >
                              User wallet:
                              {" "}
                              <strong>
                                ₹
                                {Number(
                                  profile.wallet_balance ||
                                    0
                                ).toFixed(2)}
                              </strong>
                            </div>
                          )}
                        </div>
                      );
                    }
                  )
                )}
              </div>
            </section>
          )}
                  </div>

        {selectedWithdrawal &&
          withdrawalAction && (
            <div
              style={styles.modalOverlay}
              onClick={closeWithdrawalAction}
            >
              <div
                style={styles.modalCard}
                onClick={(event) =>
                  event.stopPropagation()
                }
              >
                <div style={styles.modalHeader}>
                  <div>
                    <div style={styles.modalEyebrow}>
                      WITHDRAWAL ACTION
                    </div>

                    <h3 style={styles.modalTitle}>
                      {withdrawalAction === "approve"
                        ? "Approve Withdrawal"
                        : "Reject Withdrawal"}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={closeWithdrawalAction}
                    style={styles.closeButton}
                  >
                    ×
                  </button>
                </div>

                <div style={styles.modalSummary}>
                  <div>
                    <span>User</span>
                    <strong>
                      {getUserName(
                        selectedWithdrawal.user_id
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Amount</span>
                    <strong>
                      ₹
                      {Number(
                        selectedWithdrawal.amount
                      ).toFixed(2)}
                    </strong>
                  </div>

                  <div>
                    <span>Method</span>
                    <strong>
                      {selectedWithdrawal.method.toUpperCase()}
                    </strong>
                  </div>
                </div>

                <label style={styles.label}>
                  {withdrawalAction === "approve"
                    ? "Admin Note"
                    : "Rejection Reason *"}

                  <textarea
                    value={withdrawalNote}
                    onChange={(event) =>
                      setWithdrawalNote(
                        event.target.value
                      )
                    }
                    placeholder={
                      withdrawalAction === "approve"
                        ? "Optional note..."
                        : "Enter reason for rejection..."
                    }
                    rows={4}
                    style={styles.textarea}
                  />
                </label>

                {withdrawalAction === "reject" && (
                  <div style={styles.warningBox}>
                    The existing database RPC should refund
                    the rejected withdrawal amount to the
                    user's wallet.
                  </div>
                )}

                <div style={styles.modalActions}>
                  <button
                    type="button"
                    onClick={closeWithdrawalAction}
                    style={styles.secondaryButton}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={processWithdrawal}
                    disabled={
                      actionId === selectedWithdrawal.id
                    }
                    style={{
                      ...(withdrawalAction === "approve"
                        ? styles.successButton
                        : styles.dangerButton),
                      opacity:
                        actionId === selectedWithdrawal.id
                          ? 0.6
                          : 1,
                    }}
                  >
                    {actionId === selectedWithdrawal.id
                      ? "Processing..."
                      : withdrawalAction === "approve"
                      ? "Approve Withdrawal"
                      : "Reject Withdrawal"}
                  </button>
                </div>
              </div>
            </div>
          )}
      </main>
    </>
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
    <label style={styles.label}>
      {label}

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        style={styles.input}
      />
    </label>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={styles.label}>
      {label}

      <textarea
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        rows={4}
        style={styles.textarea}
      />
    </label>
  );
}

function StatCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: string;
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIcon}>{icon}</div>

      <div style={styles.statContent}>
        <span style={styles.statTitle}>
          {title}
        </span>

        <strong style={styles.statNumber}>
          {value}
        </strong>

        <small style={styles.statSubtitle}>
          {subtitle}
        </small>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>{icon}</div>

      <h3 style={styles.emptyTitle}>{title}</h3>

      <p style={styles.emptyText}>{text}</p>
    </div>
  );
}

function PaymentField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.paymentField}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
