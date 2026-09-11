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

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.replace("/login");
      return;
    }

    const [p, w] = await Promise.all([
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

    if (p.data) {
      setProfile({
        ...p.data,
        email: p.data.email || user.email || null,
      });
    }

    setWithdrawals(w.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();

    const visibility = () => {
      if (document.visibilityState === "visible") {
        load();
      }
    };

    document.addEventListener("visibilitychange", visibility);

    return () => {
      document.removeEventListener("visibilitychange", visibility);
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
        .channel(`profile-${user.id}`)

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          () => load()
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "withdrawals",
            filter: `user_id=eq.${user.id}`,
          },
          () => load()
        )

        .subscribe();
    }

    realtime();

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

  function coming() {
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
          <div className="spinner" />
          <span>Loading profile...</span>
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
      .map((x) => x[0]?.toUpperCase())
      .join("") || "U";

  return (
    <>
      <style>{css}</style>

      <main className="page">

        {/* HEADER */}

        <header className="header">

          <button
            className="back"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            ←
          </button>

          <div className="headerText">
            <span>AURA CAMP</span>
            <h1>My Profile</h1>
            <p>Your account & earnings</p>
          </div>

          <button
            className="headerLogout"
            onClick={logout}
          >
            Logout
          </button>

        </header>


        {/* PROFILE */}

        <section className="hero">

          <div className="avatar">
            {initials}
          </div>

          <h2>{name}</h2>

          <p className="email">
            {profile?.email || "Email not available"}
          </p>

          <div className="badges">

            <span className="idBadge">
              {profile?.user_code || "AC----"}
            </span>

            <span
              className={
                profile?.is_blocked
                  ? "status blocked"
                  : "status"
              }
            >
              <i />
              {profile?.is_blocked
                ? "Blocked"
                : "Verified"}
            </span>

          </div>

        </section>


        {/* ACCOUNT */}

        <section className="card">

          <div className="heading">

            <span>ACCOUNT</span>

            <h2>Account Information</h2>

            <p>
              Your registered account details.
            </p>

          </div>

          <Info
            label="Full Name"
            value={profile?.full_name || "Not set"}
          />

          <Info
            label="Email"
            value={profile?.email || "—"}
          />

          <Info
            label="AURA CAMP ID"
            value={profile?.user_code || "AC----"}
            green
          />

          <Info
            label="Referral Code"
            value={profile?.referral_code || "Not set"}
          />

          <Info
            label="Joined Date"
            value={dateOnly(profile?.created_at)}
          />

        </section>


        {/* EARNINGS */}

        <section className="stats">

          <Stat
            title="Available Balance"
            value={`₹${Number(
              profile?.wallet_balance || 0
            ).toFixed(2)}`}
            dark
          />

          <Stat
            title="Pending Balance"
            value={`₹${Number(
              profile?.pending_balance || 0
            ).toFixed(2)}`}
          />

          <Stat
            title="Total Earned"
            value={`₹${Number(
              profile?.total_earned || 0
            ).toFixed(2)}`}
          />

          <Stat
            title="Total Withdrawn"
            value={`₹${Number(
              profile?.total_withdrawn || 0
            ).toFixed(2)}`}
          />

        </section>


        {/* WITHDRAWALS */}

        <section className="card withdrawalCard">

          <div className="withdrawHeader">

            <div>
              <span className="headingLabel">
                PAYMENTS
              </span>

              <h2>Withdrawal History</h2>

              <p>
                Your latest payment requests
              </p>
            </div>

            <button
              className="withdraw"
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

              <small>
                Your payment requests will
                appear here.
              </small>

            </div>

          ) : (

            <div className="history">

              {withdrawals.map((item) => (

                <div
                  className="historyItem"
                  key={item.id}
                >

                  <div className="historyInfo">

                    <strong>
                      ₹{Number(
                        item.amount
                      ).toFixed(2)}
                    </strong>

                    <small>
                      {(item.method || "upi")
                        .toLowerCase()}
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

          <button onClick={coming}>

            <div className="actionIcon gift">
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

            <div className="actionIcon telegramAction">
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
          className="logoutFull"
          onClick={logout}
        >
          Log out of AURA CAMP
        </button>


        {/* BOTTOM NAV */}

        <nav className="bottomNav">

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
            <small>Telegram</small>
          </button>


          <button onClick={coming}>
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
              <strong>Coming Soon</strong>
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


/* INFO */

function Info({
  label,
  value,
  green = false,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="info">

      <span>{label}</span>

      <strong className={green ? "green" : ""}>
        {value}
      </strong>

    </div>
  );
}


/* STAT */

function Stat({
  title,
  value,
  dark = false,
}: {
  title: string;
  value: string;
  dark?: boolean;
}) {
  return (
    <div className={dark ? "stat dark" : "stat"}>

      <small>{title}</small>

      <strong>{value}</strong>

    </div>
  );
}


/* STATUS */

function Status({
  status,
}: {
  status: string;
}) {
  const s = status.toLowerCase();

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

function dateOnly(value?: string | null) {
  if (!value) return "—";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return "—";
  }

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}


/* DATE + TIME */

function formatDate(value?: string | null) {
  if (!value) return "—";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return "—";
  }

  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


/* TELEGRAM */

function TelegramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="telegramIcon"
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
    Georgia,
    "Times New Roman",
    serif;
}

button{
  font:inherit;
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}

.page{
  width:100%;
  max-width:540px;
  min-height:100vh;
  margin:0 auto;

  padding:12px 12px
    calc(150px + env(safe-area-inset-bottom));

  background:
    radial-gradient(
      circle at 5% 0%,
      rgba(22,163,74,.07),
      transparent 28%
    ),
    radial-gradient(
      circle at 100% 10%,
      rgba(21,94,239,.07),
      transparent 30%
    ),
    linear-gradient(
      145deg,
      #f0fbfc,
      #f8fcff 55%,
      #faf8ff
    );
}


/* HEADER */

.header{
  display:flex;
  align-items:center;
  gap:9px;
  margin-bottom:12px;
}

.back{
  flex:0 0 44px;
  width:44px;
  height:44px;

  border:1px solid #dfe8eb;
  border-radius:15px;

  background:#fff;
  color:#183342;

  font-size:22px;

  box-shadow:
    0 5px 18px
    rgba(20,60,80,.06);
}

.headerText{
  min-width:0;
  flex:1;
}

.headerText>span{
  display:block;

  color:#159447;

  font-size:7px;
  font-weight:bold;

  letter-spacing:2px;
}

.headerText h1{
  margin:2px 0 1px;

  font-size:23px;
  line-height:1;

  letter-spacing:-.5px;
}

.headerText p{
  margin:4px 0 0;

  color:#7d8792;
  font-size:9px;
}

.headerLogout{
  flex:0 0 auto;

  border:0;
  border-radius:13px;

  padding:10px 12px;

  color:#fff;
  background:#163847;

  font-size:9px;
  font-weight:bold;

  box-shadow:
    0 7px 18px
    rgba(22,56,71,.16);
}


/* HERO */

.hero{
  position:relative;
  overflow:hidden;

  padding:28px 15px 23px;

  text-align:center;

  border:1px solid #dce9eb;
  border-radius:25px;

  background:
    linear-gradient(
      135deg,
      #fff 0%,
      #f2fcfc 52%,
      #f7f1ff 100%
    );

  box-shadow:
    0 12px 32px
    rgba(20,60,80,.07);

  margin-bottom:10px;
}

.hero:after{
  content:"";

  position:absolute;

  width:150px;
  height:150px;

  right:-55px;
  top:-80px;

  border-radius:50%;

  background:
    rgba(22,163,74,.07);
}

.avatar{
  position:relative;
  z-index:1;

  width:76px;
  height:76px;

  margin:auto;

  display:flex;
  align-items:center;
  justify-content:center;

  border-radius:23px;

  color:#fff;

  background:
    linear-gradient(
      135deg,
      #14384a,
      #155eef 58%,
      #16a34a
    );

  font-size:28px;
  font-weight:bold;

  box-shadow:
    0 12px 28px
    rgba(21,94,239,.22);
}

.hero h2{
  margin:13px 0 3px;

  font-size:27px;
  line-height:1.05;
}

.email{
  margin:0;

  color:#7c8992;
  font-size:10px;

  overflow-wrap:anywhere;
}

.badges{
  display:flex;
  justify-content:center;
  align-items:center;

  gap:6px;

  flex-wrap:wrap;

  margin-top:12px;
}

.idBadge,
.status{
  display:inline-flex;
  align-items:center;
  gap:5px;

  padding:7px 11px;

  border-radius:999px;

  font-size:8px;
  font-weight:bold;
}

.idBadge{
  color:#16734a;

  background:#ecfdf5;

  border:1px solid #d1fae5;
}

.status{
  color:#047857;

  background:#ecfdf5;

  border:1px solid #d1fae5;
}

.status i{
  width:6px;
  height:6px;

  border-radius:50%;

  background:currentColor;
}

.status.blocked{
  color:#dc2626;
  background:#fef2f2;
  border-color:#fee2e2;
}


/* CARD */

.card{
  padding:17px;

  border:1px solid #dfeaec;
  border-radius:20px;

  background:#fff;

  margin-bottom:10px;

  box-shadow:
    0 7px 23px
    rgba(20,60,80,.045);
}

.heading{
  margin-bottom:8px;
}

.heading>span,
.headingLabel{
  display:block;

  color:#159447;

  font-size:7px;
  font-weight:bold;

  letter-spacing:2px;
}

.heading h2,
.withdrawHeader h2{
  margin:3px 0 0;

  font-size:18px;
  line-height:1.1;
}

.heading p,
.withdrawHeader p{
  margin:4px 0 11px;

  color:#84919a;
  font-size:9px;
}


/* INFO */

.info{
  min-height:46px;

  display:flex;
  align-items:center;
  justify-content:space-between;

  gap:12px;

  padding:10px 0;

  border-bottom:1px solid #edf2f3;
}

.info:last-child{
  border-bottom:0;
}

.info span{
  color:#7c8992;
  font-size:10px;
}

.info strong{
  max-width:67%;

  text-align:right;

  overflow-wrap:anywhere;

  font-size:10px;
}

.info .green{
  color:#159447;
}


/* STATS */

.stats{
  display:grid;

  grid-template-columns:
    1fr 1fr;

  gap:9px;

  margin-bottom:10px;
}

.stat{
  min-width:0;

  padding:16px;

  border:1px solid #dfeaec;
  border-radius:18px;

  background:#fff;

  box-shadow:
    0 6px 20px
    rgba(20,60,80,.035);
}

.stat small{
  display:block;

  color:#84919a;

  font-size:9px;
}

.stat strong{
  display:block;

  margin-top:6px;

  font-size:19px;

  line-height:1.1;

  overflow-wrap:anywhere;
}

.stat.dark{
  color:#fff;

  background:#163847;

  border-color:#163847;
}

.stat.dark small{
  color:#b9c9d0;
}


/* WITHDRAWAL */

.withdrawHeader{
  display:flex;
  align-items:center;
  justify-content:space-between;

  gap:10px;
}

.withdraw{
  flex:0 0 auto;

  border:0;
  border-radius:12px;

  padding:10px 12px;

  color:#fff;
  background:#163847;

  font-size:9px;
  font-weight:bold;
}

.history{
  margin-top:3px;
}

.historyItem{
  min-height:62px;

  display:flex;
  align-items:center;
  justify-content:space-between;

  gap:8px;

  padding:12px 0;

  border-top:1px solid #edf2f3;
}

.historyInfo{
  min-width:0;
}

.historyInfo strong{
  display:block;

  font-size:15px;
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

  padding:7px 10px;

  border-radius:999px;

  font-size:8px;
  font-weight:bold;
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

  text-align:center;

  padding:25px 5px 8px;

  color:#84919a;
}

.emptyIcon{
  width:43px;
  height:43px;

  display:flex;
  align-items:center;
  justify-content:center;

  margin-bottom:7px;

  border-radius:14px;

  color:#159447;
  background:#ecfdf5;

  font-size:18px;
  font-weight:bold;
}

.empty strong{
  color:#52616b;
  font-size:11px;
}

.empty small{
  margin-top:3px;
  font-size:8px;
}


/* ACTIONS */

.actions{
  display:grid;

  grid-template-columns:
    1fr 1fr;

  gap:9px;

  margin-bottom:11px;
}

.actions button{
  min-width:0;

  display:flex;
  align-items:center;

  gap:9px;

  padding:13px 10px;

  border:1px solid #dfeaec;
  border-radius:16px;

  background:#fff;

  color:#17202b;

  text-align:left;

  box-shadow:
    0 5px 18px
    rgba(20,60,80,.035);
}

.actions button>div:last-child{
  min-width:0;
}

.actions strong{
  display:block;

  font-size:10px;
}

.actions small{
  display:block;

  margin-top:2px;

  color:#8b98a1;

  font-size:8px;
}

.actionIcon{
  flex:0 0 35px;

  width:35px;
  height:35px;

  display:flex;
  align-items:center;
  justify-content:center;

  border-radius:11px;

  background:#f2f7f8;

  font-size:16px;
}

.gift{
  background:#f8f0ff;
}

.telegramAction{
  color:#fff;
  background:#229ed9;
}

.telegramIcon{
  width:19px;
  height:19px;
}


/* LOGOUT */

.logoutFull{
  width:100%;

  padding:13px;

  border:1px solid #fee2e2;
  border-radius:15px;

  background:#fff;

  color:#dc2626;

  font-size:9px;
  font-weight:bold;
}


/* BOTTOM */

.bottomNav{
  position:fixed;

  left:8px;
  right:8px;

  bottom:
    max(
      8px,
      env(safe-area-inset-bottom)
    );

  z-index:100;

  width:auto;
  max-width:524px;

  height:72px;

  margin:0 auto;

  display:grid;

  grid-template-columns:
    repeat(5,1fr);

  align-items:end;

  padding:4px;

  border:1px solid #dfe9ec;

  border-radius:23px;

  background:
    rgba(255,255,255,.97);

  box-shadow:
    0 15px 40px
    rgba(15,40,55,.17);

  backdrop-filter:blur(18px);
}

.bottomNav button{
  appearance:none;
  -webkit-appearance:none;

  min-width:0;
  height:62px;

  display:flex;

  flex-direction:column;

  align-items:center;

  justify-content:center;

  gap:2px;

  border:0;
  outline:0;

  background:transparent;

  color:#7c8790;

  font-size:21px;
}

.bottomNav button span{
  line-height:1;
}

.bottomNav small{
  display:block;

  margin-top:3px;

  font-size:7px;
  font-weight:bold;
}

.bottomNav .active{
  color:#155eef;
}

.bottomNav .telegram{
  width:60px;
  height:60px;

  margin:-21px auto 0;

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
    0 10px 27px
    rgba(21,94,239,.30);
}

.bottomNav .telegram .telegramIcon{
  width:24px;
  height:24px;
}

.bottomNav .telegram small{
  color:#fff;
}


/* TOAST */

.toast{
  position:fixed;

  z-index:200;

  left:50%;
  bottom:94px;

  width:calc(100% - 32px);
  max-width:400px;

  transform:translateX(-50%);

  display:flex;

  align-items:center;

  gap:10px;

  padding:12px 14px;

  border:1px solid #dfeaec;
  border-radius:15px;

  background:#fff;

  box-shadow:
    0 14px 35px
    rgba(15,40,55,.18);

  animation:
    toastIn .22s ease-out;
}

.toastIcon{
  width:31px;
  height:31px;

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

  flex-direction:column;

  align-items:center;
  justify-content:center;

  gap:10px;

  color:#71808a;

  font-size:10px;
}

.spinner{
  width:29px;
  height:29px;

  border:3px solid #dcecee;

  border-top-color:#159447;

  border-radius:50%;

  animation:
    spin .8s linear infinite;
}


/* SMALL MOBILE */

@media(max-width:380px){

  .page{
    padding-left:9px;
    padding-right:9px;
  }

  .header{
    gap:6px;
  }

  .headerLogout{
    padding:9px 10px;
  }

  .headerText h1{
    font-size:21px;
  }

  .hero{
    padding-top:24px;
  }

  .stat{
    padding:13px;
  }

  .stat strong{
    font-size:17px;
  }

  .info strong{
    max-width:62%;
  }

  .actions button{
    padding:11px 8px;
  }

}


/* DESKTOP APP SHELL */

@media(min-width:801px){

  .page{
    min-height:100vh;

    border-left:1px solid #e5eef0;
    border-right:1px solid #e5eef0;
  }

  .bottomNav{
    left:50%;
    right:auto;

    transform:
      translateX(-50%);
  }

}


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
`;
