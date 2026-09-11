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

const TELEGRAM_URL = "https://t.me/Auracampaign";

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
  const [userName, setUserName] = useState("User");
  const [message, setMessage] = useState("");
  const [startingOffer, setStartingOffer] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
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

        const [
          profileResult,
          campaignsResult,
          transactionsResult,
          withdrawalsResult,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select(
              `
              user_code,
              full_name,
              email,
              wallet_balance,
              pending_balance,
              total_earned,
              total_withdrawn
            `
            )
            .eq("id", user.id)
            .maybeSingle(),

          supabase
            .from("campaigns")
            .select(
              `
              id,
              name,
              description,
              category,
              reward,
              conversion_type,
              terms,
              image_url,
              landing_url
            `
            )
            .eq("status", "active")
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("wallet_transactions")
            .select(
              `
              id,
              type,
              amount,
              description,
              created_at
            `
            )
            .eq("user_id", user.id)
            .order("created_at", {
              ascending: false,
            })
            .limit(5),

          supabase
            .from("withdrawals")
            .select(
              `
              id,
              amount,
              method,
              status,
              created_at
            `
            )
            .eq("user_id", user.id)
            .order("created_at", {
              ascending: false,
            })
            .limit(5),
        ]);

        if (!mounted) return;

        if (profileResult.data) {
          setProfile(profileResult.data);

          setUserName(
            profileResult.data.full_name ||
              user.email?.split("@")[0] ||
              "User"
          );
        } else {
          setUserName(
            user.email?.split("@")[0] || "User"
          );
        }

        setCampaigns(campaignsResult.data || []);
        setTransactions(
          transactionsResult.data || []
        );
        setWithdrawals(
          withdrawalsResult.data || []
        );
      } catch (error) {
        console.error(
          "Dashboard loading error:",
          error
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * REALTIME USER DATA
   *
   * Profile:
   * - balance
   * - pending balance
   * - total earned
   *
   * Withdrawal:
   * - pending
   * - approved/paid
   * - rejected
   */
  useEffect(() => {
    let channel:
      | ReturnType<typeof supabase.channel>
      | null = null;

    async function setupRealtime() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      channel = supabase
        .channel(`auracamp-dashboard-${user.id}`)

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
                `
                user_code,
                full_name,
                email,
                wallet_balance,
                pending_balance,
                total_earned,
                total_withdrawn
                `
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
              .select(
                `
                id,
                amount,
                method,
                status,
                created_at
                `
              )
              .eq("user_id", user.id)
              .order("created_at", {
                ascending: false,
              })
              .limit(5);

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

  async function startOffer(
    campaign: Campaign
  ) {
    if (startingOffer) return;

    setMessage("");

    try {
      setStartingOffer(campaign.id);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.replace("/login");
        return;
      }

      if (!campaign.landing_url) {
        setMessage(
          "This offer is temporarily unavailable."
        );
        return;
      }

      const clickId = crypto.randomUUID();

      const { error } = await supabase
        .from("clicks")
        .insert({
          user_id: user.id,
          campaign_id: campaign.id,
          click_id: clickId,
          status: "clicked",
          user_agent: navigator.userAgent,
        });

      if (error) {
        console.error(
          "Click tracking error:",
          error
        );

        setMessage(
          "Unable to start this offer. Please try again."
        );

        return;
      }

      const separator =
        campaign.landing_url.includes("?")
          ? "&"
          : "?";

      const trackingUrl =
        `${campaign.landing_url}${separator}` +
        `click_id=${encodeURIComponent(clickId)}`;

      window.location.href = trackingUrl;
    } catch (error) {
      console.error(
        "Offer start error:",
        error
      );

      setMessage(
        "Something went wrong. Please try again."
      );
    } finally {
      setStartingOffer(null);
    }
  }

  if (loading) {
    return (
      <>
        <style>{styles}</style>

        <main className="loadingScreen">
          <div className="loadingCard">
            <div className="loadingBrand">
              <span>AURA</span>{" "}
              <b>CAMP</b>
            </div>

            <div className="loader" />

            <p>
              Loading your dashboard...
            </p>
          </div>
        </main>
      </>
    );
  }

  const wallet = Number(
    profile?.wallet_balance || 0
  );

  const pending = Number(
    profile?.pending_balance || 0
  );

  const earned = Number(
    profile?.total_earned || 0
  );

  const latestWithdrawal =
    withdrawals[0] || null;

  return (
    <>
      <style>{styles}</style>

      <main className="page">

        <div className="backgroundGlow glow1" />
        <div className="backgroundGlow glow2" />

        <div className="container">

          {/* HEADER */}

          <header className="header fadeDown">

            <div className="brandArea">

              <div className="brand">
                <span>AURA</span>{" "}
                <b>CAMP</b>
              </div>

              <div className="tagline">
                Earn • Explore • Grow
              </div>

            </div>

            <div className="headerActions">

              <button
                className="notificationButton"
                aria-label="Notifications"
                onClick={() => {
                  window.location.href =
                    "/notifications";
                }}
              >
                🔔
              </button>

              <button
                className="logoutButton"
                onClick={logout}
              >
                Logout
              </button>

            </div>

          </header>

          {/* WELCOME */}

          <section className="welcomeCard fadeUp delay1">

            <div className="welcomeLeft">

              <div className="avatar">
                {userName
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="welcomeText">

                <div className="welcomeSmall">
                  Welcome back 👋
                </div>

                <h1>
                  {userName}
                </h1>

                <p>
                  Complete offers and grow
                  your earnings.
                </p>

              </div>

            </div>

            <button
              className="earningBadge"
              onClick={() =>
                document
                  .getElementById("offers")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
            >
              ✨ Start Earning
            </button>

          </section>

          {/* USER ID */}

          <section className="userIdCard fadeUp delay2">

            <div className="userIdIcon">
              AC
            </div>

            <div className="userIdText">

              <span>
                AURA CAMP ID
              </span>

              <strong>
                {profile?.user_code ||
                  "AC----"}
              </strong>

            </div>

            <div className="verifiedBadge">
              ✓ Verified
            </div>

          </section>

          {/* BALANCE */}

          <section className="balanceGrid fadeUp delay2">

            <div className="balanceCard">

              <div className="balanceTop">

                <div>

                  <span className="balanceLabel">
                    Available Balance
                  </span>

                  <strong className="balanceAmount">
                    ₹{wallet.toFixed(2)}
                  </strong>

                </div>

                <div className="balanceIcon">
                  💳
                </div>

              </div>

              <div className="balanceBottom">

                <span>
                  Ready to withdraw
                </span>

                <button
                  onClick={() => {
                    window.location.href =
                      "/withdraw";
                  }}
                >
                  + Withdraw
                </button>

              </div>

            </div>

            <div className="miniStat">

              <div className="miniIcon purple">
                ◷
              </div>

              <span>
                Pending Rewards
              </span>

              <strong>
                ₹{pending.toFixed(2)}
              </strong>

              <small>
                Under verification
              </small>

            </div>

            <div className="miniStat">

              <div className="miniIcon orange">
                🏆
              </div>

              <span>
                Total Earned
              </span>

              <strong>
                ₹{earned.toFixed(2)}
              </strong>

              <small>
                Lifetime earnings
              </small>

            </div>

          </section>

          {/* WITHDRAWAL */}

          {latestWithdrawal && (
            <section className="section fadeUp">

              <div className="sectionTitle">

                <div>
                  <h2>
                    Latest Withdrawal
                  </h2>

                  <p>
                    Status updates automatically.
                  </p>
                </div>

              </div>

              <div className="withdrawalCard">

                <div className="withdrawalLeft">

                  <div className="withdrawalIcon">
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
                      {formatDate(
                        latestWithdrawal.created_at
                      )}
                    </span>

                  </div>

                </div>

                <WithdrawalStatus
                  status={
                    latestWithdrawal.status
                  }
                />

              </div>

            </section>
          )}

          {/* QUICK ACTIONS */}

          <section className="section fadeUp">

            <div className="sectionTitle">

              <div>
                <h2>
                  Quick Actions
                </h2>

                <p>
                  Everything you need in one place.
                </p>
              </div>

            </div>

            <div className="quickGrid">

              <QuickAction
                icon="🎁"
                title="Earn Rewards"
                subtitle="Explore & Earn"
                className="red"
                onClick={() =>
                  document
                    .getElementById("offers")
                    ?.scrollIntoView({
                      behavior: "smooth",
                    })
                }
              />

              <QuickAction
                icon="💸"
                title="Withdraw"
                subtitle="Get Your Money"
                className="green"
                onClick={() => {
                  window.location.href =
                    "/withdraw";
                }}
              />

              <QuickAction
                icon="👥"
                title="Refer & Earn"
                subtitle="Invite & Earn"
                className="pink"
                onClick={() => {
                  window.location.href =
                    "/referrals";
                }}
              />

              <QuickAction
                icon="🎧"
                title="Support"
                subtitle="Need Help?"
                className="blue"
                onClick={() => {
                  window.location.href =
                    "/support";
                }}
              />

            </div>

          </section>

          {message && (
            <div className="errorMessage">
              {message}
            </div>
          )}

          {/* OFFERS */}

          <section
            id="offers"
            className="section fadeUp"
          >

            <div className="sectionTitle">

              <div>
                <h2>
                  Available Offers
                </h2>

                <p>
                  Complete offers and earn real
                  rewards.
                </p>
              </div>

              <span className="offerCount">
                {campaigns.length} Offers
              </span>

            </div>

            {campaigns.length === 0 ? (
              <div className="emptyState">

                <div className="emptyIcon">
                  🎁
                </div>

                <h3>
                  No offers available
                </h3>

                <p>
                  New earning opportunities
                  will appear here.
                </p>

              </div>
            ) : (
              <div className="offerGrid">

                {campaigns.map(
                  (campaign) => (
                    <article
                      className="offerCard"
                      key={campaign.id}
                    >

                      <div className="offerImage">

                        {campaign.image_url ? (
                          <img
                            src={
                              campaign.image_url
                            }
                            alt={
                              campaign.name
                            }
                            loading="lazy"
                          />
                        ) : (
                          <div className="offerPlaceholder">
                            🎁
                          </div>
                        )}

                        <span className="rewardBadge">
                          +₹
                          {Number(
                            campaign.reward
                          ).toFixed(2)}
                        </span>

                      </div>

                      <div className="offerBody">

                        <div className="offerMeta">

                          <span className="category">
                            {campaign.category ||
                              "Offer"}
                          </span>

                          <span className="available">
                            ✓ Available
                          </span>

                        </div>

                        <h3>
                          {campaign.name}
                        </h3>

                        <p>
                          {campaign.description ||
                            "Complete this offer and earn your reward."}
                        </p>

                        <button
                          className="startOffer"
                          disabled={
                            startingOffer ===
                            campaign.id
                          }
                          onClick={() =>
                            startOffer(
                              campaign
                            )
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

                    </article>
                  )
                )}

              </div>
            )}

          </section>

          {/* TRANSACTIONS */}

          <section className="section fadeUp">

            <div className="sectionTitle">

              <div>
                <h2>
                  Recent Activity
                </h2>

                <p>
                  Your latest wallet transactions.
                </p>
              </div>

              {transactions.length > 0 && (
                <button
                  className="viewAll"
                  onClick={() => {
                    window.location.href =
                      "/transactions";
                  }}
                >
                  View All →
                </button>
              )}

            </div>

            {transactions.length === 0 ? (
              <div className="emptyState">

                <div className="emptyIcon">
                  📊
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
                  (transaction) => (
                    <div
                      className="transaction"
                      key={transaction.id}
                    >

                      <div className="transactionLeft">

                        <div className="transactionIcon">
                          {transaction.amount >=
                          0
                            ? "↗"
                            : "↘"}
                        </div>

                        <div className="transactionInfo">

                          <strong>
                            {transaction.description ||
                              transaction.type.replaceAll(
                                "_",
                                " "
                              )}
                          </strong>

                          <span>
                            {formatDate(
                              transaction.created_at
                            )}
                          </span>

                        </div>

                      </div>

                      <strong
                        className={
                          transaction.amount >=
                          0
                            ? "amountPositive"
                            : "amountNegative"
                        }
                      >
                        {transaction.amount >= 0
                          ? "+"
                          : "-"}
                        ₹
                        {Math.abs(
                          Number(
                            transaction.amount
                          )
                        ).toFixed(2)}
                      </strong>

                    </div>
                  )
                )}

              </div>
            )}

          </section>

          {/* FOOTER */}

          <footer className="footer">

            <div>
              <strong>
                <span>AURA</span>{" "}
                CAMP
              </strong>

              <small>
                Independent Rewards Platform
              </small>
            </div>

            <span>
              © {new Date().getFullYear()} AURA CAMP
            </span>

          </footer>

        </div>

        {/* =================================================
            MOBILE BOTTOM NAVIGATION
        ================================================= */}

        <nav
          className="bottomNav"
          aria-label="Mobile navigation"
        >

          {/* HOME */}

          <button
            className="bottomItem active"
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: "smooth",
              })
            }
          >
            <span className="bottomIcon">
              ⌂
            </span>

            <small>
              Home
            </small>

            <i className="activeIndicator" />
          </button>

          {/* OFFERS */}

          <button
            className="bottomItem"
            onClick={() =>
              document
                .getElementById("offers")
                ?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
            }
          >
            <span className="bottomIcon">
              ▦
            </span>

            <small>
              Offers
            </small>
          </button>

          {/* TELEGRAM */}

          <button
            className="telegramItem"
            aria-label="Join AURA CAMP Telegram"
            onClick={() => {
              window.location.href =
                TELEGRAM_URL;
            }}
          >
            <span className="telegramButton">

              <svg
                viewBox="0 0 24 24"
                width="30"
                height="30"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M21.5 3.5 18.3 20c-.24 1.17-.88 1.46-1.78.91l-4.92-3.63-2.37 2.28c-.26.26-.48.48-.99.48l.35-5.02 9.14-8.26c.4-.35-.09-.55-.62-.2L5.8 13.73.94 12.21c-1.06-.33-1.08-1.06.22-1.54L20.16 3.3c.88-.33 1.65.2 1.34.2Z"
                  fill="currentColor"
                />
              </svg>

            </span>

            <small>
              Telegram
            </small>

          </button>

          {/* MY OFFERS */}

          <button
            className="bottomItem"
            onClick={() => {
              window.location.href =
                "/my-offers";
            }}
          >
            <span className="bottomIcon">
              ▤
            </span>

            <small>
              My Offers
            </small>
          </button>

          {/* PROFILE */}

          <button
            className="bottomItem"
            onClick={() => {
              window.location.href =
                "/profile";
            }}
          >
            <span className="bottomIcon">
              ♙
            </span>

            <small>
              Profile
            </small>
          </button>

        </nav>

      </main>
    </>
  );
}

/* =========================================================
   QUICK ACTION
========================================================= */

function QuickAction({
  icon,
  title,
  subtitle,
  className,
  onClick,
}: {
  icon: string;
  title: string;
  subtitle: string;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      className="quickAction"
      onClick={onClick}
    >
      <span
        className={`quickIcon ${className}`}
      >
        {icon}
      </span>

      <span className="quickText">
        <strong>
          {title}
        </strong>

        <small>
          {subtitle}
        </small>
      </span>

      <span className="quickArrow">
        →
      </span>
    </button>
  );
}

/* =========================================================
   WITHDRAWAL STATUS
========================================================= */

function WithdrawalStatus({
  status,
}: {
  status: string;
}) {
  const value =
    status.toLowerCase();

  if (
    value === "approved" ||
    value === "paid" ||
    value === "success" ||
    value === "completed"
  ) {
    return (
      <span className="status paid">
        ✓ Paid
      </span>
    );
  }

  if (
    value === "rejected" ||
    value === "failed"
  ) {
    return (
      <span className="status rejected">
        ✕ Rejected
      </span>
    );
  }

  return (
    <span className="status pending">
      ◷ Pending
    </span>
  );
}

/* =========================================================
   DATE
========================================================= */

function formatDate(
  value: string
) {
  return new Date(
    value
  ).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

/* =========================================================
   CSS
========================================================= */

const styles = `

* {
  box-sizing: border-box;
}

html,
body {
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
}

body {
  background: #f3fafb;
}

button {
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}

button:disabled {
  opacity: .65;
}

/* =========================================
   PAGE
========================================= */

.page {
  position: relative;
  min-height: 100vh;
  width: 100%;
  overflow-x: hidden;

  padding:
    10px
    10px
    45px;

  color: #17202b;

  background:
    linear-gradient(
      145deg,
      #f1fbfc 0%,
      #f7fbff 52%,
      #faf7ff 100%
    );

  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.container {
  position: relative;
  z-index: 2;

  width: 100%;
  max-width: 1120px;

  margin: 0 auto;
}

.backgroundGlow {
  position: fixed;

  z-index: 0;

  border-radius: 50%;

  pointer-events: none;

  filter: blur(80px);
}

.glow1 {
  width: 280px;
  height: 280px;

  left: -130px;
  top: -110px;

  background:
    rgba(34,197,194,.10);
}

.glow2 {
  width: 340px;
  height: 340px;

  right: -150px;
  bottom: -160px;

  background:
    rgba(124,58,237,.08);
}

/* =========================================
   ANIMATIONS
========================================= */

.fadeUp {
  animation:
    fadeUp .45s ease both;
}

.fadeDown {
  animation:
    fadeDown .4s ease both;
}

.delay1 {
  animation-delay: .04s;
}

.delay2 {
  animation-delay: .08s;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform:
      translateY(10px);
  }

  to {
    opacity: 1;
    transform:
      translateY(0);
  }
}

@keyframes fadeDown {
  from {
    opacity: 0;
    transform:
      translateY(-8px);
  }

  to {
    opacity: 1;
    transform:
      translateY(0);
  }
}

@keyframes spin {
  to {
    transform:
      rotate(360deg);
  }
}

@keyframes telegramFloat {
  0%,
  100% {
    transform:
      translateY(0);
  }

  50% {
    transform:
      translateY(-5px);
  }
}

/* =========================================
   LOADING
========================================= */

.loadingScreen {
  min-height: 100vh;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 20px;

  background:
    linear-gradient(
      145deg,
      #effbfc,
      #f5f9ff,
      #fbf7ff
    );
}

.loadingCard {
  width:
    min(320px, 100%);

  padding: 32px 20px;

  text-align: center;

  border-radius: 25px;

  background:
    rgba(255,255,255,.95);

  border:
    1px solid #e1eaed;

  box-shadow:
    0 20px 60px
    rgba(20,60,80,.10);
}

.loadingBrand {
  margin-bottom: 22px;

  font-size: 25px;

  font-weight: 950;

  letter-spacing: -1px;
}

.loadingBrand span {
  color: #111827;
}

.loadingBrand b {
  color: #16a34a;
}

.loader {
  width: 29px;
  height: 29px;

  margin: auto;

  border:
    3px solid #e4ecef;

  border-top-color:
    #155eef;

  border-right-color:
    #16a34a;

  border-radius: 50%;

  animation:
    spin .7s linear infinite;
}

.loadingCard p {
  margin:
    14px 0 0;

  color: #84919d;

  font-size: 11px;
}

/* =========================================
   HEADER
========================================= */

.header {
  min-width: 0;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 10px;

  margin-bottom: 11px;
  padding: 13px 14px;

  border-radius: 18px;

  background:
    rgba(255,255,255,.91);

  border:
    1px solid #dfe9ec;

  box-shadow:
    0 8px 28px
    rgba(20,60,80,.055);

  backdrop-filter:
    blur(16px);
}

.brandArea {
  min-width: 0;
}

.brand {
  font-size: 21px;

  line-height: 1;

  font-weight: 950;

  letter-spacing: -1px;
}

.brand span {
  color: #111827;
}

.brand b {
  color: #16a34a;
}

.tagline {
  margin-top: 4px;

  color: #94a3a8;

  font-size: 8px;

  letter-spacing: .45px;
}

.headerActions {
  display: flex;
  align-items: center;

  gap: 7px;

  flex-shrink: 0;
}

.notificationButton {
  width: 37px;
  height: 37px;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 0;

  border:
    1px solid #dfe8eb;

  border-radius: 12px;

  background: #fff;

  cursor: pointer;

  font-size: 15px;
}

.logoutButton {
  border: 0;

  border-radius: 11px;

  padding:
    10px
    13px;

  color: #fff;

  background:
    #132f3f;

  font-size: 10px;

  font-weight: 850;

  cursor: pointer;
}

/* =========================================
   WELCOME
========================================= */

.welcomeCard {
  min-width: 0;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 12px;

  margin-bottom: 10px;
  padding: 17px;

  border:
    1px solid #e1eaed;

  border-radius: 19px;

  background:
    linear-gradient(
      135deg,
      #fff,
      #f6fbfc 58%,
      #f5f0ff
    );

  box-shadow:
    0 9px 32px
    rgba(20,60,80,.055);
}

.welcomeLeft {
  min-width: 0;

  display: flex;
  align-items: center;

  gap: 11px;
}

.avatar {
  width: 47px;
  height: 47px;

  min-width: 47px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 14px;

  color: #fff;

  background:
    linear-gradient(
      135deg,
      #155eef,
      #16a34a
    );

  box-shadow:
    0 8px 20px
    rgba(21,94,239,.18);

  font-size: 18px;

  font-weight: 900;
}

.welcomeText {
  min-width: 0;
}

.welcomeSmall {
  margin-bottom: 3px;

  color: #71808a;

  font-size: 11px;
}

.welcomeText h1 {
  margin: 0;

  color: #111827;

  font-size: 23px;

  line-height: 1.15;

  font-weight: 900;

  letter-spacing: -.6px;

  overflow-wrap: anywhere;
}

.welcomeText p {
  margin: 5px 0 0;

  color: #71808a;

  font-size: 10px;
}

.earningBadge {
  flex-shrink: 0;

  padding:
    8px
    10px;

  border: 0;

  border-radius: 11px;

  color: #138a50;

  background:
    #edf9f5;

  font-size: 9px;

  font-weight: 850;

  cursor: pointer;
}

/* =========================================
   USER ID
========================================= */

.userIdCard {
  min-width: 0;

  display: flex;
  align-items: center;

  gap: 10px;

  margin-bottom: 11px;
  padding:
    11px
    13px;

  border:
    1px solid #e1eaed;

  border-radius: 16px;

  background:
    rgba(255,255,255,.94);

  box-shadow:
    0 7px 24px
    rgba(20,60,80,.045);
}

.userIdIcon {
  width: 39px;
  height: 39px;

  min-width: 39px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 12px;

  color: #fff;

  background:
    linear-gradient(
      135deg,
      #155eef,
      #16a34a
    );

  font-size: 10px;

  font-weight: 950;
}

.userIdText {
  min-width: 0;

  flex: 1;

  display: flex;
  flex-direction: column;

  gap: 2px;
}

.userIdText span {
  color: #98a5ad;

  font-size: 8px;

  font-weight: 850;

  letter-spacing: .7px;
}

.userIdText strong {
  color: #16202b;

  font-size: 14px;

  font-weight: 950;
}

.verifiedBadge {
  flex-shrink: 0;

  padding:
    6px
    9px;

  border-radius: 999px;

  color: #059669;

  background:
    #ecfdf5;

  font-size: 8px;

  font-weight: 850;
}

/* =========================================
   BALANCE
========================================= */

.balanceGrid {
  width: 100%;

  display: grid;

  grid-template-columns:
    minmax(280px,1.5fr)
    repeat(2,minmax(190px,1fr));

  gap: 10px;

  margin-bottom: 23px;
}

.balanceCard {
  min-width: 0;
  min-height: 145px;

  padding: 18px;

  color: #fff;

  border-radius: 20px;

  background:
    linear-gradient(
      135deg,
      #123746,
      #164b59 55%,
      #166a51
    );

  box-shadow:
    0 14px 34px
    rgba(18,55,70,.19);
}

.balanceTop {
  display: flex;

  align-items: flex-start;

  justify-content: space-between;

  gap: 10px;
}

.balanceLabel {
  display: block;

  margin-bottom: 5px;

  opacity: .75;

  font-size: 10px;
}

.balanceAmount {
  display: block;

  font-size: 30px;

  line-height: 1;

  font-weight: 950;

  letter-spacing: -1.2px;
}

.balanceIcon {
  width: 46px;
  height: 46px;

  min-width: 46px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 14px;

  background:
    rgba(255,255,255,.14);

  font-size: 20px;
}

.balanceBottom {
  display: flex;

  align-items: center;
  justify-content: space-between;

  gap: 8px;

  margin-top: 19px;
}

.balanceBottom span {
  opacity: .68;

  font-size: 9px;
}

.balanceBottom button {
  padding:
    9px
    12px;

  border: 0;

  border-radius: 10px;

  color: #123746;

  background: #fff;

  font-size: 10px;

  font-weight: 850;

  cursor: pointer;
}

.miniStat {
  min-width: 0;
  min-height: 145px;

  padding: 17px;

  border:
    1px solid #e1eaed;

  border-radius: 20px;

  background:
    rgba(255,255,255,.93);

  box-shadow:
    0 7px 24px
    rgba(20,60,80,.045);
}

.miniIcon {
  width: 36px;
  height: 36px;

  margin-bottom: 10px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 11px;

  font-size: 15px;
}

.miniIcon.purple {
  color: #8b5cf6;
  background: #f3e8ff;
}

.miniIcon.orange {
  color: #ea580c;
  background: #fff7ed;
}

.miniStat > span {
  display: block;

  margin-bottom: 4px;

  color: #6d7c86;

  font-size: 10px;
}

.miniStat > strong {
  display: block;

  color: #111827;

  font-size: 22px;

  font-weight: 900;
}

.miniStat > small {
  display: block;

  margin-top: 5px;

  color: #98a5ad;

  font-size: 9px;
}

/* =========================================
   SECTION
========================================= */

.section {
  min-width: 0;

  margin-bottom: 23px;
}

.sectionTitle {
  min-width: 0;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 8px;

  margin-bottom: 11px;
}

.sectionTitle h2 {
  margin: 0;

  color: #15202b;

  font-size: 17px;

  font-weight: 900;

  letter-spacing: -.3px;
}

.sectionTitle p {
  margin: 4px 0 0;

  color: #71808a;

  font-size: 10px;
}

.offerCount {
  flex-shrink: 0;

  padding:
    6px
    9px;

  border-radius: 999px;

  color: #166534;

  background: #ecfdf5;

  font-size: 9px;

  font-weight: 850;
}

/* =========================================
   WITHDRAWAL
========================================= */

.withdrawalCard {
  display: flex;

  align-items: center;
  justify-content: space-between;

  gap: 10px;

  padding: 12px;

  border:
    1px solid #e1eaed;

  border-radius: 16px;

  background: #fff;

  box-shadow:
    0 7px 22px
    rgba(20,60,80,.045);
}

.withdrawalLeft {
  min-width: 0;

  display: flex;
  align-items: center;

  gap: 9px;
}

.withdrawalIcon {
  width: 38px;
  height: 38px;

  min-width: 38px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 11px;

  color: #047857;

  background: #ecfdf5;

  font-weight: 900;
}

.withdrawalLeft strong,
.withdrawalLeft span {
  display: block;
}

.withdrawalLeft strong {
  color: #17202a;

  font-size: 12px;
}

.withdrawalLeft span {
  margin-top: 3px;

  color: #98a5ad;

  font-size: 8px;
}

.status {
  flex-shrink: 0;

  padding:
    6px
    9px;

  border-radius: 999px;

  font-size: 8px;

  font-weight: 850;
}

.status.paid {
  color: #047857;
  background: #ecfdf5;
}

.status.pending {
  color: #a16207;
  background: #fef9c3;
}

.status.rejected {
  color: #dc2626;
  background: #fef2f2;
}

/* =========================================
   QUICK ACTIONS
========================================= */

.quickGrid {
  width: 100%;

  display: grid;

  grid-template-columns:
    repeat(4,minmax(0,1fr));

  gap: 8px;
}

.quickAction {
  min-width: 0;

  min-height: 69px;

  display: flex;
  align-items: center;

  gap: 7px;

  padding: 11px;

  text-align: left;

  border:
    1px solid #e1eaed;

  border-radius: 15px;

  background: #fff;

  box-shadow:
    0 6px 20px
    rgba(20,60,80,.04);

  cursor: pointer;
}

.quickIcon {
  width: 35px;
  height: 35px;

  min-width: 35px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 11px;

  font-size: 14px;
}

.quickIcon.red {
  color: #e11d48;
  background: #fff1f2;
}

.quickIcon.green {
  color: #059669;
  background: #ecfdf5;
}

.quickIcon.pink {
  color: #db2777;
  background: #fdf2f8;
}

.quickIcon.blue {
  color: #2563eb;
  background: #eff6ff;
}

.quickText {
  min-width: 0;

  flex: 1;
}

.quickText strong,
.quickText small {
  display: block;

  overflow: hidden;

  white-space: nowrap;

  text-overflow: ellipsis;
}

.quickText strong {
  color: #17202a;

  font-size: 10px;
}

.quickText small {
  margin-top: 3px;

  color: #98a5ad;

  font-size: 8px;
}

.quickArrow {
  color: #a0abb1;
}

/* =========================================
   ERROR
========================================= */

.errorMessage {
  margin-bottom: 17px;

  padding:
    10px
    12px;

  border:
    1px solid #ffd9d5;

  border-radius: 12px;

  color: #b42318;

  background: #fff5f4;

  font-size: 10px;
}

/* =========================================
   OFFERS
========================================= */

.offerGrid {
  width: 100%;

  display: grid;

  grid-template-columns:
    repeat(auto-fit,minmax(270px,1fr));

  gap: 11px;
}

.offerCard {
  min-width: 0;

  overflow: hidden;

  border:
    1px solid #e1eaed;

  border-radius: 17px;

  background: #fff;

  box-shadow:
    0 7px 24px
    rgba(20,60,80,.045);

  transition:
    transform .18s ease,
    box-shadow .18s ease;
}

.offerCard:hover {
  transform:
    translateY(-2px);

  box-shadow:
    0 14px 32px
    rgba(20,60,80,.09);
}

.offerImage {
  position: relative;

  width: 100%;
  height: 145px;

  overflow: hidden;

  background:
    linear-gradient(
      135deg,
      #edf7f8,
      #f5f1ff
    );
}

.offerImage img {
  width: 100%;
  height: 100%;

  display: block;

  object-fit: cover;
}

.offerPlaceholder {
  width: 100%;
  height: 100%;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 40px;
}

.rewardBadge {
  position: absolute;

  right: 9px;
  bottom: 9px;

  padding:
    6px
    9px;

  border-radius: 9px;

  color: #047857;

  background: #fff;

  box-shadow:
    0 5px 14px
    rgba(0,0,0,.1);

  font-size: 11px;

  font-weight: 900;
}

.offerBody {
  padding: 13px;

  min-width: 0;
}

.offerMeta {
  display: flex;

  align-items: center;
  justify-content: space-between;

  gap: 7px;
}

.category {
  max-width: 60%;

  overflow: hidden;

  padding:
    5px
    7px;

  border-radius: 8px;

  color: #2563eb;

  background: #eff6ff;

  font-size: 8px;

  font-weight: 800;

  white-space: nowrap;

  text-overflow: ellipsis;
}

.available {
  color: #059669;

  font-size: 8px;

  font-weight: 800;

  white-space: nowrap;
}

.offerBody h3 {
  margin:
    9px
    0
    5px;

  color: #17202a;

  font-size: 14px;

  font-weight: 900;

  overflow-wrap: anywhere;
}

.offerBody p {
  min-height: 32px;

  margin: 0;

  color: #71808a;

  font-size: 10px;

  line-height: 1.55;
}

.startOffer {
  width: 100%;

  margin-top: 11px;

  padding: 10px;

  display: flex;
  align-items: center;
  justify-content: center;

  gap: 7px;

  border: 0;

  border-radius: 10px;

  color: #fff;

  background:
    linear-gradient(
      90deg,
      #155eef,
      #2563eb
    );

  font-size: 10px;

  font-weight: 850;

  cursor: pointer;
}

/* =========================================
   EMPTY
========================================= */

.emptyState {
  padding:
    34px
    17px;

  text-align: center;

  border:
    1px solid #e1eaed;

  border-radius: 17px;

  background:
    rgba(255,255,255,.9);
}

.emptyIcon {
  width: 52px;
  height: 52px;

  margin:
    0
    auto
    10px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 16px;

  background: #eef5ff;

  font-size: 23px;
}

.emptyState h3 {
  margin:
    0
    0
    5px;

  color: #17202a;

  font-size: 14px;
}

.emptyState p {
  margin: 0;

  color: #84919a;

  font-size: 10px;
}

/* =========================================
   TRANSACTIONS
========================================= */

.transactions {
  overflow: hidden;

  width: 100%;

  border:
    1px solid #e1eaed;

  border-radius: 16px;

  background:
    rgba(255,255,255,.94);
}

.transaction {
  min-width: 0;

  display: flex;

  align-items: center;
  justify-content: space-between;

  gap: 8px;

  padding:
    11px
    13px;

  border-bottom:
    1px solid #eef2f3;
}

.transaction:last-child {
  border-bottom: 0;
}

.transactionLeft {
  min-width: 0;

  flex: 1;

  display: flex;

  align-items: center;

  gap: 8px;
}

.transactionIcon {
  width: 35px;
  height: 35px;

  min-width: 35px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 11px;

  color: #059669;

  background: #ecfdf5;

  font-weight: 900;
}

.transactionInfo {
  min-width: 0;
}

.transactionInfo strong,
.transactionInfo span {
  display: block;
}

.transactionInfo strong {
  max-width: 220px;

  overflow: hidden;

  color: #17202a;

  font-size: 10px;

  white-space: nowrap;

  text-overflow: ellipsis;
}

.transactionInfo span {
  margin-top: 3px;

  color: #98a5ad;

  font-size: 8px;
}

.amountPositive,
.amountNegative {
  flex-shrink: 0;

  font-size: 11px;

  font-weight: 900;
}

.amountPositive {
  color: #059669;
}

.amountNegative {
  color: #ef4444;
}

.viewAll {
  padding: 0;

  border: 0;

  color: #2563eb;

  background: transparent;

  font-size: 9px;

  font-weight: 850;

  cursor: pointer;
}

/* =========================================
   FOOTER
========================================= */

.footer {
  display: flex;

  align-items: center;
  justify-content: space-between;

  gap: 12px;

  padding:
    18px
    3px
    4px;

  color: #98a5ad;

  font-size: 8px;
}

.footer strong {
  display: block;

  color: #16a34a;

  font-size: 12px;
}

.footer strong span {
  color: #111827;
}

.footer small {
  display: block;

  margin-top: 3px;

  color: #a0abb1;

  font-size: 7px;
}

/* =========================================
   DESKTOP
========================================= */

@media (min-width: 801px) {

  .quickAction,
  .balanceBottom button,
  .startOffer,
  .notificationButton,
  .logoutButton {
    transition:
      transform .18s ease,
      box-shadow .18s ease;
  }

  .quickAction:hover {
    transform:
      translateY(-2px);

    box-shadow:
      0 12px 28px
      rgba(20,60,80,.08);
  }

  .balanceBottom button:hover,
  .startOffer:hover,
  .logoutButton:hover {
    transform:
      translateY(-2px);
  }
}

/* =========================================
   TABLET
========================================= */

@media (max-width: 800px) {

  .balanceGrid {
    grid-template-columns:
      1fr
      1fr;
  }

  .balanceCard {
    grid-column:
      span 2;
  }

  .quickGrid {
    grid-template-columns:
      1fr
      1fr;
  }

  .offerGrid {
    grid-template-columns:
      1fr
      1fr;
  }
}

/* =========================================
   MOBILE
========================================= */

.bottomNav {
  display: none;
}

@media (max-width: 520px) {

  .page {
    padding:
      7px
      7px
      calc(
        104px +
        env(safe-area-inset-bottom)
      );
  }

  .header {
    padding:
      11px;

    border-radius: 17px;
  }

  .brand {
    font-size: 19px;
  }

  .tagline {
    font-size: 8px;
  }

  .notificationButton {
    width: 35px;
    height: 35px;

    font-size: 14px;
  }

  .logoutButton {
    padding:
      9px
      10px;

    font-size: 9px;
  }

  /* WELCOME */

  .welcomeCard {
    padding: 14px;

    border-radius: 18px;

    align-items: flex-start;

    flex-direction: column;
  }

  .welcomeLeft {
    width: 100%;
  }

  .avatar {
    width: 44px;
    height: 44px;

    min-width: 44px;
  }

  .welcomeText h1 {
    font-size: 20px;
  }

  .welcomeText p {
    font-size: 9px;
  }

  .earningBadge {
    align-self: flex-start;

    padding:
      8px
      10px;
  }

  /* ID */

  .userIdCard {
    padding:
      10px
      11px;

    border-radius: 15px;
  }

  .userIdIcon {
    width: 38px;
    height: 38px;

    min-width: 38px;
  }

  .userIdText strong {
    font-size: 13px;
  }

  /* BALANCE */

  .balanceGrid {
    grid-template-columns: 1fr;

    gap: 8px;
  }

  .balanceCard {
    grid-column: auto;

    min-height: 142px;

    padding: 16px;
  }

  .balanceAmount {
    font-size: 28px;
  }

  .miniStat {
    min-height: 125px;

    padding: 15px;
  }

  /* SECTION */

  .section {
    margin-bottom: 21px;
  }

  .sectionTitle h2 {
    font-size: 16px;
  }

  .sectionTitle p {
    font-size: 9px;
  }

  /* QUICK */

  .quickGrid {
    grid-template-columns:
      1fr
      1fr;

    gap: 7px;
  }

  .quickAction {
    min-height: 68px;

    padding:
      9px;

    gap: 6px;

    border-radius: 14px;
  }

  .quickIcon {
    width: 33px;
    height: 33px;

    min-width: 33px;
  }

  .quickText strong {
    font-size: 9px;
  }

  .quickText small {
    font-size: 7px;
  }

  .quickArrow {
    display: none;
  }

  /* OFFERS */

  .offerGrid {
    grid-template-columns: 1fr;
  }

  .offerImage {
    height: 155px;
  }

  /* TRANSACTIONS */

  .transactionInfo strong {
    max-width: 145px;
  }

  .amountPositive,
  .amountNegative {
    font-size: 10px;
  }

  /* FOOTER */

  .footer {
    flex-direction: column;

    align-items: flex-start;

    padding-bottom: 95px;
  }

  /* =================================================
     LARGE PREMIUM BOTTOM NAV
  ================================================= */

  .bottomNav {
    position: fixed;

    left: 8px;
    right: 8px;

    bottom:
      max(
        8px,
        env(safe-area-inset-bottom)
      );

    z-index: 999;

    height: 76px;

    padding:
      5px
      6px;

    display: grid;

    grid-template-columns:
      1fr
      1fr
      1.25fr
      1fr
      1fr;

    align-items: end;

    border:
      1px solid
      rgba(220,230,233,.95);

    border-radius: 24px;

    background:
      rgba(255,255,255,.97);

    box-shadow:
      0 16px 45px
      rgba(15,40,55,.17),
      0 3px 12px
      rgba(15,40,55,.05);

    backdrop-filter:
      blur(20px);

    -webkit-backdrop-filter:
      blur(20px);
  }

  /* NORMAL NAV */

  .bottomItem {
    position: relative;

    width: 100%;
    height: 65px;

    padding:
      4px
      2px;

    border: 0;
    outline: 0;

    display: flex;

    flex-direction: column;

    align-items: center;
    justify-content: center;

    gap: 3px;

    color: #7c8790;

    background: transparent;

    cursor: pointer;

    transition:
      transform .18s ease,
      color .18s ease;
  }

  .bottomItem:active {
    transform:
      scale(.91);
  }

  .bottomIcon {
    width: 37px;
    height: 37px;

    display: flex;

    align-items: center;
    justify-content: center;

    border-radius: 12px;

    font-size: 23px;

    line-height: 1;

    font-weight: 700;
  }

  .bottomItem small {
    font-size: 8px;

    line-height: 10px;

    font-weight: 800;

    white-space: nowrap;
  }

  /* ACTIVE HOME */

  .bottomItem.active {
    color: #155eef;
  }

  .bottomItem.active
  .bottomIcon {
    color: #155eef;

    background:
      #edf3ff;
  }

  .activeIndicator {
    position: absolute;

    bottom: 0;

    width: 31px;
    height: 4px;

    border-radius: 999px;

    background:
      linear-gradient(
        90deg,
        #155eef,
        #16a34a
      );
  }

  /* =================================================
     TELEGRAM CENTER
  ================================================= */

  .telegramItem {
    position: relative;

    height: 84px;

    margin-top: -31px;

    padding: 0;

    border: 0;
    outline: 0;

    display: flex;

    flex-direction: column;

    align-items: center;
    justify-content: flex-end;

    gap: 3px;

    color: #64748b;

    background: transparent;

    cursor: pointer;
  }

  .telegramButton {
    width: 66px;
    height: 66px;

    display: flex;

    align-items: center;
    justify-content: center;

    border-radius: 50%;

    color: #fff;

    background:
      linear-gradient(
        145deg,
        #155eef 0%,
        #2563eb 45%,
        #16a34a 100%
      );

    border:
      4px solid #fff;

    box-shadow:
      0 10px 27px
      rgba(21,94,239,.30),
      0 4px 13px
      rgba(22,163,74,.15);

    animation:
      telegramFloat
      2.8s
      ease-in-out
      infinite;
  }

  .telegramItem small {
    font-size: 8px;

    line-height: 10px;

    font-weight: 850;

    color: #64748b;

    white-space: nowrap;
  }

  .telegramItem:active
  .telegramButton {
    transform:
      scale(.90);
  }

}

/* =========================================
   SMALL PHONES
========================================= */

@media (max-width: 370px) {

  .page {
    padding-left: 6px;
    padding-right: 6px;
  }

  .brand {
    font-size: 18px;
  }

  .logoutButton {
    padding:
      8px;

    font-size: 8px;
  }

  .welcomeText h1 {
    font-size: 19px;
  }

  .quickAction {
    padding:
      8px
      7px;
  }

  .quickIcon {
    width: 31px;
    height: 31px;

    min-width: 31px;
  }

  .quickText strong {
    font-size: 8px;
  }

  .quickText small {
    font-size: 7px;
  }

  .bottomNav {
    height: 73px;

    left: 6px;
    right: 6px;

    border-radius: 22px;
  }

  .telegramButton {
    width: 60px;
    height: 60px;
  }

  .telegramItem {
    height: 80px;

    margin-top: -28px;
  }

  .bottomIcon {
    width: 34px;
    height: 34px;

    font-size: 21px;
  }

}

/* =========================================
   REDUCED MOTION
========================================= */

@media (prefers-reduced-motion: reduce) {

  *,
  *::before,
  *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: .01ms !important;
  }

}

`;
