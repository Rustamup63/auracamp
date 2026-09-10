"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

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
        setUserName(profileData.full_name || user.email?.split("@")[0] || "User");
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
      <main style={styles.loadingPage}>
        <div style={styles.loadingBox}>
          <div style={styles.logo}>AURACAMP</div>
          <p>Loading your dashboard...</p>
        </div>
      </main>
    );
  }

  const wallet = profile?.wallet_balance || 0;
  const pending = profile?.pending_balance || 0;
  const earned = profile?.total_earned || 0;

  return (
    <main style={styles.page}>
      <div style={styles.container}>

        {/* Header */}
        <header style={styles.header}>
          <div>
            <div style={styles.brand}>AURACAMP</div>
            <div style={styles.tagline}>Earn • Explore • Grow</div>
          </div>

          <button onClick={logout} style={styles.logout}>
            Logout
          </button>
        </header>

        {/* Welcome */}
        <section style={styles.welcome}>
          <div>
            <p style={styles.smallText}>Welcome back 👋</p>
            <h1 style={styles.welcomeTitle}>{userName}</h1>
            <p style={styles.subText}>
              Complete offers and grow your earnings.
            </p>
          </div>
        </section>

        {/* Wallet Cards */}
        <section style={styles.statsGrid}>

          <div style={styles.walletCard}>
            <div style={styles.cardLabel}>Available Balance</div>
            <div style={styles.walletAmount}>
              ₹{wallet.toFixed(2)}
            </div>
            <div style={styles.cardHint}>Ready to withdraw</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.cardLabel}>Pending Rewards</div>
            <div style={styles.statAmount}>
              ₹{pending.toFixed(2)}
            </div>
            <div style={styles.cardHint}>Under verification</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.cardLabel}>Total Earned</div>
            <div style={styles.statAmount}>
              ₹{earned.toFixed(2)}
            </div>
            <div style={styles.cardHint}>Lifetime earnings</div>
          </div>

        </section>

        {/* Quick Actions */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Quick Actions</h2>

          <div style={styles.actionGrid}>
            <button
              style={styles.actionButton}
              onClick={() =>
                document
                  .getElementById("offers")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              🎁
              <span>Earn Rewards</span>
            </button>

            <button
              style={styles.actionButton}
              onClick={() => alert("Withdrawal system will be available soon.")}
            >
              💸
              <span>Withdraw</span>
            </button>

            <button
              style={styles.actionButton}
              onClick={() => alert("Referral system will be available soon.")}
            >
              👥
              <span>Refer & Earn</span>
            </button>

            <button
              style={styles.actionButton}
              onClick={() => alert("Support system will be available soon.")}
            >
              🎧
              <span>Support</span>
            </button>
          </div>
        </section>

        {/* Offers */}
        <section id="offers" style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Available Offers</h2>
              <p style={styles.sectionSub}>
                Complete offers and earn rewards.
              </p>
            </div>

            <span style={styles.offerCount}>
              {campaigns.length} Offers
            </span>
          </div>

          {campaigns.length === 0 ? (
            <div style={styles.emptyBox}>
              <div style={styles.emptyIcon}>🎁</div>
              <h3>No offers available</h3>
              <p>
                New earning opportunities will appear here.
              </p>
            </div>
          ) : (
            <div style={styles.offerGrid}>
              {campaigns.map((campaign) => (
                <div key={campaign.id} style={styles.offerCard}>

                  {campaign.image_url ? (
                    <img
                      src={campaign.image_url}
                      alt={campaign.name}
                      style={styles.offerImage}
                    />
                  ) : (
                    <div style={styles.offerPlaceholder}>
                      🎁
                    </div>
                  )}

                  <div style={styles.offerContent}>
                    <div style={styles.offerTop}>
                      <span style={styles.category}>
                        {campaign.category || "Offer"}
                      </span>

                      <strong style={styles.reward}>
                        ₹{Number(campaign.reward).toFixed(2)}
                      </strong>
                    </div>

                    <h3 style={styles.offerName}>
                      {campaign.name}
                    </h3>

                    <p style={styles.offerDescription}>
                      {campaign.description ||
                        "Complete this offer and earn your reward."}
                    </p>

                    <button
                      style={styles.startButton}
                      onClick={() =>
                        alert(
                          "Offer tracking system is being connected next."
                        )
                      }
                    >
                      Start Offer →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Transactions */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Recent Activity</h2>
              <p style={styles.sectionSub}>
                Your latest wallet transactions.
              </p>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div style={styles.emptyBox}>
              <div style={styles.emptyIcon}>📊</div>
              <h3>No transactions yet</h3>
              <p>
                Your earnings will appear here after completing offers.
              </p>
            </div>
          ) : (
            <div style={styles.transactionBox}>
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  style={styles.transactionRow}
                >
                  <div>
                    <strong>
                      {transaction.description ||
                        transaction.type.replaceAll("_", " ")}
                    </strong>
                    <div style={styles.transactionDate}>
                      {new Date(
                        transaction.created_at
                      ).toLocaleDateString("en-IN")}
                    </div>
                  </div>

                  <div style={styles.transactionAmount}>
                    +₹{Number(transaction.amount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer style={styles.footer}>
          <strong>AURACAMP</strong>
          <span>Independent Rewards Platform</span>
        </footer>

      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    fontFamily: "Arial, sans-serif",
    color: "#111827",
    padding: "20px 14px 50px",
  },

  container: {
    maxWidth: "1100px",
    margin: "0 auto",
  },

  loadingPage: {
    minHeight: "100vh",
    background: "#f5f7fb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Arial, sans-serif",
  },

  loadingBox: {
    background: "#fff",
    padding: "35px",
    borderRadius: "20px",
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  },

  logo: {
    fontSize: "24px",
    fontWeight: "800",
    color: "#173bff",
  },

  header: {
    background: "#101827",
    color: "#fff",
    padding: "18px 20px",
    borderRadius: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "18px",
  },

  brand: {
    fontSize: "22px",
    fontWeight: "800",
    letterSpacing: "1px",
  },

  tagline: {
    fontSize: "11px",
    opacity: 0.7,
    marginTop: "3px",
  },

  logout: {
    background: "#fff",
    color: "#111827",
    border: "none",
    borderRadius: "10px",
    padding: "10px 15px",
    fontWeight: "700",
    cursor: "pointer",
  },

  welcome: {
    background: "#fff",
    borderRadius: "18px",
    padding: "24px",
    marginBottom: "18px",
    boxShadow: "0 5px 20px rgba(0,0,0,0.04)",
  },

  smallText: {
    color: "#6b7280",
    margin: "0 0 5px",
    fontSize: "14px",
  },

  welcomeTitle: {
    margin: "0",
    fontSize: "28px",
  },

  subText: {
    color: "#6b7280",
    margin: "7px 0 0",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "14px",
    marginBottom: "25px",
  },

  walletCard: {
    background: "#173bff",
    color: "#fff",
    padding: "22px",
    borderRadius: "18px",
  },

  statCard: {
    background: "#fff",
    padding: "22px",
    borderRadius: "18px",
    boxShadow: "0 5px 20px rgba(0,0,0,0.04)",
  },

  cardLabel: {
    fontSize: "13px",
    opacity: 0.75,
    marginBottom: "8px",
  },

  walletAmount: {
    fontSize: "30px",
    fontWeight: "800",
  },

  statAmount: {
    fontSize: "27px",
    fontWeight: "800",
  },

  cardHint: {
    fontSize: "12px",
    marginTop: "5px",
    opacity: 0.65,
  },

  section: {
    marginBottom: "25px",
  },

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "13px",
  },

  sectionTitle: {
    margin: "0",
    fontSize: "20px",
  },

  sectionSub: {
    margin: "5px 0 0",
    color: "#6b7280",
    fontSize: "13px",
  },

  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: "10px",
  },

  actionButton: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "14px",
    padding: "18px 10px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "13px",
  },

  offerCount: {
    background: "#eef2ff",
    color: "#173bff",
    padding: "7px 11px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "700",
  },

  offerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
    gap: "15px",
  },

  offerCard: {
    background: "#fff",
    borderRadius: "18px",
    overflow: "hidden",
    boxShadow: "0 5px 20px rgba(0,0,0,0.05)",
  },

  offerImage: {
    width: "100%",
    height: "150px",
    objectFit: "cover",
  },

  offerPlaceholder: {
    height: "150px",
    background: "#eef2ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "45px",
  },

  offerContent: {
    padding: "16px",
  },

  offerTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  category: {
    fontSize: "11px",
    background: "#f3f4f6",
    padding: "5px 8px",
    borderRadius: "10px",
    color: "#6b7280",
  },

  reward: {
    color: "#059669",
    fontSize: "18px",
  },

  offerName: {
    margin: "12px 0 7px",
    fontSize: "18px",
  },

  offerDescription: {
    color: "#6b7280",
    fontSize: "13px",
    lineHeight: "1.5",
    minHeight: "40px",
  },

  startButton: {
    width: "100%",
    marginTop: "12px",
    border: "none",
    background: "#101827",
    color: "#fff",
    padding: "12px",
    borderRadius: "10px",
    fontWeight: "700",
    cursor: "pointer",
  },

  emptyBox: {
    background: "#fff",
    borderRadius: "18px",
    padding: "40px 20px",
    textAlign: "center",
    color: "#6b7280",
  },

  emptyIcon: {
    fontSize: "38px",
    marginBottom: "8px",
  },

  transactionBox: {
    background: "#fff",
    borderRadius: "18px",
    overflow: "hidden",
  },

  transactionRow: {
    padding: "15px 18px",
    borderBottom: "1px solid #f0f0f0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
  },

  transactionDate: {
    fontSize: "11px",
    color: "#9ca3af",
    marginTop: "4px",
  },

  transactionAmount: {
    color: "#059669",
    fontWeight: "800",
    whiteSpace: "nowrap",
  },

  footer: {
    padding: "25px 5px",
    display: "flex",
    justifyContent: "space-between",
    color: "#9ca3af",
    fontSize: "12px",
  },
};
