"use client";

import { useEffect, useRef, useState } from "react";
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

const MIN_WITHDRAWAL = 20;

type WithdrawalStatus = "pending" | "paid" | "rejected";

type Withdrawal = {
  id: string;
  amount: number;
  method: string;
  status: string;
  created_at: string;
};

type WithdrawalAccount = {
  id: string;
  method: "upi" | "bank";
  account_name: string;
  upi_id: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
};

type MessageType = "success" | "error" | "info";

export default function WithdrawPage() {
  const [balance, setBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [savedAccounts, setSavedAccounts] = useState<
    WithdrawalAccount[]
  >([]);

  const [method, setMethod] = useState<"upi" | "bank">("upi");
  const [amount, setAmount] = useState("");

  const [upiId, setUpiId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");

  const [editingAccount, setEditingAccount] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState<MessageType>("info");

  const userIdRef = useRef<string | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.replace("/login");
        return;
      }

      userIdRef.current = user.id;

      await loadWithdrawalData(user.id, mounted);

      /*
       * REALTIME WITHDRAWAL STATUS
       *
       * User will see:
       * pending → paid
       * pending → rejected
       *
       * without manually refreshing the page.
       */
      const channel = supabase
        .channel(`withdrawals-user-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "withdrawals",
            filter: `user_id=eq.${user.id}`,
          },
          async () => {
            await refreshWithdrawalData(user.id);
          }
        )
        .subscribe();

      channelRef.current = channel;

      return () => {
        mounted = false;

        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      };
    }

    const cleanupPromise = init();

    return () => {
      mounted = false;

      cleanupPromise.then((cleanup) => {
        if (typeof cleanup === "function") {
          cleanup();
        }
      });
    };
  }, []);

  /*
   * Also refresh when user returns to this tab.
   * This helps even if realtime is temporarily unavailable.
   */
  useEffect(() => {
    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        userIdRef.current
      ) {
        refreshWithdrawalData(userIdRef.current);
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, []);

  async function loadWithdrawalData(
    userId: string,
    mounted = true
  ) {
    try {
      const [
        profileResult,
        withdrawalsResult,
        accountsResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("wallet_balance")
          .eq("id", userId)
          .maybeSingle(),

        supabase
          .from("withdrawals")
          .select(
            "id, amount, method, status, created_at"
          )
          .eq("user_id", userId)
          .order("created_at", {
            ascending: false,
          })
          .limit(10),

        supabase
          .from("withdrawal_accounts")
          .select(
            "id, method, account_name, upi_id, bank_name, account_number, ifsc_code"
          )
          .eq("user_id", userId)
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (!mounted) return;

      if (profileResult.data) {
        setBalance(
          Number(profileResult.data.wallet_balance || 0)
        );
      }

      setWithdrawals(
        (withdrawalsResult.data || []) as Withdrawal[]
      );

      if (accountsResult.error) {
        console.error(
          "Saved payment methods error:",
          accountsResult.error
        );
      } else {
        const accounts =
          (accountsResult.data || []) as WithdrawalAccount[];

        setSavedAccounts(accounts);

        const preferred =
          accounts.find(
            (item) => item.method === method
          ) || accounts[0];

        if (preferred) {
          applySavedAccount(preferred);
        }
      }
    } catch (error) {
      console.error(
        "Withdrawal data loading error:",
        error
      );
    } finally {
      if (mounted) {
        setLoading(false);
      }
    }
  }

  async function refreshWithdrawalData(userId: string) {
    try {
      const [profileResult, withdrawalsResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("wallet_balance")
            .eq("id", userId)
            .maybeSingle(),

          supabase
            .from("withdrawals")
            .select(
              "id, amount, method, status, created_at"
            )
            .eq("user_id", userId)
            .order("created_at", {
              ascending: false,
            })
            .limit(10),
        ]);

      if (profileResult.data) {
        setBalance(
          Number(profileResult.data.wallet_balance || 0)
        );
      }

      setWithdrawals(
        (withdrawalsResult.data || []) as Withdrawal[]
      );
    } catch (error) {
      console.error(
        "Withdrawal refresh error:",
        error
      );
    }
  }

  function showMessage(
    text: string,
    type: MessageType
  ) {
    setMessage(text);
    setMessageType(type);
  }

  function applySavedAccount(
    account: WithdrawalAccount
  ) {
    setMethod(account.method);
    setAccountName(account.account_name || "");
    setUpiId(account.upi_id || "");
    setAccountNumber(account.account_number || "");
    setIfscCode(account.ifsc_code || "");
    setEditingAccount(false);
  }

  function editSavedAccount(
    account: WithdrawalAccount
  ) {
    applySavedAccount(account);
    setEditingAccount(true);

    showMessage(
      "Edit your saved payment details below.",
      "info"
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function selectMethod(
    nextMethod: "upi" | "bank"
  ) {
    setMethod(nextMethod);
    setEditingAccount(false);
    setMessage("");

    const saved = savedAccounts.find(
      (account) => account.method === nextMethod
    );

    if (saved) {
      applySavedAccount(saved);
      return;
    }

    setAccountName("");
    setUpiId("");
    setAccountNumber("");
    setIfscCode("");
  }

  async function savePaymentMethod() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.replace("/login");
      return false;
    }

    const payload =
      method === "upi"
        ? {
            user_id: user.id,
            method: "upi",
            account_name: accountName.trim(),
            upi_id: upiId.trim(),
            bank_name: null,
            account_number: null,
            ifsc_code: null,
          }
        : {
            user_id: user.id,
            method: "bank",
            account_name: accountName.trim(),
            upi_id: null,
            bank_name: null,
            account_number:
              accountNumber.trim(),
            ifsc_code:
              ifscCode.trim().toUpperCase(),
          };

    const { error } = await supabase
      .from("withdrawal_accounts")
      .upsert(payload, {
        onConflict: "user_id,method",
      });

    if (error) {
      console.error(
        "Save payment method error:",
        error
      );

      showMessage(
        `Payment method could not be saved: ${error.message}`,
        "error"
      );

      return false;
    }

    return true;
  }

  async function submitWithdrawal(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (submitting) return;

    setMessage("");

    const numericAmount = Number(amount);

    /*
     * MINIMUM = ₹20
     */
    if (
      !Number.isFinite(numericAmount) ||
      numericAmount < MIN_WITHDRAWAL
    ) {
      showMessage(
        `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL}.`,
        "error"
      );
      return;
    }

    /*
     * Amount cannot be greater than wallet balance.
     */
    if (numericAmount > balance) {
      showMessage(
        `Insufficient wallet balance. Available balance is ₹${balance.toFixed(
          2
        )}.`,
        "error"
      );
      return;
    }

    /*
     * UPI validation.
     */
    if (
      method === "upi" &&
      (!accountName.trim() ||
        !upiId.trim())
    ) {
      showMessage(
        "Please enter account holder name and UPI ID.",
        "error"
      );
      return;
    }

    /*
     * Bank validation.
     */
    if (
      method === "bank" &&
      (!accountName.trim() ||
        !accountNumber.trim() ||
        !ifscCode.trim())
    ) {
      showMessage(
        "Please complete all bank details.",
        "error"
      );
      return;
    }

    setSubmitting(true);

    try {
      /*
       * EDIT SAVED ACCOUNT
       *
       * Does not create a withdrawal.
       */
      if (editingAccount) {
        const saved =
          await savePaymentMethod();

        if (saved) {
          showMessage(
            "Payment details updated successfully.",
            "success"
          );

          setEditingAccount(false);

          if (userIdRef.current) {
            await loadWithdrawalData(
              userIdRef.current,
              true
            );
          }
        }

        return;
      }

      /*
       * CREATE WITHDRAWAL
       */
      const { error } = await supabase.rpc(
        "request_withdrawal",
        {
          p_amount: numericAmount,
          p_method: method,
          p_upi_id:
            method === "upi"
              ? upiId.trim()
              : "",
          p_account_name:
            accountName.trim(),
          p_account_number:
            method === "bank"
              ? accountNumber.trim()
              : "",
          p_ifsc_code:
            method === "bank"
              ? ifscCode
                  .trim()
                  .toUpperCase()
              : "",
        }
      );

      if (error) {
        console.error(
          "Withdrawal request error:",
          error
        );

        showMessage(
          error.message,
          "error"
        );

        return;
      }

      /*
       * Save payment details for next withdrawal.
       */
      const saved =
        await savePaymentMethod();

      showMessage(
        saved
          ? "Withdrawal request submitted successfully."
          : "Withdrawal submitted successfully. Payment details could not be saved.",
        "success"
      );

      setAmount("");
      setEditingAccount(false);

      /*
       * IMPORTANT:
       * Immediately refresh the recent history.
       */
      if (userIdRef.current) {
        await refreshWithdrawalData(
          userIdRef.current
        );
      }
    } catch (error) {
      console.error(
        "Withdrawal submission error:",
        error
      );

      showMessage(
        "Something went wrong. Please try again.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  }

  /*
   * ONLY THREE USER-FACING STATES:
   *
   * pending
   * paid
   * rejected
   *
   * Any unknown/non-final state is safely shown as Pending.
   */
  function getStatus(status: string): {
    label: string;
    type: WithdrawalStatus;
    icon: string;
  } {
    const normalized =
      String(status || "")
        .toLowerCase()
        .trim();

    if (
      normalized === "paid" ||
      normalized === "approved" ||
      normalized === "success"
    ) {
      return {
        label: "Paid",
        type: "paid",
        icon: "✓",
      };
    }

    if (
      normalized === "rejected" ||
      normalized === "failed" ||
      normalized === "cancelled"
    ) {
      return {
        label: "Rejected",
        type: "rejected",
        icon: "×",
      };
    }

    /*
     * No Processing state.
     * Everything non-final is Pending.
     */
    return {
      label: "Pending",
      type: "pending",
      icon: "⏳",
    };
  }

  function statusStyle(
    status: string
  ): React.CSSProperties {
    const state = getStatus(status);

    if (state.type === "paid") {
      return {
        background:
          "linear-gradient(135deg,#dcfce7,#ecfdf5)",
        color: "#15803d",
        border:
          "1px solid #bbf7d0",
      };
    }

    if (state.type === "rejected") {
      return {
        background:
          "linear-gradient(135deg,#fee2e2,#fff1f2)",
        color: "#dc2626",
        border:
          "1px solid #fecaca",
      };
    }

    return {
      background:
        "linear-gradient(135deg,#fef3c7,#fffbeb)",
      color: "#b45309",
      border:
        "1px solid #fde68a",
    };
  }

  function statusIconStyle(
    status: string
  ): React.CSSProperties {
    const state = getStatus(status);

    if (state.type === "paid") {
      return {
        background: "#dcfce7",
        color: "#15803d",
      };
    }

    if (state.type === "rejected") {
      return {
        background: "#fee2e2",
        color: "#dc2626",
      };
    }

    return {
      background: "#fef3c7",
      color: "#b45309",
    };
  }

  if (loading) {
    return (
      <>
        <style>{globalStyles}</style>

        <main style={styles.page}>
          <div style={styles.loadingBox}>
            <div style={styles.loadingLogo}>
              AURA <span>CAMP</span>
            </div>

            <div style={styles.loader} />

            <div style={styles.loadingText}>
              Loading withdrawal...
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <style>{globalStyles}</style>

      <main style={styles.page}>
        <div style={styles.backgroundGlowOne} />
        <div style={styles.backgroundGlowTwo} />

        <div style={styles.container}>

          {/* HEADER */}

          <header style={styles.header}>
            <button
              type="button"
              onClick={() =>
                window.location.replace("/")
              }
              style={styles.backButton}
            >
              ← Back
            </button>

            <div style={styles.headerCenter}>
              <div style={styles.brand}>
                AURA CAMP
              </div>

              <div style={styles.subtitle}>
                Withdrawal
              </div>
            </div>

            <div style={styles.headerSpacer} />
          </header>

          {/* BALANCE */}

          <section style={styles.balanceCard}>
            <div style={styles.balanceTop}>
              <div>
                <div style={styles.balanceLabel}>
                  Available Balance
                </div>

                <div style={styles.balance}>
                  ₹{balance.toFixed(2)}
                </div>

                <div style={styles.balanceHint}>
                  Minimum withdrawal: ₹20
                </div>
              </div>

              <div style={styles.balanceIcon}>
                💳
              </div>
            </div>
          </section>

          {/* WITHDRAW CARD */}

          <section style={styles.card}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.title}>
                  Withdraw Money
                </h2>

                <p style={styles.description}>
                  Choose your payment method and
                  submit a withdrawal request.
                </p>
              </div>
            </div>

            {/* SAVED ACCOUNTS */}

            {savedAccounts.length > 0 && (
              <div style={styles.savedSection}>
                <div style={styles.savedHeader}>
                  <div>
                    <div style={styles.savedTitle}>
                      Saved Payment Methods
                    </div>

                    <div
                      style={styles.savedSubtitle}
                    >
                      Your details are saved for
                      faster withdrawals.
                    </div>
                  </div>
                </div>

                <div style={styles.savedGrid}>
                  {savedAccounts.map(
                    (account) => (
                      <div
                        key={account.id}
                        style={{
                          ...styles.savedAccountCard,
                          ...(method ===
                          account.method
                            ? styles.savedAccountActive
                            : {}),
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            applySavedAccount(
                              account
                            )
                          }
                          style={
                            styles.savedAccountMain
                          }
                        >
                          <span
                            style={
                              styles.savedAccountIcon
                            }
                          >
                            {account.method ===
                            "upi"
                              ? "📱"
                              : "🏦"}
                          </span>

                          <span
                            style={
                              styles.savedAccountInfo
                            }
                          >
                            <strong>
                              {account.method ===
                              "upi"
                                ? "UPI"
                                : "Bank Account"}
                            </strong>

                            <span>
                              {account.account_name}
                            </span>

                            <span
                              style={
                                styles.savedAccountValue
                              }
                            >
                              {account.method ===
                              "upi"
                                ? account.upi_id
                                : `••••${(
                                    account.account_number ||
                                    ""
                                  ).slice(-4)}`}
                            </span>
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            editSavedAccount(
                              account
                            )
                          }
                          style={styles.editButton}
                        >
                          ✏️ Edit
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* PAYMENT METHODS */}

            <div style={styles.methodGrid}>
              <button
                type="button"
                onClick={() =>
                  selectMethod("upi")
                }
                style={{
                  ...styles.methodButton,
                  ...(method === "upi"
                    ? styles.methodActive
                    : {}),
                }}
              >
                <span
                  style={styles.methodIcon}
                >
                  📱
                </span>

                <span>UPI</span>

                {method === "upi" && (
                  <span
                    style={styles.selectedTick}
                  >
                    ✓
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  selectMethod("bank")
                }
                style={{
                  ...styles.methodButton,
                  ...(method === "bank"
                    ? styles.methodActive
                    : {}),
                }}
              >
                <span
                  style={styles.methodIcon}
                >
                  🏦
                </span>

                <span>Bank</span>

                {method === "bank" && (
                  <span
                    style={styles.selectedTick}
                  >
                    ✓
                  </span>
                )}
              </button>
            </div>

            {/* FORM */}

            <form
              onSubmit={submitWithdrawal}
            >
              <label style={styles.label}>
                Withdrawal Amount
              </label>

              <div style={styles.inputWrap}>
                <span style={styles.rupee}>
                  ₹
                </span>

                <input
                  type="number"
                  min={MIN_WITHDRAWAL}
                  max={balance}
                  step="1"
                  inputMode="numeric"
                  placeholder={`Enter amount (min ₹${MIN_WITHDRAWAL})`}
                  value={amount}
                  onChange={(e) =>
                    setAmount(
                      e.target.value
                    )
                  }
                  style={styles.amountInput}
                  disabled={submitting}
                />
              </div>

              <div
                style={styles.amountHint}
              >
                Minimum ₹20 • Maximum ₹
                {balance.toFixed(2)}
              </div>

              {/* UPI */}

              {method === "upi" ? (
                <>
                  <label
                    style={styles.label}
                  >
                    Account Holder Name
                  </label>

                  <input
                    type="text"
                    placeholder="Enter account holder name"
                    value={accountName}
                    onChange={(e) =>
                      setAccountName(
                        e.target.value
                      )
                    }
                    style={styles.input}
                    autoComplete="name"
                    disabled={submitting}
                  />

                  <label
                    style={styles.label}
                  >
                    UPI ID
                  </label>

                  <input
                    type="text"
                    placeholder="example@upi"
                    value={upiId}
                    onChange={(e) =>
                      setUpiId(
                        e.target.value
                      )
                    }
                    style={styles.input}
                    autoComplete="off"
                    disabled={submitting}
                  />
                </>
              ) : (
                <>
                  {/* BANK */}

                  <label
                    style={styles.label}
                  >
                    Account Holder Name
                  </label>

                  <input
                    type="text"
                    placeholder="Enter account holder name"
                    value={accountName}
                    onChange={(e) =>
                      setAccountName(
                        e.target.value
                      )
                    }
                    style={styles.input}
                    autoComplete="name"
                    disabled={submitting}
                  />

                  <label
                    style={styles.label}
                  >
                    Account Number
                  </label>

                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter account number"
                    value={accountNumber}
                    onChange={(e) =>
                      setAccountNumber(
                        e.target.value.replace(
                          /\D/g,
                          ""
                        )
                      )
                    }
                    style={styles.input}
                    autoComplete="off"
                    disabled={submitting}
                  />

                  <label
                    style={styles.label}
                  >
                    IFSC Code
                  </label>

                  <input
                    type="text"
                    placeholder="Example: SBIN0001234"
                    value={ifscCode}
                    onChange={(e) =>
                      setIfscCode(
                        e.target.value
                          .toUpperCase()
                          .replace(
                            /\s/g,
                            ""
                          )
                      )
                    }
                    style={styles.input}
                    autoComplete="off"
                    disabled={submitting}
                  />
                </>
              )}

              {/* MESSAGE */}

              {message && (
                <div
                  style={{
                    ...styles.message,
                    ...(messageType ===
                    "success"
                      ? styles.successMessage
                      : messageType ===
                        "error"
                      ? styles.errorMessage
                      : styles.infoMessage),
                  }}
                >
                  <span
                    style={
                      styles.messageIcon
                    }
                  >
                    {messageType ===
                    "success"
                      ? "✓"
                      : messageType ===
                        "error"
                      ? "!"
                      : "i"}
                  </span>

                  <span>{message}</span>
                </div>
              )}

              {/* EDIT NOTE */}

              {editingAccount && (
                <div
                  style={styles.editingNote}
                >
                  ✏️ Editing saved{" "}
                  {method === "upi"
                    ? "UPI"
                    : "bank"}{" "}
                  details. Save the changes
                  below.
                </div>
              )}

              {/* SUBMIT */}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  ...styles.submitButton,
                  opacity: submitting
                    ? 0.65
                    : 1,
                }}
              >
                {submitting ? (
                  <span
                    style={
                      styles.buttonLoading
                    }
                  >
                    <span
                      style={styles.smallLoader}
                    />
                    {editingAccount
                      ? "Saving..."
                      : "Submitting..."}
                  </span>
                ) : editingAccount ? (
                  "Save Changes"
                ) : (
                  "Request Withdrawal"
                )}
              </button>

              {/* CANCEL EDIT */}

              {editingAccount && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAccount(
                      false
                    );
                    setMessage("");

                    const saved =
                      savedAccounts.find(
                        (account) =>
                          account.method ===
                          method
                      );

                    if (saved) {
                      applySavedAccount(
                        saved
                      );
                    }
                  }}
                  style={
                    styles.cancelEditButton
                  }
                >
                  Cancel Edit
                </button>
              )}
            </form>
          </section>

          {/* RECENT WITHDRAWALS */}

          <section style={styles.card}>
            <div
              style={
                styles.historyHeader
              }
            >
              <div>
                <h2 style={styles.title}>
                  Recent Withdrawals
                </h2>

                <p
                  style={
                    styles.historySubtitle
                  }
                >
                  Your latest withdrawal
                  requests and their status.
                </p>
              </div>

              {withdrawals.length > 0 && (
                <div
                  style={
                    styles.liveBadge
                  }
                >
                  <span
                    style={
                      styles.liveDot
                    }
                  />
                  Live
                </div>
              )}
            </div>

            {withdrawals.length === 0 ? (
              <div style={styles.empty}>
                <div
                  style={styles.emptyIcon}
                >
                  💸
                </div>

                <strong>
                  No withdrawals yet
                </strong>

                <p>
                  Your withdrawal requests
                  will appear here.
                </p>
              </div>
            ) : (
              <div
                style={
                  styles.historyList
                }
              >
                {withdrawals.map(
                  (item, index) => {
                    const state =
                      getStatus(
                        item.status
                      );

                    return (
                      <div
                        key={item.id}
                        style={{
                          ...styles.historyRow,
                          animationDelay: `${
                            index * 40
                          }ms`,
                        }}
                      >
                        <div
                          style={
                            styles.historyLeft
                          }
                        >
                          <div
                            style={{
                              ...styles.historyIcon,
                              ...statusIconStyle(
                                item.status
                              ),
                            }}
                          >
                            {state.icon}
                          </div>

                          <div>
                            <strong
                              style={
                                styles.historyAmount
                              }
                            >
                              ₹
                              {Number(
                                item.amount
                              ).toFixed(2)}
                            </strong>

                            <div
                              style={
                                styles.historyDate
                              }
                            >
                              {String(
                                item.method
                              ).toUpperCase()}{" "}
                              •{" "}
                              {new Date(
                                item.created_at
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

                        <span
                          style={{
                            ...styles.status,
                            ...statusStyle(
                              item.status
                            ),
                          }}
                        >
                          {state.label}
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>

          <footer style={styles.footer}>
            <div style={styles.footerBrand}>
              AURA CAMP
            </div>

            <div>
              Secure Withdrawal •
              Payments Protected
            </div>
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
  }

  body {
    margin: 0;
    padding: 0;
    background: #f4f9fb;
    color: #101827;
  }

  button,
  input {
    font-family: inherit;
  }

  button {
    -webkit-tap-highlight-color: transparent;
  }

  input:focus {
    border-color: #173bff !important;
    box-shadow: 0 0 0 3px rgba(23,59,255,.08);
  }

  button:active {
    transform: scale(.98);
  }

  @keyframes fadeUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: .45;
    }

    50% {
      opacity: 1;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes historyIn {
    from {
      opacity: 0;
      transform: translateY(6px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 480px) {
    .withdraw-container {
      width: 100%;
    }
  }
`;

/* =========================================================
   STYLES
========================================================= */

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: "100vh",
    position: "relative",
    overflowX: "hidden",
    background:
      "linear-gradient(180deg,#f2fbfd 0%,#f7f9ff 48%,#f4f8fb 100%)",
    padding:
      "20px 14px 46px",
    fontFamily:
      "Georgia, 'Times New Roman', serif",
    color: "#101827",
  },

  backgroundGlowOne: {
    position: "fixed",
    width: "260px",
    height: "260px",
    borderRadius: "50%",
    background:
      "rgba(56,189,248,.08)",
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
    background:
      "rgba(99,102,241,.06)",
    filter: "blur(80px)",
    bottom: "-130px",
    right: "-130px",
    pointerEvents: "none",
  },

  container: {
    width: "100%",
    maxWidth: "650px",
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
  },

  loadingBox: {
    minHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "14px",
  },

  loadingLogo: {
    fontSize: "28px",
    letterSpacing: "-1px",
    fontWeight: 700,
  },

  loadingLogoSpan: {
    color: "#1c9b61",
  },

  loader: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    border:
      "3px solid rgba(23,59,255,.15)",
    borderTopColor: "#173bff",
    animation:
      "spin .8s linear infinite",
  },

  smallLoader: {
    width: "15px",
    height: "15px",
    borderRadius: "50%",
    border:
      "2px solid rgba(255,255,255,.35)",
    borderTopColor: "#fff",
    animation:
      "spin .7s linear infinite",
  },

  loadingText: {
    color: "#7b8794",
    fontSize: "13px",
  },

  header: {
    background:
      "linear-gradient(135deg,#101827,#152237)",
    color: "#fff",
    borderRadius: "22px",
    padding: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: "78px",
    marginBottom: "16px",
    boxShadow:
      "0 15px 35px rgba(16,24,39,.12)",
    animation:
      "fadeUp .45s ease both",
  },

  headerCenter: {
    textAlign: "center",
    flex: 1,
  },

  headerSpacer: {
    width: "72px",
  },

  backButton: {
    width: "72px",
    background:
      "rgba(255,255,255,.04)",
    border:
      "1px solid rgba(255,255,255,.25)",
    color: "#fff",
    borderRadius: "12px",
    padding: "10px 7px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 700,
  },

  brand: {
    fontSize: "22px",
    fontWeight: 700,
    letterSpacing: ".3px",
  },

  subtitle: {
    fontSize: "12px",
    opacity: .7,
    marginTop: "3px",
  },

  balanceCard: {
    background:
      "linear-gradient(135deg,#102f43 0%,#105d62 52%,#13795c 100%)",
    color: "#fff",
    borderRadius: "25px",
    padding: "25px",
    marginBottom: "16px",
    boxShadow:
      "0 18px 38px rgba(16,59,67,.18)",
    overflow: "hidden",
    position: "relative",
    animation:
      "fadeUp .5s ease .05s both",
  },

  balanceTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
  },

  balanceLabel: {
    fontSize: "15px",
    opacity: .8,
    marginBottom: "7px",
  },

  balance: {
    fontSize: "40px",
    fontWeight: 700,
    lineHeight: 1.05,
    letterSpacing: "-1px",
  },

  balanceHint: {
    fontSize: "13px",
    opacity: .72,
    marginTop: "10px",
  },

  balanceIcon: {
    width: "62px",
    height: "62px",
    borderRadius: "20px",
    background:
      "rgba(255,255,255,.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "27px",
    flexShrink: 0,
  },

  card: {
    background:
      "rgba(255,255,255,.94)",
    border:
      "1px solid rgba(213,225,229,.9)",
    borderRadius: "24px",
    padding: "21px",
    marginBottom: "16px",
    boxShadow:
      "0 9px 28px rgba(30,55,70,.055)",
    animation:
      "fadeUp .5s ease .1s both",
  },

  sectionHeader: {
    marginBottom: "4px",
  },

  title: {
    margin: 0,
    fontSize: "25px",
    fontWeight: 700,
    letterSpacing: "-.5px",
  },

  description: {
    color: "#77828c",
    fontSize: "13px",
    lineHeight: 1.55,
    margin:
      "7px 0 0",
    fontFamily:
      "Georgia, 'Times New Roman', serif",
  },

  savedSection: {
    marginTop: "18px",
    marginBottom: "5px",
    padding: "14px",
    background:
      "linear-gradient(135deg,#f8fbfc,#f8faff)",
    border:
      "1px solid #e3e9ed",
    borderRadius: "17px",
  },

  savedHeader: {
    marginBottom: "11px",
  },

  savedTitle: {
    fontSize: "14px",
    fontWeight: 800,
    color: "#182333",
  },

  savedSubtitle: {
    marginTop: "3px",
    fontSize: "11px",
    color: "#7d8790",
    lineHeight: 1.4,
  },

  savedGrid: {
    display: "grid",
    gap: "9px",
  },

  savedAccountCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    background: "#fff",
    border:
      "1px solid #e5e9ee",
    borderRadius: "13px",
    padding: "9px",
    transition:
      "all .2s ease",
  },

  savedAccountActive: {
    border:
      "2px solid #173bff",
    background: "#f2f5ff",
  },

  savedAccountMain: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "9px",
    border: "none",
    background: "transparent",
    padding: 0,
    textAlign: "left",
    cursor: "pointer",
  },

  savedAccountIcon: {
    width: "39px",
    height: "39px",
    borderRadius: "11px",
    background: "#f1f5f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: "19px",
  },

  savedAccountInfo: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    fontSize: "12px",
  },

  savedAccountValue: {
    color: "#78838e",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "185px",
  },

  editButton: {
    flexShrink: 0,
    border:
      "1px solid #cbd8ff",
    background: "#eef2ff",
    color: "#173bff",
    borderRadius: "10px",
    padding: "8px 10px",
    fontSize: "11px",
    fontWeight: 800,
    cursor: "pointer",
  },

  methodGrid: {
    display: "grid",
    gridTemplateColumns:
      "1fr 1fr",
    gap: "10px",
    margin:
      "20px 0 18px",
  },

  methodButton: {
    minHeight: "82px",
    position: "relative",
    background: "#fafbfd",
    border:
      "1px solid #e2e7ec",
    borderRadius: "15px",
    padding: "12px",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    color: "#202936",
    fontSize: "14px",
  },

  methodActive: {
    background:
      "linear-gradient(135deg,#eef3ff,#f5f7ff)",
    border:
      "2px solid #173bff",
    color: "#173bff",
    boxShadow:
      "0 7px 20px rgba(23,59,255,.08)",
  },

  methodIcon: {
    fontSize: "23px",
    lineHeight: 1,
  },

  selectedTick: {
    position: "absolute",
    top: "7px",
    right: "8px",
    width: "19px",
    height: "19px",
    borderRadius: "50%",
    background: "#173bff",
    color: "#fff",
    fontSize: "11px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 700,
    margin:
      "15px 0 7px",
    color: "#26313e",
  },

  inputWrap: {
    display: "flex",
    alignItems: "center",
    border:
      "1px solid #d5dbe1",
    borderRadius: "13px",
    overflow: "hidden",
    background: "#fff",
    transition:
      "all .2s ease",
  },

  rupee: {
    paddingLeft: "14px",
    fontWeight: 700,
    color: "#697580",
    fontSize: "18px",
  },

  amountInput: {
    width: "100%",
    border: "none",
    outline: "none",
    padding: "14px 12px",
    fontSize: "17px",
    background: "transparent",
    color: "#101827",
    fontFamily:
      "Georgia, 'Times New Roman', serif",
  },

  amountHint: {
    marginTop: "6px",
    fontSize: "11px",
    color: "#89939c",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border:
      "1px solid #d5dbe1",
    borderRadius: "13px",
    padding: "14px",
    fontSize: "14px",
    outline: "none",
    background: "#fff",
    color: "#101827",
    transition:
      "all .2s ease",
  },

  message: {
    marginTop: "15px",
    padding: "12px 13px",
    borderRadius: "12px",
    fontSize: "12px",
    lineHeight: 1.45,
    display: "flex",
    alignItems: "center",
    gap: "9px",
    animation:
      "fadeIn .25s ease both",
  },

  messageIcon: {
    width: "21px",
    height: "21px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontWeight: 800,
  },

  successMessage: {
    color: "#166534",
    background: "#ecfdf5",
    border:
      "1px solid #bbf7d0",
  },

  errorMessage: {
    color: "#b91c1c",
    background: "#fef2f2",
    border:
      "1px solid #fecaca",
  },

  infoMessage: {
    color: "#3730a3",
    background: "#eef2ff",
    border:
      "1px solid #c7d2fe",
  },

  editingNote: {
    marginTop: "12px",
    padding: "11px 12px",
    borderRadius: "11px",
    background: "#fff7ed",
    border:
      "1px solid #fed7aa",
    color: "#9a3412",
    fontSize: "11px",
    lineHeight: 1.45,
  },

  submitButton: {
    width: "100%",
    marginTop: "18px",
    minHeight: "50px",
    background:
      "linear-gradient(135deg,#101827,#16283b)",
    color: "#fff",
    border: "none",
    borderRadius: "13px",
    padding: "14px",
    fontWeight: 700,
    fontSize: "15px",
    cursor: "pointer",
    boxShadow:
      "0 10px 22px rgba(16,24,39,.15)",
    transition:
      "all .2s ease",
  },

  buttonLoading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "9px",
  },

  cancelEditButton: {
    width: "100%",
    marginTop: "9px",
    background: "transparent",
    color: "#6b7280",
    border:
      "1px solid #e1e5e9",
    borderRadius: "12px",
    padding: "12px",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
  },

  historyHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
    marginBottom: "10px",
  },

  historySubtitle: {
    margin:
      "6px 0 0",
    color: "#7b8791",
    fontSize: "12px",
    lineHeight: 1.45,
  },

  liveBadge: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: "5px 8px",
    borderRadius: "20px",
    background: "#ecfdf5",
    border:
      "1px solid #bbf7d0",
    color: "#15803d",
    fontSize: "10px",
    fontWeight: 800,
    flexShrink: 0,
  },

  liveDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#22c55e",
    animation:
      "pulse 1.5s ease-in-out infinite",
  },

  historyList: {
    marginTop: "8px",
  },

  historyRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    padding: "14px 0",
    borderBottom:
      "1px solid #edf0f3",
    animation:
      "historyIn .3s ease both",
  },

  historyLeft: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "11px",
  },

  historyIcon: {
    width: "38px",
    height: "38px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "15px",
    fontWeight: 900,
    flexShrink: 0,
  },

  historyAmount: {
    fontSize: "17px",
    display: "block",
  },

  historyDate: {
    color: "#929ca5",
    fontSize: "10px",
    marginTop: "4px",
    fontFamily:
      "Arial, sans-serif",
  },

  status: {
    padding: "6px 9px",
    borderRadius: "20px",
    fontSize: "10px",
    fontWeight: 800,
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "65px",
    fontFamily:
      "Arial, sans-serif",
  },

  empty: {
    textAlign: "center",
    color: "#707b85",
    padding:
      "28px 10px 18px",
  },

  emptyIcon: {
    width: "55px",
    height: "55px",
    borderRadius: "18px",
    margin:
      "0 auto 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f3f5f8",
    fontSize: "27px",
  },

  footer: {
    textAlign: "center",
    color: "#9aa3ab",
    fontSize: "10px",
    lineHeight: 1.6,
    padding:
      "4px 10px 10px",
    fontFamily:
      "Arial, sans-serif",
  },

  footerBrand: {
    fontWeight: 800,
    letterSpacing: "1px",
    color: "#78838d",
    marginBottom: "2px",
  },
};
