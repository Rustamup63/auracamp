"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { CSSProperties } from "react";

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

type ComingSoonType =
  | "My Offers"
  | "Profile"
  | "Refer & Earn"
  | "Notifications";

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("User");

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [campaigns, setCampaigns] =
    useState<Campaign[]>([]);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [startingOffer, setStartingOffer] =
    useState<string | null>(null);

  const [comingSoon, setComingSoon] =
    useState<ComingSoonType | null>(null);

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
          .select("id, role, is_active")
          .eq("id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (admin) {
          window.location.replace("/admin");
          return;
        }

        const [
          profileResult,
          campaignResult,
          transactionResult,
        ] = await Promise.all([
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
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("wallet_transactions")
            .select(
              "id, type, amount, description, created_at"
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
            user.email?.split("@")[0] ||
              "User"
          );
        }

        setCampaigns(
          campaignResult.data || []
        );

        setTransactions(
          transactionResult.data || []
        );
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

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let channel:
      | ReturnType<typeof supabase.channel>
      | null = null;

    async function subscribeRealtime() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      channel = supabase
        .channel(
          `auracamp-dashboard-${user.id}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          async () => {
            const { data } =
              await supabase
                .from("profiles")
                .select(
                  "user_code, full_name, email, wallet_balance, pending_balance, total_earned, total_withdrawn"
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
            const { data } =
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

            setTransactions(data || []);
          }
        )
        .subscribe();
    }

    subscribeRealtime();

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

  function openComingSoon(
    feature: ComingSoonType
  ) {
    setComingSoon(feature);
  }

  function closeComingSoon() {
    setComingSoon(null);
  }

  async function startOffer(
    campaign: Campaign
  ) {
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
        openComingSoon("My Offers");
        return;
      }

      const clickId =
        crypto.randomUUID();

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

      window.location.href =
        trackingUrl;
    } catch (error) {
      console.error(
        "Start offer error:",
        error
      );
    } finally {
      setStartingOffer(null);
    }
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

  const wallet = Number(
    profile?.wallet_balance || 0
  );

  const pending = Number(
    profile?.pending_balance || 0
  );

  const earned = Number(
    profile?.total_earned || 0
  );

  return (
    <>
      <style>{globalStyles}</style>

      <main style={styles.page}>

        <div
          style={styles.backgroundGlowOne}
        />

        <div
          style={styles.backgroundGlowTwo}
        />

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

            <div style={styles.headerRight}>

              <button
                type="button"
                className="topIconButton"
                style={
                  styles.notificationButton
                }
                onClick={() =>
                  openComingSoon(
                    "Notifications"
                  )
                }
              >
                🔔
              </button>

              <button
                type="button"
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
            className="animateUp delay1"
            style={styles.welcome}
          >
            <div
              style={
                styles.welcomeContent
              }
            >

              <div style={styles.avatar}>
                {userName
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div
                style={styles.welcomeText}
              >
                <p style={styles.smallText}>
                  Welcome back 👋
                </p>

                <h1
                  style={
                    styles.welcomeTitle
                  }
                >
                  {userName}
                </h1>

                <p style={styles.subText}>
                  Complete offers and
                  grow your earnings.
                </p>
              </div>

            </div>

            <button
              type="button"
              className="welcomeButton"
              style={
                styles.welcomeBadge
              }
              onClick={() =>
                document
                  .getElementById(
                    "offers"
                  )
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
            >
              ✨ Start Earning
            </button>

          </section>

          {/* AURA CAMP ID */}

          <section
            className="animateUp delay2"
            style={styles.auraIdCard}
          >
            <div
              style={styles.auraIdIcon}
            >
              AC
            </div>

            <div
              style={
                styles.auraIdContent
              }
            >
              <span
                style={
                  styles.auraIdLabel
                }
              >
                AURA CAMP ID
              </span>

              <strong
                style={
                  styles.auraIdValue
                }
              >
                {profile?.user_code ||
                  "AC----"}
              </strong>
            </div>

            <span
              style={
                styles.auraIdVerified
              }
            >
              ✓ Verified
            </span>
          </section>

          {/* STATS */}

          <section
            className="animateUp delay2 statsGrid"
            style={styles.statsGrid}
          >

            <div
              className="walletCard"
              style={styles.walletCard}
            >

              <div
                style={styles.walletTop}
              >

                <div>
                  <div
                    style={
                      styles.walletLabel
                    }
                  >
                    Available Balance
                  </div>

                  <div
                    style={
                      styles.walletAmount
                    }
                  >
                    ₹{wallet.toFixed(2)}
                  </div>
                </div>

                <div
                  style={
                    styles.walletIcon
                  }
                >
                  💳
                </div>

              </div>

              <div
                style={
                  styles.walletBottom
                }
              >

                <span
                  style={
                    styles.walletHint
                  }
                >
                  Ready to withdraw
                </span>

                <button
                  type="button"
                  className="walletButton"
                  style={
                    styles.walletButton
                  }
                  onClick={() =>
                    (window.location.href =
                      "/withdraw")
                  }
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

              <div
                style={
                  styles.cardLabel
                }
              >
                Pending Rewards
              </div>

              <div
                style={
                  styles.statAmount
                }
              >
                ₹{pending.toFixed(2)}
              </div>

              <div
                style={
                  styles.cardHint
                }
              >
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

              <div
                style={
                  styles.cardLabel
                }
              >
                Total Earned
              </div>

              <div
                style={
                  styles.statAmount
                }
              >
                ₹{earned.toFixed(2)}
              </div>

              <div
                style={
                  styles.cardHint
                }
              >
                Lifetime earnings
              </div>
            </div>

          </section>

          {/* QUICK ACTIONS */}

          <section
            className="animateUp delay3"
            style={styles.section}
          >
            <div
              style={
                styles.sectionHeader
              }
            >
              <div>
                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  Quick Actions
                </h2>

                <p
                  style={
                    styles.sectionSub
                  }
                >
                  Everything you need
                  in one place.
                </p>
              </div>
            </div>

            <div
              className="actionGrid"
              style={styles.actionGrid}
            >

              <button
                type="button"
                className="actionCard"
                style={
                  styles.actionButton
                }
                onClick={() =>
                  document
                    .getElementById(
                      "offers"
                    )
                    ?.scrollIntoView({
                      behavior: "smooth",
                    })
                }
              >
                <div
                  style={{
                    ...styles.actionIcon,
                    background:
                      "#fff1f2",
                    color:
                      "#e11d48",
                  }}
                >
                  🎁
                </div>

                <div className="actionText">
                  <strong
                    style={
                      styles.actionTitle
                    }
                  >
                    Earn Rewards
                  </strong>

                  <span
                    style={
                      styles.actionSub
                    }
                  >
                    Explore & Earn
                  </span>
                </div>

                <span
                  style={
                    styles.actionArrow
                  }
                >
                  →
                </span>
              </button>

              <button
                type="button"
                className="actionCard"
                style={
                  styles.actionButton
                }
                onClick={() =>
                  (window.location.href =
                    "/withdraw")
                }
              >
                <div
                  style={{
                    ...styles.actionIcon,
                    background:
                      "#ecfdf5",
                    color:
                      "#059669",
                  }}
                >
                  💸
                </div>

                <div className="actionText">
                  <strong
                    style={
                      styles.actionTitle
                    }
                  >
                    Withdraw
                  </strong>

                  <span
                    style={
                      styles.actionSub
                    }
                  >
                    Get Your Money
                  </span>
                </div>

                <span
                  style={
                    styles.actionArrow
                  }
                >
                  →
                </span>
              </button>

              <button
                type="button"
                className="actionCard"
                style={
                  styles.actionButton
                }
                onClick={() =>
                  openComingSoon(
                    "Refer & Earn"
                  )
                }
              >
                <div
                  style={{
                    ...styles.actionIcon,
                    background:
                      "#fdf2f8",
                    color:
                      "#db2777",
                  }}
                >
                  👥
                </div>

                <div className="actionText">
                  <strong
                    style={
                      styles.actionTitle
                    }
                  >
                    Refer & Earn
                  </strong>

                  <span
                    style={
                      styles.actionSub
                    }
                  >
                    Coming Soon
                  </span>
                </div>

                <span
                  style={
                    styles.actionArrow
                  }
                >
                  →
                </span>
              </button>

              <button
                type="button"
                className="actionCard"
                style={
                  styles.actionButton
                }
                onClick={() =>
                  (window.location.href =
                    "/support")
                }
              >
                <div
                  style={{
                    ...styles.actionIcon,
                    background:
                      "#eff6ff",
                    color:
                      "#2563eb",
                  }}
                >
                  🎧
                </div>

                <div className="actionText">
                  <strong
                    style={
                      styles.actionTitle
                    }
                  >
                    Support
                  </strong>

                  <span
                    style={
                      styles.actionSub
                    }
                  >
                    Need Help?
                  </span>
                </div>

                <span
                  style={
                    styles.actionArrow
                  }
                >
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

            <div
              style={
                styles.sectionHeader
              }
            >
              <div>
                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  Available Offers
                </h2>

                <p
                  style={
                    styles.sectionSub
                  }
                >
                  Complete offers and
                  earn real rewards.
                </p>
              </div>

              <span
                style={
                  styles.offerCount
                }
              >
                {campaigns.length} Offers
              </span>
            </div>

            {campaigns.length === 0 ? (
              <div
                style={
                  styles.emptyBox
                }
              >
                <div
                  style={
                    styles.emptyIcon
                  }
                >
                  🎁
                </div>

                <h3
                  style={
                    styles.emptyTitle
                  }
                >
                  No offers available
                </h3>

                <p
                  style={
                    styles.emptyText
                  }
                >
                  New earning
                  opportunities will
                  appear here.
                </p>
              </div>
            ) : (
              <div
                className="offerGrid"
                style={
                  styles.offerGrid
                }
              >
                {campaigns.map(
                  (campaign) => (
                    <div
                      key={campaign.id}
                      className="offerCard"
                      style={
                        styles.offerCard
                      }
                    >

                      <div
                        style={
                          styles.offerImageWrap
                        }
                      >

                        {campaign.image_url ? (
                          <img
                            src={
                              campaign.image_url
                            }
                            alt={
                              campaign.name
                            }
                            style={
                              styles.offerImage
                            }
                            loading="lazy"
                          />
                        ) : (
                          <div
                            style={
                              styles.offerPlaceholder
                            }
                          >
                            🎁
                          </div>
                        )}

                        <div
                          style={
                            styles.offerRewardBadge
                          }
                        >
                          +₹
                          {Number(
                            campaign.reward
                          ).toFixed(2)}
                        </div>

                      </div>

                      <div
                        style={
                          styles.offerContent
                        }
                      >

                        <div
                          style={
                            styles.offerTop
                          }
                        >
                          <span
                            style={
                              styles.category
                            }
                          >
                            {campaign.category ||
                              "Offer"}
                          </span>

                          <span
                            style={
                              styles.easyBadge
                            }
                          >
                            ✓ Available
                          </span>
                        </div>

                        <h3
                          style={
                            styles.offerName
                          }
                        >
                          {campaign.name}
                        </h3>

                        <p
                          style={
                            styles.offerDescription
                          }
                        >
                          {campaign.description ||
                            "Complete this offer and earn your reward."}
                        </p>

                        <button
                          type="button"
                          className="startButton"
                          style={
                            styles.startButton
                          }
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
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          {/* RECENT ACTIVITY */}

          <section
            className="animateUp delay5"
            style={styles.section}
          >

            <div
              style={
                styles.sectionHeader
              }
            >
              <div>
                <h2
                  style={
                    styles.sectionTitle
                  }
                >
                  Recent Activity
                </h2>

                <p
                  style={
                    styles.sectionSub
                  }
                >
                  Your latest wallet
                  transactions.
                </p>
              </div>
            </div>

            {transactions.length === 0 ? (
              <div
                style={
                  styles.emptyBox
                }
              >
                <div
                  style={
                    styles.emptyIcon
                  }
                >
                  📊
                </div>

                <h3
                  style={
                    styles.emptyTitle
                  }
                >
                  No transactions yet
                </h3>

                <p
                  style={
                    styles.emptyText
                  }
                >
                  Your earnings will
                  appear here after
                  completing offers.
                </p>
              </div>
            ) : (
              <div
                style={
                  styles.transactionBox
                }
              >
                {transactions.map(
                  (transaction) => {
                    const positive =
                      Number(
                        transaction.amount
                      ) >= 0;

                    return (
                      <div
                        key={
                          transaction.id
                        }
                        style={
                          styles.transactionRow
                        }
                      >

                        <div
                          style={
                            styles.transactionLeft
                          }
                        >

                          <div
                            style={{
                              ...styles.transactionIcon,
                              background:
                                positive
                                  ? "#ecfdf5"
                                  : "#fff1f2",
                              color:
                                positive
                                  ? "#059669"
                                  : "#ef4444",
                            }}
                          >
                            {positive
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
                              style={
                                styles.transactionTitle
                              }
                            >
                              {transaction.description ||
                                transaction.type.replaceAll(
                                  "_",
                                  " "
                                )}
                            </strong>

                            <div
                              style={
                                styles.transactionDate
                              }
                            >
                              {new Date(
                                transaction.created_at
                              ).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month:
                                    "short",
                                  year:
                                    "numeric",
                                }
                              )}
                            </div>
                          </div>

                        </div>

                        <div
                          style={{
                            ...styles.transactionAmount,
                            color:
                              positive
                                ? "#059669"
                                : "#ef4444",
                          }}
                        >
                          {positive
                            ? "+"
                            : "-"}
                          ₹
                          {Math.abs(
                            Number(
                              transaction.amount
                            )
                          ).toFixed(2)}
                        </div>

                      </div>
                    );
                  }
                )}
              </div>
            )}

          </section>

          <footer
            style={styles.footer}
          >
            <div
              style={
                styles.footerBrand
              }
            >
              <strong>
                <span>AURA</span>{" "}
                <b>CAMP</b>
              </strong>

              <span>
                Independent Rewards
                Platform
              </span>
            </div>

            <span>
              ©{" "}
              {new Date().getFullYear()}{" "}
              AURA CAMP
            </span>
          </footer>

        </div>

        {/* =================================================
            FIXED BOTTOM NAV
        ================================================= */}

        <nav
          className="auraBottomNav"
          aria-label="Aura Camp navigation"
        >

          {/* HOME */}

          <button
            type="button"
            className="auraNavItem auraNavActive"
            onClick={() => {
              window.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }}
          >
            <span className="auraNavIcon">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M3 10.8 12 3l9 7.8v9.2a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </span>

            <span className="auraNavLabel">
              Home
            </span>
          </button>

          {/* OFFERS */}

          <button
            type="button"
            className="auraNavItem"
            onClick={() => {
              document
                .getElementById("offers")
                ?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
            }}
          >
            <span className="auraNavIcon">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
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
            </span>

            <span className="auraNavLabel">
              Offers
            </span>
          </button>

          {/* TELEGRAM */}

          <button
            type="button"
            className="auraTelegramNav"
            onClick={() => {
              window.location.href =
                TELEGRAM_URL;
            }}
            aria-label="Open Aura Camp Telegram"
          >
            <span className="auraTelegramCircle">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M21.7 3.4 18.5 20c-.24 1.17-.87 1.46-1.76.91l-4.84-3.57-2.34 2.25c-.26.26-.48.48-.98.48l.35-4.93 8.97-8.1c.39-.35-.08-.55-.6-.2L6.2 13.92l-4.73-1.48c-1.03-.32-1.05-1.03.22-1.52L20.17 3.1c.87-.32 1.63.2 1.53.3Z"
                  fill="white"
                />
              </svg>
            </span>

            <span className="telegramText">
              Telegram
            </span>
          </button>

          {/* MY OFFERS */}

          <button
            type="button"
            className="auraNavItem"
            onClick={() => {
              openComingSoon(
                "My Offers"
              );
            }}
          >
            <span className="auraNavIcon">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
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
            </span>

            <span className="auraNavLabel">
              My Offers
            </span>

            <span className="auraSoon">
              Soon
            </span>
          </button>

          {/* PROFILE */}

          <button
            type="button"
            className="auraNavItem"
            onClick={() => {
              openComingSoon(
                "Profile"
              );
            }}
          >
            <span className="auraNavIcon">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
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
            </span>

            <span className="auraNavLabel">
              Profile
            </span>

            <span className="auraSoon">
              Soon
            </span>
          </button>

        </nav>

        {/* COMING SOON MODAL */}

        {comingSoon && (
          <div
            className="comingOverlay"
            onClick={
              closeComingSoon
            }
          >
            <div
              className="comingModal"
              onClick={(event) =>
                event.stopPropagation()
              }
            >

              <button
                type="button"
                className="comingClose"
                onClick={
                  closeComingSoon
                }
              >
                ×
              </button>

              <div className="comingIcon">
                ⏳
              </div>

              <h2>
                Coming Soon
              </h2>

              <p>
                <strong>
                  {comingSoon}
                </strong>{" "}
                is currently under
                development.
              </p>

              <small>
                We are working on it.
                Stay tuned!
              </small>

              <button
                type="button"
                className="comingButton"
                onClick={
                  closeComingSoon
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
}

body {
  margin: 0;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  background: #eaf2f4;
}

button {
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
}

button:focus {
  outline: none;
}

button:disabled {
  opacity: .65;
}

button,
a {
  touch-action: manipulation;
}

/* ========================================
   ANIMATIONS
======================================== */

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
    transform: translateY(14px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes auraDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
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

@keyframes telegramFloat {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-3px);
  }
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: translateY(14px) scale(.94);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ========================================
   MOBILE APP WIDTH
======================================== */

@media (min-width: 521px) {
  body {
    background: #eaf2f4;
  }
}

/* ========================================
   BOTTOM NAV - IMPORTANT
======================================== */

.auraBottomNav {
  position: fixed !important;

  left: 50% !important;

  bottom:
    calc(8px + env(safe-area-inset-bottom))
    !important;

  transform:
    translateX(-50%) !important;

  width:
    calc(100% - 18px) !important;

  max-width:
    520px !important;

  height:
    74px !important;

  display:
    grid !important;

  grid-template-columns:
    repeat(5, minmax(0, 1fr)) !important;

  align-items:
    center !important;

  padding:
    4px !important;

  margin:
    0 !important;

  background:
    rgba(255,255,255,.98) !important;

  border:
    1px solid #dce6e9 !important;

  border-radius:
    25px !important;

  box-shadow:
    0 15px 42px rgba(15,40,55,.17) !important;

  backdrop-filter:
    blur(18px) !important;

  -webkit-backdrop-filter:
    blur(18px) !important;

  z-index:
    99999 !important;

  overflow:
    visible !important;
}

/* ALL BOTTOM BUTTONS */

.auraBottomNav button {
  appearance: none !important;
  -webkit-appearance: none !important;

  border: 0 !important;
  outline: 0 !important;

  margin: 0 !important;

  font-family:
    Inter,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif !important;

  cursor: pointer !important;

  -webkit-tap-highlight-color:
    transparent !important;
}

/* NORMAL ITEMS */

.auraNavItem {
  position: relative !important;

  width: 100% !important;

  height: 64px !important;

  padding: 0 !important;

  background:
    transparent !important;

  color:
    #7c878d !important;

  display:
    flex !important;

  flex-direction:
    column !important;

  align-items:
    center !important;

  justify-content:
    center !important;

  gap:
    3px !important;

  border-radius:
    17px !important;

  transition:
    transform .15s ease,
    color .15s ease,
    background .15s ease !important;
}

.auraNavItem:active {
  transform:
    scale(.91) !important;
}

.auraNavItem.auraNavActive {
  color:
    #155eef !important;
}

.auraNavIcon {
  width:
    27px !important;

  height:
    27px !important;

  display:
    flex !important;

  align-items:
    center !important;

  justify-content:
    center !important;

  color:
    currentColor !important;
}

.auraNavIcon svg {
  width:
    23px !important;

  height:
    23px !important;

  display:
    block !important;
}

.auraNavLabel {
  display:
    block !important;

  font-size:
    8px !important;

  line-height:
    11px !important;

  font-weight:
    700 !important;

  color:
    currentColor !important;

  white-space:
    nowrap !important;
}

/* ========================================
   TELEGRAM CENTER BUTTON
======================================== */

.auraTelegramNav {
  position: relative !important;

  width:
    100% !important;

  height:
    90px !important;

  margin:
    -20px 0 0 !important;

  padding:
    0 !important;

  background:
    transparent !important;

  color:
    #68767d !important;

  display:
    flex !important;

  flex-direction:
    column !important;

  align-items:
    center !important;

  justify-content:
    flex-start !important;

  gap:
    3px !important;

  transition:
    transform .15s ease !important;
}

.auraTelegramNav:active {
  transform:
    scale(.92) !important;
}

.auraTelegramCircle {
  width:
    66px !important;

  height:
    66px !important;

  min-width:
    66px !important;

  min-height:
    66px !important;

  display:
    flex !important;

  align-items:
    center !important;

  justify-content:
    center !important;

  border-radius:
    50% !important;

  border:
    4px solid #fff !important;

  background:
    linear-gradient(
      145deg,
      #29a9e8,
      #168fd0,
      #0879b5
    ) !important;

  box-shadow:
    0 9px 25px
    rgba(22,143,208,.30) !important;

  animation:
    telegramFloat 2.8s ease-in-out infinite !important;

  transition:
    transform .15s ease !important;
}

.auraTelegramCircle svg {
  width:
    31px !important;

  height:
    31px !important;

  display:
    block !important;
}

.telegramText {
  display:
    block !important;

  font-size:
    8px !important;

  line-height:
    11px !important;

  font-weight:
    700 !important;

  color:
    #68767d !important;

  white-space:
    nowrap !important;
}

/* SOON BADGE */

.auraSoon {
  position:
    absolute !important;

  top:
    3px !important;

  right:
    1px !important;

  padding:
    2px 4px !important;

  border-radius:
    999px !important;

  background:
    #fff0f3 !important;

  color:
    #e11d48 !important;

  border:
    1px solid #ffd6df !important;

  font-size:
    5px !important;

  line-height:
    8px !important;

  font-weight:
    850 !important;
}

/* ========================================
   COMING SOON
======================================== */

.comingOverlay {
  position:
    fixed !important;

  inset:
    0 !important;

  z-index:
    100000 !important;

  display:
    flex !important;

  align-items:
    center !important;

  justify-content:
    center !important;

  padding:
    20px !important;

  background:
    rgba(10,25,35,.48) !important;

  backdrop-filter:
    blur(7px) !important;

  -webkit-backdrop-filter:
    blur(7px) !important;
}

.comingModal {
  position:
    relative !important;

  width:
    min(100%, 350px) !important;

  padding:
    27px 21px 21px !important;

  border-radius:
    25px !important;

  background:
    #fff !important;

  text-align:
    center !important;

  box-shadow:
    0 25px 70px
    rgba(10,30,45,.25) !important;

  animation:
    modalIn .25s ease both !important;
}

.comingClose {
  position:
    absolute !important;

  top:
    9px !important;

  right:
    11px !important;

  width:
    29px !important;

  height:
    29px !important;

  border:
    0 !important;

  border-radius:
    50% !important;

  background:
    #f1f5f7 !important;

  color:
    #64748b !important;

  font-size:
    20px !important;

  cursor:
    pointer !important;
}

.comingIcon {
  width:
    66px !important;

  height:
    66px !important;

  margin:
    0 auto 13px !important;

  border-radius:
    21px !important;

  background:
    linear-gradient(
      135deg,
      #f0e7ff,
      #e8f0ff
    ) !important;

  display:
    flex !important;

  align-items:
    center !important;

  justify-content:
    center !important;

  font-size:
    29px !important;
}

.comingModal h2 {
  margin:
    0 0 8px !important;

  color:
    #111827 !important;

  font-size:
    21px !important;
}

.comingModal p {
  margin:
    0 !important;

  color:
    #64748b !important;

  font-size:
    11px !important;

  line-height:
    1.6 !important;
}

.comingModal small {
  display:
    block !important;

  margin-top:
    5px !important;

  color:
    #94a3b8 !important;

  font-size:
    9px !important;
}

.comingButton {
  width:
    100% !important;

  margin-top:
    18px !important;

  padding:
    11px !important;

  border:
    0 !important;

  border-radius:
    12px !important;

  background:
    linear-gradient(
      90deg,
      #155eef,
      #6d28d9
    ) !important;

  color:
    #fff !important;

  font-size:
    10px !important;

  font-weight:
    850 !important;

  cursor:
    pointer !important;
}

/* ========================================
   SMALL MOBILE
======================================== */

@media (max-width: 360px) {

  .auraBottomNav {
    width:
      calc(100% - 12px) !important;

    height:
      70px !important;

    bottom:
      calc(5px + env(safe-area-inset-bottom))
      !important;
  }

  .auraNavItem {
    height:
      60px !important;
  }

  .auraNavIcon {
    width:
      25px !important;

    height:
      25px !important;
  }

  .auraNavIcon svg {
    width:
      21px !important;

    height:
      21px !important;
  }

  .auraNavLabel,
  .telegramText {
    font-size:
      7px !important;
  }

  .auraTelegramCircle {
    width:
      62px !important;

    height:
      62px !important;

    min-width:
      62px !important;

    min-height:
      62px !important;
  }

  .auraTelegramCircle svg {
    width:
      28px !important;

    height:
      28px !important;
  }
}

/* ========================================
   DESKTOP STILL MOBILE APP WIDTH
======================================== */

@media (min-width: 521px) {

  .auraBottomNav {
    width:
      510px !important;
  }
}
`;

/* =========================================================
   STYLES
========================================================= */

const styles: Record<
  string,
  CSSProperties
> = {

  page: {
    minHeight: "100vh",
    width: "100%",
    maxWidth: "540px",
    margin: "0 auto",
    boxSizing: "border-box",
    background:
      "linear-gradient(145deg, #f1fbfc 0%, #f7fbff 55%, #faf7ff 100%)",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#111827",
    padding:
      "10px 9px 125px",
    position: "relative",
    overflow: "hidden",
  },

  backgroundGlowOne: {
    position: "fixed",
    width: "260px",
    height: "260px",
    borderRadius: "50%",
    background:
      "rgba(37,99,235,.07)",
    filter: "blur(70px)",
    top: "-100px",
    left: "-100px",
    pointerEvents: "none",
  },

  backgroundGlowTwo: {
    position: "fixed",
    width: "280px",
    height: "280px",
    borderRadius: "50%",
    background:
      "rgba(168,85,247,.06)",
    filter: "blur(75px)",
    bottom: "-120px",
    right: "-100px",
    pointerEvents: "none",
  },

  container: {
    width: "100%",
    maxWidth: "520px",
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
  },

  loadingPage: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(145deg,#f1fbfc,#f7fbff,#faf7ff)",
    fontFamily:
      "Inter,system-ui,sans-serif",
  },

  loadingBox: {
    width: "260px",
    padding: "30px",
    borderRadius: "24px",
    background: "#fff",
    textAlign: "center",
    boxShadow:
      "0 20px 60px rgba(30,64,175,.10)",
  },

  loadingLogo: {
    fontSize: "25px",
    fontWeight: 950,
    letterSpacing: "-1px",
    marginBottom: "20px",
  },

  loader: {
    width: "29px",
    height: "29px",
    border:
      "3px solid #e5e7eb",
    borderTopColor:
      "#2563eb",
    borderRightColor:
      "#16a34a",
    borderRadius: "50%",
    margin:
      "0 auto 13px",
    animation:
      "spin .75s linear infinite",
  },

  loadingText: {
    margin: 0,
    color: "#7b8790",
    fontSize: "10px",
  },

  header: {
    background:
      "rgba(255,255,255,.94)",
    backdropFilter:
      "blur(16px)",
    WebkitBackdropFilter:
      "blur(16px)",
    padding: "13px 12px",
    borderRadius: "19px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "10px",
    border:
      "1px solid #dfe9ec",
    boxShadow:
      "0 8px 26px rgba(20,60,80,.055)",
    minWidth: 0,
  },

  brandArea: {
    minWidth: 0,
  },

  brand: {
    fontSize: "22px",
    fontWeight: 950,
    letterSpacing: "-1px",
    lineHeight: 1,
  },

  tagline: {
    fontSize: "9px",
    color: "#96a2aa",
    marginTop: "5px",
  },

  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    flexShrink: 0,
  },

  notificationButton: {
    width: "38px",
    height: "38px",
    borderRadius: "12px",
    border:
      "1px solid #dfe7ea",
    background: "#fff",
    cursor: "pointer",
    fontSize: "16px",
  },

  logout: {
    background: "#153342",
    color: "#fff",
    border: "none",
    borderRadius: "11px",
    padding: "10px 13px",
    fontWeight: 750,
    cursor: "pointer",
    fontSize: "10px",
  },

  welcome: {
    background:
      "linear-gradient(135deg,#fff 0%,#f8fbff 55%,#f5f0ff 100%)",
    borderRadius: "21px",
    padding: "17px",
    marginBottom: "10px",
    border:
      "1px solid #dfe9ec",
    boxShadow:
      "0 9px 28px rgba(20,60,80,.055)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    minWidth: 0,
  },

  welcomeContent: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
    flex: 1,
  },

  avatar: {
    width: "48px",
    height: "48px",
    minWidth: "48px",
    borderRadius: "15px",
    background:
      "linear-gradient(135deg,#155eef,#16a34a)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: "18px",
    boxShadow:
      "0 8px 20px rgba(37,99,235,.20)",
  },

  welcomeText: {
    minWidth: 0,
  },

  smallText: {
    color: "#71808a",
    margin: "0 0 2px",
    fontSize: "10px",
  },

  welcomeTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 850,
    letterSpacing: "-.5px",
    overflowWrap: "anywhere",
  },

  subText: {
    color: "#71808a",
    margin: "4px 0 0",
    fontSize: "9px",
  },

  welcomeBadge: {
    background: "#ecfaf5",
    color: "#16804e",
    padding: "9px 10px",
    border: 0,
    borderRadius: "11px",
    fontSize: "8px",
    fontWeight: 850,
    whiteSpace: "nowrap",
    cursor: "pointer",
  },

  auraIdCard: {
    background:
      "rgba(255,255,255,.96)",
    borderRadius: "18px",
    padding: "11px 13px",
    marginBottom: "10px",
    border:
      "1px solid #dfe9ec",
    display: "flex",
    alignItems: "center",
    gap: "9px",
    boxShadow:
      "0 7px 22px rgba(20,60,80,.045)",
  },

  auraIdIcon: {
    width: "40px",
    height: "40px",
    minWidth: "40px",
    borderRadius: "12px",
    background:
      "linear-gradient(135deg,#155eef,#16a34a)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "10px",
    fontWeight: 900,
  },

  auraIdContent: {
    flex: 1,
    minWidth: 0,
  },

  auraIdLabel: {
    display: "block",
    color: "#9aa6ae",
    fontSize: "8px",
    letterSpacing: ".7px",
    fontWeight: 800,
  },

  auraIdValue: {
    display: "block",
    color: "#111827",
    fontSize: "15px",
    marginTop: "2px",
  },

  auraIdVerified: {
    padding: "7px 9px",
    borderRadius: "999px",
    background: "#ecfdf5",
    color: "#059669",
    fontSize: "8px",
    fontWeight: 850,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0,1.5fr) repeat(2,minmax(0,1fr))",
    gap: "9px",
    marginBottom: "20px",
    width: "100%",
  },

  walletCard: {
    background:
      "linear-gradient(135deg,#123746,#164b59 55%,#166a51)",
    color: "#fff",
    padding: "17px",
    borderRadius: "21px",
    minHeight: "142px",
    boxShadow:
      "0 13px 32px rgba(18,55,70,.17)",
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
    fontSize: "10px",
    opacity: .78,
    marginBottom: "5px",
  },

  walletAmount: {
    fontSize: "31px",
    fontWeight: 900,
    letterSpacing: "-1px",
  },

  walletIcon: {
    width: "46px",
    height: "46px",
    minWidth: "46px",
    borderRadius: "14px",
    background:
      "rgba(255,255,255,.14)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
  },

  walletBottom: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    marginTop: "18px",
  },

  walletHint: {
    fontSize: "9px",
    opacity: .72,
  },

  walletButton: {
    background: "#fff",
    color: "#123746",
    border: "none",
    padding: "9px 12px",
    borderRadius: "11px",
    fontWeight: 850,
    fontSize: "10px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  statCard: {
    background:
      "rgba(255,255,255,.96)",
    padding: "15px",
    borderRadius: "19px",
    border:
      "1px solid #e1e9ec",
    boxShadow:
      "0 7px 22px rgba(20,60,80,.045)",
    minHeight: "142px",
    minWidth: 0,
  },

  statIcon: {
    width: "35px",
    height: "35px",
    borderRadius: "11px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    marginBottom: "10px",
  },

  cardLabel: {
    fontSize: "9px",
    color: "#71808a",
    marginBottom: "3px",
  },

  statAmount: {
    fontSize: "21px",
    fontWeight: 850,
    color: "#111827",
  },

  cardHint: {
    fontSize: "8px",
    color: "#9aa6ae",
    marginTop: "4px",
  },

  section: {
    marginBottom: "22px",
    minWidth: 0,
  },

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "10px",
    gap: "8px",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 850,
    letterSpacing: "-.35px",
  },

  sectionSub: {
    margin: "4px 0 0",
    color: "#71808a",
    fontSize: "9px",
  },

  actionGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",
    gap: "8px",
    width: "100%",
  },

  actionButton: {
    background: "#fff",
    border:
      "1px solid #e1e9ec",
    borderRadius: "16px",
    padding: "11px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    textAlign: "left",
    cursor: "pointer",
    boxShadow:
      "0 7px 20px rgba(20,60,80,.04)",
    minHeight: "70px",
    minWidth: 0,
    width: "100%",
    overflow: "hidden",
  },

  actionIcon: {
    width: "36px",
    height: "36px",
    minWidth: "36px",
    borderRadius: "11px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
  },

  actionTitle: {
    display: "block",
    color: "#111827",
    fontSize: "10px",
    marginBottom: "3px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  actionSub: {
    display: "block",
    color: "#94a3b8",
    fontSize: "8px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  actionArrow: {
    marginLeft: "auto",
    color: "#94a3b8",
    fontSize: "14px",
    flexShrink: 0,
  },

  offerCount: {
    background: "#ecfdf5",
    color: "#047857",
    padding: "6px 9px",
    borderRadius: "999px",
    fontSize: "8px",
    fontWeight: 850,
    whiteSpace: "nowrap",
  },

  offerGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(260px,1fr))",
    gap: "10px",
    width: "100%",
  },

  offerCard: {
    background: "#fff",
    borderRadius: "18px",
    overflow: "hidden",
    border:
      "1px solid #e1e9ec",
    boxShadow:
      "0 8px 24px rgba(20,60,80,.045)",
    minWidth: 0,
  },

  offerImageWrap: {
    height: "145px",
    position: "relative",
    background:
      "linear-gradient(135deg,#eef7f8,#f4f0ff)",
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
    fontSize: "40px",
  },

  offerRewardBadge: {
    position: "absolute",
    right: "9px",
    bottom: "9px",
    background: "#fff",
    color: "#059669",
    padding: "6px 9px",
    borderRadius: "9px",
    fontSize: "10px",
    fontWeight: 900,
    boxShadow:
      "0 5px 15px rgba(0,0,0,.10)",
  },

  offerContent: {
    padding: "13px",
    minWidth: 0,
  },

  offerTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "7px",
  },

  category: {
    fontSize: "8px",
    background: "#eff6ff",
    padding: "5px 7px",
    borderRadius: "8px",
    color: "#2563eb",
    fontWeight: 750,
    maxWidth: "60%",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },

  easyBadge: {
    fontSize: "8px",
    color: "#059669",
    fontWeight: 750,
    whiteSpace: "nowrap",
  },

  offerName: {
    margin: "9px 0 5px",
    fontSize: "15px",
    fontWeight: 850,
    color: "#111827",
    overflowWrap: "anywhere",
  },

  offerDescription: {
    color: "#64748b",
    fontSize: "9px",
    lineHeight: 1.5,
    minHeight: "32px",
    margin: 0,
  },

  startButton: {
    width: "100%",
    marginTop: "10px",
    border: "none",
    background:
      "linear-gradient(90deg,#155eef,#4f46e5)",
    color: "#fff",
    padding: "10px",
    borderRadius: "10px",
    fontWeight: 850,
    cursor: "pointer",
    fontSize: "9px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "8px",
  },

  emptyBox: {
    background:
      "rgba(255,255,255,.92)",
    borderRadius: "18px",
    padding: "30px 16px",
    textAlign: "center",
    color: "#64748b",
    border:
      "1px solid #e1e9ec",
  },

  emptyIcon: {
    width: "55px",
    height: "55px",
    borderRadius: "17px",
    background: "#eef2ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 10px",
    fontSize: "24px",
  },

  emptyTitle: {
    color: "#111827",
    margin: "0 0 4px",
    fontSize: "14px",
  },

  emptyText: {
    margin: 0,
    fontSize: "9px",
  },

  transactionBox: {
    background:
      "rgba(255,255,255,.94)",
    borderRadius: "18px",
    overflow: "hidden",
    border:
      "1px solid #e1e9ec",
    width: "100%",
  },

  transactionRow: {
    padding: "12px",
    borderBottom:
      "1px solid #eef2f4",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
  },

  transactionLeft: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    minWidth: 0,
    flex: 1,
  },

  transactionIcon: {
    width: "36px",
    height: "36px",
    minWidth: "36px",
    borderRadius: "11px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
  },

  transactionTitle: {
    display: "block",
    fontSize: "9px",
    color: "#111827",
    textTransform: "capitalize",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "190px",
  },

  transactionDate: {
    fontSize: "8px",
    color: "#94a3b8",
    marginTop: "3px",
  },

  transactionAmount: {
    fontWeight: 900,
    fontSize: "10px",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  footer: {
    padding: "18px 3px 4px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    color: "#94a3b8",
    fontSize: "8px",
  },

  footerBrand: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
};
