"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { CSSProperties } from "react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type Profile = {
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

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("User");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }
      alert(`Logged-in User ID: ${user.id}`);
      const { data: admin } = await supabase
        .from("admin_users")
        .select("id, role, is_active")
        .eq("id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (admin) {
        window.location.href = "/admin";
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select(
          "full_name, email, wallet_balance, pending_balance, total_earned, total_withdrawn"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);

        setUserName(
          profileData.full_name ||
            user.email?.split("@")[0] ||
            "User"
        );
      } else {
        setUserName(user.email?.split("@")[0] || "User");
      }

      const { data: campaignData } = await supabase
        .from("campaigns")
        .select(
  "id, name, description, category, reward, conversion_type, terms, image_url, landing_url"
)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      setCampaigns(campaignData || []);

      const { data: transactionData } = await supabase
        .from("wallet_transactions")
        .select("id, type, amount, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      setTransactions(transactionData || []);
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <>
        <style>{globalStyles}</style>

        <main style={styles.loadingPage}>
          <div style={styles.loadingBox}>
            <div style={styles.loadingLogo}>
              <span>AURA</span>{" "}
              <b>CAMP</b>
            </div>

            <div style={styles.loader} />

            <p style={styles.loadingText}>
              Loading your dashboard...
            </p>
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

      <main style={styles.page}>
        <div style={styles.backgroundGlowOne} />
        <div style={styles.backgroundGlowTwo} />

        <div style={styles.container}>

          {/* HEADER */}

          <header
            className="animateDown"
            style={styles.header}
          >
            <div style={styles.brandArea}>
              <div style={styles.brand}>
                <span>AURA</span>{" "}
                <b>CAMP</b>
              </div>

              <div style={styles.tagline}>
                Earn • Explore • Grow
              </div>
            </div>

            <div
              className="headerRight"
              style={styles.headerRight}
            >
              <button
                className="iconButton notificationButton"
                style={styles.notificationButton}
                aria-label="Notifications"
              >
                🔔
              </button>

              <button
                className="logoutButton"
                onClick={logout}
                style={styles.logout}
              >
                Logout
              </button>
            </div>
          </header>

          {/* WELCOME */}

          <section
            className="animateUp delay1 welcome"
            style={styles.welcome}
          >
            <div style={styles.welcomeContent}>
              <div style={styles.avatar}>
                {userName.charAt(0).toUpperCase()}
              </div>

              <div style={styles.welcomeText}>
                <p style={styles.smallText}>
                  Welcome back 👋
                </p>

                <h1 style={styles.welcomeTitle}>
                  {userName}
                </h1>

                <p style={styles.subText}>
                  Complete offers and grow your earnings.
                </p>
              </div>
            </div>

            <div style={styles.welcomeBadge}>
              ✨ Start Earning
            </div>
          </section>

          {/* WALLET + STATS */}

          <section
            className="animateUp delay2 statsGrid"
            style={styles.statsGrid}
          >
            <div
              className="walletCard"
              style={styles.walletCard}
            >
              <div style={styles.walletTop}>
                <div>
                  <div style={styles.walletLabel}>
                    Available Balance
                  </div>

                  <div style={styles.walletAmount}>
                    ₹{wallet.toFixed(2)}
                  </div>
                </div>

                <div style={styles.walletIcon}>
                  💳
                </div>
              </div>

              <div style={styles.walletBottom}>
                <span style={styles.walletHint}>
                  Ready to withdraw
                </span>

                <button
                  className="walletButton"
                  style={styles.walletButton}
                  onClick={() => {
                    window.location.href = "/withdraw";
                  }}
                >
                  + Withdraw
                </button>
              </div>
            </div>

            <div
              className="statCard"
              style={styles.statCard}
            >
              <div
                style={{
                  ...styles.statIcon,
                  background: "#f3e8ff",
                  color: "#9333ea",
                }}
              >
                ◷
              </div>

              <div style={styles.cardLabel}>
                Pending Rewards
              </div>

              <div style={styles.statAmount}>
                ₹{pending.toFixed(2)}
              </div>

              <div style={styles.cardHint}>
                Under verification
              </div>
            </div>

            <div
              className="statCard"
              style={styles.statCard}
            >
              <div
                style={{
                  ...styles.statIcon,
                  background: "#fff7ed",
                  color: "#f97316",
                }}
              >
                🏆
              </div>

              <div style={styles.cardLabel}>
                Total Earned
              </div>

              <div style={styles.statAmount}>
                ₹{earned.toFixed(2)}
              </div>

              <div style={styles.cardHint}>
                Lifetime earnings
              </div>
            </div>
          </section>

          {/* QUICK ACTIONS */}

          <section
            className="animateUp delay3"
            style={styles.section}
          >
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>
                  Quick Actions
                </h2>

                <p style={styles.sectionSub}>
                  Everything you need in one place.
                </p>
              </div>
            </div>

            <div
              className="actionGrid"
              style={styles.actionGrid}
            >

              <button
                className="actionCard"
                style={styles.actionButton}
                onClick={() => {
                  document
                    .getElementById("offers")
                    ?.scrollIntoView({
                      behavior: "smooth",
                    });
                }}
              >
                <div
                  style={{
                    ...styles.actionIcon,
                    background: "#fff1f2",
                    color: "#e11d48",
                  }}
                >
                  🎁
                </div>

                <div className="actionText">
                  <strong style={styles.actionTitle}>
                    Earn Rewards
                  </strong>

                  <span style={styles.actionSub}>
                    Explore & Earn
                  </span>
                </div>

                <span style={styles.actionArrow}>
                  →
                </span>
              </button>

              <button
                className="actionCard"
                style={styles.actionButton}
                onClick={() => {
                  window.location.href = "/withdraw";
                }}
              >
                <div
                  style={{
                    ...styles.actionIcon,
                    background: "#ecfdf5",
                    color: "#059669",
                  }}
                >
                  💸
                </div>

                <div className="actionText">
                  <strong style={styles.actionTitle}>
                    Withdraw
                  </strong>

                  <span style={styles.actionSub}>
                    Get Your Money
                  </span>
                </div>

                <span style={styles.actionArrow}>
                  →
                </span>
              </button>

              <button
                className="actionCard"
                style={styles.actionButton}
                onClick={() => {
                  alert(
                    "Referral system will be available soon."
                  );
                }}
              >
                <div
                  style={{
                    ...styles.actionIcon,
                    background: "#fdf2f8",
                    color: "#db2777",
                  }}
                >
                  👥
                </div>

                <div className="actionText">
                  <strong style={styles.actionTitle}>
                    Refer & Earn
                  </strong>

                  <span style={styles.actionSub}>
                    Invite & Earn
                  </span>
                </div>

                <span style={styles.actionArrow}>
                  →
                </span>
              </button>

              <button
                className="actionCard"
                style={styles.actionButton}
                onClick={() => {
                  window.location.href = "/support";
                }}
              >
                <div
                  style={{
                    ...styles.actionIcon,
                    background: "#eff6ff",
                    color: "#2563eb",
                  }}
                >
                  🎧
                </div>

                <div className="actionText">
                  <strong style={styles.actionTitle}>
                    Support
                  </strong>

                  <span style={styles.actionSub}>
                    Need Help?
                  </span>
                </div>

                <span style={styles.actionArrow}>
                  →
                </span>
              </button>

            </div>
          </section>

          {/* OFFERS */}

          <section
            id="offers"
            className="animateUp delay4"
            style={styles.section}
          >
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>
                  Available Offers
                </h2>

                <p style={styles.sectionSub}>
                  Complete offers and earn real rewards.
                </p>
              </div>

              <span style={styles.offerCount}>
                {campaigns.length} Offers
              </span>
            </div>

            {campaigns.length === 0 ? (
              <div style={styles.emptyBox}>
                <div style={styles.emptyIcon}>
                  🎁
                </div>

                <h3 style={styles.emptyTitle}>
                  No offers available
                </h3>

                <p style={styles.emptyText}>
                  New earning opportunities will appear here.
                </p>
              </div>
            ) : (
              <div style={styles.offerGrid}>
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="offerCard"
                    style={styles.offerCard}
                  >
                    <div style={styles.offerImageWrap}>
                      {campaign.image_url ? (
                        <img
                          src={campaign.image_url}
                          alt={campaign.name}
                          style={styles.offerImage}
                        />
                      ) : (
                        <div
                          style={styles.offerPlaceholder}
                        >
                          🎁
                        </div>
                      )}

                      <div style={styles.offerRewardBadge}>
                        +₹
                        {Number(
                          campaign.reward
                        ).toFixed(2)}
                      </div>
                    </div>

                    <div style={styles.offerContent}>
                      <div style={styles.offerTop}>
                        <span style={styles.category}>
                          {campaign.category || "Offer"}
                        </span>

                        <span style={styles.easyBadge}>
                          ✓ Available
                        </span>
                      </div>

                      <h3 style={styles.offerName}>
                        {campaign.name}
                      </h3>

                      <p style={styles.offerDescription}>
                        {campaign.description ||
                          "Complete this offer and earn your reward."}
                      </p>

                      <button
                        className="startButton"
                        style={styles.startButton}
                        onClick={async () => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (!campaign.landing_url) {
      alert("This offer is temporarily unavailable.");
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

  alert(
    `Click tracking error: ${error.message}`
  );

  return;
    }

    const separator = campaign.landing_url.includes("?")
      ? "&"
      : "?";

    const trackingUrl =
      `${campaign.landing_url}${separator}` +
      `click_id=${encodeURIComponent(clickId)}`;

    window.location.href = trackingUrl;
  } catch (error) {
    console.error("Start offer error:", error);
    alert("Something went wrong. Please try again.");
  }
}}
                      >
                        Start Offer
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
                    {/* RECENT ACTIVITY */}

          <section
            className="animateUp delay5"
            style={styles.section}
          >
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>
                  Recent Activity
                </h2>

                <p style={styles.sectionSub}>
                  Your latest wallet transactions.
                </p>
              </div>

              {transactions.length > 0 && (
                <span style={styles.viewAll}>
                  View All →
                </span>
              )}
            </div>

            {transactions.length === 0 ? (
              <div style={styles.emptyBox}>
                <div style={styles.emptyIcon}>
                  📊
                </div>

                <h3 style={styles.emptyTitle}>
                  No transactions yet
                </h3>

                <p style={styles.emptyText}>
                  Your earnings will appear here after
                  completing offers.
                </p>
              </div>
            ) : (
              <div style={styles.transactionBox}>
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="transactionRow"
                    style={styles.transactionRow}
                  >
                    <div style={styles.transactionLeft}>
                      <div style={styles.transactionIcon}>
                        {transaction.amount >= 0
                          ? "↗"
                          : "↘"}
                      </div>

                      <div
                        style={{
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <strong
                          className="transactionTitle"
                          style={styles.transactionTitle}
                        >
                          {transaction.description ||
                            transaction.type.replaceAll(
                              "_",
                              " "
                            )}
                        </strong>

                        <div
                          style={styles.transactionDate}
                        >
                          {new Date(
                            transaction.created_at
                          ).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        ...styles.transactionAmount,
                        color:
                          transaction.amount >= 0
                            ? "#059669"
                            : "#ef4444",
                      }}
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

          <footer style={styles.footer}>
            <div style={styles.footerBrand}>
              <strong>
                <span>AURA</span>{" "}
                <b>CAMP</b>
              </strong>

              <span>
                Independent Rewards Platform
              </span>
            </div>

            <span>
              © {new Date().getFullYear()} AURA CAMP
            </span>
          </footer>

        </div>
      </main>
    </>
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
  scroll-behavior: smooth;
  width: 100%;
  max-width: 100%;
}

body {
  margin: 0;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

button {
  font-family: inherit;
}

.animateUp {
  animation: auraUp 0.65s ease both;
}

.animateDown {
  animation: auraDown 0.55s ease both;
}

.delay1 {
  animation-delay: 0.05s;
}

.delay2 {
  animation-delay: 0.10s;
}

.delay3 {
  animation-delay: 0.15s;
}

.delay4 {
  animation-delay: 0.20s;
}

.delay5 {
  animation-delay: 0.25s;
}

@keyframes auraUp {
  from {
    opacity: 0;
    transform: translateY(18px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes auraDown {
  from {
    opacity: 0;
    transform: translateY(-12px);
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

.actionCard,
.offerCard,
.statCard,
.walletCard,
.startButton,
.walletButton,
.iconButton,
.logoutButton {
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.actionCard:hover {
  transform: translateY(-4px);
  box-shadow:
    0 14px 35px rgba(30, 64, 175, 0.10);
}

.offerCard:hover {
  transform: translateY(-5px);
  box-shadow:
    0 18px 40px rgba(30, 64, 175, 0.12);
}

.statCard:hover {
  transform: translateY(-3px);
  box-shadow:
    0 14px 35px rgba(30, 64, 175, 0.09);
}

.startButton:hover,
.walletButton:hover {
  transform: translateY(-2px);
  box-shadow:
    0 10px 25px rgba(37, 99, 235, 0.28);
}

.iconButton:hover {
  transform: scale(1.05);
}

.logoutButton:hover {
  transform: translateY(-2px);
}

.actionCard:active,
.startButton:active,
.walletButton:active {
  transform: scale(0.97);
}

/* TABLET */

@media (max-width: 800px) {

  .container {
    width: 100% !important;
    max-width: 100% !important;
  }

  .statsGrid {
    grid-template-columns:
      1fr 1fr !important;
  }

  .walletCard {
    grid-column: span 2;
  }

  .actionGrid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr)) !important;
  }

  .offerGrid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr)) !important;
  }
}

/* MOBILE */

@media (max-width: 520px) {

  html,
  body {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden !important;
  }

  .page {
    width: 100% !important;
    max-width: 100% !important;
    padding: 10px 9px 35px !important;
    overflow-x: hidden !important;
  }

  .container {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
  }

  .header {
    width: 100% !important;
    padding: 13px 12px !important;
  }

  .brand {
    font-size: 20px !important;
  }

  .tagline {
    font-size: 9px !important;
  }

  .notificationButton {
    width: 36px !important;
    height: 36px !important;
    font-size: 15px !important;
  }

  .logoutButton {
    padding: 9px 10px !important;
    font-size: 11px !important;
  }

  .welcome {
    width: 100% !important;
    padding: 17px !important;
    flex-direction: column !important;
    align-items: stretch !important;
  }

  .welcomeContent {
    min-width: 0 !important;
    width: 100% !important;
  }

  .welcomeText {
    min-width: 0 !important;
    overflow: hidden !important;
  }

  .avatar {
    width: 46px !important;
    height: 46px !important;
    min-width: 46px !important;
  }

  .welcomeTitle {
    font-size: 21px !important;
    max-width: 100% !important;
    overflow-wrap: anywhere !important;
  }

  .subText {
    font-size: 11px !important;
  }

  .welcomeBadge {
    align-self: flex-start !important;
  }

  .statsGrid {
    width: 100% !important;
    grid-template-columns:
      1fr !important;
    gap: 10px !important;
  }

  .walletCard {
    grid-column: auto !important;
    width: 100% !important;
    min-width: 0 !important;
    padding: 18px !important;
  }

  .statCard {
    width: 100% !important;
    min-width: 0 !important;
  }

  .walletAmount {
    font-size: 29px !important;
  }

  .actionGrid {
    width: 100% !important;
    grid-template-columns:
      repeat(2, minmax(0, 1fr)) !important;
    gap: 9px !important;
  }

  .actionButton {
    width: 100% !important;
    min-width: 0 !important;
    min-height: 76px !important;
    padding: 11px 9px !important;
    gap: 7px !important;
    overflow: hidden !important;
  }

  .actionIcon {
    width: 35px !important;
    height: 35px !important;
    min-width: 35px !important;
    font-size: 15px !important;
  }

  .actionText {
    min-width: 0 !important;
    overflow: hidden !important;
    flex: 1 !important;
  }

  .actionTitle,
  .actionSub {
    max-width: 100% !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .actionTitle {
    font-size: 11px !important;
  }

  .actionSub {
    font-size: 9px !important;
  }

  .actionArrow {
    display: none !important;
  }

  .offerGrid {
    width: 100% !important;
    grid-template-columns:
      1fr !important;
  }

  .offerCard {
    width: 100% !important;
    min-width: 0 !important;
  }

  .offerImageWrap {
    height: 150px !important;
  }

  .offerName {
    font-size: 15px !important;
  }

  .transactionBox {
    width: 100% !important;
  }

  .transactionRow {
    width: 100% !important;
    padding: 12px !important;
    gap: 7px !important;
  }

  .transactionTitle {
    max-width: 145px !important;
  }

  .transactionAmount {
    font-size: 12px !important;
  }

  .footer {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 8px !important;
  }
}

/* VERY SMALL PHONES */

@media (max-width: 360px) {

  .page {
    padding-left: 7px !important;
    padding-right: 7px !important;
  }

  .brand {
    font-size: 18px !important;
  }

  .logoutButton {
    padding: 8px !important;
    font-size: 10px !important;
  }

  .notificationButton {
    width: 33px !important;
    height: 33px !important;
  }

  .actionButton {
    padding: 10px 7px !important;
    gap: 5px !important;
  }

  .actionIcon {
    width: 32px !important;
    height: 32px !important;
    min-width: 32px !important;
    font-size: 14px !important;
  }

  .actionTitle {
    font-size: 10px !important;
  }

  .actionSub {
    font-size: 8px !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    background:
      "linear-gradient(145deg, #f8fbff 0%, #f4f7ff 50%, #fbf8ff 100%)",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#111827",
    padding: "16px 14px 45px",
    position: "relative",
    overflow: "hidden",
  },

  backgroundGlowOne: {
    position: "fixed",
    width: "280px",
    height: "280px",
    borderRadius: "50%",
    background: "rgba(37, 99, 235, 0.08)",
    filter: "blur(70px)",
    top: "-100px",
    left: "-100px",
    pointerEvents: "none",
  },

  backgroundGlowTwo: {
    position: "fixed",
    width: "300px",
    height: "300px",
    borderRadius: "50%",
    background: "rgba(168, 85, 247, 0.07)",
    filter: "blur(75px)",
    bottom: "-120px",
    right: "-100px",
    pointerEvents: "none",
  },

  container: {
    maxWidth: "1120px",
    width: "100%",
    boxSizing: "border-box",
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
  },

  loadingPage: {
    minHeight: "100vh",
    background:
      "linear-gradient(145deg, #f8fbff, #f4f7ff, #fbf8ff)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, sans-serif",
  },

  loadingBox: {
    background: "#fff",
    padding: "35px",
    borderRadius: "24px",
    textAlign: "center",
    boxShadow:
      "0 20px 60px rgba(30, 64, 175, 0.12)",
    minWidth: "260px",
  },

  loadingLogo: {
    fontSize: "27px",
    fontWeight: 900,
    letterSpacing: "-0.8px",
    marginBottom: "22px",
  },

  loader: {
    width: "30px",
    height: "30px",
    border: "3px solid #e5e7eb",
    borderTop: "3px solid #2563eb",
    borderRight: "3px solid #9333ea",
    borderRadius: "50%",
    margin: "0 auto 15px",
    animation: "spin 0.8s linear infinite",
  },

  loadingText: {
    color: "#6b7280",
    margin: 0,
    fontSize: "13px",
  },

  header: {
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    padding: "15px 17px",
    borderRadius: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "14px",
    border: "1px solid rgba(226,232,240,0.9)",
    boxShadow:
      "0 8px 30px rgba(30, 64, 175, 0.06)",
    minWidth: 0,
  },

  brandArea: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },

  brand: {
    fontSize: "23px",
    fontWeight: 900,
    letterSpacing: "-0.8px",
    lineHeight: 1,
    background:
      "linear-gradient(90deg, #155eef 0%, #2563eb 48%, #f97316 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },

  tagline: {
    fontSize: "10px",
    color: "#94a3b8",
    marginTop: "5px",
    letterSpacing: "0.3px",
  },

  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },

  notificationButton: {
    width: "39px",
    height: "39px",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    cursor: "pointer",
    fontSize: "17px",
  },

  logout: {
    background: "#111827",
    color: "#fff",
    border: "none",
    borderRadius: "11px",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "12px",
  },

  welcome: {
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fbff 55%, #f6f1ff 100%)",
    borderRadius: "22px",
    padding: "22px",
    marginBottom: "15px",
    border: "1px solid #e8edf6",
    boxShadow:
      "0 10px 35px rgba(30, 64, 175, 0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "15px",
    minWidth: 0,
  },

  welcomeContent: {
    display: "flex",
    alignItems: "center",
    gap: "13px",
    minWidth: 0,
    flex: 1,
  },

  welcomeText: {
    minWidth: 0,
  },

  avatar: {
    width: "50px",
    height: "50px",
    minWidth: "50px",
    borderRadius: "16px",
    background:
      "linear-gradient(135deg, #2563eb, #7c3aed)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: "19px",
    boxShadow:
      "0 8px 20px rgba(37, 99, 235, 0.22)",
  },

  smallText: {
    color: "#64748b",
    margin: "0 0 3px",
    fontSize: "13px",
  },

  welcomeTitle: {
    margin: 0,
    fontSize: "25px",
    fontWeight: 850,
    letterSpacing: "-0.5px",
    overflowWrap: "anywhere",
  },

  subText: {
    color: "#64748b",
    margin: "5px 0 0",
    fontSize: "13px",
  },

  welcomeBadge: {
    background: "#eff6ff",
    color: "#2563eb",
    padding: "9px 12px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 800,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "minmax(280px, 1.5fr) repeat(2, minmax(190px, 1fr))",
    gap: "13px",
    marginBottom: "25px",
    width: "100%",
  },

  walletCard: {
    background:
      "linear-gradient(135deg, #2563eb 0%, #4f46e5 52%, #7c3aed 100%)",
    color: "#fff",
    padding: "21px",
    borderRadius: "21px",
    minHeight: "155px",
    boxShadow:
      "0 15px 35px rgba(37, 99, 235, 0.22)",
    position: "relative",
    overflow: "hidden",
    minWidth: 0,
  },

  walletTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
  },

  walletLabel: {
    fontSize: "12px",
    opacity: 0.78,
    marginBottom: "6px",
  },

  walletAmount: {
    fontSize: "31px",
    fontWeight: 900,
    letterSpacing: "-1px",
  },

  walletIcon: {
    width: "48px",
    height: "48px",
    minWidth: "48px",
    borderRadius: "15px",
    background:
      "rgba(255,255,255,0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "22px",
  },

  walletBottom: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "18px",
    gap: "10px",
  },

  walletHint: {
    fontSize: "11px",
    opacity: 0.72,
  },

  walletButton: {
    background: "#fff",
    color: "#2563eb",
    border: "none",
    padding: "9px 13px",
    borderRadius: "11px",
    fontWeight: 800,
    fontSize: "11px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  statCard: {
    background:
      "rgba(255,255,255,0.92)",
    padding: "19px",
    borderRadius: "21px",
    border: "1px solid #e8edf5",
    boxShadow:
      "0 8px 25px rgba(30, 64, 175, 0.055)",
    minHeight: "155px",
    minWidth: 0,
  },

  statIcon: {
    width: "37px",
    height: "37px",
    borderRadius: "11px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "17px",
    marginBottom: "12px",
  },

  cardLabel: {
    fontSize: "11px",
    color: "#64748b",
    marginBottom: "4px",
  },

  statAmount: {
    fontSize: "24px",
    fontWeight: 850,
    color: "#111827",
  },

  cardHint: {
    fontSize: "10px",
    color: "#94a3b8",
    marginTop: "5px",
  },

  section: {
    marginBottom: "27px",
    minWidth: 0,
  },

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "13px",
    gap: "10px",
    minWidth: 0,
  },

  sectionTitle: {
    margin: 0,
    fontSize: "19px",
    fontWeight: 850,
    letterSpacing: "-0.35px",
  },

  sectionSub: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: "12px",
  },

  actionGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4, minmax(0, 1fr))",
    gap: "11px",
    width: "100%",
    minWidth: 0,
  },

  actionButton: {
    background: "#fff",
    border: "1px solid #e8edf5",
    borderRadius: "17px",
    padding: "14px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    textAlign: "left",
    cursor: "pointer",
    boxShadow:
      "0 7px 22px rgba(30, 64, 175, 0.045)",
    minHeight: "74px",
    minWidth: 0,
    width: "100%",
    overflow: "hidden",
  },

  actionIcon: {
    width: "40px",
    height: "40px",
    minWidth: "40px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
  },

  actionTitle: {
    display: "block",
    color: "#111827",
    fontSize: "12px",
    marginBottom: "3px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  actionSub: {
    display: "block",
    color: "#94a3b8",
    fontSize: "10px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  actionArrow: {
    marginLeft: "auto",
    color: "#94a3b8",
    fontSize: "15px",
    flexShrink: 0,
  },

  offerCount: {
    background: "#eef2ff",
    color: "#4f46e5",
    padding: "7px 11px",
    borderRadius: "20px",
    fontSize: "10px",
    fontWeight: 800,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  viewAll: {
    color: "#2563eb",
    fontSize: "11px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  offerGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(270px, 1fr))",
    gap: "14px",
    width: "100%",
    minWidth: 0,
  },

  offerCard: {
    background: "#fff",
    borderRadius: "19px",
    overflow: "hidden",
    border: "1px solid #e8edf5",
    boxShadow:
      "0 8px 25px rgba(30, 64, 175, 0.055)",
    minWidth: 0,
  },

  offerImageWrap: {
    height: "145px",
    position: "relative",
    background:
      "linear-gradient(135deg, #eef2ff, #f5f3ff)",
    overflow: "hidden",
  },

  offerImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  offerPlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "43px",
  },

  offerRewardBadge: {
    position: "absolute",
    right: "10px",
    bottom: "10px",
    background: "#fff",
    color: "#059669",
    padding: "7px 10px",
    borderRadius: "10px",
    fontSize: "12px",
    fontWeight: 900,
    boxShadow:
      "0 5px 15px rgba(0,0,0,0.12)",
  },

  offerContent: {
    padding: "15px",
    minWidth: 0,
  },

  offerTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },

  category: {
    fontSize: "10px",
    background: "#eff6ff",
    padding: "5px 8px",
    borderRadius: "8px",
    color: "#2563eb",
    fontWeight: 750,
    maxWidth: "60%",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },

  easyBadge: {
    fontSize: "9px",
    color: "#059669",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  offerName: {
    margin: "10px 0 6px",
    fontSize: "16px",
    fontWeight: 850,
    color: "#111827",
    overflowWrap: "anywhere",
  },

  offerDescription: {
    color: "#64748b",
    fontSize: "11px",
    lineHeight: "1.55",
    minHeight: "35px",
    margin: 0,
  },

  startButton: {
    width: "100%",
    marginTop: "13px",
    border: "none",
    background:
      "linear-gradient(90deg, #2563eb, #4f46e5)",
    color: "#fff",
    padding: "12px",
    borderRadius: "11px",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: "12px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "8px",
  },

  emptyBox: {
    background:
      "rgba(255,255,255,0.9)",
    borderRadius: "20px",
    padding: "40px 20px",
    textAlign: "center",
    color: "#64748b",
    border: "1px solid #e8edf5",
  },

  emptyIcon: {
    width: "58px",
    height: "58px",
    borderRadius: "18px",
    background: "#eef2ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 12px",
    fontSize: "26px",
  },

  emptyTitle: {
    color: "#111827",
    margin: "0 0 5px",
    fontSize: "16px",
  },

  emptyText: {
    margin: 0,
    fontSize: "12px",
  },

  transactionBox: {
    background:
      "rgba(255,255,255,0.94)",
    borderRadius: "19px",
    overflow: "hidden",
    border: "1px solid #e8edf5",
    boxShadow:
      "0 8px 25px rgba(30, 64, 175, 0.045)",
    width: "100%",
  },

  transactionRow: {
    padding: "14px 16px",
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    minWidth: 0,
  },

  transactionLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
    flex: 1,
  },

  transactionIcon: {
    width: "38px",
    height: "38px",
    minWidth: "38px",
    borderRadius: "12px",
    background: "#ecfdf5",
    color: "#059669",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
  },

  transactionTitle: {
    display: "block",
    fontSize: "12px",
    color: "#111827",
    textTransform: "capitalize",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "220px",
  },

  transactionDate: {
    fontSize: "10px",
    color: "#94a3b8",
    marginTop: "3px",
  },

  transactionAmount: {
    fontWeight: 900,
    fontSize: "13px",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  footer: {
    padding: "20px 4px 5px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    color: "#94a3b8",
    fontSize: "10px",
  },

  footerBrand: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
};

