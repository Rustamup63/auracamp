"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

const blank = {
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
  const [admin, setAdmin] = useState(false);
  const [tab, setTab] = useState("overview");
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [form, setForm] = useState<any>(blank);
  const [editing, setEditing] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [action, setAction] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [loadingUser, setLoadingUser] = useState(false);

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (!admin) return;

    const channel = supabase
      .channel("admin-withdrawals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawals" },
        loadWithdrawals
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [admin]);

  async function init() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      location.href = "/login";
      return;
    }

    const { data } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!data) {
      setMessage("Admin access denied.");
      return;
    }

    setAdmin(true);
    loadCampaigns();
    loadWithdrawals();
  }

  async function loadCampaigns() {
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    setCampaigns(data || []);
  }

  async function loadWithdrawals() {
    const { data } = await supabase
      .from("withdrawals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    setWithdrawals(data || []);
  }

  function change(key: string, value: string) {
    setForm((x: any) => ({ ...x, [key]: value }));
  }

  function newCampaign() {
    setEditing(null);
    setForm(blank);
    setFormOpen(true);
  }

  function editCampaign(c: any) {
    setEditing(c);
    setForm({
      name: c.name || "",
      description: c.description || "",
      category: c.category || "Other",
      image_url: c.image_url || "",
      landing_url: c.landing_url || "",
      reward: String(c.reward ?? ""),
      advertiser_payout: String(c.advertiser_payout ?? ""),
      conversion_type: c.conversion_type || "Complete Offer",
      terms: c.terms || "",
      daily_limit: c.daily_limit == null ? "" : String(c.daily_limit),
      total_limit: c.total_limit == null ? "" : String(c.total_limit),
    });
    setFormOpen(true);
  }

  async function saveCampaign(e: any) {
    e.preventDefault();

    if (!form.name || !form.landing_url) {
      setMessage("Name and landing URL are required.");
      return;
    }

    const data = {
      name: form.name,
      description: form.description || null,
      category: form.category,
      image_url: form.image_url || null,
      landing_url: form.landing_url,
      reward: Number(form.reward || 0),
      advertiser_payout: Number(form.advertiser_payout || 0),
      conversion_type: form.conversion_type,
      terms: form.terms || null,
      daily_limit: form.daily_limit ? Number(form.daily_limit) : null,
      total_limit: form.total_limit ? Number(form.total_limit) : null,
    };

    const result = editing
      ? await supabase.from("campaigns").update(data).eq("id", editing.id)
      : await supabase.from("campaigns").insert({
          ...data,
          slug:
            form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") +
            "-" +
            Date.now(),
          status: "active",
        });

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    setMessage(editing ? "Campaign updated." : "Campaign created.");
    setFormOpen(false);
    setEditing(null);
    setForm(blank);
    loadCampaigns();
  }

  async function campaignStatus(id: string, status: string) {
    const { error } = await supabase
      .from("campaigns")
      .update({ status })
      .eq("id", id);

    if (error) setMessage(error.message);
    loadCampaigns();
  }

  async function deleteCampaign(id: string) {
    if (!confirm("Delete this campaign?")) return;

    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", id);

    if (error) setMessage(error.message);
    else setMessage("Campaign deleted.");

    loadCampaigns();
  }

  async function viewUser(userId: string) {
    setLoadingUser(true);
    setUserData(null);

    const [p, c, t, w, cl, campaignsData] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("conversions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("clicks")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase.from("campaigns").select("id,name"),
    ]);

    const names: any = {};
    (campaignsData.data || []).forEach((x: any) => {
      names[x.id] = x.name;
    });

    setUserData({
      profile: p.data,
      conversions: (c.data || []).map((x: any) => ({
        ...x,
        campaign_name: names[x.campaign_id] || x.campaign_id,
      })),
      transactions: t.data || [],
      withdrawals: w.data || [],
      clicks: cl.data || [],
    });

    setLoadingUser(false);
  }

  async function processWithdrawal() {
    if (!selected) return;

    if (action === "reject" && !note.trim()) {
      setMessage("Rejection reason is required.");
      return;
    }

    const { error } = await supabase.rpc("admin_process_withdrawal", {
      p_withdrawal_id: selected.id,
      p_action: action,
      p_admin_note: note || null,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      action === "approve"
        ? "Withdrawal approved."
        : "Withdrawal rejected."
    );

    setSelected(null);
    setAction("");
    setNote("");
    loadWithdrawals();
  }

  if (!admin) {
    return (
      <main style={S.center}>
        <h2>{message || "Checking Admin Access..."}</h2>
      </main>
    );
  }

  const pending = withdrawals.filter((x) => x.status === "pending");
  const pendingAmount = pending.reduce(
    (a, x) => a + Number(x.amount || 0),
    0
  );

  return (
    <main style={S.page}>
      <div style={S.wrap}>
        <header style={S.header}>
          <div>
            <b style={S.logo}>AURACAMP</b>
            <small> ADMIN PANEL</small>
          </div>

          <button
            style={S.dark}
            onClick={async () => {
              await supabase.auth.signOut();
              location.href = "/login";
            }}
          >
            Logout
          </button>
        </header>

        <nav style={S.nav}>
          {["overview", "campaigns", "withdrawals"].map((x) => (
            <button
              key={x}
              onClick={() => setTab(x)}
              style={{ ...S.tab, ...(tab === x ? S.active : {}) }}
            >
              {x[0].toUpperCase() + x.slice(1)}
              {x === "withdrawals" && pending.length > 0 && (
                <i>{pending.length}</i>
              )}
            </button>
          ))}
        </nav>

        {message && (
          <div style={S.message} onClick={() => setMessage("")}>
            {message}
          </div>
        )}

        {tab === "overview" && (
          <>
            <section style={S.hero}>
              <div>
                <small>AURACAMP CONTROL CENTER</small>
                <h1>Platform Operations</h1>
                <p>Manage offers, users and withdrawals.</p>
              </div>
              <b style={{ fontSize: 45 }}>⚡</b>
            </section>

            <div style={S.grid}>
              <Stat title="Campaigns" value={campaigns.length} icon="📦" />
              <Stat
                title="Active"
                value={campaigns.filter((x) => x.status === "active").length}
                icon="🟢"
              />
              <Stat title="Pending" value={pending.length} icon="💸" />
              <Stat title="Pending Amount" value={`₹${pendingAmount}`} icon="💰" />
            </div>
          </>
        )}

        {tab === "campaigns" && (
          <section style={S.card}>
            <div style={S.row}>
              <div>
                <h2>Campaign Management</h2>
                <small>Create and manage AURACAMP offers.</small>
              </div>

              <button
                style={S.dark}
                onClick={() => (formOpen ? setFormOpen(false) : newCampaign())}
              >
                {formOpen ? "Close" : "+ Create"}
              </button>
            </div>

            {formOpen && (
              <form onSubmit={saveCampaign} style={S.form}>
                <div style={S.formGrid}>
                  {[
                    ["name", "Campaign Name"],
                    ["category", "Category"],
                    ["landing_url", "Landing URL"],
                    ["image_url", "Image URL"],
                    ["advertiser_payout", "Advertiser Payout"],
                    ["reward", "User Reward"],
                    ["conversion_type", "Conversion Type"],
                    ["daily_limit", "Daily Limit"],
                    ["total_limit", "Total Limit"],
                  ].map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <input
                        value={form[key]}
                        onChange={(e) => change(key, e.target.value)}
                        type={
                          key === "reward" ||
                          key === "advertiser_payout" ||
                          key.includes("limit")
                            ? "number"
                            : "text"
                        }
                      />
                    </label>
                  ))}
                </div>

                <label>
                  Description
                  <textarea
                    value={form.description}
                    onChange={(e) => change("description", e.target.value)}
                  />
                </label>

                <label>
                  Terms
                  <textarea
                    value={form.terms}
                    onChange={(e) => change("terms", e.target.value)}
                  />
                </label>

                <button style={S.dark}>
                  {editing ? "Update Campaign" : "Create Campaign"}
                </button>
              </form>
            )}

            <div style={S.list}>
              {campaigns.map((c) => (
                <div style={S.item} key={c.id}>
                  <div>
                    <b>{c.name}</b>
                    <small>
                      {c.category} • Reward ₹{c.reward} • Payout ₹
                      {c.advertiser_payout}
                    </small>
                    <span style={S.badge}>{c.status}</span>
                  </div>

                  <div style={S.actions}>
                    <button onClick={() => editCampaign(c)}>Edit</button>

                    <button
                      onClick={() =>
                        campaignStatus(
                          c.id,
                          c.status === "active" ? "paused" : "active"
                        )
                      }
                    >
                      {c.status === "active" ? "Pause" : "Activate"}
                    </button>

                    <button onClick={() => deleteCampaign(c.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "withdrawals" && (
          <section style={S.card}>
            <div style={S.row}>
              <div>
                <h2>Withdrawal Management</h2>
                <small>Full payment and user information.</small>
              </div>

              <button style={S.dark} onClick={loadWithdrawals}>
                Refresh
              </button>
            </div>

            <div style={S.list}>
              {withdrawals.map((w) => (
                <div style={S.withdrawal} key={w.id}>
                  <div>
                    <h2>₹{Number(w.amount).toFixed(2)}</h2>

                    <b>{w.account_name || "User"}</b>

                    <span style={S.badge}>{w.status}</span>

                    <div style={S.details}>
                      <b>Payment: {String(w.method).toUpperCase()}</b>
                      <span>Account Holder: {w.account_name || "-"}</span>
                      <span>Bank: {w.bank_name || "-"}</span>
                      <span>
                        Account Number: {w.account_number || "-"}
                      </span>
                      <span>IFSC: {w.ifsc_code || "-"}</span>
                      <span>UPI ID: {w.upi_id || "-"}</span>
                      <span>
                        Requested:{" "}
                        {new Date(w.created_at).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  <div style={S.actions}>
                    <button onClick={() => viewUser(w.user_id)}>
                      View User Details
                    </button>

                    {w.status === "pending" && (
                      <>
                        <button
                          onClick={() => {
                            setSelected(w);
                            setAction("reject");
                          }}
                        >
                          Reject
                        </button>

                        <button
                          onClick={() => {
                            setSelected(w);
                            setAction("approve");
                          }}
                        >
                          Approve
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {selected && (
          <div style={S.modal}>
            <div style={S.modalBox}>
              <h2>
                {action === "approve"
                  ? "Approve Withdrawal"
                  : "Reject Withdrawal"}
              </h2>

              <p>
                Amount: <b>₹{selected.amount}</b>
              </p>

              <textarea
                placeholder={
                  action === "approve"
                    ? "Admin note (optional)"
                    : "Rejection reason"
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />

              <div style={S.actions}>
                <button onClick={() => setSelected(null)}>Cancel</button>
                <button style={S.dark} onClick={processWithdrawal}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {userData && (
          <div style={S.modal}>
            <div style={S.userModal}>
              <div style={S.row}>
                <h2>User Details</h2>
                <button onClick={() => setUserData(null)}>✕</button>
              </div>

              {loadingUser ? (
                <p>Loading user data...</p>
              ) : (
                <>
                  <section style={S.userBox}>
                    <h3>👤 Profile</h3>
                    <p>
                      <b>Name:</b> {userData.profile?.full_name || "-"}
                    </p>
                    <p>
                      <b>Registered Email:</b>{" "}
                      {userData.profile?.email || "-"}
                    </p>
                    <p>
                      <b>User ID:</b> {userData.profile?.id || "-"}
                    </p>
                    <p>
                      <b>Referral Code:</b>{" "}
                      {userData.profile?.referral_code || "-"}
                    </p>
                  </section>

                  <section style={S.userBox}>
                    <h3>💰 Wallet</h3>
                    <p>
                      Balance: ₹
                      {Number(userData.profile?.wallet_balance || 0).toFixed(2)}
                    </p>
                    <p>
                      Pending: ₹
                      {Number(userData.profile?.pending_balance || 0).toFixed(2)}
                    </p>
                    <p>
                      Total Earned: ₹
                      {Number(userData.profile?.total_earned || 0).toFixed(2)}
                    </p>
                    <p>
                      Total Withdrawn: ₹
                      {Number(
                        userData.profile?.total_withdrawn || 0
                      ).toFixed(2)}
                    </p>
                  </section>

                  <section style={S.userBox}>
                    <h3>🏦 Withdrawal History</h3>
                    {userData.withdrawals.length === 0 ? (
                      <small>No withdrawal history.</small>
                    ) : (
                      userData.withdrawals.map((x: any) => (
                        <div style={S.history} key={x.id}>
                          <b>₹{Number(x.amount).toFixed(2)}</b>
                          <span>Status: {x.status}</span>
                          <span>Method: {x.method}</span>
                          <span>Account Holder: {x.account_name || "-"}</span>
                          <span>Bank: {x.bank_name || "-"}</span>
                          <span>
                            Account Number: {x.account_number || "-"}
                          </span>
                          <span>IFSC: {x.ifsc_code || "-"}</span>
                          <span>UPI: {x.upi_id || "-"}</span>
                          <span>
                            {new Date(x.created_at).toLocaleString("en-IN")}
                          </span>
                        </div>
                      ))
                    )}
                  </section>

                  <section style={S.userBox}>
                    <h3>🎯 Offer / Conversion History</h3>
                    {userData.conversions.map((x: any) => (
                      <div style={S.history} key={x.id}>
                        <b>{x.campaign_name}</b>
                        <span>Reward: ₹{x.reward}</span>
                        <span>Payout: ₹{x.advertiser_payout}</span>
                        <span>Status: {x.status}</span>
                        <span>Conversion: {x.conversion_id}</span>
                        {x.rejection_reason && (
                          <span>Reason: {x.rejection_reason}</span>
                        )}
                        <span>
                          {new Date(x.created_at).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </section>

                  <section style={S.userBox}>
                    <h3>💳 Wallet Transactions</h3>
                    {userData.transactions.map((x: any) => (
                      <div style={S.history} key={x.id}>
                        <b>{x.type}</b>
                        <span>₹{Number(x.amount).toFixed(2)}</span>
                        <span>{x.description || "-"}</span>
                        <span>
                          {new Date(x.created_at).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </section>

                  <section style={S.userBox}>
                    <h3>🖱️ Click History</h3>
                    {userData.clicks.map((x: any) => (
                      <div style={S.history} key={x.id}>
                        <b>{x.click_id}</b>
                        <span>Campaign: {x.campaign_id}</span>
                        <span>Status: {x.status}</span>
                        <span>
                          {new Date(x.created_at).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </section>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({
  title,
  value,
  icon,
}: {
  title: string;
  value: any;
  icon: string;
}) {
  return (
    <div style={S.stat}>
      <span>{icon}</span>
      <small>{title}</small>
      <b>{value}</b>
    </div>
  );
}

const S: any = {
  page: {
    minHeight: "100vh",
    background: "#f4f6fa",
    padding: 14,
    fontFamily: "Inter,system-ui,sans-serif",
    color: "#111827",
  },
  wrap: { maxWidth: 1100, margin: "auto" },
  center: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    fontFamily: "system-ui",
  },
  header: {
    background: "#111827",
    color: "#fff",
    padding: "18px 20px",
    borderRadius: 17,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: { fontSize: 24, letterSpacing: 1 },
  nav: {
    display: "flex",
    gap: 5,
    margin: "12px 0",
    background: "#fff",
    padding: 5,
    borderRadius: 12,
    overflowX: "auto",
  },
  tab: {
    border: 0,
    background: "transparent",
    padding: "10px 14px",
    borderRadius: 9,
    cursor: "pointer",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  active: { background: "#111827", color: "#fff" },
  hero: {
    background: "#111827",
    color: "#fff",
    padding: 25,
    borderRadius: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
    gap: 12,
    margin: "14px 0",
  },
  stat: {
    background: "#fff",
    padding: 17,
    borderRadius: 14,
    display: "grid",
    gap: 5,
    border: "1px solid #e5e7eb",
  },
  card: {
    background: "#fff",
    padding: 19,
    borderRadius: 17,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  dark: {
    background: "#111827",
    color: "#fff",
    border: 0,
    padding: "10px 14px",
    borderRadius: 9,
    cursor: "pointer",
    fontWeight: 700,
  },
  message: {
    background: "#dcfce7",
    padding: 11,
    borderRadius: 10,
    marginBottom: 12,
    cursor: "pointer",
  },
  form: {
    background: "#f8fafc",
    padding: 15,
    borderRadius: 14,
    margin: "15px 0",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
    gap: 11,
  },
  formLabel: { display: "grid", gap: 5 },
  list: { display: "grid", gap: 10, marginTop: 15 },
  item: {
    border: "1px solid #e5e7eb",
    padding: 14,
    borderRadius: 14,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  withdrawal: {
    border: "1px solid #e5e7eb",
    padding: 16,
    borderRadius: 15,
    display: "flex",
    justifyContent: "space-between",
    gap: 15,
    flexWrap: "wrap",
  },
  actions: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    alignItems: "center",
  },
  badge: {
    display: "inline-block",
    margin: "6px 5px",
    padding: "3px 8px",
    borderRadius: 20,
    background: "#eef2ff",
    fontSize: 11,
    fontWeight: 700,
  },
  details: {
    display: "grid",
    gap: 4,
    marginTop: 10,
    fontSize: 13,
    color: "#4b5563",
  },
  modal: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.55)",
    display: "grid",
    placeItems: "center",
    padding: 12,
    zIndex: 100,
  },
  modalBox: {
    background: "#fff",
    width: "min(430px,100%)",
    padding: 20,
    borderRadius: 17,
  },
  userModal: {
    background: "#f8fafc",
    width: "min(700px,100%)",
    maxHeight: "92vh",
    overflowY: "auto",
    padding: 18,
    borderRadius: 18,
  },
  userBox: {
    background: "#fff",
    padding: 14,
    borderRadius: 13,
    marginTop: 10,
    border: "1px solid #e5e7eb",
  },
  history: {
    background: "#f8fafc",
    padding: 11,
    borderRadius: 10,
    marginTop: 7,
    display: "grid",
    gap: 3,
    fontSize: 12,
  },
};
