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
  description?: string | null;
  category: string | null;
  image_url?: string | null;
  landing_url?: string | null;
  reward: number;
  advertiser_payout: number;
  conversion_type?: string | null;
  terms?: string | null;
  daily_limit?: number | null;
  total_limit?: number | null;
  status: string;
  conversions_count: number;
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
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);

  const [showCreate, setShowCreate] = useState(false);

  const [saving, setSaving] = useState(false);
  const [withdrawalAction, setWithdrawalAction] = useState<string | null>(
    null
  );

  const [message, setMessage] = useState("");
  const [newWithdrawalAlert, setNewWithdrawalAlert] = useState(false);

  const [selectedWithdrawal, setSelectedWithdrawal] =
    useState<Withdrawal | null>(null);

  const [adminNote, setAdminNote] = useState("");

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

  /*
   * ============================================================
   * ADMIN AUTH
   * ============================================================
   */

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

      await Promise.all([
        loadCampaigns(),
        loadWithdrawals(),
      ]);

      setLoading(false);
    } catch (error) {
      console.error("Admin check error:", error);

      setAuthorized(false);
      setLoading(false);
    }
  }

  /*
   * ============================================================
   * REALTIME WITHDRAWAL SUBSCRIPTION
   * ============================================================
   */

  useEffect(() => {
    if (!authorized) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function setupRealtime() {
      /*
       * Browser notification permission
       */
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "default"
      ) {
        try {
          await Notification.requestPermission();
        } catch (error) {
          console.error(
            "Notification permission error:",
            error
          );
        }
      }

      /*
       * Supabase Realtime
       */
      channel = supabase
        .channel("auracamp-admin-withdrawals")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "withdrawals",
          },
          async (payload) => {
            console.log(
              "New withdrawal received:",
              payload.new
            );

            await loadWithdrawals();

            setNewWithdrawalAlert(true);

            /*
             * Browser notification
             */
            if (
              typeof window !== "undefined" &&
              "Notification" in window &&
              Notification.permission === "granted"
            ) {
              const amount = Number(
                payload.new.amount || 0
              );

              const method =
                String(payload.new.method || "")
                  .toUpperCase();

              new Notification(
                "AURACAMP – New Withdrawal",
                {
                  body:
                    `New ${method} withdrawal request ` +
                    `of ₹${amount.toFixed(2)}.`,
                }
              );
            }

            /*
             * Auto hide alert
             */
            window.setTimeout(() => {
              setNewWithdrawalAlert(false);
            }, 6000);
          }
        )
        .subscribe((status) => {
          console.log(
            "Withdrawal realtime status:",
            status
          );
        });
    }

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [authorized]);

  /*
   * ============================================================
   * CAMPAIGNS
   * ============================================================
   */

  async function loadCampaigns() {
    const { data, error } = await supabase
      .from("campaigns")
      .select(
        `
        id,
        name,
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
        status,
        conversions_count,
        created_at
        `
      )
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

  function updateForm(
    field: string,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function createCampaign(
    e: React.FormEvent
  ) {
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
    const payout = Number(
      form.advertiser_payout
    );

    if (
      Number.isNaN(reward) ||
      Number.isNaN(payout)
    ) {
      setMessage(
        "Reward and payout must be valid numbers."
      );
      return;
    }

    if (reward < 0 || payout < 0) {
      setMessage(
        "Reward and payout cannot be negative."
      );
      return;
    }

    if (reward > payout) {
      setMessage(
        "User reward cannot be higher than advertiser payout."
      );
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

    const { error } = await supabase
      .from("campaigns")
      .insert({
        name: form.name.trim(),
        slug,
        description:
          form.description.trim() || null,
        category: form.category,
        image_url:
          form.image_url.trim() || null,
        landing_url:
          form.landing_url.trim(),
        reward,
        advertiser_payout: payout,
        conversion_type:
          form.conversion_type,
        terms:
          form.terms.trim() || null,
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

    setMessage(
      "Campaign created successfully."
    );

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

  async function deleteCampaign(
    id: string
  ) {
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

  /*
   * ============================================================
   * WITHDRAWALS
   * ============================================================
   */

  async function loadWithdrawals() {
    const { data, error } = await supabase
      .from("withdrawals")
      .select(
        `
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
        created_at,
        profiles (
          full_name,
          email
        )
        `
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Withdrawal loading error:",
        error
      );

      return;
    }

    setWithdrawals(
      (data as Withdrawal[]) || []
    );
  }

  async function processWithdrawal(
    withdrawal: Withdrawal,
    action: "approve" | "reject"
  ) {
    if (
      action === "reject" &&
      !adminNote.trim()
    ) {
      setMessage(
        "Please enter a rejection reason."
      );
      return;
    }

    const confirmed = window.confirm(
      action === "approve"
        ? `Approve ₹${Number(
            withdrawal.amount
          ).toFixed(2)} withdrawal?`
        : `Reject ₹${Number(
            withdrawal.amount
          ).toFixed(2)} withdrawal?`
    );

    if (!confirmed) return;

    setWithdrawalAction(withdrawal.id);
    setMessage("");

    const {
      data: {
        user,
      },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage(
        "Admin authentication required."
      );

      setWithdrawalAction(null);
      return;
    }

    const { data, error } =
      await supabase.rpc(
        "admin_process_withdrawal",
        {
          p_withdrawal_id:
            withdrawal.id,
          p_action: action,
          p_admin_note:
            adminNote.trim() || null,
        }
      );

    setWithdrawalAction(null);

    if (error) {
      console.error(
        "Withdrawal processing error:",
        error
      );

      setMessage(error.message);
      return;
    }

    console.log(
      "Withdrawal processed:",
      data
    );

    setMessage(
      action === "approve"
        ? "Withdrawal approved successfully."
        : "Withdrawal rejected successfully."
    );

    setAdminNote("");
    setSelectedWithdrawal(null);

    await loadWithdrawals();
  }

  /*
   * ============================================================
   * LOGOUT
   * ============================================================
   */

  async function logout() {
    await supabase.auth.signOut();

    window.location.href = "/login";
  }

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */

  if (loading) {
    return (
      <main style={pageStyle}>
        <div style={loadingStyle}>
          <div style={loadingCardStyle}>
            <div style={loadingIconStyle}>
              ⚡
            </div>

            <div>
              <strong>
                AURACAMP Admin
              </strong>

              <div
                style={{
                  color: "#6b7280",
                  fontSize: 13,
                  marginTop: 5,
                }}
              >
                Loading control panel...
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /*
   * ============================================================
   * ACCESS DENIED
   * ============================================================
   */

  if (!authorized) {
    return (
      <main style={pageStyle}>
        <div style={deniedStyle}>
          <div style={lockIcon}>
            🔒
          </div>

          <h1
            style={{
              margin: "0 0 8px",
            }}
          >
            Access Denied
          </h1>

          <p
            style={{
              color: "#666",
              marginBottom: 20,
            }}
          >
            You do not have permission to access
            the Admin Panel.
          </p>

          <button
            onClick={() =>
              (window.location.href = "/")
            }
            style={primaryButton}
          >
            Go Home
          </button>
        </div>
      </main>
    );
  }

  /*
   * ============================================================
   * DASHBOARD STATS
   * ============================================================
   */

  const activeCampaigns =
    campaigns.filter(
      (c) => c.status === "active"
    ).length;

  const totalRewards =
    campaigns.reduce(
      (sum, c) =>
        sum + Number(c.reward || 0),
      0
    );

  const pendingWithdrawals =
    withdrawals.filter(
      (w) =>
        String(w.status).toLowerCase() ===
        "pending"
    );

  const pendingWithdrawalAmount =
    pendingWithdrawals.reduce(
      (sum, w) =>
        sum + Number(w.amount || 0),
      0
    );

  /*
   * ============================================================
   * UI
   * ============================================================
   */

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        {/* =====================================================
            REALTIME ALERT
        ====================================================== */}

        {newWithdrawalAlert && (
          <div style={realtimeAlertStyle}>
            <div
              style={{
                fontSize: 25,
              }}
            >
              🔔
            </div>

            <div
              style={{
                flex: 1,
              }}
            >
              <strong>
                New Withdrawal Request
              </strong>

              <div
                style={{
                  fontSize: 13,
                  marginTop: 3,
                  opacity: 0.8,
                }}
              >
                A new withdrawal has been received.
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setNewWithdrawalAlert(false)
              }
              style={alertCloseButton}
            >
              ×
            </button>
          </div>
        )}

        {/* =====================================================
            HEADER
        ====================================================== */}

        <header style={headerStyle}>
          <div>
            <div style={brandStyle}>
              AURACAMP
            </div>

            <div style={adminLabel}>
              ADMIN CONTROL PANEL
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div style={liveBadge}>
              <span
                style={liveDot}
              />

              LIVE
            </div>

            <button
              onClick={logout}
              style={logoutButton}
            >
              Logout
            </button>
          </div>
        </header>

        {/* =====================================================
            STATS
        ====================================================== */}

        <section style={statsGrid}>
          <div style={statCard}>
            <span style={statTitle}>
              Total Campaigns
            </span>

            <strong style={statNumber}>
              {campaigns.length}
            </strong>
          </div>

          <div style={statCard}>
            <span style={statTitle}>
              Active Campaigns
            </span>

            <strong style={statNumber}>
              {activeCampaigns}
            </strong>
          </div>

          <div style={statCard}>
            <span style={statTitle}>
              Campaign Rewards
            </span>

            <strong style={statNumber}>
              ₹
              {totalRewards.toFixed(2)}
            </strong>
          </div>

          <div
            style={{
              ...statCard,
              border:
                pendingWithdrawals.length > 0
                  ? "1px solid #f59e0b"
                  : "1px solid #e5e7eb",
            }}
          >
            <span style={statTitle}>
              Pending Withdrawals
            </span>

            <strong
              style={{
                ...statNumber,
                color:
                  pendingWithdrawals.length >
                  0
                    ? "#d97706"
                    : "#111827",
              }}
            >
              {pendingWithdrawals.length}
            </strong>

            <div
              style={{
                color: "#6b7280",
                fontSize: 12,
                marginTop: 5,
              }}
            >
              ₹
              {pendingWithdrawalAmount.toFixed(
                2
              )} pending
            </div>
          </div>
        </section>

        {/* ============================================================
    WITHDRAWALS
============================================================ */}

<section style={sectionStyle}>
  <div style={sectionHeader}>
    <div>
      <h2 style={sectionTitle}>
        Withdrawal Management
      </h2>

      <p style={sectionDescription}>
        Review and process user withdrawal
        requests in real time.
      </p>
    </div>

    <button
      type="button"
      onClick={loadWithdrawals}
      style={refreshButton}
    >
      ↻ Refresh
    </button>
  </div>

  {/* REALTIME NOTIFICATION */}
  {newWithdrawalAlert && (
    <div style={realtimeAlertStyle}>
      <div
        style={{
          fontSize: 25,
        }}
      >
        🔔
      </div>

      <div
        style={{
          flex: 1,
        }}
      >
        <strong>
          New withdrawal request
        </strong>

        <div
          style={{
            marginTop: 3,
            fontSize: 12,
            color: "#475569",
          }}
        >
          A new withdrawal request has
          been received.
        </div>
      </div>

      <button
        type="button"
        onClick={() =>
          setNewWithdrawalAlert(false)
        }
        style={alertCloseButton}
      >
        ×
      </button>
    </div>
  )}

  {message && (
    <div
      style={{
        ...messageStyle,
        marginBottom: 18,
      }}
    >
      {message}
    </div>
  )}

  {withdrawals.length === 0 ? (
    <div style={emptyStyle}>
      <div
        style={{
          fontSize: 45,
        }}
      >
        💸
      </div>

      <h3>
        No withdrawal requests
      </h3>

      <p>
        New requests will appear here
        automatically.
      </p>
    </div>
  ) : (
    <div style={withdrawalListStyle}>
      {withdrawals.map((withdrawal) => {
        const method = String(
          withdrawal.method || ""
        ).toLowerCase();

        const status = String(
          withdrawal.status || ""
        ).toLowerCase();

        return (
          <div
            key={withdrawal.id}
            style={{
              ...withdrawalCard,
              border:
                status === "pending"
                  ? "1px solid #fde68a"
                  : "1px solid #e5e7eb",
            }}
          >
            {/* TOP */}
            <div style={withdrawalTop}>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div style={withdrawalTitle}>
                  <strong>
                    ₹
                    {Number(
                      withdrawal.amount || 0
                    ).toFixed(2)}
                  </strong>

                  <span
                    style={{
                      ...withdrawalStatus,
                      ...(status === "pending"
                        ? pendingStatus
                        : status === "approved"
                        ? approvedStatus
                        : rejectedStatus),
                    }}
                  >
                    {status}
                  </span>
                </div>

                <div style={withdrawalUser}>
                  👤{" "}
                  {withdrawal.profiles
                    ?.full_name || "User"}
                </div>

                <div style={withdrawalEmail}>
                  {withdrawal.profiles
                    ?.email ||
                    "Email unavailable"}
                </div>
              </div>

              <div style={methodBadge}>
                {method === "upi"
                  ? "📱 UPI"
                  : "🏦 Bank"}
              </div>
            </div>

            {/* PAYMENT DETAILS */}
            <div
              style={paymentDetailsGrid}
            >
              {method === "upi" ? (
                <>
                  <Detail
                    label="UPI ID"
                    value={
                      withdrawal.upi_id ||
                      "Not provided"
                    }
                  />

                  <Detail
                    label="Account Name"
                    value={
                      withdrawal.account_name ||
                      "Not provided"
                    }
                  />
                </>
              ) : (
                <>
                  <Detail
                    label="Account Holder"
                    value={
                      withdrawal.account_name ||
                      "Not provided"
                    }
                  />

                  <Detail
                    label="Bank"
                    value={
                      withdrawal.bank_name ||
                      "Not provided"
                    }
                  />

                  <Detail
                    label="Account Number"
                    value={
                      withdrawal.account_number ||
                      "Not provided"
                    }
                  />

                  <Detail
                    label="IFSC Code"
                    value={
                      withdrawal.ifsc_code ||
                      "Not provided"
                    }
                  />
                </>
              )}
            </div>

            {/* DATE */}
            <div style={withdrawalDate}>
              Requested:{" "}
              {withdrawal.created_at
                ? new Date(
                    withdrawal.created_at
                  ).toLocaleString()
                : "Unknown"}
            </div>

            {/* REJECTION */}
            {withdrawal.rejection_reason && (
              <div style={rejectionBox}>
                <strong>
                  Rejection reason:
                </strong>{" "}
                {withdrawal.rejection_reason}
              </div>
            )}

            {/* PROCESS */}
            {status === "pending" && (
              <div
                style={withdrawalActions}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedWithdrawal(
                      withdrawal
                    );
                    setAdminNote("");
                  }}
                  style={viewButton}
                >
                  View / Process
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  )}
</section>

{/* ============================================================
    WITHDRAWAL PROCESS MODAL
============================================================ */}

{selectedWithdrawal && (
  <div style={modalOverlay}>
    <div style={modalCard}>
      {/* HEADER */}
      <div style={modalHeader}>
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
            }}
          >
            Process Withdrawal
          </h2>

          <p
            style={{
              margin: "6px 0 0",
              color: "#6b7280",
              fontSize: 13,
            }}
          >
            Review payment details before
            processing.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setSelectedWithdrawal(null)
          }
          style={modalClose}
        >
          ×
        </button>
      </div>

      {/* AMOUNT */}
      <div style={modalAmountBox}>
        <span>
          Withdrawal Amount
        </span>

        <strong>
          ₹
          {Number(
            selectedWithdrawal.amount || 0
          ).toFixed(2)}
        </strong>
      </div>

      {/* USER DETAILS */}
      <div style={modalDetails}>
        <Detail
          label="User"
          value={
            selectedWithdrawal.profiles
              ?.full_name || "User"
          }
        />

        <Detail
          label="Email"
          value={
            selectedWithdrawal.profiles
              ?.email || "Unavailable"
          }
        />

        <Detail
          label="Method"
          value={String(
            selectedWithdrawal.method ||
              ""
          ).toUpperCase()}
        />

        {String(
          selectedWithdrawal.method || ""
        ).toLowerCase() === "upi" ? (
          <>
            <Detail
              label="UPI ID"
              value={
                selectedWithdrawal.upi_id ||
                "Not provided"
              }
            />

            <Detail
              label="Account Name"
              value={
                selectedWithdrawal.account_name ||
                "Not provided"
              }
            />
          </>
        ) : (
          <>
            <Detail
              label="Account Holder"
              value={
                selectedWithdrawal.account_name ||
                "Not provided"
              }
            />

            <Detail
              label="Bank"
              value={
                selectedWithdrawal.bank_name ||
                "Not provided"
              }
            />

            <Detail
              label="Account Number"
              value={
                selectedWithdrawal.account_number ||
                "Not provided"
              }
            />

            <Detail
              label="IFSC"
              value={
                selectedWithdrawal.ifsc_code ||
                "Not provided"
              }
            />
          </>
        )}
      </div>

      {/* ADMIN NOTE */}
      <label style={labelStyle}>
        Admin Note / Rejection Reason
      </label>

      <textarea
        value={adminNote}
        onChange={(e) =>
          setAdminNote(e.target.value)
        }
        placeholder="Optional for approval. Required for rejection."
        style={textareaStyle}
      />

      {/* ACTIONS */}
      <div style={modalActions}>
        <button
          type="button"
          disabled={
            withdrawalAction ===
            selectedWithdrawal.id
          }
          onClick={() =>
            processWithdrawal(
              selectedWithdrawal,
              "reject"
            )
          }
          style={rejectButton}
        >
          ❌ Reject
        </button>

        <button
          type="button"
          disabled={
            withdrawalAction ===
            selectedWithdrawal.id
          }
          onClick={() =>
            processWithdrawal(
              selectedWithdrawal,
              "approve"
            )
          }
          style={approveButton}
        >
          {withdrawalAction ===
          selectedWithdrawal.id
            ? "Processing..."
            : "✅ Approve"}
        </button>
      </div>
    </div>
  </div>
       )}
    </div>
  </div>
</main>
);
}
