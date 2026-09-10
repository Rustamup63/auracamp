"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

type Profile = {
  id: string;
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
  conversion_type: string | null;
  terms: string | null;
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
  method: string;
  status: string;
  created_at: string;
};

export default function Home() {
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [campaigns, setCampaigns] =
    useState<Campaign[]>([]);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [withdrawals, setWithdrawals] =
    useState<Withdrawal[]>([]);

  const [userName, setUserName] =
    useState("User");

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState<"success" | "error">("success");

  const [startingOffer, setStartingOffer] =
    useState<string | null>(null);

  const [activeNav, setActiveNav] =
    useState("home");

  useEffect(() => {
    let mounted = true;

    async function start() {
      await loadDashboard(mounted);
    }

    start();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * REAL-TIME WITHDRAWAL STATUS
   */
  useEffect(() => {
    const channel = supabase
      .channel("user-withdrawal-status")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "withdrawals",
        },
        async () => {
          await loadWithdrawals();
          await loadProfile();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadDashboard(
    mounted = true
  ) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.replace("/login");
        return;
      }

      /*
       * ADMIN → ADMIN PANEL
       */
      const { data: admin } =
        await supabase
          .from("admin_users")
          .select("id")
          .eq("id", user.id)
          .eq("is_active", true)
          .maybeSingle();

      if (admin) {
        window.location.replace("/admin");
        return;
      }

      /*
       * PROFILE
       *
       * IMPORTANT:
       * user_code is the public ID such as AC1200.
       *
       * Supabase UUID is NOT displayed.
       */
      const { data: profileData } =
        await supabase
          .from("profiles")
          .select(
            "id, user_code, full_name, email, wallet_balance, pending_balance, total_earned, total_withdrawn"
          )
          .eq("id", user.id)
          .maybeSingle();

      if (profileData && mounted) {
        setProfile(profileData);

        setUserName(
          profileData.full_name ||
            user.email?.split("@")[0] ||
            "User"
        );
      }

      /*
       * ACTIVE CAMPAIGNS
       */
      const { data: campaignData } =
        await supabase
          .from("campaigns")
          .select(
            "id, name, description, category, reward, conversion_type, terms, image_url, landing_url"
          )
          .eq("status", "active")
          .order("created_at", {
            ascending: false,
          });

      if (mounted) {
        setCampaigns(campaignData || []);
      }

      /*
       * RECENT WALLET ACTIVITY
       */
      const { data: transactionData } =
        await supabase
          .from("wallet_transactions")
          .select(
            "id, type, amount, description, created_at"
          )
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          })
          .limit(5);

      if (mounted) {
        setTransactions(
          transactionData || []
        );
      }

      /*
       * WITHDRAWALS
       */
      await loadWithdrawals(user.id);
    } catch (error) {
      console.error(
        "Dashboard error:",
        error
      );
    } finally {
      if (mounted) {
        setLoading(false);
      }
    }
  }

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select(
        "id, user_code, full_name, email, wallet_balance, pending_balance, total_earned, total_withdrawn"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      setProfile(data);

      setUserName(
        data.full_name ||
          user.email?.split("@")[0] ||
          "User"
      );
    }
  }

  async function loadWithdrawals(
    userId?: string
  ) {
    let uid = userId;

    if (!uid) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      uid = user.id;
    }

    const { data } = await supabase
      .from("withdrawals")
      .select(
        "id, amount, method, status, created_at"
      )
      .eq("user_id", uid)
      .order("created_at", {
        ascending: false,
      })
      .limit(5);

    setWithdrawals(data || []);
  }

  /*
   * NO BROWSER ALERT
   *
   * All messages appear inside the UI.
   */
  function showMessage(
    text: string,
    type: "success" | "error"
  ) {
    setMessage(text);
    setMessageType(type);

    window.setTimeout(() => {
      setMessage("");
    }, 4000);
  }

  async function startOffer(
    campaign: Campaign
  ) {
    setStartingOffer(campaign.id);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.replace("/login");
        return;
      }

      if (!campaign.landing_url) {
        showMessage(
          "This offer is temporarily unavailable.",
          "error"
        );
        return;
      }

      /*
       * OWN CLICK TRACKING
       */
      const clickId = crypto.randomUUID();

      const { error } =
        await supabase
          .from("clicks")
          .insert({
            user_id: user.id,
            campaign_id: campaign.id,
            click_id: clickId,
            status: "clicked",
            user_agent:
              navigator.userAgent,
          });

      if (error) {
        console.error(
          "Click tracking error:",
          error
        );

        showMessage(
          "Unable to start this offer right now. Please try again.",
          "error"
        );

        return;
      }

      const separator =
        campaign.landing_url.includes("?")
          ? "&"
          : "?";

      const trackingUrl =
        `${campaign.landing_url}` +
        `${separator}click_id=${encodeURIComponent(
          clickId
        )}`;

      /*
       * NO ALERT
       * Directly open tracking URL.
       */
      window.location.href =
        trackingUrl;
    } catch (error) {
      console.error(
        "Start offer error:",
        error
      );

      showMessage(
        "Something went wrong. Please try again.",
        "error"
      );
    } finally {
      setStartingOffer(null);
    }
  }

  async function logout() {
    await supabase.auth.signOut();

    window.location.replace("/login");
  }

  function withdrawalStatus(
    status: string
  ) {
    const value =
      status.toLowerCase();

    if (
      value === "paid" ||
      value === "approved" ||
      value === "success" ||
      value === "completed"
    ) {
      return {
        label: "Paid",
        className: "status-paid",
      };
    }

    if (
      value === "rejected" ||
      value === "failed"
    ) {
      return {
        label: "Rejected",
        className: "status-rejected",
      };
    }

    return {
      label:
        value === "processing"
          ? "Processing"
          : "Pending",
      className: "status-pending",
    };
  }

  function transactionTitle(
    transaction: Transaction
  ) {
    if (transaction.description) {
      return transaction.description;
    }

    return transaction.type
      .replaceAll("_", " ")
      .replace(
        /\b\w/g,
        (x) => x.toUpperCase()
      );
  }

  if (loading) {
    return (
      <>
        <style>{styles}</style>

        <main className="loading-page">
          <div className="loading-card">
            <div className="logo-mark">
              A
            </div>

            <div className="loading-brand">
              AURACAMP
            </div>

            <div className="loading-line" />

            <p>
              Preparing your dashboard...
            </p>
          </div>
        </main>
      </>
    );
  }

  const wallet = Number(
    profile?.wallet_balance || 0
  );

  const pendingBalance = Number(
    profile?.pending_balance || 0
  );

  const totalEarned = Number(
    profile?.total_earned || 0
  );

  const latestWithdrawal =
    withdrawals[0];

  return (
    <>
      <style>{styles}</style>

      <main className="app">

        {/* =========================
            DESKTOP / MOBILE HEADER
        ========================== */}

        <header className="topbar">
          <div className="topbar-inner">

            <a
              href="/"
              className="brand"
              onClick={() =>
                setActiveNav("home")
              }
            >
              <span className="brand-logo">
                A
              </span>

              <span>
                <strong>AURACAMP</strong>
                <small>
                  Earn • Explore • Grow
                </small>
              </span>
            </a>

            <div className="top-actions">

              <button
                className="notification"
                type="button"
                aria-label="Notifications"
                onClick={() =>
                  showMessage(
                    "Notifications will appear here.",
                    "success"
                  )
                }
              >
                <span />
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
                  />
                </svg>
              </button>

              <button
                className="logout"
                type="button"
                onClick={logout}
              >
                Logout
              </button>

            </div>
          </div>
        </header>

        <div className="container">

          {/* =========================
              MESSAGE
          ========================== */}

          {message && (
            <div
              className={
                messageType === "success"
                  ? "message success"
                  : "message error"
              }
            >
              <span>
                {messageType ===
                "success"
                  ? "✓"
                  : "!"}
              </span>

              {message}
            </div>
          )}

          {/* =========================
              WELCOME
          ========================== */}

          <section className="welcome">

            <div className="welcome-left">

              <div className="avatar">
                {userName
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>
                <p className="eyebrow">
                  WELCOME BACK
                </p>

                <h1>
                  Hello, {userName}
                </h1>

                <p className="welcome-sub">
                  Ready to earn more today?
                </p>
              </div>

            </div>

            <div className="user-code">
              <span>AURA CAMP ID</span>
              <strong>
                {profile?.user_code ||
                  "AC----"}
              </strong>
            </div>

          </section>

          {/* =========================
              WALLET
          ========================== */}

          <section className="wallet-grid">

            <div className="wallet-card">

              <div className="wallet-top">
                <span>
                  Available Balance
                </span>

                <div className="wallet-icon">
                  ₹
                </div>
              </div>

              <strong className="wallet-amount">
                ₹{wallet.toFixed(2)}
              </strong>

              <div className="wallet-bottom">
                <span>
                  Total earned
                </span>

                <b>
                  ₹{totalEarned.toFixed(2)}
                </b>
              </div>

            </div>

            <div className="mini-card">

              <span className="mini-icon blue">
                ₹
              </span>

              <div>
                <small>
                  Pending Balance
                </small>

                <strong>
                  ₹
                  {pendingBalance.toFixed(
                    2
                  )}
                </strong>
              </div>

            </div>

            <div className="mini-card">

              <span className="mini-icon green">
                ✓
              </span>

              <div>
                <small>
                  Total Withdrawn
                </small>

                <strong>
                  ₹
                  {Number(
                    profile?.total_withdrawn ||
                      0
                  ).toFixed(2)}
                </strong>
              </div>

            </div>

          </section>

          {/* =========================
              QUICK ACTIONS
          ========================== */}

          <section className="quick-grid">

            <a
              href="#offers"
              className="quick-card"
              onClick={() =>
                setActiveNav("offers")
              }
            >
              <span className="quick-icon blue-bg">
                →
              </span>

              <div>
                <strong>
                  Earn Rewards
                </strong>

                <small>
                  Explore available offers
                </small>
              </div>

              <b>›</b>
            </a>

            <a
              href="/withdrawal"
              className="quick-card"
            >
              <span className="quick-icon green-bg">
                ₹
              </span>

              <div>
                <strong>
                  Withdraw
                </strong>

                <small>
                  Withdraw your earnings
                </small>
              </div>

              <b>›</b>
            </a>

          </section>

          {/* =========================
              LATEST WITHDRAWAL
          ========================== */}

          {latestWithdrawal && (
            <section className="section">

              <div className="section-heading">
                <div>
                  <p className="eyebrow">
                    PAYOUT STATUS
                  </p>

                  <h2>
                    Latest Withdrawal
                  </h2>
                </div>

                <a href="/withdrawal">
                  View all →
                </a>
              </div>

              <div className="withdrawal-card">

                <div className="withdrawal-main">

                  <div className="withdrawal-icon">
                    ₹
                  </div>

                  <div>
                    <strong>
                      ₹
                      {Number(
                        latestWithdrawal.amount
                      ).toFixed(2)}
                    </strong>

                    <span>
                      {String(
                        latestWithdrawal.method
                      ).toUpperCase()}{" "}
                      •{" "}
                      {new Date(
                        latestWithdrawal.created_at
                      ).toLocaleDateString(
                        "en-IN",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </span>
                  </div>

                </div>

                {(() => {
                  const status =
                    withdrawalStatus(
                      latestWithdrawal.status
                    );

                  return (
                    <span
                      className={`status ${status.className}`}
                    >
                      <i />
                      {status.label}
                    </span>
                  );
                })()}

              </div>

            </section>
          )}

          {/* =========================
              OFFERS
          ========================== */}

          <section
            className="section"
            id="offers"
          >

            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  EARN MORE
                </p>

                <h2>
                  Available Offers
                </h2>

                <p>
                  Complete offers and earn
                  rewards.
                </p>
              </div>

              <span className="offer-count">
                {campaigns.length} Offers
              </span>
            </div>

            {campaigns.length === 0 ? (
              <div className="empty">

                <div className="empty-icon">
                  —
                </div>

                <h3>
                  No offers available
                </h3>

                <p>
                  New offers will appear
                  here when available.
                </p>

              </div>
            ) : (
              <div className="offers">

                {campaigns.map(
                  (campaign) => (
                    <article
                      className="offer"
                      key={campaign.id}
                    >

                      <div className="offer-image">

                        {campaign.image_url ? (
                          <img
                            src={
                              campaign.image_url
                            }
                            alt={
                              campaign.name
                            }
                          />
                        ) : (
                          <div className="offer-placeholder">
                            A
                          </div>
                        )}

                        <span>
                          +₹
                          {Number(
                            campaign.reward
                          ).toFixed(2)}
                        </span>

                      </div>

                      <div className="offer-content">

                        <div className="offer-meta">

                          <span>
                            {campaign.category ||
                              "Offer"}
                          </span>

                          <b>
                            Available
                          </b>

                        </div>

                        <h3>
                          {campaign.name}
                        </h3>

                        <p>
                          {campaign.description ||
                            "Complete this offer and earn your reward."}
                        </p>

                        <div className="offer-footer">

                          <div>
                            <small>
                              Reward
                            </small>

                            <strong>
                              ₹
                              {Number(
                                campaign.reward
                              ).toFixed(2)}
                            </strong>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              startOffer(
                                campaign
                              )
                            }
                            disabled={
                              startingOffer ===
                              campaign.id
                            }
                          >
                            {startingOffer ===
                            campaign.id
                              ? "Starting..."
                              : "Start Offer"}
                            <span>
                              →
                            </span>
                          </button>

                        </div>

                      </div>

                    </article>
                  )
                )}

              </div>
            )}

          </section>

          {/* =========================
              RECENT ACTIVITY
          ========================== */}

          <section className="section">

            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  WALLET
                </p>

                <h2>
                  Recent Activity
                </h2>

                <p>
                  Your latest wallet
                  transactions.
                </p>
              </div>
            </div>

            {transactions.length === 0 ? (
              <div className="empty compact">

                <div className="empty-icon">
                  —
                </div>

                <h3>
                  No transactions yet
                </h3>

                <p>
                  Your earnings will appear
                  here after completing offers.
                </p>

              </div>
            ) : (
              <div className="transactions">

                {transactions.map(
                  (transaction) => {

                    const positive =
                      Number(
                        transaction.amount
                      ) >= 0;

                    return (
                      <div
                        className="transaction"
                        key={transaction.id}
                      >

                        <div className="transaction-left">

                          <div
                            className={
                              positive
                                ? "transaction-icon positive"
                                : "transaction-icon negative"
                            }
                          >
                            {positive
                              ? "+"
                              : "−"}
                          </div>

                          <div>
                            <strong>
                              {transactionTitle(
                                transaction
                              )}
                            </strong>

                            <small>
                              {new Date(
                                transaction.created_at
                              ).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                }
                              )}
                            </small>
                          </div>

                        </div>

                        <strong
                          className={
                            positive
                              ? "amount-positive"
                              : "amount-negative"
                          }
                        >
                          {positive
                            ? "+"
                            : "−"}
                          ₹
                          {Math.abs(
                            Number(
                              transaction.amount
                            )
                          ).toFixed(2)}
                        </strong>

                      </div>
                    );
                  }
                )}

              </div>
            )}

          </section>

          {/* =========================
              FOOTER
          ========================== */}

          <footer className="footer">

            <div className="footer-brand">
              <span className="footer-logo">
                A
              </span>

              <div>
                <strong>
                  AURACAMP
                </strong>

                <small>
                  Independent Rewards Platform
                </small>
              </div>
            </div>

            <div className="footer-links">
              <a href="/terms">
                Terms
              </a>

              <a href="/privacy">
                Privacy
              </a>

              <a href="/support">
                Support
              </a>
            </div>

            <span className="copyright">
              © {new Date().getFullYear()} AURA CAMP
            </span>

          </footer>

        </div>

        {/* =========================
            MOBILE BOTTOM NAV
        ========================== */}

        <nav className="mobile-nav">

          <a
            href="/"
            className={
              activeNav === "home"
                ? "mobile-nav-item active"
                : "mobile-nav-item"
            }
            onClick={() =>
              setActiveNav("home")
            }
          >
            <span>⌂</span>
            Home
          </a>

          <a
            href="#offers"
            className={
              activeNav === "offers"
                ? "mobile-nav-item active"
                : "mobile-nav-item"
            }
            onClick={() =>
              setActiveNav("offers")
            }
          >
            <span>+</span>
            Earn
          </a>

          <a
            href="/withdrawal"
            className="mobile-nav-item"
          >
            <span>₹</span>
            Withdraw
          </a>

          <a
            href="/profile"
            className="mobile-nav-item"
          >
            <span>
              {userName
                .charAt(0)
                .toUpperCase()}
            </span>
            Profile
          </a>

        </nav>

      </main>
    </>
  );
}

/* =========================================================
   DESIGN SYSTEM
========================================================= */

const styles = `

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  min-height: 100%;
}

body {
  overflow-x: hidden;
  background: #f5f8fc;
  color: #111827;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

button,
input {
  font: inherit;
}

button,
a {
  -webkit-tap-highlight-color: transparent;
}

a {
  text-decoration: none;
}

/* =========================
   LOADING
========================= */

.loading-page {
  min-height: 100svh;
  display: grid;
  place-items: center;
  background:
    radial-gradient(
      circle at 50% 30%,
      rgba(46, 102, 235, .08),
      transparent 35%
    ),
    #f5f8fc;
}

.loading-card {
  width: min(320px, 90%);
  padding: 34px;
  border: 1px solid #e4eaf2;
  border-radius: 24px;
  background: #fff;
  text-align: center;
  box-shadow:
    0 25px 70px rgba(15, 23, 42, .08);
}

.loading-card .logo-mark {
  margin: 0 auto 14px;
}

.loading-brand {
  font-size: 20px;
  font-weight: 900;
  letter-spacing: -.6px;
}

.loading-line {
  width: 90px;
  height: 3px;
  margin: 18px auto;
  border-radius: 99px;
  background:
    linear-gradient(
      90deg,
      #2468ee,
      #6a42e8
    );
  animation: loading 1.2s ease-in-out infinite;
}

.loading-card p {
  margin: 0;
  color: #7a8799;
  font-size: 12px;
}

@keyframes loading {
  0% {
    transform: scaleX(.4);
    opacity: .5;
  }

  50% {
    transform: scaleX(1);
    opacity: 1;
  }

  100% {
    transform: scaleX(.4);
    opacity: .5;
  }
}

/* =========================
   APP
========================= */

.app {
  min-height: 100svh;
  background:
    radial-gradient(
      circle at 5% 0%,
      rgba(44, 103, 235, .055),
      transparent 25%
    ),
    radial-gradient(
      circle at 95% 20%,
      rgba(91, 72, 221, .045),
      transparent 25%
    ),
    #f5f8fc;
}

/* =========================
   TOPBAR
========================= */

.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid rgba(225, 231, 240, .9);
  background: rgba(255,255,255,.93);
  backdrop-filter: blur(18px);
}

.topbar-inner {
  width: min(1180px, calc(100% - 36px));
  min-height: 74px;
  margin: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  color: #111827;
}

.brand-logo,
.logo-mark,
.footer-logo {
  display: grid;
  place-items: center;
  color: white;
  background:
    linear-gradient(
      145deg,
      #1d6cff,
      #4257ed 55%,
      #703ce5
    );
  box-shadow:
    0 9px 20px rgba(43, 91, 225, .20),
    inset 0 1px rgba(255,255,255,.55);
}

.brand-logo {
  width: 39px;
  height: 39px;
  border-radius: 12px;
  font-weight: 900;
}

.brand strong {
  display: block;
  font-size: 17px;
  letter-spacing: -.5px;
}

.brand small {
  display: block;
  margin-top: 2px;
  color: #8793a5;
  font-size: 9px;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 9px;
}

.notification {
  position: relative;
  width: 39px;
  height: 39px;
  display: grid;
  place-items: center;
  border: 1px solid #e0e6ef;
  border-radius: 12px;
  background: white;
  cursor: pointer;
}

.notification svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: #344054;
  stroke-width: 1.7;
  stroke-linecap: round;
}

.notification span {
  position: absolute;
  width: 6px;
  height: 6px;
  top: 8px;
  right: 8px;
  border-radius: 50%;
  background: #2468ee;
}

.logout {
  height: 39px;
  padding: 0 15px;
  border: 1px solid #dce3ec;
  border-radius: 12px;
  background: white;
  color: #344054;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

/* =========================
   CONTAINER
========================= */

.container {
  width: min(1180px, calc(100% - 36px));
  margin: auto;
  padding: 30px 0 55px;
}

/* =========================
   MESSAGE
========================= */

.message {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 15px;
  padding: 11px 13px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
}

.message span {
  width: 21px;
  height: 21px;
  display: grid;
  place-items: center;
  flex: 0 0 21px;
  border-radius: 50%;
}

.message.success {
  border: 1px solid #b7ebcb;
  color: #087443;
  background: #f0fdf4;
}

.message.success span {
  background: #d1fadf;
}

.message.error {
  border: 1px solid #fecaca;
  color: #b42318;
  background: #fff5f4;
}

.message.error span {
  background: #fee2e2;
}

/* =========================
   WELCOME
========================= */

.welcome {
  min-height: 145px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 25px;
  padding: 30px;
  border: 1px solid #e1e8f1;
  border-radius: 24px;
  background:
    linear-gradient(
      120deg,
      #ffffff,
      #f7faff
    );
  box-shadow:
    0 18px 45px rgba(15,23,42,.055);
}

.welcome-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  flex: 0 0 58px;
  border: 4px solid white;
  border-radius: 19px;
  color: white;
  background:
    linear-gradient(
      145deg,
      #2b70ef,
      #5947e6
    );
  box-shadow:
    0 10px 25px rgba(44, 94, 221, .20);
  font-size: 21px;
  font-weight: 900;
}

.eyebrow {
  margin: 0 0 5px;
  color: #718096;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 1.1px;
}

.welcome h1 {
  margin: 0;
  color: #101828;
  font-size: 27px;
  line-height: 1.15;
  letter-spacing: -.9px;
}

.welcome-sub {
  margin: 6px 0 0;
  color: #7b8798;
  font-size: 12px;
}

.user-code {
  min-width: 150px;
  padding: 13px 15px;
  border: 1px solid #dce6f4;
  border-radius: 14px;
  background: #f8fbff;
}

.user-code span {
  display: block;
  color: #8390a3;
  font-size: 8px;
  font-weight: 900;
  letter-spacing: .8px;
}

.user-code strong {
  display: block;
  margin-top: 4px;
  color: #245edc;
  font-size: 17px;
  letter-spacing: .4px;
}

/* =========================
   WALLET
========================= */

.wallet-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 13px;
  margin-top: 15px;
}

.wallet-card {
  position: relative;
  overflow: hidden;
  min-height: 160px;
  padding: 22px;
  border-radius: 21px;
  color: white;
  background:
    linear-gradient(
      135deg,
      #172238,
      #202f4a
    );
  box-shadow:
    0 18px 38px rgba(20, 36, 64, .18);
}

.wallet-card::after {
  content: "";
  position: absolute;
  width: 190px;
  height: 190px;
  right: -70px;
  top: -80px;
  border: 1px solid rgba(255,255,255,.10);
  border-radius: 50%;
}

.wallet-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wallet-top span {
  color: rgba(255,255,255,.68);
  font-size: 11px;
}

.wallet-icon {
  width: 33px;
  height: 33px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 10px;
  background: rgba(255,255,255,.08);
  font-weight: 800;
}

.wallet-amount {
  display: block;
  margin-top: 12px;
  font-size: 31px;
  letter-spacing: -1.2px;
}

.wallet-bottom {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  color: rgba(255,255,255,.58);
  font-size: 10px;
}

.wallet-bottom b {
  color: white;
}

.mini-card {
  min-height: 160px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  border: 1px solid #e2e8f0;
  border-radius: 21px;
  background: white;
  box-shadow:
    0 12px 28px rgba(15,23,42,.045);
}

.mini-card small {
  display: block;
  color: #7a8798;
  font-size: 10px;
}

.mini-card strong {
  display: block;
  margin-top: 5px;
  color: #101828;
  font-size: 20px;
  letter-spacing: -.5px;
}

.mini-icon {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  flex: 0 0 40px;
  border-radius: 13px;
  font-weight: 900;
}

.mini-icon.blue {
  color: #245edc;
  background: #edf4ff;
}

.mini-icon.green {
  color: #087443;
  background: #ecfdf3;
}

/* =========================
   QUICK
========================= */

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 13px;
  margin-top: 15px;
}

.quick-card {
  display: flex;
  align-items: center;
  gap: 13px;
  min-height: 72px;
  padding: 14px 17px;
  border: 1px solid #e2e8f0;
  border-radius: 17px;
  color: #111827;
  background: white;
  box-shadow:
    0 10px 24px rgba(15,23,42,.035);
  transition:
    transform .16s ease,
    box-shadow .16s ease;
}

.quick-card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 15px 30px rgba(15,23,42,.07);
}

.quick-icon {
  width: 39px;
  height: 39px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  font-weight: 900;
}

.blue-bg {
  color: #245edc;
  background: #edf4ff;
}

.green-bg {
  color: #087443;
  background: #ecfdf3;
}

.quick-card div {
  flex: 1;
}

.quick-card strong {
  display: block;
  font-size: 12px;
}

.quick-card small {
  display: block;
  margin-top: 3px;
  color: #8490a2;
  font-size: 10px;
}

.quick-card > b {
  color: #98a2b3;
  font-size: 19px;
}

/* =========================
   SECTIONS
========================= */

.section {
  margin-top: 34px;
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 15px;
  margin-bottom: 13px;
}

.section-heading h2 {
  margin: 0;
  color: #101828;
  font-size: 20px;
  letter-spacing: -.5px;
}

.section-heading p:not(.eyebrow) {
  margin: 5px 0 0;
  color: #7c8798;
  font-size: 10px;
}

.section-heading a {
  color: #245edc;
  font-size: 10px;
  font-weight: 800;
}

.offer-count {
  padding: 7px 10px;
  border-radius: 99px;
  color: #245edc;
  background: #edf4ff;
  font-size: 9px;
  font-weight: 800;
}

/* =========================
   WITHDRAWAL
========================= */

.withdrawal-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding: 17px;
  border: 1px solid #e1e7ef;
  border-radius: 17px;
  background: white;
  box-shadow:
    0 10px 24px rgba(15,23,42,.035);
}

.withdrawal-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.withdrawal-icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  color: #245edc;
  background: #edf4ff;
  font-weight: 900;
}

.withdrawal-main strong {
  display: block;
  font-size: 16px;
}

.withdrawal-main span {
  display: block;
  margin-top: 3px;
  color: #8994a5;
  font-size: 9px;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 99px;
  font-size: 9px;
  font-weight: 900;
}

.status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-paid {
  color: #087443;
  background: #ecfdf3;
}

.status-paid i {
  background: #16a34a;
}

.status-pending {
  color: #9a6700;
  background: #fff8db;
}

.status-pending i {
  background: #eab308;
}

.status-rejected {
  color: #b42318;
  background: #fff1f0;
}

.status-rejected i {
  background: #ef4444;
}

/* =========================
   OFFERS
========================= */

.offers {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.offer {
  overflow: hidden;
  border: 1px solid #e1e7ef;
  border-radius: 19px;
  background: white;
  box-shadow:
    0 12px 28px rgba(15,23,42,.04);
  transition:
    transform .18s ease,
    box-shadow .18s ease;
}

.offer:hover {
  transform: translateY(-2px);
  box-shadow:
    0 17px 35px rgba(15,23,42,.07);
}

.offer-image {
  position: relative;
  height: 145px;
  overflow: hidden;
  background: #eef3fa;
}

.offer-image img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.offer-placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: #3266df;
  font-size: 42px;
  font-weight: 900;
  background:
    linear-gradient(
      135deg,
      #edf5ff,
      #f3f0ff
    );
}

.offer-image > span {
  position: absolute;
  top: 11px;
  right: 11px;
  padding: 7px 9px;
  border-radius: 9px;
  color: #087443;
  background: rgba(240,253,244,.95);
  font-size: 10px;
  font-weight: 900;
}

.offer-content {
  padding: 15px;
}

.offer-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.offer-meta span {
  color: #6e7b8e;
  font-size: 9px;
  font-weight: 700;
}

.offer-meta b {
  padding: 4px 7px;
  border-radius: 99px;
  color: #087443;
  background: #ecfdf3;
  font-size: 8px;
}

.offer h3 {
  margin: 9px 0 5px;
  color: #101828;
  font-size: 15px;
  letter-spacing: -.25px;
}

.offer-content > p {
  min-height: 34px;
  margin: 0;
  color: #7c8798;
  font-size: 10px;
  line-height: 1.55;
}

.offer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #edf0f4;
}

.offer-footer small {
  display: block;
  color: #98a2b3;
  font-size: 8px;
}

.offer-footer strong {
  display: block;
  margin-top: 2px;
  color: #101828;
  font-size: 14px;
}

.offer-footer button {
  min-height: 37px;
  padding: 0 13px;
  border: 0;
  border-radius: 10px;
  color: white;
  background:
    linear-gradient(
      100deg,
      #1c293e,
      #26344b
    );
  box-shadow:
    0 7px 15px rgba(15,23,42,.12);
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
}

.offer-footer button span {
  margin-left: 5px;
}

.offer-footer button:disabled {
  opacity: .55;
  cursor: wait;
}

/* =========================
   EMPTY
========================= */

.empty {
  padding: 40px 20px;
  border: 1px dashed #dbe2eb;
  border-radius: 18px;
  background: rgba(255,255,255,.65);
  text-align: center;
}

.empty.compact {
  padding: 30px 20px;
}

.empty-icon {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  margin: auto;
  border-radius: 12px;
  color: #667085;
  background: #f1f4f8;
  font-weight: 900;
}

.empty h3 {
  margin: 11px 0 5px;
  font-size: 13px;
}

.empty p {
  margin: 0;
  color: #8a95a5;
  font-size: 10px;
}

/* =========================
   TRANSACTIONS
========================= */

.transactions {
  overflow: hidden;
  border: 1px solid #e1e7ef;
  border-radius: 17px;
  background: white;
}

.transaction {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding: 14px 16px;
  border-bottom: 1px solid #edf0f4;
}

.transaction:last-child {
  border-bottom: 0;
}

.transaction-left {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 11px;
}

.transaction-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  flex: 0 0 36px;
  border-radius: 11px;
  font-weight: 900;
}

.transaction-icon.positive {
  color: #087443;
  background: #ecfdf3;
}

.transaction-icon.negative {
  color: #b42318;
  background: #fff1f0;
}

.transaction-left strong {
  display: block;
  overflow: hidden;
  color: #344054;
  font-size: 11px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.transaction-left small {
  display: block;
  margin-top: 3px;
  color: #98a2b3;
  font-size: 9px;
}

.amount-positive,
.amount-negative {
  white-space: nowrap;
  font-size: 12px;
}

.amount-positive {
  color: #059669;
}

.amount-negative {
  color: #ef4444;
}

/* =========================
   FOOTER
========================= */

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 50px;
  padding-top: 22px;
  border-top: 1px solid #e2e7ee;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 9px;
}

.footer-logo {
  width: 31px;
  height: 31px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 900;
}

.footer-brand strong {
  display: block;
  font-size: 11px;
}

.footer-brand small {
  display: block;
  margin-top: 2px;
  color: #98a2b3;
  font-size: 8px;
}

.footer-links {
  display: flex;
  gap: 16px;
}

.footer-links a {
  color: #667085;
  font-size: 9px;
  font-weight: 700;
}

.copyright {
  color: #98a2b3;
  font-size: 8px;
}

/* =========================
   MOBILE NAV
========================= */

.mobile-nav {
  display: none;
}

/* =========================
   TABLET
========================= */

@media (max-width: 900px) {

  .wallet-grid {
    grid-template-columns: 1fr 1fr;
  }

  .wallet-card {
    grid-column: 1 / -1;
  }

  .offers {
    grid-template-columns: 1fr;
  }
}

/* =========================
   MOBILE
========================= */

@media (max-width: 640px) {

  body {
    background: #f5f8fc;
  }

  .topbar-inner,
  .container {
    width: calc(100% - 24px);
  }

  .topbar-inner {
    min-height: 64px;
  }

  .brand-logo {
    width: 36px;
    height: 36px;
    border-radius: 11px;
  }

  .brand strong {
    font-size: 15px;
  }

  .brand small {
    display: none;
  }

  .logout {
    padding: 0 11px;
    font-size: 10px;
  }

  .notification {
    width: 36px;
    height: 36px;
  }

  .container {
    padding-top: 17px;
    padding-bottom: 88px;
  }

  .welcome {
    min-height: auto;
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    border-radius: 20px;
  }

  .welcome-left {
    width: 100%;
  }

  .avatar {
    width: 49px;
    height: 49px;
    flex-basis: 49px;
    border-radius: 16px;
    font-size: 18px;
  }

  .welcome h1 {
    font-size: 22px;
  }

  .welcome-sub {
    font-size: 10px;
  }

  .user-code {
    width: 100%;
    min-width: 0;
  }

  .wallet-grid {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .wallet-card {
    grid-column: 1 / -1;
    min-height: 155px;
    padding: 19px;
    border-radius: 19px;
  }

  .wallet-amount {
    font-size: 29px;
  }

  .mini-card {
    min-height: 100px;
    padding: 14px;
    gap: 9px;
    border-radius: 16px;
  }

  .mini-card strong {
    font-size: 15px;
  }

  .mini-icon {
    width: 34px;
    height: 34px;
    flex-basis: 34px;
    border-radius: 10px;
  }

  .quick-grid {
    grid-template-columns: 1fr;
    gap: 9px;
  }

  .quick-card {
    min-height: 64px;
  }

  .section {
    margin-top: 27px;
  }

  .section-heading h2 {
    font-size: 18px;
  }

  .offers {
    gap: 11px;
  }

  .offer {
    border-radius: 17px;
  }

  .offer-image {
    height: 145px;
  }

  .offer-content {
    padding: 14px;
  }

  .withdrawal-card {
    padding: 14px;
    border-radius: 15px;
  }

  .status {
    padding: 6px 8px;
    font-size: 8px;
  }

  .footer {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    margin-bottom: 20px;
  }

  .footer-links {
    justify-content: flex-end;
  }

  .copyright {
    grid-column: 1 / -1;
  }

  /* MOBILE BOTTOM NAV */

  .mobile-nav {
    position: fixed;
    left: 10px;
    right: 10px;
    bottom: 10px;
    z-index: 100;
    height: 63px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    align-items: center;
    padding: 5px;
    border: 1px solid rgba(220,227,237,.95);
    border-radius: 19px;
    background: rgba(255,255,255,.96);
    backdrop-filter: blur(18px);
    box-shadow:
      0 15px 40px rgba(15,23,42,.13);
  }

  .mobile-nav-item {
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 3px;
    border-radius: 14px;
    color: #8792a3;
    font-size: 8px;
    font-weight: 800;
  }

  .mobile-nav-item span {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 900;
  }

  .mobile-nav-item.active {
    color: #245edc;
    background: #edf4ff;
  }

  .mobile-nav-item.active span {
    background: #dce9ff;
  }
}

/* =========================
   SMALL PHONES
========================= */

@media (max-width: 380px) {

  .container,
  .topbar-inner {
    width: calc(100% - 20px);
  }

  .welcome {
    padding: 17px;
  }

  .wallet-amount {
    font-size: 26px;
  }

  .mini-card {
    padding: 11px;
  }

  .mini-card strong {
    font-size: 14px;
  }

  .offer-image {
    height: 125px;
  }
}

`;
