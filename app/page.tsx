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

      // Admin account → Admin Panel
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

      // User profile
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

      // Active campaigns
      const { data: campaignData } = await supabase
        .from("campaigns")
        .select(
          "id, name, description, category, reward, conversion_type, terms, image_url"
        )
        .eq("status", "active")
        .order("created_at", { ascending: false });

      setCampaigns(campaignData || []);

      // Recent transactions
      const { data: transactionData } = await supabase
        .from("wallet_transactions")
        .select("id, type, amount, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      setTransactions(transactionData || []);
    } catch (error) {
      console.error(error);
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
              <span>AURA</span>
              <b>CAMP</b>
            </div>

            <div style={styles.loader}></div>

            <p style={styles.loadingText}>
              Loading your dashboard...
            </p>
          </div>
        </main>
      </>
    );
  }

  const wallet = profile?.wallet_balance || 0;
  const pending = profile?.pending_balance || 0;
  const earned = profile?.total_earned || 0;

  return (
    <>
      <style>{globalStyles}</style>

      <main style={styles.page}>
        <div style={styles.backgroundGlowOne}></div>
        <div style={styles.backgroundGlowTwo}></div>

        <div style={styles.container}>

          {/* Header */}
          <header className="animateDown" style={styles.header}>
            <div style={styles.brandArea}>
              <div style={styles.brand}>
                <span>AURA</span>{" "}
                <b>CAMP</b>
              </div>

              <div style={styles.tagline}>
                Earn • Explore • Grow
              </div>
            </div>

            <div style={styles.headerRight}>
              <button
                className="iconButton"
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

          {/* Welcome */}
          <section
            className="animateUp delay1"
            style={styles.welcome}
          >
            <div style={styles.welcomeContent}>
              <div style={styles.avatar}>
                {userName.charAt(0).toUpperCase()}
              </div>

              <div>
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

          {/* Wallet + Stats */}
          <section
            className="animateUp delay2"
            style={styles.statsGrid}
          >
            {/* Main Wallet */}
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

            {/* Pending */}
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

            {/* Earned */}
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

          {/* Quick Actions */}
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

            <div style={styles.actionGrid}>

              <button
                className="actionCard"
                style={styles.actionButton}
                onClick={() =>
                  document
                    .getElementById("offers")
                    ?.scrollIntoView({
                      behavior: "smooth",
                    })
                }
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

                <div>
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

                <div>
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
                onClick={() =>
                  alert(
                    "Referral system will be available soon."
                  )
                }
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

                <div>
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

                <div>
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

          {/* Offers */}
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
                        {Number(campaign.reward).toFixed(2)}
                      </div>
                    </div>

                    <div style={styles.offerContent}>
                      <div style={styles.offerTop}>
                        <span style={styles.category}>
                          {campaign.category ||
                            "Offer"}
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
                        onClick={() =>
                          alert(
                            "Offer tracking system is being connected next."
                          )
                        }
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

          {/* Recent Transactions */}
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

                      <div>
                        <strong
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

          {/* Footer */}
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

const globalStyles = [
  "* { box-sizing: border-box; }",
  "html { scroll-behavior: smooth; }",
  "body { margin: 0; }",
  "button { font-family: inherit; }",

  ".animateUp { animation: auraUp 0.65s ease both; }",
  ".animateDown { animation: auraDown 0.55s ease both; }",

  ".delay1 { animation-delay: 0.05s; }",
  ".delay2 { animation-delay: 0.10s; }",
  ".delay3 { animation-delay: 0.15s; }",
  ".delay4 { animation-delay: 0.20s; }",
  ".delay5 { animation-delay: 0.25s; }",

  "@keyframes auraUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }",

  "@keyframes auraDown { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }",

  "@keyframes spin { to { transform: rotate(360deg); } }",

  ".actionCard, .offerCard, .statCard, .walletCard, .startButton, .walletButton, .iconButton, .logoutButton { transition: transform 0.2s ease, box-shadow 0.2s ease; }",

  ".actionCard:hover { transform: translateY(-4px); box-shadow: 0 14px 35px rgba(30,64,175,0.10); }",

  ".offerCard:hover { transform: translateY(-5px); box-shadow: 0 18px 40px rgba(30,64,175,0.12); }",

  ".statCard:hover { transform: translateY(-3px); box-shadow: 0 14px 35px rgba(30,64,175,0.09); }",

  ".startButton:hover, .walletButton:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(37,99,235,0.28); }",

  ".iconButton:hover { transform: scale(1.05); }",

  ".logoutButton:hover { transform: translateY(-2px); }",

  ".actionCard:active, .startButton:active, .walletButton:active { transform: scale(0.97); }",

  "@media (max-width: 700px) { .desktopOnly { display: none; } }",

  "@media (max-width: 520px) { body { overflow-x: hidden; } }"
].join("\n");
