"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

const empty = {
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
  const [ok, setOk] = useState(false);
  const [tab, setTab] = useState("overview");
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [edit, setEdit] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [action, setAction] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (!ok) return;

    const channel = supabase
      .channel("withdrawals")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "withdrawals",
        },
        loadWithdrawals
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ok]);

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
      .select("*")
      .eq("id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!data) return;

    setOk(true);
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

  function set(key: string, value: string) {
    setForm((x: any) => ({ ...x, [key]: value }));
  }

  function createCampaign() {
    setEdit(null);
    setForm(empty);
    setShow(true);
  }

  function editCampaign(c: any) {
    setEdit(c);
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
    setShow(true);
  }

  async function save(e: any) {
    e.preventDefault();

    if (!form.name || !form.landing_url) {
      setMsg("Campaign name and landing URL are required.");
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

    const result = edit
      ? await supabase.from("campaigns").update(data).eq("id", edit.id)
      : await supabase.from("campaigns").insert({
          ...data,
          slug:
            form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") +
            "-" +
            Date.now(),
          status: "active",
        });

    if (result.error) {
      setMsg(result.error.message);
      return;
    }

    setMsg(edit ? "Campaign updated." : "Campaign created.");
    setShow(false);
    setEdit(null);
    setForm(empty);
    loadCampaigns();
  }

  async function status(id: string, value: string) {
    await supabase
      .from("campaigns")
      .update({ status: value })
      .eq("id", id);

    loadCampaigns();
  }

  async function remove(id: string) {
    if (!confirm("Delete this campaign?")) return;

    await supabase.from("campaigns").delete().eq("id", id);
    loadCampaigns();
  }

  async function processWithdrawal() {
    if (!selected || !action) return;

    if (action === "reject" && !note.trim()) {
      setMsg("Rejection reason is required.");
      return;
    }

    const { error } = await supabase.rpc(
      "admin_process_withdrawal",
      {
        p_withdrawal_id: selected.id,
        p_action: action,
        p_admin_note: note || null,
      }
    );

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg(
      action === "approve"
        ? "Withdrawal approved."
        : "Withdrawal rejected."
    );

    setSelected(null);
    setAction("");
    setNote("");
    loadWithdrawals();
  }

  if (!ok) {
    return (
      <main style={S.center}>
        <h2>Checking Admin Access...</h2>
      </main>
    );
  }

  const active = campaigns.filter((x) => x.status === "active").length;
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
          <button onClick={() => supabase.auth.signOut().then(() => location.href = "/login")} style={S.darkBtn}>
            Logout
          </button>
        </header>

        <nav style={S.nav}>
          {["overview", "campaigns", "withdrawals"].map((x) => (
            <button
              key={x}
              onClick={() => setTab(x)}
              style={{
                ...S.tab,
                ...(tab === x ? S.tabOn : {}),
              }}
            >
              {x[0].toUpperCase() + x.slice(1)}
              {x === "withdrawals" && pending.length > 0 && (
                <i>{pending.length}</i>
              )}
            </button>
          ))}
        </nav>

        {msg && (
          <div style={S.msg} onClick={() => setMsg("")}>
            {msg}
          </div>
        )}

        {tab === "overview" && (
          <>
            <section style={S.hero}>
              <div>
                <small>AURACAMP CONTROL CENTER</small>
                <h1>Platform Operations</h1>
                <p>Manage campaigns and withdrawals.</p>
              </div>
              <strong style={{ fontSize: 45 }}>⚡</strong>
            </section>

            <div style={S.grid}>
              <Stat title="Campaigns" value={campaigns.length} icon="📦" />
              <Stat title="Active" value={active} icon="🟢" />
              <Stat title="Pending Requests" value={pending.length} icon="💸" />
              <Stat title="Pending Amount" value={`₹${pendingAmount}`} icon="💰" />
            </div>
          </>
        )}

        {tab === "campaigns" && (
          <section style={S.card}>
            <div style={S.row}>
              <div>
                <h2>Campaigns</h2>
                <small>Create and manage offers.</small>
              </div>
              <button onClick={() => show ? setShow(false) : createCampaign()} style={S.darkBtn}>
                {show ? "Close" : "+ Create"}
              </button>
            </div>

            {show && (
              <form onSubmit={save} style={S.form}>
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
                        onChange={(e) => set(key, e.target.value)}
                        placeholder={label}
                        type={
                          key.includes("payout") ||
                          key === "reward" ||
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
                    onChange={(e) => set("description", e.target.value)}
                  />
                </label>

                <label>
                  Terms
                  <textarea
                    value={form.terms}
                    onChange={(e) => set("terms", e.target.value)}
                  />
                </label>

                <button style={S.darkBtn}>
                  {edit ? "Update Campaign" : "Create Campaign"}
                </button>
              </form>
            )}

            <div style={S.list}>
              {campaigns.map((c) => (
                <div key={c.id} style={S.item}>
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
                        status(
                          c.id,
                          c.status === "active" ? "paused" : "active"
                        )
                      }
                    >
                      {c.status === "active" ? "Pause" : "Activate"}
                    </button>

                    <button onClick={() => remove(c.id)}>Delete</button>
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
                <h2>Withdrawals</h2>
                <small>Review user withdrawal requests.</small>
              </div>
              <button onClick={loadWithdrawals} style={S.darkBtn}>
                Refresh
              </button>
            </div>

            <div style={S.list}>
              {withdrawals.map((w) => (
                <div key={w.id} style={S.item}>
                  <div>
                    <b>₹{Number(w.amount).toFixed(2)}</b>
                    <small>
                      {w.method?.toUpperCase()} • {w.account_name || "User"}
                    </small>

                    {w.method === "upi" ? (
                      <small>UPI: {w.upi_id || "-"}</small>
                    ) : (
                      <small>
                        {w.bank_name || "-"} ••••{w.account_number?.slice(-4)}
                        {" "}• {w.ifsc_code || "-"}
                      </small>
                    )}

                    <span style={S.badge}>{w.status}</span>
                  </div>

                  {w.status === "pending" && (
                    <div style={S.actions}>
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
                    </div>
                  )}
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
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  action === "approve"
                    ? "Optional admin note"
                    : "Rejection reason"
                }
              />

              <div style={S.actions}>
                <button onClick={() => setSelected(null)}>
                  Cancel
                </button>

                <button onClick={processWithdrawal} style={S.darkBtn}>
                  Confirm
                </button>
              </div>
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
    background: "#f5f7fb",
    padding: 15,
    fontFamily: "system-ui,sans-serif",
    color: "#111827",
  },
  wrap: {
    maxWidth: 1100,
    margin: "auto",
  },
  center: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    fontFamily: "system-ui",
  },
  header: {
    background: "#111827",
    color: "white",
    padding: 20,
    borderRadius: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: {
    fontSize: 25,
    letterSpacing: 1,
  },
  nav: {
    display: "flex",
    gap: 6,
    margin: "14px 0",
    background: "white",
    padding: 5,
    borderRadius: 12,
  },
  tab: {
    border: 0,
    background: "transparent",
    padding: "10px 14px",
    borderRadius: 9,
    cursor: "pointer",
    fontWeight: 700,
  },
  tabOn: {
    background: "#111827",
    color: "white",
  },
  hero: {
    background: "#111827",
    color: "white",
    padding: 25,
    borderRadius: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 12,
    margin: "14px 0",
  },
  stat: {
    background: "white",
    padding: 18,
    borderRadius: 15,
    border: "1px solid #e5e7eb",
  },
  card: {
    background: "white",
    padding: 20,
    borderRadius: 18,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  form: {
    background: "#f8fafc",
    padding: 15,
    borderRadius: 14,
    marginBottom: 18,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
    gap: 12,
  },
  list: {
    display: "grid",
    gap: 10,
  },
  item: {
    border: "1px solid #e5e7eb",
    padding: 14,
    borderRadius: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  actions: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  darkBtn: {
    background: "#111827",
    color: "white",
    border: 0,
    padding: "10px 14px",
    borderRadius: 9,
    cursor: "pointer",
    fontWeight: 700,
  },
  badge: {
    display: "inline-block",
    marginTop: 7,
    padding: "3px 8px",
    borderRadius: 20,
    background: "#eef2ff",
    fontSize: 11,
    fontWeight: 700,
  },
  msg: {
    background: "#dcfce7",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  modal: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.5)",
    display: "grid",
    placeItems: "center",
    padding: 15,
  },
  modalBox: {
    background: "white",
    width: "min(450px,100%)",
    padding: 20,
    borderRadius: 18,
  },
};
