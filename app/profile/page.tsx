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

type Profile = {
  user_code: string | null;
  full_name: string | null;
  email: string | null;
  referral_code: string | null;
  wallet_balance: number;
  pending_balance: number;
  total_earned: number;
  total_withdrawn: number;
  is_blocked: boolean;
  created_at: string;
};

type Withdrawal = {
  id: string;
  amount: number;
  method: string | null;
  status: string | null;
  created_at: string;
};

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [comingSoon, setComingSoon] = useState(false);

  useEffect(() => {
    load();

    const refresh = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };

    document.addEventListener("visibilitychange", refresh);

    return () => {
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.replace("/login");
      return;
    }

    const [profileResult, withdrawalResult] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "user_code,full_name,email,referral_code,wallet_balance,pending_balance,total_earned,total_withdrawn,is_blocked,created_at"
        )
        .eq("id", user.id)
        .maybeSingle(),

      supabase
        .from("withdrawals")
        .select("id,amount,method,status,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (profileResult.error) {
      console.error(profileResult.error);
    }

    if (withdrawalResult.error) {
      console.error(withdrawalResult.error);
    }

    if (profileResult.data) {
      setProfile({
        ...profileResult.data,
        email: profileResult.data.email || user.email || null,
      });
    }

    setWithdrawals(withdrawalResult.data || []);
    setLoading(false);
  }

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function setupRealtime() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      channel = supabase
        .channel("auracamp-profile-" + user.id)

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
                "user_code,full_name,email,referral_code,wallet_balance,pending_balance,total_earned,total_withdrawn,is_blocked,created_at"
              )
              .eq("id", user.id)
              .maybeSingle();

            if (data) {
              setProfile(data);
            }
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
              .limit(10);

            setWithdrawals(data || []);
          }
        )

        .subscribe();
    }

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  function showComingSoon() {
    setComingSoon(true);

    setTimeout(() => {
      setComingSoon(false);
    }, 2200);
  }

  if (loading) {
    return (
      <>
        <style>{css}</style>

        <main className="loading">
          <div className="loaderBox">
            <div className="loader" />
            <span>Loading profile...</span>
          </div>
        </main>
      </>
    );
  }

  const name =
    profile?.full_name ||
    profile?.email?.split("@")[0] ||
    "User";

  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x.charAt(0).toUpperCase())
      .join("") || "U";

  return (
    <>
      <style>{css}</style>

      <main className="page">

        {/* HEADER */}

        <header className="top">

          <button
            className="backButton"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            ←
          </button>

          <div className="topTitle">
            <span>AURA CAMP</span>

            <h1>My Profile</h1>

            <p>Your account & earnings</p>
          </div>

          <button
            className="logout"
            onClick={logout}
          >
            Logout
          </button>

        </header>


        {/* PROFILE HERO */}

        <section className="profileHero">

          <div className="avatar">
            {initials}
          </div>

          <h2>{name}</h2>

          <p>
            {profile?.email || "Email not available"}
          </p>

          <div className="identity">

            <span className="userCode">
              {profile?.user_code || "AC----"}
            </span>

            <span
              className={
                profile?.is_blocked
                  ? "status blocked"
                  : "status active"
              }
            >
              <i />
              {profile?.is_blocked
                ? "Blocked"
                : "Active"}
            </span>

          </div>

        </section>


        {/* ACCOUNT INFORMATION */}

        <section className="card">

          <div className="sectionTitle">
            <span>ACCOUNT</span>

            <h2>Account Information</h2>

            <p>
              Your registered account details.
            </p>
          </div>

          <InfoRow
            label="Full Name"
            value={
              profile?.full_name || "Not set"
            }
          />

          <InfoRow
            label="Email"
            value={
              profile?.email || "—"
            }
          />

          <InfoRow
            label="AURA CAMP ID"
            value={
              profile?.user_code || "AC----"
            }
            green
          />

          <InfoRow
            label="Referral Code"
            value={
              profile?.referral_code || "Not set"
            }
          />

          <InfoRow
            label="Joined Date"
            value={formatDateOnly(
              profile?.created_at
            )}
          />

        </section>


        {/* BALANCE */}

        <section className="stats">

          <Stat
            label="Available Balance"
            value={`₹${Number(
              profile?.wallet_balance || 0
            ).toFixed(2)}`}
            dark
          />

          <Stat
            label="Pending Balance"
            value={`₹${Number(
              profile?.pending_balance || 0
            ).toFixed(2)}`}
          />

          <Stat
            label="Total Earned"
            value={`₹${Number(
              profile?.total_earned || 0
            ).toFixed(2)}`}
          />

          <Stat
            label="Total Withdrawn"
            value={`₹${Number(
              profile?.total_withdrawn || 0
            ).toFixed(2)}`}
          />

        </section>


        {/* WITHDRAWAL HISTORY */}

        <section className="card">

          <div className="titleRow">

            <div>
              <div className="sectionLabel">
                PAYMENTS
              </div>

              <h2>Withdrawal History</h2>

              <p className="muted">
                Your latest payment requests
              </p>
            </div>

            <button
              className="withdrawButton"
              onClick={() => {
                window.location.href =
                  "/withdraw";
              }}
            >
              Withdraw
            </button>

          </div>


          {withdrawals.length === 0 ? (

            <div className="empty">

              <div className="emptyIcon">
                ₹
              </div>

              <strong>
                No withdrawals yet
              </strong>

              <span>
                Your withdrawal requests
                will appear here.
              </span>

            </div>

          ) : (

            <div className="history">

              {withdrawals.map((item) => (

                <div
                  className="historyRow"
                  key={item.id}
                >

                  <div className="historyInfo">

                    <strong>
                      ₹{Number(
                        item.amount
                      ).toFixed(2)}
                    </strong>

                    <small>
                      {item.method || "Payment"}
                      {" • "}
                      {formatDate(
                        item.created_at
                      )}
                    </small>

                  </div>

                  <Status
                    status={
                      item.status ||
                      "pending"
                    }
                  />

                </div>

              ))}

            </div>

          )}

        </section>


        {/* QUICK ACTIONS */}

        <section className="actions">

          <button onClick={showComingSoon}>

            <div className="actionIcon">
              🎁
            </div>

            <div>
              <strong>My Offers</strong>
              <small>Coming soon</small>
            </div>

          </button>


          <button
            onClick={() => {
              window.location.href =
                "/transactions";
            }}
          >

            <div className="actionIcon">
              💳
            </div>

            <div>
              <strong>Transactions</strong>
              <small>Wallet activity</small>
            </div>

          </button>


          <button
            onClick={() => {
              window.location.href =
                "/support";
            }}
          >

            <div className="actionIcon">
              🎧
            </div>

            <div>
              <strong>Support</strong>
              <small>Get help</small>
            </div>

          </button>


          <button
            onClick={() => {
              window.open(
                "https://t.me/Auracampaign",
                "_blank"
              );
            }}
          >

            <div className="telegramAction">
              <TelegramIcon />
            </div>

            <div>
              <strong>Telegram</strong>
              <small>Join channel</small>
            </div>

          </button>

        </section>


        {/* LOGOUT */}

        <button
          className="logoutBig"
          onClick={logout}
        >
          Log out of AURA CAMP
        </button>


        {/* BOTTOM NAV */}

        <nav className="bottom">

          <button
            onClick={() => {
              window.location.href = "/";
            }}
          >
            <span>⌂</span>
            <small>Home</small>
          </button>


          <button
            onClick={() => {
              window.location.href =
                "/#offers";
            }}
          >
            <span>▦</span>
            <small>Offers</small>
          </button>


          <button
            className="telegram"
            onClick={() => {
              window.open(
                "https://t.me/Auracampaign",
                "_blank"
              );
            }}
          >

            <TelegramIcon />

            <small>
              Telegram
            </small>

          </button>


          <button
            onClick={showComingSoon}
          >
            <span>▤</span>
            <small>My Offers</small>
          </button>


          <button className="active">
            <span>♙</span>
            <small>Profile</small>
          </button>

        </nav>


        {/* COMING SOON */}

        {comingSoon && (

          <div className="toast">

            <div className="toastIcon">
              ✦
            </div>

            <div>
              <strong>
                Coming Soon
              </strong>

              <small>
                My Offers is under development.
              </small>
            </div>

          </div>

        )}

      </main>
    </>
  );
}


/* INFO ROW */

function InfoRow({
  label,
  value,
  green = false,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="infoRow">

      <span>{label}</span>

      <strong
        className={
          green ? "green" : ""
        }
      >
        {value}
      </strong>

    </div>
  );
}


/* STAT */

function Stat({
  label,
  value,
  dark = false,
}: {
  label: string;
  value: string;
  dark?: boolean;
}) {
  return (
    <div
      className={
        dark
          ? "stat dark"
          : "stat"
      }
    >

      <small>{label}</small>

      <strong>{value}</strong>

    </div>
  );
}


/* WITHDRAWAL STATUS */

function Status({
  status,
}: {
  status: string;
}) {
  const s =
    status.toLowerCase();

  if (
    s === "paid" ||
    s === "approved" ||
    s === "success" ||
    s === "completed"
  ) {
    return (
      <span className="paid">
        ✓ Paid
      </span>
    );
  }

  if (
    s === "rejected" ||
    s === "failed" ||
    s === "cancelled" ||
    s === "canceled"
  ) {
    return (
      <span className="rejected">
        ✕ Rejected
      </span>
    );
  }

  return (
    <span className="pending">
      ◷ Pending
    </span>
  );
}


/* DATE */

function formatDateOnly(
  value?: string | null
) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}


/* DATE + TIME */

function formatDate(
  value?: string | null
) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}


/* TELEGRAM ICON */

function TelegramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="telegramIcon"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M21.7 3.3 18.5 20c-.2 1.2-.9 1.5-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.2-8.3c.4-.4-.1-.6-.6-.2L6 13.5 1 11.9c-1.1-.3-1.1-1.1.2-1.6L20.8 2.7c.9-.3 1.7.2.9.6Z"
      />
    </svg>
  );
}


/* CSS */

const css = `
*{
  box-sizing:border-box;
}

html,
body{
  margin:0;
  padding:0;
  overflow-x:hidden;
}

body{
  background:#eef8fa;
  color:#17202b;
  font-family:
    Inter,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.bottom{
  position:fixed;
  left:8px;
  right:8px;
  bottom:max(8px,env(safe-area-inset-bottom));
  z-index:99;
  width:auto;
  max-width:524px;
  height:72px;
  margin:auto;
  display:grid;
  grid-template-columns:repeat(5,1fr);
  align-items:end;
  padding:4px;
  border-radius:22px;
  background:rgba(255,255,255,.97);
  border:1px solid #e0e9ec;
  box-shadow:0 15px 40px rgba(15,40,55,.15);
  backdrop-filter:blur(18px);
}

.page{
  width:100%;
  max-width:540px;
  min-height:100vh;
  margin:0 auto;
  padding:12px 12px
    calc(155px + env(safe-area-inset-bottom));

  background:
    radial-gradient(
      circle at 10% 0%,
      rgba(34,197,94,.07),
      transparent 27%
    ),
    radial-gradient(
      circle at 100% 15%,
      rgba(21,94,239,.07),
      transparent 30%
    ),
    linear-gradient(
      145deg,
      #f1fbfc,
      #f8fcff 55%,
      #faf8ff
    );
}


/* HEADER */

.top{
  display:flex;
  align-items:center;
  gap:9px;
  margin-bottom:12px;
}

.backButton{
  flex:0 0 43px;
  width:43px;
  height:43px;
  border:1px solid #dfe8eb;
  border-radius:14px;
  background:#fff;
  color:#183342;
  font-size:22px;
  box-shadow:
    0 5px 18px rgba(20,60,80,.05);
}

.topTitle{
  min-width:0;
  flex:1;
}

.topTitle>span{
  display:block;
  color:#159447;
  font-size:7px;
  font-weight:900;
  letter-spacing:1.5px;
}

.topTitle h1{
  margin:2px 0 1px;
  font-size:21px;
  line-height:1.1;
  letter-spacing:-.4px;
}

.topTitle p{
  margin:0;
  color:#7d8792;
  font-size:9px;
}

.logout{
  flex:0 0 auto;
  border:0;
  border-radius:10px;
  padding:9px 11px;
  color:#fff;
  background:#132f3f;
  font-size:8px;
  font-weight:800;
  box-shadow:
    0 6px 16px rgba(19,47,63,.16);
}


/* HERO */

.profileHero{
  position:relative;
  overflow:hidden;
  padding:25px 15px 21px;
  text-align:center;

  border:1px solid #dfeaec;
  border-radius:24px;

  background:
    linear-gradient(
      135deg,
      #fff 0%,
      #f4fcfc 52%,
      #f6f1ff 100%
    );

  box-shadow:
    0 12px 32px rgba(20,60,80,.07);

  margin-bottom:10px;
}

.profileHero:before{
  content:"";
  position:absolute;
  width:130px;
  height:130px;
  right:-45px;
  top:-65px;
  border-radius:50%;
  background:
    rgba(22,163,74,.08);
}

.avatar{
  position:relative;
  width:72px;
  height:72px;
  margin:auto;

  display:flex;
  align-items:center;
  justify-content:center;

  border-radius:22px;

  color:#fff;
  background:
    linear-gradient(
      135deg,
      #132f3f,
      #155eef 58%,
      #16a34a
    );

  font-size:25px;
  font-weight:900;

  box-shadow:
    0 12px 26px
    rgba(21,94,239,.22);
}

.profileHero h2{
  margin:12px 0 3px;
  font-size:22px;
  line-height:1.15;
  letter-spacing:-.4px;
}

.profileHero>p{
  margin:0;
  color:#7c8992;
  font-size:10px;
  overflow-wrap:anywhere;
}

.identity{
  display:flex;
  justify-content:center;
  align-items:center;
  flex-wrap:wrap;
  gap:6px;
  margin-top:11px;
}

.userCode,
.status{
  display:inline-flex;
  align-items:center;
  gap:5px;
  padding:6px 10px;
  border-radius:999px;
  font-size:8px;
  font-weight:850;
}

.userCode{
  color:#166534;
  background:#ecfdf5;
  border:1px solid #d1fae5;
}

.status{
  color:#64748b;
  background:#f1f5f9;
  border:1px solid #e2e8f0;
}

.status i{
  width:5px;
  height:5px;
  border-radius:50%;
  background:currentColor;
}

.status.active{
  color:#047857;
  background:#ecfdf5;
  border-color:#d1fae5;
}

.status.blocked{
  color:#dc2626;
  background:#fef2f2;
  border-color:#fee2e2;
}


/* CARD */

.card{
  padding:16px;
  border:1px solid #dfeaec;
  border-radius:19px;
  background:#fff;
  margin-bottom:10px;

  box-shadow:
    0 6px 22px rgba(20,60,80,.04);
}

.sectionTitle{
  margin-bottom:8px;
}

.sectionTitle>span,
.sectionLabel{
  display:block;
  color:#159447;
  font-size:7px;
  font-weight:900;
  letter-spacing:1.5px;
}

.sectionTitle h2,
.card h2{
  margin:2px 0 0;
  font-size:15px;
  letter-spacing:-.1px;
}

.sectionTitle p,
.muted{
  margin:4px 0 12px;
  color:#84919a;
  font-size:9px;
}


/* INFO */

.infoRow{
  min-height:42px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:10px 0;
  border-bottom:1px solid #eef2f3;
}

.infoRow:last-child{
  border:0;
}

.infoRow span{
  color:#7c8992;
  font-size:9px;
}

.infoRow strong{
  max-width:66%;
  text-align:right;
  overflow-wrap:anywhere;
  font-size:9px;
  line-height:1.35;
}

.infoRow .green{
  color:#159447;
}


/* STATS */

.stats{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:8px;
  margin-bottom:10px;
}

.stat{
  min-width:0;
  padding:14px;

  border:1px solid #dfeaec;
  border-radius:17px;
  background:#fff;

  box-shadow:
    0 6px 20px rgba(20,60,80,.035);
}

.stat small{
  display:block;
  color:#84919a;
  font-size:8px;
  line-height:1.25;
}

.stat strong{
  display:block;
  margin-top:5px;
  font-size:17px;
  line-height:1.1;
  overflow-wrap:anywhere;
}

.stat.dark{
  color:#fff;
  background:#132f3f;
  border-color:#132f3f;
}

.stat.dark small{
  color:#b7c7cf;
}


/* WITHDRAW */

.titleRow{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
}

.withdrawButton{
  flex:0 0 auto;
  border:0;
  border-radius:10px;
  padding:9px 11px;

  color:#fff;
  background:#132f3f;

  font-size:8px;
  font-weight:850;
}

.history{
  margin-top:5px;
}

.historyRow{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  padding:12px 0;
  border-top:1px solid #eef2f3;
}

.historyInfo{
  min-width:0;
}

.historyInfo strong{
  display:block;
  font-size:13px;
  font-weight:900;
}

.historyInfo small{
  display:block;
  max-width:245px;
  margin-top:4px;

  color:#98a5ad;
  font-size:8px;

  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.paid,
.pending,
.rejected{
  flex:0 0 auto;
  padding:6px 9px;
  border-radius:999px;
  font-size:8px;
  font-weight:850;
}

.paid{
  color:#047857;
  background:#ecfdf5;
}

.pending{
  color:#a16207;
  background:#fef9c3;
}

.rejected{
  color:#dc2626;
  background:#fef2f2;
}


/* EMPTY */

.empty{
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:4px;

  text-align:center;
  padding:24px 8px 8px;

  color:#84919a;
  font-size:9px;
}

.empty strong{
  color:#52616b;
  font-size:10px;
}

.empty span{
  font-size:8px;
}

.emptyIcon{
  width:42px;
  height:42px;
  margin-bottom:3px;

  display:flex;
  align-items:center;
  justify-content:center;

  border-radius:14px;

  color:#159447;
  background:#ecfdf5;

  font-size:17px;
  font-weight:900;
}


/* ACTIONS */

.actions{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:8px;
  margin-bottom:10px;
}

.actions button{
  min-width:0;

  display:flex;
  align-items:center;
  gap:9px;

  padding:12px 10px;

  border:1px solid #dfeaec;
  border-radius:15px;

  background:#fff;
  color:#17202b;

  text-align:left;

  box-shadow:
    0 5px 18px rgba(20,60,80,.035);
}

.actions button>div:last-child{
  min-width:0;
}

.actions strong{
  display:block;
  font-size:9px;
}

.actions small{
  display:block;
  margin-top:2px;
  color:#8b98a1;
  font-size:7px;
}

.actionIcon,
.telegramAction{
  flex:0 0 32px;
  width:32px;
  height:32px;

  display:flex;
  align-items:center;
  justify-content:center;

  border-radius:10px;

  background:#f2f7f8;

  font-size:15px;
}

.telegramAction{
  color:#fff;
  background:#229ed9;
}

.telegramIcon{
  width:18px;
  height:18px;
}


/* LOGOUT */

.logoutBig{
  width:100%;
  margin:2px 0 0;
  padding:12px;

  border:1px solid #fee2e2;
  border-radius:14px;

  background:#fff;
  color:#dc2626;

  font-size:9px;
  font-weight:800;
}


/* BOTTOM NAV */

.bottom{
  position:fixed;

  left:8px;
  right:8px;
  bottom:max(
    8px,
    env(safe-area-inset-bottom)
  );

  z-index:99;

  width:auto;
  max-width:524px;
  height:72px;
  margin:auto;

  display:grid;
  grid-template-columns:
    repeat(5,1fr);
  align-items:end;

  padding:4px;

  border-radius:22px;

  background:
    rgba(255,255,255,.97);

  border:1px solid #e0e9ec;

  box-shadow:
    0 15px 40px
    rgba(15,40,55,.15);

  backdrop-filter:blur(18px);
}

.bottom button{
  appearance:none;
  -webkit-appearance:none;

  min-width:0;
  height:62px;

  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;

  gap:1px;

  border:0;
  outline:0;
  background:transparent;

  color:#7c8790;

  font-size:20px;
}

.bottom button span{
  line-height:1;
}

.bottom small{
  display:block;
  margin-top:3px;
  font-size:7px;
  font-weight:700;
}

.bottom .active{
  color:#155eef;
}

.bottom .telegram{
  width:58px;
  height:58px;

  margin:-20px auto 0;

  align-self:start;
  justify-self:center;

  border-radius:50%;

  color:#fff;

  background:
    linear-gradient(
      145deg,
      #155eef,
      #16a34a
    );

  border:4px solid #fff;

  box-shadow:
    0 9px 25px
    rgba(21,94,239,.28);
}

.bottom .telegram small{
  color:#fff;
}

.bottom .telegram .telegramIcon{
  width:23px;
  height:23px;
}


/* TOAST */

.toast{
  position:fixed;
  z-index:200;

  left:50%;
  bottom:92px;

  width:calc(100% - 32px);
  max-width:400px;

  transform:translateX(-50%);

  display:flex;
  align-items:center;
  gap:10px;

  padding:12px 14px;

  border:1px solid #dfeaec;
  border-radius:15px;

  background:
    rgba(255,255,255,.98);

  box-shadow:
    0 14px 35px
    rgba(15,40,55,.18);

  animation:
    toastIn .22s ease-out;
}

.toastIcon{
  width:30px;
  height:30px;

  display:flex;
  align-items:center;
  justify-content:center;

  border-radius:10px;

  color:#159447;
  background:#ecfdf5;
}

.toast strong{
  display:block;
  font-size:10px;
}

.toast small{
  display:block;
  margin-top:2px;
  color:#82909a;
  font-size:8px;
}


/* LOADING */

.loading{
  min-height:100vh;

  display:flex;
  align-items:center;
  justify-content:center;

  background:#f3fafb;
}

.loaderBox{
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:9px;

  color:#71808a;
  font-size:10px;
}

.loader{
  width:28px;
  height:28px;

  border:3px solid #dcecee;
  border-top-color:#159447;

  border-radius:50%;

  animation:
    spin .8s linear infinite;
}


/* ANIMATION */

@keyframes spin{
  to{
    transform:rotate(360deg);
  }
}

@keyframes toastIn{
  from{
    opacity:0;
    transform:
      translate(-50%,10px);
  }

  to{
    opacity:1;
    transform:
      translate(-50%,0);
  }
}


/* SMALL MOBILE */

@media(max-width:380px){

  .page{
    padding-left:9px;
    padding-right:9px;
  }

  .top{
    gap:6px;
  }

  .topTitle h1{
    font-size:19px;
  }

  .logout{
    padding:8px 9px;
  }

  .infoRow strong{
    max-width:62%;
  }

  .stat{
    padding:12px;
  }

  .stat strong{
    font-size:15px;
  }

  .actions button{
    padding:11px 8px;
  }

  .actions strong{
    font-size:8px;
  }
}


/* DESKTOP = MOBILE APP SHELL */

@media(min-width:801px){

  .page{
    min-height:100vh;

    border-left:1px solid #e5eef0;
    border-right:1px solid #e5eef0;
  }

  .bottom{
    left:50%;
    right:auto;

    transform:
      translateX(-50%);
  }
}
`;
