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

type SoonFeature =
  | "My Offers"
  | "Profile"
  | "Notifications"
  | "Refer & Earn";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userName, setUserName] = useState("User");
  const [startingOffer, setStartingOffer] = useState<string | null>(null);
  const [comingSoon, setComingSoon] =
    useState<SoonFeature | null>(null);

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
        ] = await Promise.all([
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
              "id,name,description,category,reward,conversion_type,terms,image_url,landing_url"
            )
            .eq("status", "active")
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("wallet_transactions")
            .select(
              "id,type,amount,description,created_at"
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
              profileResult.data.email?.split("@")[0] ||
              "User"
          );
        } else {
          setUserName(
            user.email?.split("@")[0] || "User"
          );
        }

        setCampaigns(campaignsResult.data || []);
        setTransactions(transactionsResult.data || []);
      } catch (error) {
        console.error("Dashboard error:", error);
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

  /* REALTIME PROFILE + WALLET */

  useEffect(() => {
    let channel:
      | ReturnType<typeof supabase.channel>
      | null = null;

    async function subscribe() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      channel = supabase
        .channel(`auracamp-user-${user.id}`)
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

            if (data) {
              setProfile(data);

              setUserName(
                data.full_name ||
                  data.email?.split("@")[0] ||
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
            table: "wallet_transactions",
            filter: `user_id=eq.${user.id}`,
          },
          async () => {
            const { data } = await supabase
              .from("wallet_transactions")
              .select(
                "id,type,amount,description,created_at"
              )
              .eq("user_id", user.id)
              .order("created_at", {
                ascending: false,
              })
              .limit(5);

            setTransactions(data || []);
          }
        )
        .subscribe();
    }

    subscribe();

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

  function showComingSoon(feature: SoonFeature) {
    setComingSoon(feature);
  }

  async function startOffer(campaign: Campaign) {
    if (startingOffer) return;

    setStartingOffer(campaign.id);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.replace("/login");
        return;
      }

      if (!campaign.landing_url) {
        showComingSoon("My Offers");
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
        console.error("Click tracking error:", error);
        return;
      }

      const separator = campaign.landing_url.includes("?")
        ? "&"
        : "?";

      const trackingUrl =
        `${campaign.landing_url}` +
        `${separator}click_id=${encodeURIComponent(clickId)}`;

      window.location.href = trackingUrl;
    } catch (error) {
      console.error("Start offer error:", error);
    } finally {
      setStartingOffer(null);
    }
  }

  const wallet = Number(profile?.wallet_balance || 0);
  const pending = Number(profile?.pending_balance || 0);
  const earned = Number(profile?.total_earned || 0);

  if (loading) {
    return (
      <>
        <style>{css}</style>

        <main className="loadingPage">
          <div className="loadingBox">
            <div className="loadingBrand">
              <span>AURA</span> <b>CAMP</b>
            </div>

            <div className="loader" />

            <p>Loading your dashboard...</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>

      <main className="page">

        <div className="ambient ambientOne" />
        <div className="ambient ambientTwo" />

        <div className="container">

          {/* HEADER */}

          <header className="header animateDown">
            <div>
              <div className="brand">
                <span>AURA</span> <b>CAMP</b>
              </div>

              <div className="tagline">
                Earn • Explore • Grow
              </div>
            </div>

            <div className="headerActions">
              <button
                type="button"
                className="notificationButton"
                onClick={() =>
                  showComingSoon("Notifications")
                }
              >
                🔔
              </button>

              <button
                type="button"
                className="logoutButton"
                onClick={logout}
              >
                Logout
              </button>
            </div>
          </header>

          {/* WELCOME */}

          <section className="welcomeCard animateUp delay1">
            <div className="welcomeLeft">

              <div className="avatar">
                {userName
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="welcomeText">
                <p>Welcome back 👋</p>

                <h1>{userName}</h1>

                <span>
                  Complete offers and grow
                  your earnings.
                </span>
              </div>

            </div>

            <button
              type="button"
              className="startEarning"
              onClick={() =>
                document
                  .getElementById("offers")
                  ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
              }
            >
              ✨ Start Earning
            </button>
          </section>

          {/* USER ID */}

          <section className="idCard animateUp delay2">

            <div className="idIcon">
              AC
            </div>

            <div className="idInfo">
              <span>AURA CAMP ID</span>

              <strong>
                {profile?.user_code || "AC----"}
              </strong>
            </div>

            <div className="verified">
              ✓ Verified
            </div>

          </section>

          {/* BALANCE + STATS */}

          <section className="statsSection animateUp delay2">

            {/* WALLET */}

            <div className="walletCard">

              <div className="walletTop">

                <div>
                  <span className="walletTitle">
                    Available Balance
                  </span>

                  <strong className="walletAmount">
                    ₹{wallet.toFixed(2)}
                  </strong>
                </div>

                <div className="walletIcon">
                  💳
                </div>

              </div>

              <div className="walletBottom">

                <span>
                  Ready to withdraw
                </span>

                <button
                  type="button"
                  className="withdrawButton"
                  onClick={() =>
                    (window.location.href =
                      "/withdraw")
                  }
                >
                  + Withdraw
                </button>

              </div>

            </div>

            {/* PENDING */}

            <div className="statCard">

              <div className="statIcon pendingIcon">
                ◷
              </div>

              <span className="statLabel">
                Pending Rewards
              </span>

              <strong className="statAmount">
                ₹{pending.toFixed(2)}
              </strong>

              <span className="statHint">
                Under verification
              </span>

            </div>

            {/* EARNED */}

            <div className="statCard">

              <div className="statIcon earnedIcon">
                🏆
              </div>

              <span className="statLabel">
                Total Earned
              </span>

              <strong className="statAmount">
                ₹{earned.toFixed(2)}
              </strong>

              <span className="statHint">
                Lifetime earnings
              </span>

            </div>

          </section>

          {/* QUICK ACTIONS */}

          <section className="section animateUp delay3">

            <div className="sectionHeader">
              <div>
                <h2>Quick Actions</h2>

                <p>
                  Everything you need in one place.
                </p>
              </div>
            </div>

            <div className="quickGrid">

              <button
                type="button"
                className="quickCard"
                onClick={() =>
                  document
                    .getElementById("offers")
                    ?.scrollIntoView({
                      behavior: "smooth",
                    })
                }
              >
                <div className="quickIcon reward">
                  🎁
                </div>

                <div>
                  <strong>Earn Rewards</strong>
                  <span>Explore & Earn</span>
                </div>

                <b>→</b>
              </button>

              <button
                type="button"
                className="quickCard"
                onClick={() =>
                  (window.location.href =
                    "/withdraw")
                }
              >
                <div className="quickIcon money">
                  💸
                </div>

                <div>
                  <strong>Withdraw</strong>
                  <span>Get Your Money</span>
                </div>

                <b>→</b>
              </button>

              <button
                type="button"
                className="quickCard"
                onClick={() =>
                  showComingSoon("Refer & Earn")
                }
              >
                <div className="quickIcon refer">
                  👥
                </div>

                <div>
                  <strong>Refer & Earn</strong>
                  <span>Coming Soon</span>
                </div>

                <b>→</b>
              </button>

              <button
                type="button"
                className="quickCard"
                onClick={() =>
                  (window.location.href =
                    "/support")
                }
              >
                <div className="quickIcon support">
                  🎧
                </div>

                <div>
                  <strong>Support</strong>
                  <span>Need Help?</span>
                </div>

                <b>→</b>
              </button>

            </div>
          </section>

          {/* OFFERS */}

          <section
            id="offers"
            className="section animateUp delay4"
          >

            <div className="sectionHeader">
              <div>
                <h2>Available Offers</h2>

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
              <div className="emptyCard">

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
              <div className="offersGrid">

                {campaigns.map((campaign) => (
                  <article
                    key={campaign.id}
                    className="offerCard"
                  >

                    <div className="offerImageBox">

                      {campaign.image_url ? (
                        <img
                          src={campaign.image_url}
                          alt={campaign.name}
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
                        type="button"
                        className="offerButton"
                        disabled={
                          startingOffer ===
                          campaign.id
                        }
                        onClick={() =>
                          startOffer(campaign)
                        }
                      >
                        {startingOffer ===
                        campaign.id
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

          <section className="section animateUp delay5">

            <div className="sectionHeader">
              <div>
                <h2>Recent Activity</h2>

                <p>
                  Your latest wallet transactions.
                </p>
              </div>
            </div>

            {transactions.length === 0 ? (
              <div className="emptyCard">

                <div className="emptyIcon">
                  📊
                </div>

                <h3>
                  No transactions yet
                </h3>

                <p>
                  Your earnings will appear here
                  after completing offers.
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
                        key={transaction.id}
                        className="transaction"
                      >

                        <div className="transactionLeft">

                          <div
                            className={
                              positive
                                ? "transactionIcon green"
                                : "transactionIcon red"
                            }
                          >
                            {positive
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
                            </span>

                          </div>

                        </div>

                        <strong
                          className={
                            positive
                              ? "transactionAmount greenText"
                              : "transactionAmount redText"
                          }
                        >
                          {positive ? "+" : "-"}₹
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

          {/* FOOTER */}

          <footer className="footer">
            <div>
              <strong>
                <span>AURA</span> <b>CAMP</b>
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

        {/* ==================================================
            BOTTOM NAVIGATION
        ================================================== */}

        <nav className="bottomNav">

          {/* HOME */}

          <button
            type="button"
            className="navButton active"
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: "smooth",
              })
            }
          >
            <svg viewBox="0 0 24 24">
              <path
                d="M3 10.8 12 3l9 7.8v9.2a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>

            <span>Home</span>
          </button>

          {/* OFFERS */}

          <button
            type="button"
            className="navButton"
            onClick={() =>
              document
                .getElementById("offers")
                ?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
            }
          >
            <svg viewBox="0 0 24 24">
              <rect
                x="4"
                y="4"
                width="6"
                height="6"
                rx="1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <rect
                x="14"
                y="4"
                width="6"
                height="6"
                rx="1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <rect
                x="4"
                y="14"
                width="6"
                height="6"
                rx="1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <rect
                x="14"
                y="14"
                width="6"
                height="6"
                rx="1"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>

            <span>Offers</span>
          </button>

          {/* TELEGRAM */}

          <button
            type="button"
            className="telegramButton"
            onClick={() => {
              window.location.href =
                TELEGRAM_URL;
            }}
            aria-label="Open Aura Camp Telegram"
          >
            <span className="telegramCircle">
              <svg viewBox="0 0 24 24">
                <path
                  d="M21.7 3.4 18.5 20c-.24 1.17-.87 1.46-1.76.91l-4.84-3.57-2.34 2.25c-.26.26-.48.48-.98.48l.35-4.93 8.97-8.1c.39-.35-.08-.55-.6-.2L6.2 13.92l-4.73-1.48c-1.03-.32-1.05-1.03.22-1.52L20.17 3.1c.87-.32 1.63.2 1.53.3Z"
                  fill="white"
                />
              </svg>
            </span>

            <span>Telegram</span>
          </button>

          {/* MY OFFERS */}

          <button
            type="button"
            className="navButton"
            onClick={() =>
              showComingSoon("My Offers")
            }
          >
            <svg viewBox="0 0 24 24">
              <rect
                x="5"
                y="4"
                width="14"
                height="17"
                rx="2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />

              <path
                d="M9 4.5V3h6v1.5M8 9h8M8 13h8M8 17h5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>

            <span>My Offers</span>

            <small>Soon</small>
          </button>

          {/* PROFILE */}

          <button
            type="button"
            className="navButton"
            onClick={() =>
              showComingSoon("Profile")
            }
          >
            <svg viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="8"
                r="3.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />

              <path
                d="M5 20c.8-3.5 3.1-5.2 7-5.2s6.2 1.7 7 5.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>

            <span>Profile</span>

            <small>Soon</small>
          </button>

        </nav>

        {/* COMING SOON */}

        {comingSoon && (
          <div
            className="modalOverlay"
            onClick={() => setComingSoon(null)}
          >
            <div
              className="modal"
              onClick={(e) =>
                e.stopPropagation()
              }
            >

              <button
                type="button"
                className="modalClose"
                onClick={() =>
                  setComingSoon(null)
                }
              >
                ×
              </button>

              <div className="modalIcon">
                ⏳
              </div>

              <h2>Coming Soon</h2>

              <p>
                <strong>{comingSoon}</strong>{" "}
                is currently under development.
              </p>

              <span>
                Stay tuned for the update.
              </span>

              <button
                type="button"
                className="modalButton"
                onClick={() =>
                  setComingSoon(null)
                }
              >
                OK
              </button>

            </div>
          </div>
        )}

      </main>
    </>
  );
}

/* =========================================================
   CSS
========================================================= */

const css = `
* {
  box-sizing: border-box;
}

html {
  width: 100%;
  overflow-x: hidden;
  scroll-behavior: smooth;
}

body {
  margin: 0;
  width: 100%;
  overflow-x: hidden;
  background: #edf5f7;
}

button {
  font-family: inherit;
}

button,
a {
  -webkit-tap-highlight-color: transparent;
}

button:focus {
  outline: none;
}

/* ===============================
   PAGE
================================ */

.page {
  position: relative;
  width: 100%;
  max-width: 540px;
  min-height: 100vh;
  margin: 0 auto;
  padding:
    10px
    9px
    calc(115px + env(safe-area-inset-bottom));

  overflow-x: hidden;

  background:
    linear-gradient(
      145deg,
      #f0fafb 0%,
      #f7fbff 55%,
      #faf7ff 100%
    );

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

.container {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
}

.ambient {
  position: fixed;
  pointer-events: none;
  border-radius: 50%;
  filter: blur(80px);
  z-index: 0;
}

.ambientOne {
  width: 250px;
  height: 250px;
  top: -110px;
  left: -100px;
  background: rgba(37,99,235,.06);
}

.ambientTwo {
  width: 280px;
  height: 280px;
  right: -130px;
  bottom: -130px;
  background: rgba(168,85,247,.055);
}

/* ===============================
   ANIMATION
================================ */

.animateUp {
  animation:
    auraUp .48s ease both;
}

.animateDown {
  animation:
    auraDown .45s ease both;
}

.delay1 {
  animation-delay: .04s;
}

.delay2 {
  animation-delay: .08s;
}

.delay3 {
  animation-delay: .12s;
}

.delay4 {
  animation-delay: .16s;
}

.delay5 {
  animation-delay: .20s;
}

@keyframes auraUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes auraDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes telegramFloat {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-3px);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(.94) translateY(10px);
  }

  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* ===============================
   HEADER
================================ */

.header {
  width: 100%;
  min-width: 0;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 10px;

  padding: 13px 13px;

  margin-bottom: 10px;

  border-radius: 20px;

  border: 1px solid #dfe8eb;

  background:
    rgba(255,255,255,.95);

  box-shadow:
    0 8px 26px
    rgba(20,60,80,.055);
}

.brand {
  font-family: Georgia, serif;
  font-size: 23px;
  line-height: 1;
  letter-spacing: -1px;
  white-space: nowrap;
}

.brand span {
  color: #111827;
}

.brand b {
  color: #209657;
  font-weight: 500;
}

.tagline {
  margin-top: 5px;
  color: #99a5ac;
  font-family: Georgia, serif;
  font-size: 9px;
}

.headerActions {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
}

.notificationButton {
  width: 39px;
  height: 39px;

  border: 1px solid #dfe7ea;
  border-radius: 13px;

  background: #fff;

  display: flex;
  align-items: center;
  justify-content: center;

  font-size: 16px;
  cursor: pointer;
}

.logoutButton {
  height: 39px;

  border: none;
  border-radius: 12px;

  padding: 0 14px;

  background: #153544;
  color: #fff;

  font-family: Georgia, serif;
  font-size: 11px;

  cursor: pointer;
}

/* ===============================
   WELCOME
================================ */

.welcomeCard {
  width: 100%;
  min-width: 0;

  padding: 18px;

  margin-bottom: 10px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 10px;

  border-radius: 22px;
  border: 1px solid #dfe8eb;

  background:
    linear-gradient(
      135deg,
      #ffffff,
      #f8fbff 55%,
      #f5f0ff
    );

  box-shadow:
    0 9px 28px
    rgba(20,60,80,.055);
}

.welcomeLeft {
  min-width: 0;
  flex: 1;

  display: flex;
  align-items: center;
  gap: 11px;
}

.avatar {
  width: 51px;
  height: 51px;
  min-width: 51px;

  border-radius: 16px;

  display: flex;
  align-items: center;
  justify-content: center;

  color: white;

  font-family: Georgia, serif;
  font-size: 20px;

  background:
    linear-gradient(
      135deg,
      #155eef,
      #159d65
    );

  box-shadow:
    0 8px 20px
    rgba(37,99,235,.18);
}

.welcomeText {
  min-width: 0;
}

.welcomeText p {
  margin: 0 0 2px;

  color: #71808a;

  font-family: Georgia, serif;
  font-size: 11px;
}

.welcomeText h1 {
  margin: 0;

  font-family: Georgia, serif;

  font-size: 25px;
  line-height: 1.05;

  font-weight: 500;

  color: #111827;

  overflow-wrap: anywhere;
}

.welcomeText span {
  display: block;

  margin-top: 5px;

  color: #71808a;

  font-family: Georgia, serif;
  font-size: 9px;
  line-height: 1.35;
}

.startEarning {
  flex-shrink: 0;

  border: none;
  border-radius: 12px;

  padding: 10px 11px;

  background: #ecfaf5;
  color: #16804e;

  font-family: Georgia, serif;
  font-size: 9px;

  cursor: pointer;

  white-space: nowrap;
}

/* ===============================
   ID CARD
================================ */

.idCard {
  width: 100%;

  display: flex;
  align-items: center;

  gap: 10px;

  padding: 12px 14px;

  margin-bottom: 10px;

  border:
    1px solid #dfe8eb;

  border-radius: 19px;

  background: rgba(255,255,255,.96);

  box-shadow:
    0 7px 22px
    rgba(20,60,80,.045);
}

.idIcon {
  width: 41px;
  height: 41px;
  min-width: 41px;

  border-radius: 13px;

  display: flex;
  align-items: center;
  justify-content: center;

  color: #fff;

  font-size: 10px;
  font-weight: 900;

  background:
    linear-gradient(
      135deg,
      #155eef,
      #159d65
    );
}

.idInfo {
  min-width: 0;
  flex: 1;
}

.idInfo span {
  display: block;

  color: #9aa6ae;

  font-size: 8px;
  font-weight: 800;

  letter-spacing: .8px;
}

.idInfo strong {
  display: block;

  margin-top: 2px;

  font-family: Georgia, serif;
  font-size: 16px;
  font-weight: 500;

  color: #111827;
}

.verified {
  flex-shrink: 0;

  padding: 8px 10px;

  border-radius: 999px;

  background: #ecfdf5;
  color: #059669;

  font-size: 8px;
  font-weight: 850;
}

/* ===============================
   STATS
================================ */

.statsSection {
  width: 100%;

  display: grid;

  grid-template-columns:
    minmax(0, 1fr)
    minmax(0, 1fr);

  gap: 10px;

  margin-bottom: 20px;
}

.walletCard {
  grid-column: 1 / -1;

  min-width: 0;

  min-height: 168px;

  padding: 19px;

  border-radius: 22px;

  color: #fff;

  background:
    linear-gradient(
      135deg,
      #123746,
      #164b59 55%,
      #166a51
    );

  box-shadow:
    0 13px 32px
    rgba(18,55,70,.17);

  overflow: hidden;
}

.walletTop {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;

  gap: 10px;
}

.walletTitle {
  display: block;

  color: rgba(255,255,255,.78);

  font-family: Georgia, serif;
  font-size: 11px;
}

.walletAmount {
  display: block;

  margin-top: 5px;

  font-family: Georgia, serif;

  font-size: 39px;
  line-height: 1;

  font-weight: 500;

  letter-spacing: -1.5px;
}

.walletIcon {
  width: 49px;
  height: 49px;
  min-width: 49px;

  border-radius: 15px;

  display: flex;
  align-items: center;
  justify-content: center;

  background:
    rgba(255,255,255,.13);

  font-size: 21px;
}

.walletBottom {
  margin-top: 27px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 10px;
}

.walletBottom > span {
  color: rgba(255,255,255,.72);

  font-family: Georgia, serif;
  font-size: 10px;
}

.withdrawButton {
  flex-shrink: 0;

  border: none;
  border-radius: 12px;

  padding: 10px 14px;

  background: #fff;
  color: #153b48;

  font-family: Georgia, serif;
  font-size: 10px;

  cursor: pointer;
}

.statCard {
  min-width: 0;

  min-height: 151px;

  padding: 15px;

  border-radius: 20px;

  border:
    1px solid #e1e9ec;

  background:
    rgba(255,255,255,.96);

  box-shadow:
    0 7px 22px
    rgba(20,60,80,.045);

  overflow: hidden;
}

.statIcon {
  width: 38px;
  height: 38px;

  border-radius: 12px;

  display: flex;
  align-items: center;
  justify-content: center;

  margin-bottom: 13px;

  font-size: 17px;
}

.pendingIcon {
  background: #f3e8ff;
  color: #9333ea;
}

.earnedIcon {
  background: #fff7ed;
  color: #f97316;
}

.statLabel {
  display: block;

  color: #71808a;

  font-family: Georgia, serif;
  font-size: 10px;

  line-height: 1.3;
}

.statAmount {
  display: block;

  margin-top: 4px;

  color: #111827;

  font-family: Georgia, serif;

  font-size: 25px;
  font-weight: 500;

  white-space: nowrap;
}

.statHint {
  display: block;

  margin-top: 5px;

  color: #9aa6ae;

  font-family: Georgia, serif;

  font-size: 8px;

  line-height: 1.3;
}

/* ===============================
   SECTIONS
================================ */

.section {
  width: 100%;
  min-width: 0;
  margin-bottom: 23px;
}

.sectionHeader {
  width: 100%;

  display: flex;
  align-items: flex-end;
  justify-content: space-between;

  gap: 8px;

  margin-bottom: 11px;
}

.sectionHeader h2 {
  margin: 0;

  font-family: Georgia, serif;

  font-size: 20px;
  font-weight: 500;

  letter-spacing: -.3px;
}

.sectionHeader p {
  margin: 4px 0 0;

  color: #71808a;

  font-family: Georgia, serif;

  font-size: 9px;
}

/* ===============================
   QUICK ACTIONS
================================ */

.quickGrid {
  width: 100%;

  display: grid;

  grid-template-columns:
    repeat(2, minmax(0, 1fr));

  gap: 9px;
}

.quickCard {
  width: 100%;
  min-width: 0;

  min-height: 75px;

  display: flex;
  align-items: center;

  gap: 8px;

  padding: 11px;

  border:
    1px solid #e1e9ec;

  border-radius: 17px;

  background: #fff;

  box-shadow:
    0 7px 20px
    rgba(20,60,80,.04);

  text-align: left;

  cursor: pointer;

  overflow: hidden;
}

.quickCard:active {
  transform: scale(.98);
}

.quickCard > div:nth-child(2) {
  min-width: 0;
  flex: 1;
}

.quickCard strong {
  display: block;

  color: #111827;

  font-size: 10px;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quickCard span {
  display: block;

  margin-top: 3px;

  color: #94a3b8;

  font-size: 8px;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quickCard > b {
  flex-shrink: 0;

  color: #94a3b8;

  font-size: 14px;
}

.quickIcon {
  width: 38px;
  height: 38px;
  min-width: 38px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 12px;

  font-size: 17px;
}

.reward {
  background: #fff1f2;
}

.money {
  background: #ecfdf5;
}

.refer {
  background: #fdf2f8;
}

.support {
  background: #eff6ff;
}

/* ===============================
   OFFERS
================================ */

.offerCount {
  flex-shrink: 0;

  padding: 6px 9px;

  border-radius: 999px;

  background: #ecfdf5;
  color: #047857;

  font-size: 8px;
  font-weight: 850;
}

.offersGrid {
  width: 100%;

  display: grid;

  grid-template-columns:
    1fr;

  gap: 11px;
}

.offerCard {
  width: 100%;
  min-width: 0;

  overflow: hidden;

  border-radius: 19px;

  border:
    1px solid #e1e9ec;

  background: #fff;

  box-shadow:
    0 8px 24px
    rgba(20,60,80,.045);
}

.offerImageBox {
  position: relative;

  width: 100%;
  height: 165px;

  overflow: hidden;

  background:
    linear-gradient(
      135deg,
      #eef7f8,
      #f4f0ff
    );
}

.offerImageBox img {
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

  font-size: 42px;
}

.rewardBadge {
  position: absolute;

  right: 10px;
  bottom: 10px;

  padding: 7px 10px;

  border-radius: 10px;

  background: #fff;
  color: #059669;

  font-size: 10px;
  font-weight: 900;

  box-shadow:
    0 5px 15px
    rgba(0,0,0,.1);
}

.offerBody {
  padding: 13px;
}

.offerMeta {
  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 7px;
}

.category {
  max-width: 60%;

  padding: 5px 7px;

  border-radius: 8px;

  background: #eff6ff;
  color: #2563eb;

  font-size: 8px;
  font-weight: 750;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.available {
  color: #059669;

  font-size: 8px;
  font-weight: 750;

  white-space: nowrap;
}

.offerBody h3 {
  margin: 9px 0 5px;

  color: #111827;

  font-family: Georgia, serif;

  font-size: 17px;
  font-weight: 600;

  overflow-wrap: anywhere;
}

.offerBody p {
  margin: 0;

  color: #64748b;

  font-size: 9px;

  line-height: 1.5;
}

.offerButton {
  width: 100%;

  margin-top: 11px;

  border: none;
  border-radius: 11px;

  padding: 11px;

  display: flex;
  align-items: center;
  justify-content: center;

  gap: 8px;

  background:
    linear-gradient(
      90deg,
      #155eef,
      #4f46e5
    );

  color: #fff;

  font-size: 9px;
  font-weight: 850;

  cursor: pointer;
}

.offerButton:disabled {
  opacity: .6;
}

/* ===============================
   EMPTY
================================ */

.emptyCard {
  width: 100%;

  padding: 30px 16px;

  text-align: center;

  border:
    1px solid #e1e9ec;

  border-radius: 19px;

  background:
    rgba(255,255,255,.94);
}

.emptyIcon {
  width: 56px;
  height: 56px;

  margin: 0 auto 11px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 17px;

  background: #eef2ff;

  font-size: 24px;
}

.emptyCard h3 {
  margin: 0 0 4px;

  color: #111827;

  font-size: 14px;
}

.emptyCard p {
  margin: 0;

  color: #94a3b8;

  font-size: 9px;
}

/* ===============================
   TRANSACTIONS
================================ */

.transactions {
  width: 100%;

  overflow: hidden;

  border:
    1px solid #e1e9ec;

  border-radius: 18px;

  background: #fff;
}

.transaction {
  width: 100%;

  padding: 12px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 10px;

  border-bottom:
    1px solid #eef2f4;
}

.transaction:last-child {
  border-bottom: none;
}

.transactionLeft {
  min-width: 0;
  flex: 1;

  display: flex;
  align-items: center;

  gap: 9px;
}

.transactionIcon {
  width: 36px;
  height: 36px;
  min-width: 36px;

  border-radius: 11px;

  display: flex;
  align-items: center;
  justify-content: center;

  font-weight: 900;
}

.transactionIcon.green {
  background: #ecfdf5;
}

.transactionIcon.red {
  background: #fff1f2;
}

.transactionInfo {
  min-width: 0;
}

.transactionInfo strong {
  display: block;

  max-width: 190px;

  color: #111827;

  font-size: 9px;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  text-transform: capitalize;
}

.transactionInfo span {
  display: block;

  margin-top: 3px;

  color: #94a3b8;

  font-size: 8px;
}

.transactionAmount {
  flex-shrink: 0;

  font-size: 10px;
  font-weight: 900;
}

.greenText {
  color: #059669;
}

.redText {
  color: #ef4444;
}

/* ===============================
   FOOTER
================================ */

.footer {
  width: 100%;

  padding:
    12px
    3px
    5px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 10px;

  color: #94a3b8;

  font-size: 8px;
}

.footer strong {
  display: block;

  font-family: Georgia, serif;

  font-size: 12px;
}

.footer strong span {
  color: #111827;
}

.footer strong b {
  color: #209657;
  font-weight: 500;
}

.footer small {
  display: block;

  margin-top: 3px;

  font-size: 7px;
}

/* =================================================
   BOTTOM NAV
================================================= */

.bottomNav {
  position: fixed;

  left: 50%;
  bottom:
    calc(8px + env(safe-area-inset-bottom));

  transform: translateX(-50%);

  width:
    calc(100% - 18px);

  max-width: 520px;

  height: 76px;

  padding: 4px;

  display: grid;

  grid-template-columns:
    repeat(5, minmax(0, 1fr));

  align-items: center;

  border:
    1px solid #dce6e9;

  border-radius: 26px;

  background:
    rgba(255,255,255,.98);

  box-shadow:
    0 16px 45px
    rgba(15,40,55,.18);

  backdrop-filter:
    blur(18px);

  -webkit-backdrop-filter:
    blur(18px);

  z-index: 99999;

  overflow: visible;
}

/* NORMAL NAV BUTTON */

.navButton {
  position: relative;

  width: 100%;
  height: 65px;

  min-width: 0;

  padding: 0;
  margin: 0;

  border: none;
  outline: none;

  appearance: none;
  -webkit-appearance: none;

  background: transparent;

  color: #7d888e;

  display: flex;
  flex-direction: column;

  align-items: center;
  justify-content: center;

  gap: 4px;

  cursor: pointer;

  border-radius: 17px;

  transition:
    transform .15s ease,
    color .15s ease;
}

.navButton:active {
  transform: scale(.9);
}

.navButton.active {
  color: #155eef;
}

.navButton svg {
  width: 24px;
  height: 24px;

  display: block;
}

.navButton span {
  display: block;

  color: currentColor;

  font-size: 8px;
  line-height: 11px;
  font-weight: 700;

  white-space: nowrap;
}

.navButton small {
  position: absolute;

  top: 3px;
  right: 0;

  padding: 2px 4px;

  border-radius: 999px;

  background: #fff0f3;
  color: #e11d48;

  border:
    1px solid #ffd5df;

  font-size: 5px;
  line-height: 7px;
  font-weight: 850;
}

/* =================================================
   TELEGRAM CENTER
================================================= */

.telegramButton {
  position: relative;

  width: 100%;
  height: 94px;

  margin-top: -21px;

  padding: 0;

  border: none;
  outline: none;

  appearance: none;
  -webkit-appearance: none;

  background: transparent;

  display: flex;
  flex-direction: column;

  align-items: center;
  justify-content: flex-start;

  gap: 4px;

  color: #68767d;

  cursor: pointer;

  transition:
    transform .15s ease;
}

.telegramButton:active {
  transform: scale(.91);
}

.telegramCircle {
  width: 68px;
  height: 68px;

  min-width: 68px;
  min-height: 68px;

  border:
    4px solid #fff;

  border-radius: 50%;

  display: flex;
  align-items: center;
  justify-content: center;

  background:
    linear-gradient(
      145deg,
      #29a9e8,
      #168fd0,
      #0879b5
    );

  box-shadow:
    0 10px 27px
    rgba(22,143,208,.32);

  animation:
    telegramFloat 2.8s
    ease-in-out
    infinite;
}

.telegramCircle svg {
  width: 32px;
  height: 32px;

  display: block;
}

.telegramButton > span:last-child {
  color: #68767d;

  font-size: 8px;
  line-height: 11px;

  font-weight: 700;

  white-space: nowrap;
}

/* ===============================
   MODAL
================================ */

.modalOverlay {
  position: fixed;

  inset: 0;

  z-index: 100000;

  padding: 20px;

  display: flex;
  align-items: center;
  justify-content: center;

  background:
    rgba(10,25,35,.48);

  backdrop-filter:
    blur(7px);

  -webkit-backdrop-filter:
    blur(7px);
}

.modal {
  position: relative;

  width:
    min(100%, 350px);

  padding:
    27px 21px 21px;

  border-radius: 25px;

  background: #fff;

  text-align: center;

  box-shadow:
    0 25px 70px
    rgba(10,30,45,.25);

  animation:
    modalIn .25s ease both;
}

.modalClose {
  position: absolute;

  top: 9px;
  right: 11px;

  width: 29px;
  height: 29px;

  border: none;

  border-radius: 50%;

  background: #f1f5f7;

  color: #64748b;

  font-size: 20px;

  cursor: pointer;
}

.modalIcon {
  width: 66px;
  height: 66px;

  margin: 0 auto 13px;

  border-radius: 21px;

  display: flex;
  align-items: center;
  justify-content: center;

  background:
    linear-gradient(
      135deg,
      #f0e7ff,
      #e8f0ff
    );

  font-size: 29px;
}

.modal h2 {
  margin: 0 0 8px;

  color: #111827;

  font-size: 21px;
}

.modal p {
  margin: 0;

  color: #64748b;

  font-size: 11px;
  line-height: 1.6;
}

.modal > span {
  display: block;

  margin-top: 5px;

  color: #94a3b8;

  font-size: 9px;
}

.modalButton {
  width: 100%;

  margin-top: 18px;

  padding: 11px;

  border: none;

  border-radius: 12px;

  background:
    linear-gradient(
      90deg,
      #155eef,
      #6d28d9
    );

  color: #fff;

  font-size: 10px;
  font-weight: 850;

  cursor: pointer;
}

/* ===============================
   LOADING
================================ */

.loadingPage {
  width: 100%;
  min-height: 100vh;

  display: flex;
  align-items: center;
  justify-content: center;

  background:
    linear-gradient(
      145deg,
      #f0fafb,
      #f7fbff,
      #faf7ff
    );
}

.loadingBox {
  width: 260px;

  padding: 30px;

  border-radius: 24px;

  background: #fff;

  text-align: center;

  box-shadow:
    0 20px 60px
    rgba(30,64,175,.10);
}

.loadingBrand {
  margin-bottom: 20px;

  font-family: Georgia, serif;

  font-size: 24px;
}

.loadingBrand b {
  color: #209657;
}

.loader {
  width: 30px;
  height: 30px;

  margin: 0 auto 13px;

  border:
    3px solid #e5e7eb;

  border-top-color: #2563eb;
  border-right-color: #16a34a;

  border-radius: 50%;

  animation:
    spin .75s linear infinite;
}

.loadingBox p {
  margin: 0;

  color: #7b8790;

  font-size: 10px;
}

/* =================================================
   MOBILE
================================================= */

@media (max-width: 520px) {

  .page {
    max-width: 100%;
  }

  .header {
    padding: 12px;
  }

  .welcomeCard {
    padding: 17px;
  }

  .startEarning {
    padding: 9px 8px;
  }

  .walletAmount {
    font-size: 37px;
  }

  .quickGrid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }

  .bottomNav {
    width:
      calc(100% - 16px);

    max-width: 520px;

    height: 75px;
  }
}

/* =================================================
   VERY SMALL MOBILE
================================================= */

@media (max-width: 370px) {

  .page {
    padding-left: 7px;
    padding-right: 7px;

    padding-bottom:
      calc(108px + env(safe-area-inset-bottom));
  }

  .brand {
    font-size: 20px;
  }

  .logoutButton {
    padding: 0 11px;
  }

  .notificationButton {
    width: 36px;
    height: 36px;
  }

  .welcomeCard {
    padding: 14px;
  }

  .avatar {
    width: 45px;
    height: 45px;
    min-width: 45px;
  }

  .welcomeText h1 {
    font-size: 22px;
  }

  .startEarning {
    font-size: 7px;
    padding: 8px 7px;
  }

  .walletCard {
    min-height: 157px;
    padding: 16px;
  }

  .walletAmount {
    font-size: 34px;
  }

  .walletIcon {
    width: 43px;
    height: 43px;
    min-width: 43px;
  }

  .statCard {
    min-height: 142px;
    padding: 13px;
  }

  .statAmount {
    font-size: 22px;
  }

  .quickCard {
    min-height: 70px;
    padding: 9px;
  }

  .quickIcon {
    width: 34px;
    height: 34px;
    min-width: 34px;
  }

  .quickCard strong {
    font-size: 9px;
  }

  .quickCard span {
    font-size: 7px;
  }

  .bottomNav {
    width:
      calc(100% - 12px);

    height: 71px;

    bottom:
      calc(5px + env(safe-area-inset-bottom));
  }

  .navButton {
    height: 61px;
  }

  .navButton svg {
    width: 22px;
    height: 22px;
  }

  .navButton span,
  .telegramButton > span:last-child {
    font-size: 7px;
  }

  .telegramButton {
    height: 87px;
    margin-top: -18px;
  }

  .telegramCircle {
    width: 62px;
    height: 62px;
    min-width: 62px;
    min-height: 62px;
  }

  .telegramCircle svg {
    width: 29px;
    height: 29px;
  }
}

/* =================================================
   DESKTOP — KEEP MOBILE APP FEEL
================================================= */

@media (min-width: 521px) {

  .page {
    max-width: 540px;
  }

  .bottomNav {
    width: 520px;
  }
}
`;
