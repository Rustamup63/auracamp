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

    async function init() {
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

        const [profileRes, campaignRes, transactionRes, withdrawalRes] =
          await Promise.all([
            supabase
              .from("profiles")
              .select(
                "user_code, full_name, email, wallet_balance, pending_balance, total_earned, total_withdrawn"
              )
              .eq("id", user.id)
              .maybeSingle(),

            supabase
              .from("campaigns")
              .select(
                "id, name, description, category, reward, conversion_type, terms, image_url, landing_url"
              )
              .eq("status", "active")
              .order("created_at", { ascending: false }),

            supabase
              .from("wallet_transactions")
              .select("id, type, amount, description, created_at")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(5),

            supabase
              .from("withdrawals")
              .select("id, amount, method, status, created_at")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(5),
          ]);

        if (!mounted) return;

        if (profileRes.data) {
          setProfile(profileRes.data);

          setUserName(
            profileRes.data.full_name ||
              user.email?.split("@")[0] ||
              "User"
          );
        } else {
          setUserName(user.email?.split("@")[0] || "User");
        }

        setCampaigns(campaignRes.data || []);
        setTransactions(transactionRes.data || []);
        setWithdrawals(withdrawalRes.data || []);
      } catch (error) {
        console.error("Dashboard error:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * REAL-TIME WALLET + WITHDRAWAL UPDATE
   */
  useEffect(() => {
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function subscribe() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      userId = user.id;

      channel = supabase
        .channel(`user-dashboard-${user.id}`)
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
                "user_code, full_name, email, wallet_balance, pending_balance, total_earned, total_withdrawn"
              )
              .eq("id", user.id)
              .maybeSingle();

            if (data) {
              setProfile(data);
              setUserName(data.full_name || user.email?.split("@")[0] || "User");
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
              .select("id, amount, method, status, created_at")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(5);

            setWithdrawals(data || []);
          }
        )
        .subscribe();
    }

    subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
      userId = null;
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  async function startOffer(campaign: Campaign) {
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
        setMessage("This offer is temporarily unavailable.");
        return;
      }

      const clickId = crypto.randomUUID();

      const { error } = await supabase.from("clicks").insert({
        user_id: user.id,
        campaign_id: campaign.id,
        click_id: clickId,
        status: "clicked",
        user_agent: navigator.userAgent,
      });

      if (error) {
        console.error("Click tracking error:", error);
        setMessage("Unable to start this offer. Please try again.");
        return;
      }

      const separator = campaign.landing_url.includes("?") ? "&" : "?";

      const trackingUrl =
        `${campaign.landing_url}${separator}` +
        `click_id=${encodeURIComponent(clickId)}`;

      window.location.href = trackingUrl;
    } catch (error) {
      console.error("Start offer error:", error);
      setMessage("Something went wrong. Please try again.");
    } finally {
      setStartingOffer(null);
    }
  }

  if (loading) {
    return (
      <>
        <style>{globalStyles}</style>

        <main className="loadingPage">
          <div className="loadingCard">
            <div className="loadingLogo">
              <span>AURA</span> <b>CAMP</b>
            </div>

            <div className="loader" />

            <p>Loading your dashboard...</p>
          </div>
        </main>
      </>
    );
  }

  const wallet = Number(profile?.wallet_balance || 0);
  const pending = Number(profile?.pending_balance || 0);
  const earned = Number(profile?.total_earned || 0);

  return (
    <>
      <style>{globalStyles}</style>

      <main className="page">
        <div className="glow glowOne" />
        <div className="glow glowTwo" />

        <div className="container">
          {/* HEADER */}

          <header className="header animateDown">
            <div className="brandArea">
              <div className="brand">
                <span>AURA</span> <b>CAMP</b>
              </div>

              <div className="tagline">
                Earn • Explore • Grow
              </div>
            </div>

            <div className="headerRight">
              <button
                className="iconButton"
                aria-label="Notifications"
                onClick={() => {
                  window.location.href = "/notifications";
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

          <section className="welcomeCard animateUp delay1">
            <div className="welcomeContent">
              <div className="avatar">
                {userName.charAt(0).toUpperCase()}
              </div>

              <div className="welcomeText">
                <p className="smallText">
                  Welcome back 👋
                </p>

                <h1>{userName}</h1>

                <p className="subText">
                  Complete offers and grow your earnings.
                </p>
              </div>
            </div>

            <div className="welcomeBadge">
              ✨ Start Earning
            </div>
          </section>

          {/* AURA CAMP ID */}

          <section className="idCard animateUp delay2">
            <div className="idIcon">
              AC
            </div>

            <div className="idContent">
              <span>AURA CAMP ID</span>

              <strong>
                {profile?.user_code || "AC----"}
              </strong>
            </div>

            <div className="verified">
              ✓ Verified
            </div>
          </section>

          {/* WALLET */}

          <section className="statsGrid animateUp delay2">
            <div className="walletCard">
              <div className="walletTop">
                <div>
                  <div className="walletLabel">
                    Available Balance
                  </div>

                  <div className="walletAmount">
                    ₹{wallet.toFixed(2)}
                  </div>
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
                  onClick={() => {
                    window.location.href = "/withdraw";
                  }}
                >
                  + Withdraw
                </button>
              </div>
            </div>

            <div className="statCard">
              <div className="statIcon pendingIcon">
                ◷
              </div>

              <div className="cardLabel">
                Pending Rewards
              </div>

              <div className="statAmount">
                ₹{pending.toFixed(2)}
              </div>

              <div className="cardHint">
                Under verification
              </div>
            </div>

            <div className="statCard">
              <div className="statIcon earnedIcon">
                🏆
              </div>

              <div className="cardLabel">
                Total Earned
              </div>

              <div className="statAmount">
                ₹{earned.toFixed(2)}
              </div>

              <div className="cardHint">
                Lifetime earnings
              </div>
            </div>
          </section>

          {/* WITHDRAWAL STATUS */}

          {withdrawals.length > 0 && (
            <section className="section animateUp delay2">
              <div className="sectionHeader">
                <div>
                  <h2>Latest Withdrawal</h2>

                  <p>
                    Your withdrawal status updates automatically.
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
                      ₹{Number(withdrawals[0].amount).toFixed(2)}
                    </strong>

                    <span>
                      {new Date(
                        withdrawals[0].created_at
                      ).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                <WithdrawalStatus
                  status={withdrawals[0].status}
                />
              </div>
            </section>
          )}

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

            <div className="actionGrid">
              <button
                className="actionCard"
                onClick={() =>
                  document
                    .getElementById("offers")
                    ?.scrollIntoView({
                      behavior: "smooth",
                    })
                }
              >
                <div className="actionIcon red">
                  🎁
                </div>

                <div className="actionText">
                  <strong>Earn Rewards</strong>
                  <span>Explore & Earn</span>
                </div>

                <span className="arrow">
                  →
                </span>
              </button>

              <button
                className="actionCard"
                onClick={() => {
                  window.location.href = "/withdraw";
                }}
              >
                <div className="actionIcon green">
                  💸
                </div>

                <div className="actionText">
                  <strong>Withdraw</strong>
                  <span>Get Your Money</span>
                </div>

                <span className="arrow">
                  →
                </span>
              </button>

              <button
                className="actionCard"
                onClick={() => {
                  window.location.href = "/referrals";
                }}
              >
                <div className="actionIcon pink">
                  👥
                </div>

                <div className="actionText">
                  <strong>Refer & Earn</strong>
                  <span>Invite & Earn</span>
                </div>

                <span className="arrow">
                  →
                </span>
              </button>

              <button
                className="actionCard"
                onClick={() => {
                  window.location.href = "/support";
                }}
              >
                <div className="actionIcon blue">
                  🎧
                </div>

                <div className="actionText">
                  <strong>Support</strong>
                  <span>Need Help?</span>
                </div>

                <span className="arrow">
                  →
                </span>
              </button>
            </div>
          </section>

          {/* MESSAGE */}

          {message && (
            <div className="messageBox">
              {message}
            </div>
          )}

          {/* OFFERS */}

          <section
            id="offers"
            className="section animateUp delay4"
          >
            <div className="sectionHeader">
              <div>
                <h2>Available Offers</h2>

                <p>
                  Complete offers and earn real rewards.
                </p>
              </div>

              <span className="offerCount">
                {campaigns.length} Offers
              </span>
            </div>

            {campaigns.length === 0 ? (
              <div className="emptyBox">
                <div className="emptyIcon">
                  🎁
                </div>

                <h3>
                  No offers available
                </h3>

                <p>
                  New earning opportunities will appear here.
                </p>
              </div>
            ) : (
              <div className="offerGrid">
                {campaigns.map((campaign) => (
                  <article
                    key={campaign.id}
                    className="offerCard"
                  >
                    <div className="offerImage">
                      {campaign.image_url ? (
                        <img
                          src={campaign.image_url}
                          alt={campaign.name}
                          loading="lazy"
                        />
                      ) : (
                        <div className="placeholder">
                          🎁
                        </div>
                      )}

                      <div className="rewardBadge">
                        +₹
                        {Number(
                          campaign.reward
                        ).toFixed(2)}
                      </div>
                    </div>

                    <div className="offerContent">
                      <div className="offerTop">
                        <span className="category">
                          {campaign.category || "Offer"}
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
                        className="startButton"
                        disabled={
                          startingOffer === campaign.id
                        }
                        onClick={() =>
                          startOffer(campaign)
                        }
                      >
                        {startingOffer === campaign.id
                          ? "Starting..."
                          : "Start Offer"}

                        <span>
                          →
                        </span>
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

              {transactions.length > 0 && (
                <button
                  className="viewAll"
                  onClick={() => {
                    window.location.href = "/transactions";
                  }}
                >
                  View All →
                </button>
              )}
            </div>

            {transactions.length === 0 ? (
              <div className="emptyBox">
                <div className="emptyIcon">
                  📊
                </div>

                <h3>
                  No transactions yet
                </h3>

                <p>
                  Your earnings will appear here after completing offers.
                </p>
              </div>
            ) : (
              <div className="transactionBox">
                {transactions.map((transaction) => (
                  <div
                    className="transactionRow"
                    key={transaction.id}
                  >
                    <div className="transactionLeft">
                      <div className="transactionIcon">
                        {transaction.amount >= 0
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

                    <div
                      className={
                        transaction.amount >= 0
                          ? "transactionAmount positive"
                          : "transactionAmount negative"
                      }
                    >
                      {transaction.amount >= 0
                        ? "+"
                        : "-"}
                      ₹
                      {Math.abs(
                        Number(transaction.amount)
                      ).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* FOOTER */}

          <footer className="footer">
            <div>
              <strong>
                <span>AURA</span> CAMP
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

        {/* MOBILE BOTTOM NAV */}

        <nav className="mobileBottomNav">
          <button
            className="mobileNavItem active"
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: "smooth",
              })
            }
          >
            <span>⌂</span>
            <small>Home</small>
          </button>

          <button
            className="mobileNavItem"
            onClick={() =>
              document
                .getElementById("offers")
                ?.scrollIntoView({
                  behavior: "smooth",
                })
            }
          >
            <span>✦</span>
            <small>Earn</small>
          </button>

          <button
            className="mobileNavItem"
            onClick={() => {
              window.location.href = "/withdraw";
            }}
          >
            <span>₹</span>
            <small>Withdraw</small>
          </button>

          <button
            className="mobileNavItem"
            onClick={() => {
              window.location.href = "/support";
            }}
          >
            <span>◌</span>
            <small>Support</small>
          </button>
        </nav>
      </main>
    </>
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
  const normalized = status.toLowerCase();

  if (
    normalized === "approved" ||
    normalized === "paid" ||
    normalized === "success" ||
    normalized === "completed"
  ) {
    return (
      <span className="status success">
        ✓ Paid
      </span>
    );
  }

  if (
    normalized === "rejected" ||
    normalized === "failed"
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
   GLOBAL CSS
========================================================= */

const globalStyles = `
* {
  box-sizing: border-box;
}

html {
  width: 100%;
  max-width: 100%;
  scroll-behavior: smooth;
  overflow-x: hidden;
}

body {
  margin: 0;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  background: #f5fbfc;
}

button {
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}

button:disabled {
  opacity: .65;
  cursor: not-allowed;
}

.page {
  min-height: 100vh;
  width: 100%;
  max-width: 100%;
  position: relative;
  overflow-x: hidden;
  padding: 14px 12px 45px;
  background:
    linear-gradient(
      145deg,
      #f3fbfc 0%,
      #f7fbff 48%,
      #faf7ff 100%
    );
  color: #172033;
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
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  position: relative;
  z-index: 2;
}

.glow {
  position: fixed;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(75px);
  z-index: 0;
}

.glowOne {
  width: 280px;
  height: 280px;
  top: -100px;
  left: -110px;
  background: rgba(34, 197, 194, .10);
}

.glowTwo {
  width: 320px;
  height: 320px;
  right: -130px;
  bottom: -130px;
  background: rgba(124, 58, 237, .08);
}

/* ANIMATION */

.animateUp {
  animation: auraUp .55s ease both;
}

.animateDown {
  animation: auraDown .5s ease both;
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
    transform: translateY(12px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes auraDown {
  from {
    opacity: 0;
    transform: translateY(-9px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* LOADING */

.loadingPage {
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
  width: min(320px, 100%);
  padding: 32px 22px;
  text-align: center;
  border-radius: 26px;
  background: rgba(255,255,255,.92);
  border: 1px solid #e1eaed;
  box-shadow:
    0 20px 60px rgba(20,60,80,.10);
}

.loadingLogo {
  margin-bottom: 20px;
  font-size: 25px;
  font-weight: 900;
  letter-spacing: -1px;
}

.loadingLogo span {
  color: #111827;
}

.loadingLogo b {
  color: #16a34a;
}

.loadingCard p {
  margin: 14px 0 0;
  color: #84919d;
  font-size: 12px;
}

.loader {
  width: 29px;
  height: 29px;
  margin: auto;
  border-radius: 50%;
  border: 3px solid #e4ecef;
  border-top-color: #16a34a;
  border-right-color: #155eef;
  animation: spin .75s linear infinite;
}

/* HEADER */

.header {
  min-width: 0;
  margin-bottom: 12px;
  padding: 14px 15px;
  border-radius: 19px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: rgba(255,255,255,.88);
  border: 1px solid rgba(220,230,233,.95);
  box-shadow:
    0 8px 28px rgba(20,60,80,.055);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.brandArea {
  min-width: 0;
}

.brand {
  font-size: 22px;
  font-weight: 950;
  line-height: 1;
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
  font-size: 9px;
  letter-spacing: .45px;
}

.headerRight {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
}

.iconButton {
  width: 38px;
  height: 38px;
  padding: 0;
  border-radius: 12px;
  border: 1px solid #e1e8eb;
  background: #fff;
  cursor: pointer;
  font-size: 16px;
}

.logoutButton {
  border: 0;
  border-radius: 11px;
  padding: 10px 13px;
  background: #132f3f;
  color: white;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

/* WELCOME */

.welcomeCard {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  margin-bottom: 11px;
  padding: 19px;
  border-radius: 21px;
  background:
    linear-gradient(
      135deg,
      #ffffff,
      #f6fbfc 58%,
      #f5f0ff
    );
  border: 1px solid #e1eaed;
  box-shadow:
    0 9px 32px rgba(20,60,80,.055);
}

.welcomeContent {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 49px;
  height: 49px;
  min-width: 49px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  font-weight: 900;
  background:
    linear-gradient(
      135deg,
      #155eef,
      #16a34a
    );
  box-shadow:
    0 8px 20px rgba(21,94,239,.18);
}

.welcomeText {
  min-width: 0;
}

.smallText {
  margin: 0 0 3px;
  color: #71808a;
  font-size: 12px;
}

.welcomeText h1 {
  margin: 0;
  color: #111827;
  font-size: 24px;
  line-height: 1.15;
  font-weight: 900;
  letter-spacing: -.55px;
  overflow-wrap: anywhere;
}

.subText {
  margin: 5px 0 0;
  color: #71808a;
  font-size: 11px;
}

.welcomeBadge {
  flex-shrink: 0;
  padding: 8px 10px;
  border-radius: 11px;
  background: #edf9f5;
  color: #138a50;
  font-size: 10px;
  font-weight: 850;
  white-space: nowrap;
}

/* AURA ID */

.idCard {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: 17px;
  background: rgba(255,255,255,.93);
  border: 1px solid #e2eaed;
  box-shadow:
    0 7px 24px rgba(20,60,80,.045);
}

.idIcon {
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

.idContent {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.idContent span {
  color: #98a5ad;
  font-size: 8px;
  font-weight: 850;
  letter-spacing: .7px;
}

.idContent strong {
  color: #16202b;
  font-size: 15px;
  font-weight: 950;
}

.verified {
  flex-shrink: 0;
  padding: 5px 8px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #059669;
  font-size: 8px;
  font-weight: 850;
}

/* WALLET */

.statsGrid {
  width: 100%;
  display: grid;
  grid-template-columns:
    minmax(280px, 1.5fr)
    repeat(2, minmax(190px, 1fr));
  gap: 11px;
  margin-bottom: 23px;
}

.walletCard {
  min-width: 0;
  min-height: 150px;
  padding: 20px;
  border-radius: 21px;
  color: #fff;
  background:
    linear-gradient(
      135deg,
      #123746,
      #164b59 55%,
      #166a51
    );
  box-shadow:
    0 14px 34px rgba(18,55,70,.19);
  overflow: hidden;
}

.walletTop {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.walletLabel {
  margin-bottom: 5px;
  opacity: .75;
  font-size: 11px;
}

.walletAmount {
  font-size: 30px;
  font-weight: 950;
  letter-spacing: -1px;
}

.walletIcon {
  width: 46px;
  height: 46px;
  min-width: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: rgba(255,255,255,.14);
  font-size: 21px;
}

.walletBottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 18px;
}

.walletBottom span {
  opacity: .68;
  font-size: 10px;
}

.walletBottom button {
  border: 0;
  border-radius: 10px;
  padding: 9px 12px;
  color: #123746;
  background: #fff;
  font-size: 10px;
  font-weight: 850;
  cursor: pointer;
}

/* STAT CARDS */

.statCard {
  min-width: 0;
  min-height: 150px;
  padding: 18px;
  border-radius: 21px;
  background: rgba(255,255,255,.92);
  border: 1px solid #e2eaed;
  box-shadow:
    0 7px 24px rgba(20,60,80,.045);
}

.statIcon {
  width: 37px;
  height: 37px;
  margin-bottom: 11px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.pendingIcon {
  color: #8b5cf6;
  background: #f3e8ff;
}

.earnedIcon {
  color: #ea580c;
  background: #fff7ed;
}

.cardLabel {
  margin-bottom: 4px;
  color: #6d7c86;
  font-size: 10px;
}

.statAmount {
  color: #111827;
  font-size: 23px;
  font-weight: 900;
}

.cardHint {
  margin-top: 5px;
  color: #98a5ad;
  font-size: 9px;
}

/* SECTIONS */

.section {
  min-width: 0;
  margin-bottom: 25px;
}

.sectionHeader {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.sectionHeader h2 {
  margin: 0;
  color: #15202b;
  font-size: 18px;
  font-weight: 900;
  letter-spacing: -.3px;
}

.sectionHeader p {
  margin: 4px 0 0;
  color: #71808a;
  font-size: 11px;
}

.offerCount {
  flex-shrink: 0;
  padding: 6px 9px;
  border-radius: 999px;
  color: #166534;
  background: #ecfdf5;
  font-size: 9px;
  font-weight: 850;
}

/* WITHDRAWAL */

.withdrawalCard {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 13px;
  border-radius: 17px;
  background: #fff;
  border: 1px solid #e3ebed;
  box-shadow: 0 7px 22px rgba(20,60,80,.045);
}

.withdrawalLeft {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.withdrawalIcon {
  width: 38px;
  height: 38px;
  min-width: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
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
  font-size: 13px;
}

.withdrawalLeft span {
  margin-top: 3px;
  color: #98a5ad;
  font-size: 9px;
}

.status {
  flex-shrink: 0;
  padding: 6px 9px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 850;
}

.status.success {
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

/* QUICK ACTIONS */

.actionGrid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.actionCard {
  min-width: 0;
  min-height: 72px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  border: 1px solid #e3ebed;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 6px 20px rgba(20,60,80,.04);
  cursor: pointer;
}

.actionIcon {
  width: 38px;
  height: 38px;
  min-width: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  font-size: 16px;
}

.actionIcon.red {
  color: #e11d48;
  background: #fff1f2;
}

.actionIcon.green {
  color: #059669;
  background: #ecfdf5;
}

.actionIcon.pink {
  color: #db2777;
  background: #fdf2f8;
}

.actionIcon.blue {
  color: #2563eb;
  background: #eff6ff;
}

.actionText {
  min-width: 0;
  flex: 1;
}

.actionText strong,
.actionText span {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.actionText strong {
  color: #17202a;
  font-size: 11px;
}

.actionText span {
  margin-top: 3px;
  color: #98a5ad;
  font-size: 9px;
}

.arrow {
  flex-shrink: 0;
  color: #a0abb1;
}

/* MESSAGE */

.messageBox {
  margin-bottom: 18px;
  padding: 11px 13px;
  border-radius: 13px;
  color: #b42318;
  background: #fff5f4;
  border: 1px solid #ffd9d5;
  font-size: 11px;
}

/* OFFERS */

.offerGrid {
  width: 100%;
  display: grid;
  grid-template-columns:
    repeat(auto-fit, minmax(270px, 1fr));
  gap: 12px;
}

.offerCard {
  min-width: 0;
  overflow: hidden;
  border-radius: 18px;
  background: #fff;
  border: 1px solid #e3ebed;
  box-shadow:
    0 7px 24px rgba(20,60,80,.045);
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

.placeholder {
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
  padding: 6px 9px;
  border-radius: 9px;
  color: #047857;
  background: #fff;
  box-shadow: 0 5px 14px rgba(0,0,0,.10);
  font-size: 11px;
  font-weight: 900;
}

.offerContent {
  padding: 14px;
  min-width: 0;
}

.offerTop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
}

.category {
  max-width: 60%;
  overflow: hidden;
  padding: 5px 7px;
  border-radius: 8px;
  color: #2563eb;
  background: #eff6ff;
  font-size: 9px;
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

.offerContent h3 {
  margin: 9px 0 5px;
  color: #17202a;
  font-size: 15px;
  font-weight: 900;
  overflow-wrap: anywhere;
}

.offerContent p {
  min-height: 34px;
  margin: 0;
  color: #71808a;
  font-size: 10px;
  line-height: 1.55;
}

.startButton {
  width: 100%;
  margin-top: 12px;
  padding: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 0;
  border-radius: 11px;
  color: #fff;
  background:
    linear-gradient(
      90deg,
      #155eef,
      #2563eb
    );
  font-size: 11px;
  font-weight: 850;
  cursor: pointer;
}

/* EMPTY */

.emptyBox {
  padding: 36px 18px;
  text-align: center;
  border-radius: 18px;
  background: rgba(255,255,255,.9);
  border: 1px solid #e3ebed;
}

.emptyIcon {
  width: 55px;
  height: 55px;
  margin: 0 auto 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 17px;
  background: #eef5ff;
  font-size: 24px;
}

.emptyBox h3 {
  margin: 0 0 5px;
  color: #17202a;
  font-size: 15px;
}

.emptyBox p {
  margin: 0;
  color: #84919a;
  font-size: 10px;
}

/* TRANSACTIONS */

.transactionBox {
  overflow: hidden;
  width: 100%;
  border-radius: 17px;
  background: rgba(255,255,255,.94);
  border: 1px solid #e3ebed;
}

.transactionRow {
  min-width: 0;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid #eef2f3;
}

.transactionRow:last-child {
  border-bottom: 0;
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
  font-size: 11px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.transactionInfo span {
  margin-top: 3px;
  color: #98a5ad;
  font-size: 9px;
}

.transactionAmount {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 900;
}

.positive {
  color: #059669;
}

.negative {
  color: #ef4444;
}

.viewAll {
  padding: 0;
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 10px;
  font-weight: 850;
  cursor: pointer;
}

/* FOOTER */

.footer {
  padding: 20px 3px 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #98a5ad;
  font-size: 9px;
}

.footer strong {
  display: block;
  font-size: 13px;
}

.footer strong span {
  color: #111827;
}

.footer strong {
  color: #16a34a;
}

.footer small {
  display: block;
  margin-top: 3px;
  color: #a0abb1;
  font-size: 8px;
}

/* MOBILE NAV */

.mobileBottomNav {
  display: none;
}

/* HOVER */

.actionCard,
.offerCard,
.statCard,
.walletCard,
.startButton,
.walletBottom button,
.iconButton,
.logoutButton {
  transition:
    transform .18s ease,
    box-shadow .18s ease;
}

.actionCard:hover {
  transform: translateY(-3px);
  box-shadow:
    0 12px 28px rgba(20,60,80,.09);
}

.offerCard:hover {
  transform: translateY(-3px);
  box-shadow:
    0 14px 32px rgba(20,60,80,.10);
}

.startButton:hover,
.walletBottom button:hover,
.logoutButton:hover {
  transform: translateY(-2px);
}

.iconButton:hover {
  transform: scale(1.04);
}

/* TABLET */

@media (max-width: 800px) {
  .statsGrid {
    grid-template-columns: 1fr 1fr;
  }

  .walletCard {
    grid-column: span 2;
  }

  .actionGrid {
    grid-template-columns: 1fr 1fr;
  }

  .offerGrid {
    grid-template-columns: 1fr 1fr;
  }
}

/* MOBILE */

@media (max-width: 520px) {
  .page {
    padding:
      8px
      8px
      calc(88px + env(safe-area-inset-bottom));
  }

  .header {
    padding: 12px;
    border-radius: 17px;
  }

  .brand {
    font-size: 19px;
  }

  .tagline {
    font-size: 8px;
  }

  .iconButton {
    width: 35px;
    height: 35px;
    font-size: 14px;
  }

  .logoutButton {
    padding: 9px 10px;
    font-size: 10px;
  }

  .welcomeCard {
    padding: 15px;
    border-radius: 18px;
    align-items: flex-start;
    flex-direction: column;
  }

  .welcomeContent {
    width: 100%;
  }

  .avatar {
    width: 44px;
    height: 44px;
    min-width: 44px;
    border-radius: 14px;
    font-size: 16px;
  }

  .welcomeText h1 {
    font-size: 21px;
  }

  .subText {
    font-size: 10px;
  }

  .welcomeBadge {
    align-self: flex-start;
  }

  .idCard {
    padding: 11px 12px;
    border-radius: 16px;
  }

  .idContent strong {
    font-size: 14px;
  }

  .statsGrid {
    grid-template-columns: 1fr;
    gap: 9px;
  }

  .walletCard {
    grid-column: auto;
    min-height: 145px;
    padding: 17px;
  }

  .walletAmount {
    font-size: 28px;
  }

  .statCard {
    min-height: 132px;
    padding: 16px;
  }

  .actionGrid {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .actionCard {
    min-height: 70px;
    padding: 10px;
    gap: 7px;
    border-radius: 14px;
  }

  .actionIcon {
    width: 34px;
    height: 34px;
    min-width: 34px;
    font-size: 14px;
  }

  .actionText strong {
    font-size: 10px;
  }

  .actionText span {
    font-size: 8px;
  }

  .arrow {
    display: none;
  }

  .offerGrid {
    grid-template-columns: 1fr;
  }

  .offerImage {
    height: 155px;
  }

  .offerContent h3 {
    font-size: 14px;
  }

  .transactionInfo strong {
    max-width: 145px;
  }

  .transactionAmount {
    font-size: 11px;
  }

  .footer {
    flex-direction: column;
    align-items: flex-start;
    padding-bottom: 8px;
  }

  .mobileBottomNav {
    position: fixed;
    left: 8px;
    right: 8px;
    bottom: max(
      8px,
      env(safe-area-inset-bottom)
    );
    z-index: 100;
    height: 61px;
    padding: 4px 5px;
    display: flex;
    align-items: center;
    border: 1px solid rgba(220,230,233,.95);
    border-radius: 19px;
    background: rgba(255,255,255,.94);
    box-shadow:
      0 13px 35px rgba(15,40,55,.15);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }

  .mobileNavItem {
    flex: 1;
    min-width: 0;
    height: 53px;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border: 0;
    background: transparent;
    color: #7b8992;
    cursor: pointer;
  }

  .mobileNavItem span {
    font-size: 18px;
    line-height: 19px;
    font-weight: 900;
  }

  .mobileNavItem small {
    font-size: 8px;
    font-weight: 800;
  }

  .mobileNavItem.active {
    color: #155eef;
  }
}

/* VERY SMALL PHONES */

@media (max-width: 360px) {
  .page {
    padding-left: 6px;
    padding-right: 6px;
  }

  .brand {
    font-size: 18px;
  }

  .logoutButton {
    padding: 8px;
    font-size: 9px;
  }

  .welcomeText h1 {
    font-size: 19px;
  }

  .actionCard {
    padding: 9px 7px;
  }

  .actionIcon {
    width: 31px;
    height: 31px;
    min-width: 31px;
  }

  .actionText strong {
    font-size: 9px;
  }

  .actionText span {
    font-size: 7px;
  }
}
`;
