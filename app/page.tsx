"use client";

import { useEffect, useState } from "react";
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

const TELEGRAM = "https://t.me/Auracampaign";

type Profile = {
  user_code: string | null;
  full_name: string | null;
  email: string | null;
  wallet_balance: number;
  pending_balance: number;
  total_earned: number;
  total_withdrawn: number;
};

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  reward: number;
  image_url: string | null;
  landing_url: string | null;
};

type Transaction = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
};

type Withdrawal = {
  id: string;
  amount: number;
  method: string | null;
  status: string;
  created_at: string;
};

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.replace("/login");
        return;
      }

      const { data: admin } = await supabase
        .from("admin_users")
        .select("id")
        .eq("id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (admin) {
        window.location.replace("/admin");
        return;
      }

      const [p, c, t, w] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "user_code,full_name,email,wallet_balance,pending_balance,total_earned,total_withdrawn"
          )
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("campaigns")
          .select(
            "id,name,description,category,reward,image_url,landing_url"
          )
          .eq("status", "active")
          .order("created_at", { ascending: false }),

        supabase
          .from("wallet_transactions")
          .select("id,type,amount,description,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),

        supabase
          .from("withdrawals")
          .select("id,amount,method,status,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (!alive) return;

      setProfile(p.data);
      setCampaigns(c.data || []);
      setTransactions(t.data || []);
      setWithdrawals(w.data || []);
      setLoading(false);
    }

    init();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function realtime() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      channel = supabase
        .channel("auracamp-dashboard-" + user.id)

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          async () => {
            const { data } = await supabase
              .from("profiles")
              .select(
                "user_code,full_name,email,wallet_balance,pending_balance,total_earned,total_withdrawn"
              )
              .eq("id", user.id)
              .maybeSingle();

            if (data) setProfile(data);
          }
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "withdrawals",
            filter: `user_id=eq.${user.id}`,
          },
          async () => {
            const { data } = await supabase
              .from("withdrawals")
              .select("id,amount,method,status,created_at")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(5);

            setWithdrawals(data || []);
          }
        )

        .subscribe();
    }

    realtime();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  async function startOffer(campaign: Campaign) {
    if (starting) return;

    setStarting(campaign.id);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.replace("/login");
        return;
      }

      if (!campaign.landing_url) return;

      const clickId = crypto.randomUUID();

      const { error } = await supabase.from("clicks").insert({
        user_id: user.id,
        campaign_id: campaign.id,
        click_id: clickId,
        status: "clicked",
        user_agent: navigator.userAgent,
      });

      if (error) {
        console.error(error);
        return;
      }

      const separator = campaign.landing_url.includes("?")
        ? "&"
        : "?";

      window.location.href =
        campaign.landing_url +
        separator +
        "click_id=" +
        encodeURIComponent(clickId);
    } finally {
      setStarting(null);
    }
  }

  if (loading) {
    return (
      <>
        <style>{css}</style>
        <main className="loading">
          <div className="loadingBrand">
            <span>AURA</span> CAMP
          </div>
          <div className="spinner" />
          <small>Loading your dashboard...</small>
        </main>
      </>
    );
  }

  const name =
    profile?.full_name ||
    profile?.email?.split("@")[0] ||
    "User";

  const wallet = Number(profile?.wallet_balance || 0);
  const pending = Number(profile?.pending_balance || 0);
  const earned = Number(profile?.total_earned || 0);

  return (
    <>
      <style>{css}</style>

      <main className="page">
        <div className="app">

          {/* HEADER */}
          <header className="header">
            <div>
              <div className="brand">
                <span>AURA</span> <b>CAMP</b>
              </div>
              <small>Earn • Explore • Grow</small>
            </div>

            <div className="headerBtns">
              <button
                onClick={() =>
                  (window.location.href = "/notifications")
                }
                aria-label="Notifications"
              >
                🔔
              </button>

              <button
                className="logout"
                onClick={logout}
              >
                Logout
              </button>
            </div>
          </header>

          {/* WELCOME */}
          <section className="welcome card">
            <div className="welcomeInfo">
              <div className="avatar">
                {name.charAt(0).toUpperCase()}
              </div>

              <div>
                <small>Welcome back 👋</small>
                <h1>{name}</h1>
                <p>Complete offers and grow your earnings.</p>
              </div>
            </div>

            <button
              className="earnButton"
              onClick={() =>
                document
                  .getElementById("offers")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              ✨ Start Earning
            </button>
          </section>

          {/* AURA ID */}
          <section className="idCard card">
            <div className="idIcon">AC</div>

            <div className="idText">
              <small>AURA CAMP ID</small>
              <strong>{profile?.user_code || "AC----"}</strong>
            </div>

            <span className="verified">✓ Verified</span>
          </section>

          {/* BALANCE */}
          <section className="balance">
            <div className="balanceTop">
              <div>
                <small>Available Balance</small>
                <strong>₹{wallet.toFixed(2)}</strong>
              </div>

              <div className="walletIcon">💳</div>
            </div>

            <div className="balanceBottom">
              <span>Ready to withdraw</span>

              <button
                onClick={() =>
                  (window.location.href = "/withdraw")
                }
              >
                + Withdraw
              </button>
            </div>
          </section>

          <section className="stats">
            <div className="stat card">
              <div className="statIcon purple">◷</div>
              <small>Pending Rewards</small>
              <strong>₹{pending.toFixed(2)}</strong>
              <span>Under verification</span>
            </div>

            <div className="stat card">
              <div className="statIcon orange">🏆</div>
              <small>Total Earned</small>
              <strong>₹{earned.toFixed(2)}</strong>
              <span>Lifetime earnings</span>
            </div>
          </section>

          {/* WITHDRAWAL */}
          {withdrawals.length > 0 && (
            <section className="section">
              <div className="sectionHead">
                <div>
                  <h2>Latest Withdrawal</h2>
                  <p>Status updates automatically.</p>
                </div>
              </div>

              <div className="withdrawCard card">
                <div className="withdrawLeft">
                  <div className="withdrawIcon">₹</div>

                  <div>
                    <strong>
                      ₹{Number(withdrawals[0].amount).toFixed(2)}
                    </strong>
                    <small>
                      {formatDate(withdrawals[0].created_at)}
                    </small>
                  </div>
                </div>

                <Status status={withdrawals[0].status} />
              </div>
            </section>
          )}

          {/* QUICK ACTIONS */}
          <section className="section">
            <div className="sectionHead">
              <div>
                <h2>Quick Actions</h2>
                <p>Everything you need in one place.</p>
              </div>
            </div>

            <div className="quickGrid">
              <button
                onClick={() =>
                  document
                    .getElementById("offers")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                <i className="qRed">🎁</i>
                <span>
                  <b>Earn Rewards</b>
                  <small>Explore & Earn</small>
                </span>
              </button>

              <button
                onClick={() =>
                  (window.location.href = "/withdraw")
                }
              >
                <i className="qGreen">💸</i>
                <span>
                  <b>Withdraw</b>
                  <small>Get Your Money</small>
                </span>
              </button>

              <button
                onClick={() =>
                  (window.location.href = "/referrals")
                }
              >
                <i className="qPink">👥</i>
                <span>
                  <b>Refer & Earn</b>
                  <small>Invite & Earn</small>
                </span>
              </button>

              <button
                onClick={() =>
                  (window.location.href = "/support")
                }
              >
                <i className="qBlue">🎧</i>
                <span>
                  <b>Support</b>
                  <small>Need Help?</small>
                </span>
              </button>
            </div>
          </section>

          {/* OFFERS */}
          <section id="offers" className="section">
            <div className="sectionHead">
              <div>
                <h2>Available Offers</h2>
                <p>Complete offers and earn real rewards.</p>
              </div>

              <span className="count">
                {campaigns.length} Offers
              </span>
            </div>

            {campaigns.length === 0 ? (
              <div className="empty card">
                <div>🎁</div>
                <b>No offers available</b>
                <p>New earning opportunities will appear here.</p>
              </div>
            ) : (
              <div className="offers">
                {campaigns.map((campaign) => (
                  <article className="offer card" key={campaign.id}>
                    <div className="offerImage">
                      {campaign.image_url ? (
                        <img
                          src={campaign.image_url}
                          alt={campaign.name}
                          loading="lazy"
                        />
                      ) : (
                        <span>🎁</span>
                      )}

                      <b>
                        +₹{Number(campaign.reward).toFixed(2)}
                      </b>
                    </div>

                    <div className="offerBody">
                      <div className="offerMeta">
                        <span>
                          {campaign.category || "Offer"}
                        </span>
                        <b>✓ Available</b>
                      </div>

                      <h3>{campaign.name}</h3>

                      <p>
                        {campaign.description ||
                          "Complete this offer and earn your reward."}
                      </p>

                      <button
                        className="start"
                        disabled={starting === campaign.id}
                        onClick={() => startOffer(campaign)}
                      >
                        {starting === campaign.id
                          ? "Starting..."
                          : "Start Offer"}
                        <span>→</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* RECENT ACTIVITY */}
          <section className="section">
            <div className="sectionHead">
              <div>
                <small className="eyebrow">WALLET</small>
                <h2>Recent Activity</h2>
                <p>Your latest wallet transactions.</p>
              </div>

              {transactions.length > 0 && (
                <button
                  className="viewAll"
                  onClick={() =>
                    (window.location.href = "/transactions")
                  }
                >
                  View All →
                </button>
              )}
            </div>

            {transactions.length === 0 ? (
              <div className="empty compact card">
                <div>📊</div>
                <b>No transactions yet</b>
                <p>Your earnings will appear here.</p>
              </div>
            ) : (
              <div className="transactions card">
                {transactions.map((t) => {
                  const positive = Number(t.amount) >= 0;

                  return (
                    <div className="transaction" key={t.id}>
                      <div className="transactionLeft">
                        <i className={positive ? "plus" : "minus"}>
                          {positive ? "+" : "−"}
                        </i>

                        <div>
                          <b>
                            {t.description ||
                              t.type.replaceAll("_", " ")}
                          </b>

                          <small>
                            {formatDate(t.created_at)}
                          </small>
                        </div>
                      </div>

                      <strong
                        className={positive ? "positive" : "negative"}
                      >
                        {positive ? "+" : "−"}₹
                        {Math.abs(Number(t.amount)).toFixed(2)}
                      </strong>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <footer>
            <b>
              <span>AURA</span> CAMP
            </b>
            <small>Earn • Explore • Grow</small>
          </footer>
        </div>

        {/* BOTTOM NAV */}
        <nav className="bottomNav">
          <button
            className="active"
            onClick={() =>
              window.scrollTo({ top: 0, behavior: "smooth" })
            }
          >
            <span>⌂</span>
            <small>Home</small>
          </button>

          <button
            onClick={() =>
              document
                .getElementById("offers")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <span>▦</span>
            <small>Offers</small>
          </button>

          <button
            className="telegram"
            onClick={() => {
              window.location.href = TELEGRAM;
            }}
          >
            <span>✈</span>
            <small>Telegram</small>
          </button>

          <button
            onClick={() =>
              (window.location.href = "/my-offers")
            }
          >
            <span>▤</span>
            <small>My Offers</small>
          </button>

          <button
            onClick={() =>
              (window.location.href = "/profile")
            }
          >
            <span>♙</span>
            <small>Profile</small>
          </button>
        </nav>
      </main>
    </>
  );
}

function Status({ status }: { status: string }) {
  const s = status.toLowerCase();

  if (
    s === "approved" ||
    s === "paid" ||
    s === "success" ||
    s === "completed"
  ) {
    return <span className="status paid">✓ Paid</span>;
  }

  if (s === "rejected" || s === "failed") {
    return <span className="status rejected">✕ Rejected</span>;
  }

  return <span className="status pending">◷ Pending</span>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const css = `
*{box-sizing:border-box}
html,body{margin:0;padding:0;overflow-x:hidden}
body{background:#f3fafb;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17202b}
button{font:inherit;-webkit-tap-highlight-color:transparent}
.page{min-height:100vh;padding:10px 10px 105px;background:linear-gradient(145deg,#f1fbfc,#f7fbff 55%,#faf7ff)}
.app{width:100%;max-width:540px;margin:auto}
.card{background:rgba(255,255,255,.96);border:1px solid #e0e9ec;box-shadow:0 8px 28px rgba(20,60,80,.055)}
.header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 13px;border-radius:18px;margin-bottom:10px;background:#fff;border:1px solid #e0e9ec}
.brand{font-size:21px;font-weight:950;letter-spacing:-1px;line-height:1}
.brand span{color:#111827}.brand b{color:#16a34a}
.header small{display:block;margin-top:4px;color:#94a3a8;font-size:8px}
.headerBtns{display:flex;gap:6px}.headerBtns button{border:1px solid #dfe8eb;background:#fff;border-radius:11px;height:36px;padding:0 10px;font-size:14px}.headerBtns .logout{color:#fff;background:#132f3f;border-color:#132f3f;font-size:9px;font-weight:850}
.welcome{padding:15px;border-radius:20px;margin-bottom:10px;background:linear-gradient(135deg,#fff,#f6fbfc 58%,#f5f0ff);display:flex;align-items:center;justify-content:space-between;gap:8px}
.welcomeInfo{display:flex;align-items:center;gap:10px;min-width:0}.avatar{width:47px;height:47px;min-width:47px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,#155eef,#16a34a);font-size:18px;font-weight:900}
.welcomeInfo small{color:#71808a;font-size:10px}.welcomeInfo h1{margin:3px 0 0;font-size:21px}.welcomeInfo p{margin:5px 0 0;color:#71808a;font-size:9px}.earnButton{border:0;border-radius:10px;padding:9px;color:#138a50;background:#edf9f5;font-size:8px;font-weight:850}
.idCard{display:flex;align-items:center;gap:9px;padding:10px 12px;border-radius:17px;margin-bottom:10px}
.idIcon{width:39px;height:39px;min-width:39px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(135deg,#155eef,#16a34a);font-size:10px;font-weight:950}
.idText{flex:1}.idText small{display:block;color:#98a5ad;font-size:8px;font-weight:850;letter-spacing:.6px}.idText strong{display:block;margin-top:2px;font-size:14px}.verified{padding:6px 8px;border-radius:999px;color:#059669;background:#ecfdf5;font-size:8px;font-weight:850}
.balance{min-height:142px;padding:17px;border-radius:21px;color:#fff;background:linear-gradient(135deg,#123746,#164b59 55%,#166a51);box-shadow:0 14px 34px rgba(18,55,70,.18)}
.balanceTop{display:flex;justify-content:space-between}.balanceTop small{display:block;opacity:.75;font-size:10px}.balanceTop strong{display:block;margin-top:5px;font-size:31px}.walletIcon{width:46px;height:46px;display:flex;align-items:center;justify-content:center;border-radius:14px;background:rgba(255,255,255,.14);font-size:20px}
.balanceBottom{display:flex;align-items:center;justify-content:space-between;margin-top:18px}.balanceBottom span{font-size:9px;opacity:.7}.balanceBottom button{border:0;border-radius:10px;padding:9px 12px;color:#123746;background:#fff;font-size:10px;font-weight:850}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0 21px}.stat{padding:14px;border-radius:18px}.statIcon{width:35px;height:35px;border-radius:11px;display:flex;align-items:center;justify-content:center;margin-bottom:8px}.purple{color:#8b5cf6;background:#f3e8ff}.orange{color:#ea580c;background:#fff7ed}.stat small{display:block;color:#6d7c86;font-size:9px}.stat strong{display:block;margin-top:3px;font-size:20px}.stat span{display:block;margin-top:4px;color:#98a5ad;font-size:8px}
.section{margin-bottom:21px}.sectionHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.sectionHead h2{margin:0;font-size:16px}.sectionHead p{margin:4px 0 0;color:#71808a;font-size:9px}.eyebrow{color:#98a5ad!important;letter-spacing:.7px;font-weight:800}.count{padding:6px 9px;border-radius:999px;color:#166534;background:#ecfdf5;font-size:8px;font-weight:850}
.withdrawCard{display:flex;align-items:center;justify-content:space-between;padding:12px;border-radius:17px}.withdrawLeft{display:flex;align-items:center;gap:9px}.withdrawIcon{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;color:#047857;background:#ecfdf5;font-weight:900}.withdrawLeft strong,.withdrawLeft small{display:block}.withdrawLeft strong{font-size:12px}.withdrawLeft small{margin-top:3px;color:#98a5ad;font-size:8px}
.status{padding:6px 9px;border-radius:999px;font-size:8px;font-weight:850}.paid{color:#047857;background:#ecfdf5}.pending{color:#a16207;background:#fef9c3}.rejected{color:#dc2626;background:#fef2f2}
.quickGrid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.quickGrid button{display:flex;align-items:center;gap:8px;text-align:left;padding:10px;border:1px solid #e1eaed;border-radius:15px;background:#fff}.quickGrid i{width:35px;height:35px;min-width:35px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-style:normal}.qRed{background:#fff1f2}.qGreen{background:#ecfdf5}.qPink{background:#fdf2f8}.qBlue{background:#eff6ff}.quickGrid b,.quickGrid small{display:block}.quickGrid b{font-size:9px}.quickGrid small{margin-top:3px;color:#98a5ad;font-size:7px}
.offers{display:flex;flex-direction:column;gap:10px}.offer{overflow:hidden;border-radius:18px}.offerImage{height:150px;position:relative;background:linear-gradient(135deg,#edf7f8,#f5f1ff);display:flex;align-items:center;justify-content:center}.offerImage img{width:100%;height:100%;object-fit:cover}.offerImage>span{font-size:40px}.offerImage>b{position:absolute;right:9px;bottom:9px;padding:6px 9px;border-radius:9px;background:#fff;color:#047857;font-size:11px}.offerBody{padding:13px}.offerMeta{display:flex;justify-content:space-between;gap:5px}.offerMeta span{padding:5px 7px;border-radius:8px;color:#2563eb;background:#eff6ff;font-size:8px}.offerMeta b{color:#059669;font-size:8px}.offerBody h3{margin:9px 0 5px;font-size:14px}.offerBody p{margin:0;color:#71808a;font-size:9px;line-height:1.5}.start{width:100%;margin-top:10px;border:0;border-radius:10px;padding:10px;color:#fff;background:linear-gradient(90deg,#155eef,#2563eb);font-size:10px;font-weight:850}.start span{float:right}.empty{text-align:center;padding:30px 15px;border-radius:18px}.empty div{font-size:32px}.empty b{display:block;margin-top:8px;font-size:13px}.empty p{color:#84919a;font-size:9px}.compact{padding:22px}
.transactions{overflow:hidden;border-radius:17px}.transaction{display:flex;align-items:center;justify-content:space-between;padding:11px 12px;border-bottom:1px solid #eef2f3}.transaction:last-child{border:0}.transactionLeft{display:flex;align-items:center;gap:8px;min-width:0}.transactionLeft i{width:34px;height:34px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-style:normal}.plus{color:#059669;background:#ecfdf5}.minus{color:#ef4444;background:#fff1f2}.transaction b,.transaction small{display:block}.transaction b{max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px}.transaction small{margin-top:3px;color:#98a5ad;font-size:8px}.positive{color:#059669;font-size:10px}.negative{color:#ef4444;font-size:10px}.viewAll{border:0;background:transparent;color:#2563eb;font-size:8px;font-weight:850}
footer{text-align:center;padding:5px 0 100px;color:#98a5ad}footer b{display:block;color:#16a34a;font-size:13px}footer b span{color:#111827}footer small{font-size:7px}
.bottomNav{position:fixed;left:8px;right:8px;bottom:max(8px,env(safe-area-inset-bottom));z-index:100;height:74px;display:grid;grid-template-columns:repeat(5,1fr);align-items:end;padding:4px 5px;border:1px solid #dfe8eb;border-radius:24px;background:rgba(255,255,255,.97);box-shadow:0 16px 45px rgba(15,40,55,.17);backdrop-filter:blur(20px)}.bottomNav button{height:65px;border:0;background:transparent;color:#7c8790;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}.bottomNav button span{width:35px;height:35px;display:flex;align-items:center;justify-content:center;border-radius:11px;font-size:22px}.bottomNav button small{font-size:8px;font-weight:800}.bottomNav .active{color:#155eef}.bottomNav .active span{background:#edf3ff}.telegram{height:84px!important;margin-top:-30px!important}.telegram span{width:65px!important;height:65px!important;border-radius:50%!important;color:#fff;background:linear-gradient(145deg,#155eef,#2563eb 45%,#16a34a);border:4px solid #fff;box-shadow:0 10px 27px rgba(21,94,239,.3);animation:float 2.8s ease-in-out infinite}.loading{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(145deg,#f1fbfc,#f7fbff,#faf7ff);color:#71808a}.loadingBrand{font-size:25px;font-weight:950;margin-bottom:20px}.loadingBrand span{color:#111827}.loadingBrand{color:#16a34a}.spinner{width:30px;height:30px;border:3px solid #e5ecef;border-top-color:#155eef;border-right-color:#16a34a;border-radius:50%;animation:spin .7s linear infinite}.loading small{margin-top:12px;font-size:9px}
@keyframes spin{to{transform:rotate(360deg)}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@media(min-width:801px){.bottomNav{width:524px;left:50%;right:auto;transform:translateX(-50%)}}@media(max-width:360px){.page{padding-left:6px;padding-right:6px}.welcomeInfo p{display:none}.earnButton{font-size:7px}.bottomNav{left:6px;right:6px}.telegram span{width:60px!important;height:60px!important}}
`;
