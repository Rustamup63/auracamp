"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { CSSProperties } from "react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

/* =========================================================
   TYPES
========================================================= */

type Campaign = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  landing_url: string | null;
  reward: number;
  advertiser_payout: number;
  conversion_type: string | null;
  terms: string | null;
  daily_limit: number | null;
  total_limit: number | null;
  conversions_count: number;
  status: "draft" | "active" | "paused" | "ended";
  created_at: string;
};

type Withdrawal = {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  account_name: string | null;
  upi_id: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  status: string;
  admin_note: string | null;
  rejection_reason: string | null;
  created_at: string;
};

type AdminUser = {
  id: string;
  role: string;
  is_active: boolean;
};

type CampaignForm = {
  name: string;
  description: string;
  category: string;
  image_url: string;
  landing_url: string;
  reward: string;
  advertiser_payout: string;
  conversion_type: string;
  terms: string;
  daily_limit: string;
  total_limit: string;
};

/* =========================================================
   DEFAULT FORM
========================================================= */

const emptyCampaignForm: CampaignForm = {
  name: "",
  description: "",
  category: "Other",
  image_url: "",
  landing_url: "",
  reward: "",
  advertiser_payout: "",
  conversion_type: "Complete Offer",
  terms: "",
  daily_limit: "",
  total_limit: "",
};

/* =========================================================
   ADMIN PAGE
========================================================= */

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const [showCampaignForm, setShowCampaignForm] =
    useState(false);

  const [editingCampaign, setEditingCampaign] =
    useState<Campaign | null>(null);

  const [campaignForm, setCampaignForm] =
    useState<CampaignForm>(emptyCampaignForm);

  const [savingCampaign, setSavingCampaign] =
    useState(false);

  const [withdrawals, setWithdrawals] =
    useState<Withdrawal[]>([]);

  const [selectedWithdrawal, setSelectedWithdrawal] =
    useState<Withdrawal | null>(null);

  const [withdrawalAction, setWithdrawalAction] =
    useState<"approve" | "reject" | null>(null);

  const [adminNote, setAdminNote] = useState("");

  const [processingWithdrawal, setProcessingWithdrawal] =
    useState(false);

  const [withdrawalLoading, setWithdrawalLoading] =
    useState(false);

  const [message, setMessage] = useState("");

  const [notification, setNotification] =
    useState("");

  const [notificationEnabled, setNotificationEnabled] =
    useState(false);

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    checkAdmin();
  }, []);

  /* =========================================================
     ADMIN CHECK
  ========================================================= */

  async function checkAdmin() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: adminData, error } =
        await supabase
          .from("admin_users")
          .select("id, role, is_active")
          .eq("id", user.id)
          .eq("is_active", true)
          .maybeSingle();

      if (error || !adminData) {
        setAuthorized(false);
        return;
      }

      setAdmin(adminData);
      setAuthorized(true);

      await Promise.all([
        loadCampaigns(),
        loadWithdrawals(),
      ]);

      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        setNotificationEnabled(true);
      }
    } catch (error) {
      console.error(
        "Admin check error:",
        error
      );

      setAuthorized(false);
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     LOAD CAMPAIGNS
  ========================================================= */

  async function loadCampaigns() {
    const { data, error } = await supabase
      .from("campaigns")
      .select(
        `
        id,
        name,
        slug,
        description,
        category,
        image_url,
        landing_url,
        reward,
        advertiser_payout,
        conversion_type,
        terms,
        daily_limit,
        total_limit,
        conversions_count,
        status,
        created_at
        `
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Campaign loading error:",
        error
      );
      return;
    }

    setCampaigns(
      (data as Campaign[]) || []
    );
  }

  /* =========================================================
     LOAD WITHDRAWALS
  ========================================================= */

  async function loadWithdrawals() {
    setWithdrawalLoading(true);

    const { data, error } = await supabase
      .from("withdrawals")
      .select(
        `
        id,
        user_id,
        amount,
        method,
        account_name,
        upi_id,
        bank_name,
        account_number,
        ifsc_code,
        status,
        admin_note,
        rejection_reason,
        created_at
        `
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(100);

    if (error) {
      console.error(
        "Withdrawal loading error:",
        error
      );

      setWithdrawalLoading(false);
      return;
    }

    setWithdrawals(
      (data as Withdrawal[]) || []
    );

    setWithdrawalLoading(false);
  }

  /* =========================================================
     REALTIME WITHDRAWAL LISTENER
  ========================================================= */

  useEffect(() => {
    if (!authorized) {
      return;
    }

    const channel = supabase
      .channel("auracamp-withdrawals")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "withdrawals",
        },
        async (payload) => {
          console.log(
            "Realtime withdrawal event:",
            payload
          );

          await loadWithdrawals();

          if (payload.eventType === "INSERT") {
            showNotification(
              "🔔 New withdrawal request received."
            );
          }

          if (
            payload.eventType === "UPDATE"
          ) {
            showNotification(
              "🔄 Withdrawal status updated."
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authorized]);

  /* =========================================================
     SHOW NOTIFICATION
  ========================================================= */

  function showNotification(
    text: string
  ) {
    setNotification(text);

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification(
          "AURACAMP Admin",
          {
            body: text,
          }
        );
      } catch (error) {
        console.error(
          "Browser notification error:",
          error
        );
      }
    }

    setTimeout(() => {
      setNotification("");
    }, 5000);
  }

  /* =========================================================
     ENABLE BROWSER NOTIFICATIONS
  ========================================================= */

  async function enableNotifications() {
    if (
      typeof window === "undefined" ||
      !("Notification" in window)
    ) {
      showNotification(
        "Browser notifications are not supported."
      );
      return;
    }

    try {
      const permission =
        await Notification.requestPermission();

      if (permission === "granted") {
        setNotificationEnabled(true);

        showNotification(
          "🔔 Browser notifications enabled."
        );
      } else {
        setNotificationEnabled(false);

        showNotification(
          "Notification permission was not granted."
        );
      }
    } catch (error) {
      console.error(
        "Notification permission error:",
        error
      );
    }
  }

  /* =========================================================
     CAMPAIGN FORM UPDATE
  ========================================================= */

  function updateCampaignForm(
    field: keyof CampaignForm,
    value: string
  ) {
    setCampaignForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  /* =========================================================
     OPEN CREATE CAMPAIGN
  ========================================================= */

  function openCreateCampaign() {
    setEditingCampaign(null);

    setCampaignForm({
      ...emptyCampaignForm,
    });

    setMessage("");
    setShowCampaignForm(true);
  }

  /* =========================================================
     OPEN EDIT CAMPAIGN
  ========================================================= */

  function openEditCampaign(
    campaign: Campaign
  ) {
    setEditingCampaign(campaign);

    setCampaignForm({
      name: campaign.name || "",
      description:
        campaign.description || "",
      category:
        campaign.category || "Other",
      image_url:
        campaign.image_url || "",
      landing_url:
        campaign.landing_url || "",
      reward:
        String(campaign.reward ?? ""),
      advertiser_payout:
        String(
          campaign.advertiser_payout ?? ""
        ),
      conversion_type:
        campaign.conversion_type ||
        "Complete Offer",
      terms:
        campaign.terms || "",
      daily_limit:
        campaign.daily_limit !== null
          ? String(campaign.daily_limit)
          : "",
      total_limit:
        campaign.total_limit !== null
          ? String(campaign.total_limit)
          : "",
    });

    setMessage("");
    setShowCampaignForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /* =========================================================
     RESET CAMPAIGN FORM
  ========================================================= */

  function resetCampaignForm() {
    setCampaignForm({
      ...emptyCampaignForm,
    });

    setEditingCampaign(null);
    setShowCampaignForm(false);
    setMessage("");
  }

  /* =========================================================
     SAVE CAMPAIGN
  ========================================================= */

  async function saveCampaign(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setMessage("");

    if (!campaignForm.name.trim()) {
      setMessage(
        "Campaign name is required."
      );
      return;
    }

    if (!campaignForm.landing_url.trim()) {
      setMessage(
        "Landing URL is required."
      );
      return;
    }

    const reward = Number(
      campaignForm.reward
    );

    const payout = Number(
      campaignForm.advertiser_payout
    );

    if (
      !Number.isFinite(reward) ||
      reward < 0
    ) {
      setMessage(
        "Please enter a valid reward."
      );
      return;
    }

    if (
      !Number.isFinite(payout) ||
      payout < 0
    ) {
      setMessage(
        "Please enter a valid advertiser payout."
      );
      return;
    }

    if (reward > payout) {
      setMessage(
        "User reward cannot be higher than advertiser payout."
      );
      return;
    }

    const dailyLimit =
      campaignForm.daily_limit.trim()
        ? Number(
            campaignForm.daily_limit
          )
        : null;

    const totalLimit =
      campaignForm.total_limit.trim()
        ? Number(
            campaignForm.total_limit
          )
        : null;

    if (
      dailyLimit !== null &&
      (!Number.isFinite(
        dailyLimit
      ) || dailyLimit < 0)
    ) {
      setMessage(
        "Please enter a valid daily limit."
      );
      return;
    }

    if (
      totalLimit !== null &&
      (!Number.isFinite(
        totalLimit
      ) || totalLimit < 0)
    ) {
      setMessage(
        "Please enter a valid total limit."
      );
      return;
    }

    setSavingCampaign(true);

    try {
      /* -----------------------------------------------------
         EDIT
      ----------------------------------------------------- */

      if (editingCampaign) {
        const { error } =
          await supabase
            .from("campaigns")
            .update({
              name:
                campaignForm.name.trim(),

              description:
                campaignForm.description.trim() ||
                null,

              category:
                campaignForm.category.trim() ||
                "Other",

              image_url:
                campaignForm.image_url.trim() ||
                null,

              landing_url:
                campaignForm.landing_url.trim(),

              reward,

              advertiser_payout:
                payout,

              conversion_type:
                campaignForm.conversion_type.trim() ||
                "Complete Offer",

              terms:
                campaignForm.terms.trim() ||
                null,

              daily_limit:
                dailyLimit,

              total_limit:
                totalLimit,
            })
            .eq(
              "id",
              editingCampaign.id
            );

        if (error) {
          setMessage(error.message);
          return;
        }

        setMessage(
          "Campaign updated successfully."
        );
      }

      /* -----------------------------------------------------
         CREATE
      ----------------------------------------------------- */

      else {
        const slug =
          campaignForm.name
            .toLowerCase()
            .trim()
            .replace(
              /[^a-z0-9]+/g,
              "-"
            )
            .replace(
              /^-+|-+$/g,
              ""
            ) +
          "-" +
          Date.now();

        const { error } =
          await supabase
            .from("campaigns")
            .insert({
              name:
                campaignForm.name.trim(),

              slug,

              description:
                campaignForm.description.trim() ||
                null,

              category:
                campaignForm.category.trim() ||
                "Other",

              image_url:
                campaignForm.image_url.trim() ||
                null,

              landing_url:
                campaignForm.landing_url.trim(),

              reward,

              advertiser_payout:
                payout,

              conversion_type:
                campaignForm.conversion_type.trim() ||
                "Complete Offer",

              terms:
                campaignForm.terms.trim() ||
                null,

              daily_limit:
                dailyLimit,

              total_limit:
                totalLimit,

              status: "active",
            });

        if (error) {
          setMessage(error.message);
          return;
        }

        setMessage(
          "Campaign created successfully."
        );
      }

      setCampaignForm({
        ...emptyCampaignForm,
      });

      setEditingCampaign(null);
      setShowCampaignForm(false);

      await loadCampaigns();
    } catch (error) {
      console.error(
        "Save campaign error:",
        error
      );

      setMessage(
        "Something went wrong while saving campaign."
      );
    } finally {
      setSavingCampaign(false);
    }
  }

  /* =========================================================
     CHANGE CAMPAIGN STATUS
  ========================================================= */

  async function changeCampaignStatus(
    id: string,
    status:
      | "active"
      | "paused"
      | "ended"
  ) {
    const { error } =
      await supabase
        .from("campaigns")
        .update({
          status,
        })
        .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadCampaigns();

    showNotification(
      status === "active"
        ? "▶️ Campaign activated."
        : status === "paused"
        ? "⏸️ Campaign paused."
        : "⛔ Campaign ended."
    );
  }

  /* =========================================================
     DELETE CAMPAIGN
  ========================================================= */

  async function deleteCampaign(
    id: string
  ) {
    const confirmed =
      window.confirm(
        "Delete this campaign permanently?"
      );

    if (!confirmed) {
      return;
    }

    const { error } =
      await supabase
        .from("campaigns")
        .delete()
        .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setMessage(
      "Campaign deleted successfully."
    );

    await loadCampaigns();
  }

  /* =========================================================
     OPEN WITHDRAWAL ACTION
  ========================================================= */

  function openWithdrawalAction(
    withdrawal: Withdrawal,
    action:
      | "approve"
      | "reject"
  ) {
    setSelectedWithdrawal(
      withdrawal
    );

    setWithdrawalAction(action);

    setAdminNote("");

    setMessage("");
  }

  /* =========================================================
     CLOSE WITHDRAWAL ACTION
  ========================================================= */

  function closeWithdrawalAction() {
    if (processingWithdrawal) {
      return;
    }

    setSelectedWithdrawal(null);
    setWithdrawalAction(null);
    setAdminNote("");
  }

  /* =========================================================
     PROCESS WITHDRAWAL
  ========================================================= */

  async function processWithdrawal() {
    if (
      !selectedWithdrawal ||
      !withdrawalAction
    ) {
      return;
    }

    if (
      withdrawalAction === "reject" &&
      !adminNote.trim()
    ) {
      setMessage(
        "Please enter a rejection reason."
      );
      return;
    }

    setProcessingWithdrawal(true);
    setMessage("");

    try {
      const { data, error } =
        await supabase.rpc(
          "admin_process_withdrawal",
          {
            p_withdrawal_id:
              selectedWithdrawal.id,

            p_action:
              withdrawalAction,

            p_admin_note:
              adminNote.trim() ||
              null,
          }
        );

      if (error) {
        console.error(
          "Withdrawal processing error:",
          error
        );

        setMessage(error.message);
        return;
      }

      console.log(
        "Withdrawal processed:",
        data
      );

      showNotification(
        withdrawalAction ===
          "approve"
          ? "✅ Withdrawal approved."
          : "↩️ Withdrawal rejected and refunded."
      );

      setSelectedWithdrawal(null);
      setWithdrawalAction(null);
      setAdminNote("");

      await loadWithdrawals()
                {/* =================================================
              WITHDRAWAL MANAGEMENT
          ================================================= */}

          <section
            style={{
              ...sectionStyle,
              marginTop: 20,
            }}
            className="adminSection"
          >
            <div
              className="sectionHeader"
              style={sectionHeader}
            >
              <div>
                <div
                  style={sectionEyebrow}
                >
                  WALLET SYSTEM
                </div>

                <h2
                  style={sectionTitle}
                >
                  Withdrawal Management
                </h2>

                <p
                  style={
                    sectionDescription
                  }
                >
                  Review and process user
                  withdrawal requests.
                </p>
              </div>

              <button
                onClick={
                  loadWithdrawals
                }
                style={
                  headerSecondaryButton
                }
              >
                {withdrawalLoading
                  ? "Loading..."
                  : "↻ Refresh"}
              </button>
            </div>

            <div
              style={
                withdrawalSummary
              }
            >
              <div>
                <span>
                  Pending
                </span>

                <strong>
                  {
                    withdrawals.filter(
                      (w) =>
                        w.status ===
                        "pending"
                    ).length
                  }
                </strong>
              </div>

              <div>
                <span>
                  Processing
                </span>

                <strong>
                  {
                    withdrawals.filter(
                      (w) =>
                        w.status ===
                        "processing"
                    ).length
                  }
                </strong>
              </div>

              <div>
                <span>
                  Approved
                </span>

                <strong>
                  {
                    withdrawals.filter(
                      (w) =>
                        w.status ===
                        "paid"
                    ).length
                  }
                </strong>
              </div>

              <div>
                <span>
                  Rejected
                </span>

                <strong>
                  {
                    withdrawals.filter(
                      (w) =>
                        w.status ===
                        "rejected"
                    ).length
                  }
                </strong>
              </div>
            </div>

            <div
              style={withdrawalList}
            >
              {withdrawalLoading ? (
                <div
                  style={
                    emptyStyle
                  }
                >
                  <div
                    style={
                      loadingSpinner
                    }
                  >
                    ⟳
                  </div>

                  <p>
                    Loading withdrawals...
                  </p>
                </div>
              ) : withdrawals.length ===
                0 ? (
                <div
                  style={
                    emptyStyle
                  }
                >
                  <div
                    style={emptyIcon}
                  >
                    💸
                  </div>

                  <h3>
                    No withdrawals
                  </h3>

                  <p>
                    New withdrawal requests
                    will appear here.
                  </p>
                </div>
              ) : (
                withdrawals.map(
                  (withdrawal) => (
                    <div
                      key={
                        withdrawal.id
                      }
                      className="withdrawalCard"
                      style={
                        withdrawalCard
                      }
                    >
                      <div
                        style={
                          withdrawalMain
                        }
                      >
                        <div
                          style={
                            withdrawalTop
                          }
                        >
                          <strong
                            style={
                              withdrawalAmount
                            }
                          >
                            ₹
                            {Number(
                              withdrawal.amount
                            ).toFixed(
                              2
                            )}
                          </strong>

                          <span
                            style={{
                              ...withdrawalStatus,
                              ...(withdrawal.status ===
                              "pending"
                                ? pendingBadge
                                : withdrawal.status ===
                                  "processing"
                                ? processingBadge
                                : withdrawal.status ===
                                  "paid"
                                ? paidBadge
                                : withdrawal.status ===
                                  "rejected"
                                ? rejectedBadge
                                : pendingBadge),
                            }}
                          >
                            {
                              withdrawal.status
                            }
                          </span>
                        </div>

                        <div
                          style={
                            withdrawalDetails
                          }
                        >
                          <div>
                            <span>
                              Method
                            </span>

                            <strong>
                              {withdrawal.method ===
                              "upi"
                                ? "📱 UPI"
                                : "🏦 Bank"}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Account Holder
                            </span>

                            <strong>
                              {withdrawal.account_name ||
                                "Not provided"}
                            </strong>
                          </div>

                          {withdrawal.method ===
                            "upi" && (
                            <div>
                              <span>
                                UPI ID
                              </span>

                              <strong>
                                {withdrawal.upi_id ||
                                  "Not provided"}
                              </strong>
                            </div>
                          )}

                          {withdrawal.method ===
                            "bank" && (
                            <>
                              <div>
                                <span>
                                  Bank
                                </span>

                                <strong>
                                  {withdrawal.bank_name ||
                                    "Not provided"}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Account
                                </span>

                                <strong>
                                  {withdrawal.account_number
                                    ? `••••${withdrawal.account_number.slice(
                                        -4
                                      )}`
                                    : "Not provided"}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  IFSC
                                </span>

                                <strong>
                                  {withdrawal.ifsc_code ||
                                    "Not provided"}
                                </strong>
                              </div>
                            </>
                          )}

                          <div>
                            <span>
                              Requested
                            </span>

                            <strong>
                              {new Date(
                                withdrawal.created_at
                              ).toLocaleString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month:
                                    "short",
                                  year:
                                    "numeric",
                                  hour:
                                    "2-digit",
                                  minute:
                                    "2-digit",
                                }
                              )}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div
                        className="withdrawalActions"
                        style={
                          withdrawalActions
                        }
                      >
                        {withdrawal.status ===
                          "pending" && (
                          <>
                            <button
                              onClick={() =>
                                openWithdrawalAction(
                                  withdrawal,
                                  "reject"
                                )
                              }
                              style={
                                rejectButton
                              }
                            >
                              ✕ Reject
                            </button>

                            <button
                              onClick={() =>
                                openWithdrawalAction(
                                  withdrawal,
                                  "approve"
                                )
                              }
                              style={
                                approveButton
                              }
                            >
                              ✓ Approve
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </section>

          {/* =================================================
              FOOTER
          ================================================= */}

          <footer
            style={footerStyle}
          >
            <div>
              <strong>
                <span>AURA</span>{" "}
                <b>CAMP</b>
              </strong>

              <small>
                Independent Rewards Platform
              </small>
            </div>

            <span>
              ©{" "}
              {new Date().getFullYear()}{" "}
              AURA CAMP
            </span>
          </footer>
        </div>
      </main>

      {/* =====================================================
          WITHDRAWAL MODAL
      ===================================================== */}

      {selectedWithdrawal &&
        withdrawalAction && (
          <div
            style={modalOverlay}
            onClick={
              closeWithdrawalAction
            }
          >
            <div
              className="modalCard"
              style={modalCard}
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div
                style={modalHeader}
              >
                <div>
                  <div
                    style={
                      modalIcon
                    }
                  >
                    {withdrawalAction ===
                    "approve"
                      ? "✓"
                      : "!"}
                  </div>

                  <h2
                    style={
                      modalTitle
                    }
                  >
                    {withdrawalAction ===
                    "approve"
                      ? "Approve Withdrawal"
                      : "Reject Withdrawal"}
                  </h2>

                  <p
                    style={
                      modalDescription
                    }
                  >
                    {withdrawalAction ===
                    "approve"
                      ? "Confirm that this withdrawal has been verified."
                      : "Enter the reason for rejecting this withdrawal."}
                  </p>
                </div>

                <button
                  onClick={
                    closeWithdrawalAction
                  }
                  style={
                    modalClose
                  }
                >
                  ×
                </button>
              </div>

              <div
                style={
                  modalAmountBox
                }
              >
                <span>
                  Withdrawal Amount
                </span>

                <strong>
                  ₹
                  {Number(
                    selectedWithdrawal.amount
                  ).toFixed(2)}
                </strong>
              </div>

              <div
                style={
                  modalInfoGrid
                }
              >
                <div>
                  <span>
                    Method
                  </span>

                  <strong>
                    {selectedWithdrawal.method.toUpperCase()}
                  </strong>
                </div>

                <div>
                  <span>
                    Account Holder
                  </span>

                  <strong>
                    {selectedWithdrawal.account_name ||
                      "Not provided"}
                  </strong>
                </div>
              </div>

              <label
                style={labelStyle}
              >
                {withdrawalAction ===
                "approve"
                  ? "Admin Note (optional)"
                  : "Rejection Reason *"}

                <textarea
                  value={adminNote}
                  onChange={(e) =>
                    setAdminNote(
                      e.target.value
                    )
                  }
                  placeholder={
                    withdrawalAction ===
                    "approve"
                      ? "Optional admin note..."
                      : "Enter rejection reason..."
                  }
                  rows={4}
                  style={
                    textareaStyle
                  }
                />
              </label>

              <div
                style={
                  modalActions
                }
              >
                <button
                  onClick={
                    closeWithdrawalAction
                  }
                  disabled={
                    processingWithdrawal
                  }
                  style={
                    cancelButton
                  }
                >
                  Cancel
                </button>

                <button
                  onClick={
                    processWithdrawal
                  }
                  disabled={
                    processingWithdrawal
                  }
                  style={
                    withdrawalAction ===
                    "approve"
                      ? approveButton
                      : rejectButton
                  }
                >
                  {processingWithdrawal
                    ? "Processing..."
                    : withdrawalAction ===
                      "approve"
                    ? "✓ Confirm Approve"
                    : "✕ Confirm Reject"}
                </button>
              </div>
            </div>
          </div>
        )}
          </>
  );
}

/* =========================================================
   INPUT COMPONENT
========================================================= */

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label style={inputGroup}>
      <span style={inputLabel}>{label}</span>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </label>
  );
}

/* =========================================================
   STYLES
========================================================= */

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background:
    "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
  color: "#111827",
};

const containerStyle: CSSProperties = {
  width: "100%",
  maxWidth: 1180,
  margin: "0 auto",
  padding: "24px 18px 50px",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  padding: "18px 20px",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  boxShadow: "0 8px 30px rgba(15,23,42,0.06)",
};

const brandStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  letterSpacing: "-0.6px",
};

const adminLabel: CSSProperties = {
  marginTop: 3,
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  letterSpacing: "1.4px",
};

const logoutButton: CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "10px 15px",
  background: "#111827",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
};

const backButton: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: "9px 13px",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 700,
  cursor: "pointer",
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",
  gap: 14,
  marginTop: 20,
};

const statCard: CSSProperties = {
  minWidth: 0,
  padding: 18,
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  boxShadow: "0 8px 25px rgba(15,23,42,0.05)",
};

const statPurple: CSSProperties = {
  background: "#faf5ff",
  borderColor: "#e9d5ff",
};

const statGreen: CSSProperties = {
  background: "#f0fdf4",
  borderColor: "#bbf7d0",
};

const statOrange: CSSProperties = {
  background: "#fff7ed",
  borderColor: "#fed7aa",
};

const statBlue: CSSProperties = {
  background: "#eff6ff",
  borderColor: "#bfdbfe",
};

const statLabel: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "#64748b",
};

const statNumber: CSSProperties = {
  display: "block",
  marginTop: 8,
  fontSize: 27,
  lineHeight: 1,
  fontWeight: 900,
  color: "#0f172a",
};

const statHint: CSSProperties = {
  display: "block",
  marginTop: 9,
  fontSize: 11,
  color: "#94a3b8",
};

const sectionStyle: CSSProperties = {
  marginTop: 20,
  padding: 20,
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
};

const sectionHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
};

const sectionEyebrow: CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  color: "#6366f1",
  letterSpacing: "1.4px",
};

const sectionTitle: CSSProperties = {
  margin: "5px 0 0",
  fontSize: 21,
  fontWeight: 900,
  color: "#0f172a",
};

const sectionDescription: CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 13,
};

const primaryButton: CSSProperties = {
  border: "none",
  borderRadius: 11,
  padding: "11px 16px",
  background:
    "linear-gradient(135deg, #4f46e5, #7c3aed)",
  color: "#ffffff",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(79,70,229,0.22)",
};

const secondaryButton: CSSProperties = {
  border: "1px solid #dbe3ef",
  borderRadius: 10,
  padding: "9px 13px",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerButton: CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "9px 13px",
  background: "#fee2e2",
  color: "#b91c1c",
  fontWeight: 800,
  cursor: "pointer",
};

const successButton: CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "9px 13px",
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 800,
  cursor: "pointer",
};

const messageStyle: CSSProperties = {
  marginTop: 15,
  padding: "11px 13px",
  borderRadius: 10,
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  fontSize: 13,
  fontWeight: 700,
};

const formStyle: CSSProperties = {
  marginTop: 18,
  padding: 18,
  borderRadius: 15,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const formTitle: CSSProperties = {
  margin: "0 0 16px",
  fontSize: 16,
  fontWeight: 900,
  color: "#0f172a",
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: 14,
};

const inputGroup: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
};

const inputLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#475569",
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 43,
  padding: "10px 12px",
  border: "1px solid #dbe3ef",
  borderRadius: 10,
  outline: "none",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 13,
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 100,
  resize: "vertical",
};

const fullWidth: CSSProperties = {
  gridColumn: "1 / -1",
};

const formActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 16,
  flexWrap: "wrap",
};

const campaignGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: 14,
  marginTop: 18,
};

const campaignCard: CSSProperties = {
  minWidth: 0,
  padding: 16,
  border: "1px solid #e2e8f0",
  borderRadius: 15,
  background: "#ffffff",
};

const campaignTop: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const campaignName: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 900,
  color: "#0f172a",
  overflowWrap: "anywhere",
};

const campaignCategory: CSSProperties = {
  display: "inline-block",
  marginTop: 6,
  padding: "4px 8px",
  borderRadius: 999,
  background: "#f1f5f9",
  color: "#475569",
  fontSize: 10,
  fontWeight: 800,
};

const statusBadge: CSSProperties = {
  flexShrink: 0,
  padding: "5px 9px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 900,
  textTransform: "uppercase",
};

const campaignInfoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(3, minmax(0, 1fr))",
  gap: 9,
  marginTop: 15,
};

const infoBox: CSSProperties = {
  padding: 10,
  borderRadius: 10,
  background: "#f8fafc",
};

const infoLabel: CSSProperties = {
  display: "block",
  fontSize: 9,
  fontWeight: 800,
  color: "#94a3b8",
  textTransform: "uppercase",
};

const infoValue: CSSProperties = {
  display: "block",
  marginTop: 4,
  fontSize: 14,
  fontWeight: 900,
  color: "#0f172a",
};

const campaignActions: CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 14,
  flexWrap: "wrap",
};

const withdrawalSummary: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",
  gap: 10,
  marginTop: 16,
};

const withdrawalCard: CSSProperties = {
  padding: 15,
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  background: "#ffffff",
};

const withdrawalTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const withdrawalAmount: CSSProperties = {
  fontSize: 19,
  fontWeight: 900,
  color: "#0f172a",
};

const withdrawalUser: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#64748b",
  overflowWrap: "anywhere",
};

const withdrawalDetails: CSSProperties = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: 9,
};

const detailBox: CSSProperties = {
  padding: 10,
  borderRadius: 10,
  background: "#f8fafc",
};

const detailLabel: CSSProperties = {
  display: "block",
  fontSize: 9,
  fontWeight: 800,
  color: "#94a3b8",
  textTransform: "uppercase",
};

const detailValue: CSSProperties = {
  display: "block",
  marginTop: 4,
  fontSize: 12,
  fontWeight: 800,
  color: "#334155",
  overflowWrap: "anywhere",
};

const withdrawalActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 13,
  flexWrap: "wrap",
};

const emptyState: CSSProperties = {
  padding: "35px 15px",
  textAlign: "center",
  color: "#94a3b8",
};

const emptyIcon: CSSProperties = {
  fontSize: 30,
  marginBottom: 8,
};

const emptyTitle: CSSProperties = {
  margin: 0,
  color: "#334155",
  fontSize: 15,
  fontWeight: 800,
};

const emptyText: CSSProperties = {
  margin: "6px 0 0",
  fontSize: 12,
};

const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
  background: "rgba(15,23,42,0.55)",
  backdropFilter: "blur(5px)",
};

const modalCard: CSSProperties = {
  width: "100%",
  maxWidth: 520,
  maxHeight: "90vh",
  overflowY: "auto",
  padding: 20,
  borderRadius: 18,
  background: "#ffffff",
  boxShadow: "0 25px 70px rgba(15,23,42,0.25)",
};

const modalHeader: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const modalTitle: CSSProperties = {
  margin: 0,
  fontSize: 19,
  fontWeight: 900,
  color: "#0f172a",
};

const modalClose: CSSProperties = {
  width: 34,
  height: 34,
  border: "1px solid #e2e8f0",
  borderRadius: 9,
  background: "#ffffff",
  color: "#475569",
  fontSize: 18,
  cursor: "pointer",
};

const modalActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 9,
  marginTop: 18,
};

const loadingPage: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  background:
    "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
};

const loadingCard: CSSProperties = {
  width: "100%",
  maxWidth: 360,
  padding: 30,
  textAlign: "center",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  boxShadow: "0 15px 45px rgba(15,23,42,0.08)",
};

const loadingSpinner: CSSProperties = {
  width: 35,
  height: 35,
  margin: "0 auto 14px",
  border: "4px solid #e2e8f0",
  borderTopColor: "#4f46e5",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

const loadingText: CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 13,
  fontWeight: 700,
};

const deniedCard: CSSProperties = {
  ...loadingCard,
  maxWidth: 440,
};

const notificationBanner: CSSProperties = {
  marginTop: 15,
  padding: "11px 13px",
  borderRadius: 11,
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  color: "#166534",
  fontSize: 12,
  fontWeight: 700,
};

const footerStyle: CSSProperties = {
  marginTop: 25,
  padding: "18px 5px",
  textAlign: "center",
  color: "#94a3b8",
  fontSize: 11,
};

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
input,
textarea,
select {
  font-family: inherit;
}

button {
  -webkit-tap-highlight-color: transparent;
}

input:focus,
textarea:focus,
select:focus {
  border-color: #6366f1 !important;
  box-shadow: 0 0 0 3px rgba(99,102,241,0.10);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .statsGrid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr)) !important;
  }

  .campaignGrid {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 650px) {
  .statsGrid {
    grid-template-columns: 1fr !important;
  }

  .formGrid {
    grid-template-columns: 1fr !important;
  }

  .campaignInfoGrid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr)) !important;
  }

  .withdrawalSummary {
    grid-template-columns:
      repeat(2, minmax(0, 1fr)) !important;
  }

  .withdrawalDetails {
    grid-template-columns: 1fr !important;
  }

  .sectionHeader {
    align-items: stretch !important;
  }

  .sectionHeader button {
    width: 100%;
  }
}

@media (max-width: 430px) {
  .containerStyle {
    padding-left: 10px !important;
    padding-right: 10px !important;
  }

  .sectionStyle {
    padding: 14px !important;
  }

  .campaignInfoGrid {
    grid-template-columns: 1fr !important;
  }

  .withdrawalSummary {
    grid-template-columns: 1fr !important;
  }

  .campaignActions button,
  .withdrawalActions button {
    flex: 1;
  }
}
`;
      
