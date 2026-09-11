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
      flowType: "pkce",
    },
  }
);

const MIN_WITHDRAWAL = 20;

type Withdrawal = {
  id: string;
  amount: number;
  method: string;
  status: string;
  created_at: string;
};

type SavedAccount = {
  id: string;
  method: "upi" | "bank";
  account_name: string;
  upi_id: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  is_default: boolean;
};

export default function WithdrawPage() {
  const [balance, setBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  const [method, setMethod] =
    useState<"upi" | "bank">("upi");

  const [amount, setAmount] = useState("");

  const [upiId, setUpiId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [savingAccount, setSavingAccount] =
    useState(false);

  const [editingAccount, setEditingAccount] =
    useState(false);

  const [pageLoading, setPageLoading] =
    useState(true);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState<"success" | "error">("success");

  useEffect(() => {
    let mounted = true;

    async function start() {
      await loadWithdrawalData(mounted);

      if (!mounted) return;

      setPageLoading(false);
    }

    start();

    return () => {
      mounted = false;
    };
  }, []);

  /*
   * REALTIME WITHDRAWAL STATUS
   */
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
        .channel(`auracamp-withdrawals-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "withdrawals",
            filter: `user_id=eq.${user.id}`,
          },
          async () => {
            await Promise.all([
              loadWithdrawals(user.id),
              loadBalance(user.id),
            ]);
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

  /*
   * REALTIME WALLET BALANCE
   */
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
        .channel(`auracamp-profile-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            const next = payload.new as {
              wallet_balance?: number;
            };

            if (
              typeof next.wallet_balance !==
              "undefined"
            ) {
              setBalance(
                Number(next.wallet_balance || 0)
              );
            }
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

  async function loadWithdrawalData(
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

      const [
        profileResult,
        withdrawalResult,
        accountResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("wallet_balance")
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("withdrawals")
          .select(
            "id,amount,method,status,created_at"
          )
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          })
          .limit(20),

        supabase
          .from("withdrawal_accounts")
          .select(
            "id,method,account_name,upi_id,bank_name,account_number,ifsc_code,is_default"
          )
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: true,
          }),
      ]);

      if (!mounted) return;

      if (profileResult.data) {
        setBalance(
          Number(
            profileResult.data.wallet_balance || 0
          )
        );
      }

      setWithdrawals(
        withdrawalResult.data || []
      );

      if (!accountResult.error) {
        const accounts =
          accountResult.data || [];

        setSavedAccounts(accounts);

        const current = accounts.find(
          (item) =>
            item.method === method
        );

        if (current) {
          loadAccountIntoForm(current);
        }
      }
    } catch (error) {
      console.error(
        "Withdrawal page error:",
        error
      );
    }
  }

  async function loadBalance(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("wallet_balance")
      .eq("id", userId)
      .maybeSingle();

    if (data) {
      setBalance(
        Number(data.wallet_balance || 0)
      );
    }
  }

  async function loadWithdrawals(userId: string) {
    const { data, error } = await supabase
      .from("withdrawals")
      .select(
        "id,amount,method,status,created_at"
      )
      .eq("user_id", userId)
      .order("created_at", {
        ascending: false,
      })
      .limit(20);

    if (!error) {
      setWithdrawals(data || []);
    }
  }

  function loadAccountIntoForm(
    account: SavedAccount
  ) {
    setAccountName(
      account.account_name || ""
    );

    if (account.method === "upi") {
      setUpiId(account.upi_id || "");
      setBankName("");
      setAccountNumber("");
      setIfscCode("");
    } else {
      setUpiId("");
      setBankName(
        account.bank_name || ""
      );
      setAccountNumber(
        account.account_number || ""
      );
      setIfscCode(
        account.ifsc_code || ""
      );
    }

    setEditingAccount(false);
  }

  function clearPaymentForm() {
    setAccountName("");
    setUpiId("");
    setBankName("");
    setAccountNumber("");
    setIfscCode("");
  }

  function handleMethodChange(
    nextMethod: "upi" | "bank"
  ) {
    setMethod(nextMethod);
    setMessage("");
    setEditingAccount(false);

    const saved = savedAccounts.find(
      (account) =>
        account.method === nextMethod
    );

    if (saved) {
      loadAccountIntoForm(saved);
    } else {
      clearPaymentForm();
    }
  }

  async function savePaymentAccount() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.replace("/login");
      return;
    }

    if (!accountName.trim()) {
      showMessage(
        "Please enter account holder name.",
        "error"
      );
      return;
    }

    if (
      method === "upi" &&
      !upiId.trim()
    ) {
      showMessage(
        "Please enter your UPI ID.",
        "error"
      );
      return;
    }

    if (
      method === "bank" &&
      (
        !bankName.trim() ||
        !accountNumber.trim() ||
        !ifscCode.trim()
      )
    ) {
      showMessage(
        "Please complete all bank details.",
        "error"
      );
      return;
    }

    setSavingAccount(true);
    setMessage("");

    try {
      const accountData = {
        user_id: user.id,
        method,
        account_name:
          accountName.trim(),

        upi_id:
          method === "upi"
            ? upiId.trim()
            : null,

        bank_name:
          method === "bank"
            ? bankName.trim()
            : null,

        account_number:
          method === "bank"
            ? accountNumber.trim()
            : null,

        ifsc_code:
          method === "bank"
            ? ifscCode
                .trim()
                .toUpperCase()
            : null,

        is_default: true,
      };

      const { data, error } =
        await supabase
          .from("withdrawal_accounts")
          .upsert(accountData, {
            onConflict:
              "user_id,method",
          })
          .select(
            "id,method,account_name,upi_id,bank_name,account_number,ifsc_code,is_default"
          )
          .single();

      if (error) {
        console.error(error);

        showMessage(
          error.message,
          "error"
        );

        return;
      }

      setSavedAccounts(
        (previous) => {
          const filtered =
            previous.filter(
              (item) =>
                item.method !== method
            );

          return [...filtered, data];
        }
      );

      setEditingAccount(false);

      showMessage(
        method === "upi"
          ? "UPI details saved successfully."
          : "Bank details saved successfully.",
        "success"
      );
    } catch (error) {
      console.error(error);

      showMessage(
        "Unable to save payment details.",
        "error"
      );
    } finally {
      setSavingAccount(false);
    }
  }

  async function submitWithdrawal(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setMessage("");

    const numericAmount =
      Number(amount);

    /* ₹20 MINIMUM */

    if (
      !numericAmount ||
      numericAmount < MIN_WITHDRAWAL
    ) {
      showMessage(
        `Minimum withdrawal amount is ₹${MIN_WITHDRAWAL}.`,
        "error"
      );
      return;
    }

    if (numericAmount > balance) {
      showMessage(
        "Insufficient wallet balance.",
        "error"
      );
      return;
    }

    if (!accountName.trim()) {
      showMessage(
        "Please enter account holder name.",
        "error"
      );
      return;
    }

    if (
      method === "upi" &&
      !upiId.trim()
    ) {
      showMessage(
        "Please enter your UPI ID.",
        "error"
      );
      return;
    }

    if (
      method === "bank" &&
      (
        !bankName.trim() ||
        !accountNumber.trim() ||
        !ifscCode.trim()
      )
    ) {
      showMessage(
        "Please complete all bank details.",
        "error"
      );
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.replace("/login");
        return;
      }

      /*
       * SAVE PAYMENT ACCOUNT
       */

      const paymentData = {
        user_id: user.id,
        method,
        account_name:
          accountName.trim(),

        upi_id:
          method === "upi"
            ? upiId.trim()
            : null,

        bank_name:
          method === "bank"
            ? bankName.trim()
            : null,

        account_number:
          method === "bank"
            ? accountNumber.trim()
            : null,

        ifsc_code:
          method === "bank"
            ? ifscCode
                .trim()
                .toUpperCase()
            : null,

        is_default: true,
      };

      const { error: saveError } =
        await supabase
          .from("withdrawal_accounts")
          .upsert(paymentData, {
            onConflict:
              "user_id,method",
          });

      if (saveError) {
        console.error(saveError);

        showMessage(
          "Unable to save payment details. Withdrawal was not submitted.",
          "error"
        );

        return;
      }

      /*
       * REQUEST WITHDRAWAL
       */

      const { error } =
        await supabase.rpc(
          "request_withdrawal",
          {
            p_amount:
              numericAmount,

            p_method:
              method,

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
          "Withdrawal RPC error:",
          error
        );

        showMessage(
          error.message,
          "error"
        );

        return;
      }

      showMessage(
        "Withdrawal request submitted successfully.",
        "success"
      );

      /*
       * Keep saved payment details.
       * Only clear amount.
       */

      setAmount("");

      /*
       * Immediately refresh.
       * Realtime will also update it.
       */

      await Promise.all([
        loadWithdrawals(user.id),
        loadBalance(user.id),
      ]);
    } catch (error) {
      console.error(error);

      showMessage(
        "Something went wrong. Please try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  function showMessage(
    text: string,
    type: "success" | "error"
  ) {
    setMessage(text);
    setMessageType(type);
  }

  function getStatusInfo(status: string) {
    const value =
      status.toLowerCase().trim();

    if (
      value === "paid" ||
      value === "approved" ||
      value === "success" ||
      value === "completed"
    ) {
      return {
        label: "Paid",
        icon: "✓",
        className: "statusPaid",
      };
    }

    if (
      value === "rejected" ||
      value === "failed" ||
      value === "cancelled"
    ) {
      return {
        label: "Rejected",
        icon: "×",
        className: "statusRejected",
      };
    }

    return {
      label:
        value === "processing"
          ? "Processing"
          : "Pending",
      icon: "◷",
      className: "statusPending",
    };
  }

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

  function formatTime(
    value: string
  ) {
    return new Date(
      value
    ).toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  const savedCurrentAccount =
    savedAccounts.find(
      (account) =>
        account.method === method
    );

  const isSuccess =
    messageType === "success";

  if (pageLoading) {
    return (
      <>
        <style>{styles}</style>

        <main className="loadingPage">
          <div className="loadingCard">
            <div className="loadingBrand">
              <span>AURA</span>{" "}
              <b>CAMP</b>
            </div>

            <div className="loadingSpinner" />

            <p>
              Preparing secure withdrawal...
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>

      <main className="page">

        <div className="glow glowOne" />
        <div className="glow glowTwo" />

        <div className="container">

          {/* HEADER */}

          <header className="header">

            <button
              type="button"
              className="backButton"
              onClick={() =>
                window.location.replace("/")
              }
            >
              <span>←</span>
              Back
            </button>

            <div className="headerCenter">
              <div className="brand">
                <span>AURA</span>{" "}
                <b>CAMP</b>
              </div>

              <div className="subtitle">
                Secure Withdrawal
              </div>
            </div>

            <div className="headerShield">
              🔒
            </div>

          </header>

          {/* BALANCE */}

          <section className="balanceCard">

            <div className="balanceTop">
              <div>
                <span className="balanceLabel">
                  Available Balance
                </span>

                <strong className="balance">
                  ₹{balance.toFixed(2)}
                </strong>
              </div>

              <div className="balanceIcon">
                ₹
              </div>
            </div>

            <div className="balanceBottom">

              <span>
                Minimum withdrawal
                <strong>
                  ₹{MIN_WITHDRAWAL}
                </strong>
              </span>

              <span className="walletReady">
                ● Wallet Ready
              </span>

            </div>

          </section>

          {/* WITHDRAW */}

          <section className="card">

            <div className="cardHeading">
              <div className="headingIcon">
                💸
              </div>

              <div>
                <h2>
                  Withdraw Money
                </h2>

                <p>
                  Choose your payment method
                  and withdraw your earnings.
                </p>
              </div>
            </div>

            {/* METHODS */}

            <div className="methodGrid">

              <button
                type="button"
                className={
                  method === "upi"
                    ? "methodButton active"
                    : "methodButton"
                }
                onClick={() =>
                  handleMethodChange("upi")
                }
              >
                <span className="methodIcon">
                  📱
                </span>

                <span className="methodName">
                  UPI
                </span>

                <small>
                  Instant payout
                </small>
              </button>

              <button
                type="button"
                className={
                  method === "bank"
                    ? "methodButton active"
                    : "methodButton"
                }
                onClick={() =>
                  handleMethodChange("bank")
                }
              >
                <span className="methodIcon">
                  🏦
                </span>

                <span className="methodName">
                  Bank
                </span>

                <small>
                  Direct transfer
                </small>
              </button>

            </div>

            {/* SAVED ACCOUNT */}

            {savedCurrentAccount &&
              !editingAccount && (
                <div className="savedAccount">

                  <div className="savedTop">

                    <div className="savedTitleWrap">
                      <div className="savedIcon">
                        {method === "upi"
                          ? "📱"
                          : "🏦"}
                      </div>

                      <div>
                        <strong>
                          Saved{" "}
                          {method === "upi"
                            ? "UPI"
                            : "Bank"}{" "}
                          Account
                        </strong>

                        <span>
                          Ready for withdrawal
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="editButton"
                      onClick={() =>
                        setEditingAccount(true)
                      }
                    >
                      ✏️ Edit
                    </button>

                  </div>

                  <div className="savedDetails">

                    <div>
                      <span>
                        Account Name
                      </span>

                      <strong>
                        {
                          savedCurrentAccount.account_name
                        }
                      </strong>
                    </div>

                    {method === "upi" ? (
                      <div>
                        <span>
                          UPI ID
                        </span>

                        <strong>
                          {
                            savedCurrentAccount.upi_id
                          }
                        </strong>
                      </div>
                    ) : (
                      <>
                        <div>
                          <span>
                            Bank
                          </span>

                          <strong>
                            {
                              savedCurrentAccount.bank_name
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            Account Number
                          </span>

                          <strong>
                            {
                              savedCurrentAccount.account_number
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            IFSC
                          </span>

                          <strong>
                            {
                              savedCurrentAccount.ifsc_code
                            }
                          </strong>
                        </div>
                      </>
                    )}

                  </div>

                </div>
              )}

            <form
              onSubmit={submitWithdrawal}
            >

              {/* AMOUNT */}

              <label className="label">
                Withdrawal Amount
              </label>

              <div className="amountWrap">

                <span>₹</span>

                <input
                  type="number"
                  min={MIN_WITHDRAWAL}
                  step="1"
                  inputMode="numeric"
                  placeholder={`Minimum ₹${MIN_WITHDRAWAL}`}
                  value={amount}
                  onChange={(e) =>
                    setAmount(
                      e.target.value
                    )
                  }
                />

              </div>

              <div className="amountHint">
                You can withdraw up to ₹
                {balance.toFixed(2)}
              </div>

              {/* PAYMENT FORM */}

              {(!savedCurrentAccount ||
                editingAccount) && (
                <div className="paymentForm">

                  <div className="formTitle">
                    Payment Details
                  </div>

                  <label className="label">
                    Account Holder Name
                  </label>

                  <input
                    className="input"
                    type="text"
                    placeholder="Enter account holder name"
                    value={accountName}
                    onChange={(e) =>
                      setAccountName(
                        e.target.value
                      )
                    }
                  />

                  {method === "upi" ? (
                    <>
                      <label className="label">
                        UPI ID
                      </label>

                      <input
                        className="input"
                        type="text"
                        placeholder="example@upi"
                        value={upiId}
                        onChange={(e) =>
                          setUpiId(
                            e.target.value
                          )
                        }
                      />
                    </>
                  ) : (
                    <>
                      <label className="label">
                        Bank Name
                      </label>

                      <input
                        className="input"
                        type="text"
                        placeholder="Enter bank name"
                        value={bankName}
                        onChange={(e) =>
                          setBankName(
                            e.target.value
                          )
                        }
                      />

                      <label className="label">
                        Account Number
                      </label>

                      <input
                        className="input"
                        type="text"
                        inputMode="numeric"
                        placeholder="Enter account number"
                        value={accountNumber}
                        onChange={(e) =>
                          setAccountNumber(
                            e.target.value
                          )
                        }
                      />

                      <label className="label">
                        IFSC Code
                      </label>

                      <input
                        className="input"
                        type="text"
                        placeholder="SBIN0001234"
                        value={ifscCode}
                        onChange={(e) =>
                          setIfscCode(
                            e.target.value
                              .toUpperCase()
                          )
                        }
                      />
                    </>
                  )}

                  <button
                    type="button"
                    className="saveButton"
                    disabled={savingAccount}
                    onClick={
                      savePaymentAccount
                    }
                  >
                    {savingAccount
                      ? "Saving..."
                      : editingAccount
                      ? "Save Changes"
                      : "Save Payment Details"}
                  </button>

                  {editingAccount && (
                    <button
                      type="button"
                      className="cancelButton"
                      onClick={() => {
                        if (
                          savedCurrentAccount
                        ) {
                          loadAccountIntoForm(
                            savedCurrentAccount
                          );
                        } else {
                          setEditingAccount(
                            false
                          );
                        }
                      }}
                    >
                      Cancel
                    </button>
                  )}

                </div>
              )}

              {/* MESSAGE */}

              {message && (
                <div
                  className={
                    isSuccess
                      ? "message success"
                      : "message error"
                  }
                >
                  <span>
                    {isSuccess
                      ? "✓"
                      : "!"}
                  </span>

                  {message}
                </div>
              )}

              {/* SUBMIT */}

              <button
                type="submit"
                disabled={loading}
                className="submitButton"
              >
                <span>
                  {loading
                    ? "Submitting Request..."
                    : "Request Withdrawal"}
                </span>

                {!loading && (
                  <span>→</span>
                )}
              </button>

            </form>

          </section>

          {/* HISTORY */}

          <section className="card historyCard">

            <div className="historyHeading">

              <div>
                <h2>
                  Recent Withdrawals
                </h2>

                <p>
                  Track your withdrawal
                  requests in real time.
                </p>
              </div>

              <div className="liveBadge">
                <i />
                Live
              </div>

            </div>

            {withdrawals.length === 0 ? (
              <div className="empty">

                <div className="emptyIcon">
                  💸
                </div>

                <h3>
                  No withdrawals yet
                </h3>

                <p>
                  Your withdrawal requests
                  will appear here.
                </p>

              </div>
            ) : (
              <div className="historyList">

                {withdrawals.map((item) => {
                  const status =
                    getStatusInfo(
                      item.status
                    );

                  return (
                    <div
                      key={item.id}
                      className="historyItem"
                    >

                      <div className="historyLeft">

                        <div className="historyIcon">
                          {item.method
                            .toLowerCase() ===
                          "upi"
                            ? "📱"
                            : "🏦"}
                        </div>

                        <div className="historyInfo">

                          <strong>
                            ₹
                            {Number(
                              item.amount
                            ).toFixed(2)}
                          </strong>

                          <span>
                            {item.method.toUpperCase()}
                            {" • "}
                            {formatDate(
                              item.created_at
                            )}
                            {" • "}
                            {formatTime(
                              item.created_at
                            )}
                          </span>

                        </div>

                      </div>

                      <span
                        className={`status ${status.className}`}
                      >
                        <i>
                          {status.icon}
                        </i>

                        {status.label}
                      </span>

                    </div>
                  );
                })}

              </div>
            )}

          </section>

          {/* SECURITY NOTE */}

          <div className="securityNote">
            <span>🔐</span>

            <div>
              <strong>
                Secure Withdrawal
              </strong>

              <p>
                Your payment details are
                protected and used only for
                processing your withdrawal.
              </p>
            </div>
          </div>

          <footer className="footer">
            AURA CAMP • Secure Withdrawal
          </footer>

        </div>

      </main>
    </>
  );
}

const styles = `
* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  min-height: 100%;
  overflow-x: hidden;
}

body {
  background: #edf5f7;
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

button {
  -webkit-tap-highlight-color: transparent;
}

button:active {
  transform: scale(.98);
}

/* =====================================
   PAGE
===================================== */

.page {
  position: relative;

  min-height: 100svh;

  width: 100%;

  padding:
    10px
    10px
    30px;

  overflow-x: hidden;

  background:
    linear-gradient(
      145deg,
      #effafb 0%,
      #f7fbff 55%,
      #faf7ff 100%
    );
}

.container {
  position: relative;
  z-index: 2;

  width: 100%;
  max-width: 560px;

  margin: 0 auto;
}

/* =====================================
   GLOW
===================================== */

.glow {
  position: fixed;

  width: 240px;
  height: 240px;

  border-radius: 50%;

  filter: blur(80px);

  pointer-events: none;

  z-index: 0;
}

.glowOne {
  top: -110px;
  left: -100px;

  background:
    rgba(37,99,235,.07);
}

.glowTwo {
  right: -130px;
  bottom: -130px;

  background:
    rgba(22,163,74,.055);
}

/* =====================================
   HEADER
===================================== */

.header {
  width: 100%;

  min-height: 72px;

  margin-bottom: 11px;

  padding: 11px 12px;

  display: grid;

  grid-template-columns:
    78px
    1fr
    48px;

  align-items: center;

  gap: 7px;

  border-radius: 22px;

  background:
    linear-gradient(
      145deg,
      #142331,
      #173847
    );

  color: white;

  box-shadow:
    0 13px 35px
    rgba(20,55,70,.17);

  animation:
    pageDown .45s ease both;
}

@keyframes pageDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.headerCenter {
  text-align: center;
}

.brand {
  font-family: Georgia, serif;

  font-size: 24px;

  line-height: 1;

  letter-spacing: -.8px;

  white-space: nowrap;
}

.brand span {
  color: #fff;
}

.brand b {
  color: #35b979;

  font-weight: 500;
}

.subtitle {
  margin-top: 4px;

  color:
    rgba(255,255,255,.68);

  font-family: Georgia, serif;

  font-size: 10px;
}

.backButton {
  height: 40px;

  display: flex;
  align-items: center;
  justify-content: center;

  gap: 6px;

  border:
    1px solid
    rgba(255,255,255,.25);

  border-radius: 12px;

  background:
    rgba(255,255,255,.04);

  color: white;

  font-family: Georgia, serif;

  font-size: 11px;

  cursor: pointer;
}

.backButton span {
  font-size: 15px;
}

.headerShield {
  width: 42px;
  height: 42px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 13px;

  background:
    rgba(255,255,255,.09);

  font-size: 15px;
}

/* =====================================
   BALANCE
===================================== */

.balanceCard {
  width: 100%;

  margin-bottom: 11px;

  padding: 20px;

  border-radius: 23px;

  color: white;

  background:
    linear-gradient(
      135deg,
      #14546a 0%,
      #126070 52%,
      #167352 100%
    );

  box-shadow:
    0 15px 35px
    rgba(17,84,102,.18);

  animation:
    cardUp .5s .04s ease both;
}

@keyframes cardUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.balanceTop {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;

  gap: 12px;
}

.balanceLabel {
  display: block;

  color:
    rgba(255,255,255,.76);

  font-family: Georgia, serif;

  font-size: 12px;
}

.balance {
  display: block;

  margin-top: 4px;

  font-family: Georgia, serif;

  font-size: 39px;

  line-height: 1;

  font-weight: 500;

  letter-spacing: -1.5px;
}

.balanceIcon {
  width: 48px;
  height: 48px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 15px;

  background:
    rgba(255,255,255,.12);

  font-family: Georgia, serif;

  font-size: 20px;
}

.balanceBottom {
  margin-top: 23px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 8px;

  font-family: Georgia, serif;

  font-size: 9px;

  color:
    rgba(255,255,255,.73);
}

.balanceBottom strong {
  margin-left: 4px;

  color: white;

  font-weight: 600;
}

.walletReady {
  padding: 6px 8px;

  border-radius: 999px;

  background:
    rgba(255,255,255,.10);

  color: #c8f7df;

  font-family:
    Inter,
    sans-serif;

  font-size: 7px;

  font-weight: 800;
}

/* =====================================
   CARD
===================================== */

.card {
  width: 100%;

  margin-bottom: 11px;

  padding: 17px;

  border:
    1px solid #dfe8eb;

  border-radius: 22px;

  background:
    rgba(255,255,255,.97);

  box-shadow:
    0 9px 27px
    rgba(20,60,80,.055);

  animation:
    cardUp .5s .08s ease both;
}

.cardHeading {
  display: flex;
  align-items: center;

  gap: 10px;

  margin-bottom: 14px;
}

.headingIcon {
  width: 43px;
  height: 43px;

  min-width: 43px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 14px;

  background:
    linear-gradient(
      135deg,
      #edf4ff,
      #ecfdf5
    );

  font-size: 18px;
}

.cardHeading h2,
.historyHeading h2 {
  margin: 0;

  font-family: Georgia, serif;

  font-size: 20px;

  font-weight: 500;

  color: #111827;
}

.cardHeading p,
.historyHeading p {
  margin: 4px 0 0;

  color: #7b8790;

  font-family: Georgia, serif;

  font-size: 9px;

  line-height: 1.4;
}

/* =====================================
   METHOD
===================================== */

.methodGrid {
  display: grid;

  grid-template-columns:
    repeat(2, minmax(0,1fr));

  gap: 9px;

  margin-bottom: 13px;
}

.methodButton {
  min-width: 0;

  min-height: 88px;

  padding: 11px;

  display: flex;
  flex-direction: column;

  align-items: center;
  justify-content: center;

  border:
    1px solid #e1e8eb;

  border-radius: 17px;

  background: #f9fbfc;

  color: #374151;

  cursor: pointer;

  transition:
    transform .18s ease,
    border-color .18s ease,
    background .18s ease,
    box-shadow .18s ease;
}

.methodButton.active {
  border:
    2px solid #1b65e8;

  background:
    linear-gradient(
      145deg,
      #f0f5ff,
      #f3fbff
    );

  color: #155eef;

  box-shadow:
    0 8px 22px
    rgba(37,99,235,.10);
}

.methodIcon {
  font-size: 23px;

  line-height: 1;
}

.methodName {
  margin-top: 6px;

  font-family: Georgia, serif;

  font-size: 12px;

  font-weight: 600;
}

.methodButton small {
  margin-top: 3px;

  color: #9aa6ae;

  font-size: 7px;
}

/* =====================================
   SAVED ACCOUNT
===================================== */

.savedAccount {
  margin-bottom: 15px;

  padding: 13px;

  border:
    1px solid #bcebd0;

  border-radius: 17px;

  background:
    linear-gradient(
      145deg,
      #f0fff6,
      #f8fffb
    );

  animation:
    fadeIn .25s ease both;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.savedTop {
  display: flex;

  align-items: center;
  justify-content: space-between;

  gap: 8px;

  margin-bottom: 10px;
}

.savedTitleWrap {
  min-width: 0;

  display: flex;
  align-items: center;

  gap: 8px;
}

.savedIcon {
  width: 37px;
  height: 37px;

  min-width: 37px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 12px;

  background: #fff;

  font-size: 16px;
}

.savedTitleWrap strong {
  display: block;

  color: #137044;

  font-family: Georgia, serif;

  font-size: 11px;
}

.savedTitleWrap span {
  display: block;

  margin-top: 2px;

  color: #6b907b;

  font-size: 7px;
}

.editButton {
  flex-shrink: 0;

  padding: 8px 9px;

  border:
    1px solid #94e4b5;

  border-radius: 10px;

  background: white;

  color: #147447;

  font-size: 8px;

  font-weight: 800;

  cursor: pointer;
}

.savedDetails {
  padding: 8px 10px;

  border-radius: 12px;

  background: white;
}

.savedDetails > div {
  min-width: 0;

  padding: 7px 0;

  display: flex;
  justify-content: space-between;

  gap: 12px;

  border-bottom:
    1px solid #edf7f1;
}

.savedDetails > div:last-child {
  border-bottom: none;
}

.savedDetails span {
  color: #71808a;

  font-size: 8px;
}

.savedDetails strong {
  max-width: 62%;

  overflow-wrap: anywhere;

  text-align: right;

  color: #25313a;

  font-size: 8px;
}

/* =====================================
   FORM
===================================== */

.label {
  display: block;

  margin:
    13px
    0
    6px;

  color: #34404a;

  font-family: Georgia, serif;

  font-size: 10px;

  font-weight: 600;
}

.amountWrap {
  width: 100%;

  display: flex;
  align-items: center;

  border:
    1px solid #d7e0e4;

  border-radius: 13px;

  background: #fff;

  transition:
    border-color .18s ease,
    box-shadow .18s ease;
}

.amountWrap:focus-within {
  border-color: #2771e8;

  box-shadow:
    0 0 0 3px
    rgba(39,113,232,.08);
}

.amountWrap > span {
  padding-left: 13px;

  color: #66747d;

  font-family: Georgia, serif;

  font-size: 17px;

  font-weight: 700;
}

.amountWrap input {
  width: 100%;

  min-width: 0;

  padding:
    13px
    10px;

  border: none;
  outline: none;

  background: transparent;

  color: #111827;

  font-family: Georgia, serif;

  font-size: 17px;
}

.amountHint {
  margin-top: 5px;

  color: #9aa6ae;

  font-size: 7px;
}

.input {
  width: 100%;

  min-width: 0;

  padding: 12px;

  border:
    1px solid #d7e0e4;

  border-radius: 12px;

  outline: none;

  background: #fff;

  color: #111827;

  font-size: 11px;

  transition:
    border-color .18s ease,
    box-shadow .18s ease;
}

.input:focus {
  border-color: #2771e8;

  box-shadow:
    0 0 0 3px
    rgba(39,113,232,.08);
}

.paymentForm {
  margin-top: 8px;
}

.formTitle {
  margin-top: 14px;

  color: #16212a;

  font-family: Georgia, serif;

  font-size: 12px;

  font-weight: 600;
}

.saveButton,
.cancelButton {
  width: 100%;

  margin-top: 10px;

  padding: 11px;

  border: none;

  border-radius: 12px;

  font-size: 9px;

  font-weight: 800;

  cursor: pointer;
}

.saveButton {
  background:
    linear-gradient(
      90deg,
      #155eef,
      #2578d9
    );

  color: white;
}

.cancelButton {
  background: #f1f4f6;

  color: #52616a;
}

/* =====================================
   MESSAGE
===================================== */

.message {
  margin-top: 13px;

  padding: 10px 11px;

  display: flex;
  align-items: center;

  gap: 8px;

  border-radius: 11px;

  font-size: 9px;

  line-height: 1.4;

  animation:
    fadeIn .2s ease both;
}

.message > span {
  width: 20px;
  height: 20px;

  min-width: 20px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 50%;

  font-weight: 900;
}

.message.success {
  background: #ecfdf5;
  color: #137044;
}

.message.success > span {
  background: #c9f7dc;
}

.message.error {
  background: #fff1f2;
  color: #b42318;
}

.message.error > span {
  background: #ffd7dc;
}

/* =====================================
   SUBMIT
===================================== */

.submitButton {
  width: 100%;

  margin-top: 14px;

  padding: 13px;

  display: flex;
  align-items: center;
  justify-content: center;

  gap: 9px;

  border: none;

  border-radius: 13px;

  background:
    linear-gradient(
      135deg,
      #153746,
      #176056
    );

  color: white;

  font-family: Georgia, serif;

  font-size: 12px;

  cursor: pointer;

  box-shadow:
    0 9px 22px
    rgba(21,55,70,.15);

  transition:
    transform .18s ease,
    box-shadow .18s ease;
}

.submitButton:hover {
  box-shadow:
    0 12px 27px
    rgba(21,55,70,.22);
}

.submitButton:disabled {
  opacity: .58;

  cursor: not-allowed;
}

/* =====================================
   HISTORY
===================================== */

.historyCard {
  animation-delay: .12s;
}

.historyHeading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;

  gap: 8px;

  margin-bottom: 12px;
}

.liveBadge {
  flex-shrink: 0;

  display: flex;
  align-items: center;

  gap: 4px;

  padding: 6px 8px;

  border-radius: 999px;

  background: #ecfdf5;

  color: #07804b;

  font-size: 7px;

  font-weight: 900;
}

.liveBadge i {
  width: 5px;
  height: 5px;

  border-radius: 50%;

  background: #16a34a;

  animation:
    livePulse 1.6s infinite;
}

@keyframes livePulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: .35;
  }
}

.historyList {
  width: 100%;
}

.historyItem {
  width: 100%;

  padding: 11px 0;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 9px;

  border-bottom:
    1px solid #edf1f3;
}

.historyItem:last-child {
  border-bottom: none;
}

.historyLeft {
  min-width: 0;
  flex: 1;

  display: flex;
  align-items: center;

  gap: 9px;
}

.historyIcon {
  width: 39px;
  height: 39px;

  min-width: 39px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 12px;

  background:
    linear-gradient(
      145deg,
      #f1f6ff,
      #f0fbf7
    );

  font-size: 16px;
}

.historyInfo {
  min-width: 0;
}

.historyInfo strong {
  display: block;

  color: #111827;

  font-family: Georgia, serif;

  font-size: 14px;
}

.historyInfo span {
  display: block;

  margin-top: 3px;

  color: #8b98a0;

  font-size: 7px;
}

.status {
  flex-shrink: 0;

  min-width: 61px;

  padding: 6px 7px;

  display: inline-flex;
  align-items: center;
  justify-content: center;

  gap: 4px;

  border-radius: 999px;

  font-size: 7px;

  font-weight: 900;
}

.status i {
  font-style: normal;

  font-size: 9px;
}

.statusPaid {
  background: #ecfdf5;
  color: #087443;
}

.statusPending {
  background: #fff8db;
  color: #9a6700;
}

.statusRejected {
  background: #fff1f0;
  color: #b42318;
}

/* =====================================
   EMPTY
===================================== */

.empty {
  padding: 23px 8px;

  text-align: center;
}

.emptyIcon {
  width: 51px;
  height: 51px;

  margin: 0 auto 9px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 16px;

  background:
    linear-gradient(
      145deg,
      #edf4ff,
      #f4efff
    );

  font-size: 23px;
}

.empty h3 {
  margin: 0;

  color: #27333b;

  font-family: Georgia, serif;

  font-size: 14px;
}

.empty p {
  margin: 5px 0 0;

  color: #9aa6ae;

  font-size: 8px;
}

/* =====================================
   SECURITY
===================================== */

.securityNote {
  width: 100%;

  margin:
    3px
    0
    10px;

  padding: 12px;

  display: flex;
  align-items: flex-start;

  gap: 9px;

  border:
    1px solid #dfe9e9;

  border-radius: 15px;

  background:
    rgba(255,255,255,.65);
}

.securityNote > span {
  font-size: 17px;
}

.securityNote strong {
  display: block;

  color: #42515a;

  font-size: 8px;
}

.securityNote p {
  margin: 3px 0 0;

  color: #89959d;

  font-size: 7px;

  line-height: 1.4;
}

/* =====================================
   FOOTER
===================================== */

.footer {
  padding: 8px 3px 5px;

  text-align: center;

  color: #9aa6ae;

  font-family: Georgia, serif;

  font-size: 8px;
}

/* =====================================
   LOADING
===================================== */

.loadingPage {
  width: 100%;

  min-height: 100svh;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 20px;

  background:
    linear-gradient(
      145deg,
      #effafb,
      #f7fbff,
      #faf7ff
    );
}

.loadingCard {
  width: min(290px, 100%);

  padding: 29px 22px;

  border-radius: 23px;

  background: white;

  text-align: center;

  box-shadow:
    0 20px 60px
    rgba(20,60,80,.10);
}

.loadingBrand {
  font-family: Georgia, serif;

  font-size: 24px;
}

.loadingBrand span {
  color: #111827;
}

.loadingBrand b {
  color: #209657;

  font-weight: 500;
}

.loadingSpinner {
  width: 28px;
  height: 28px;

  margin: 18px auto 11px;

  border:
    3px solid #e7edf0;

  border-top-color: #155eef;
  border-right-color: #1a9b64;

  border-radius: 50%;

  animation:
    spin .75s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loadingCard p {
  margin: 0;

  color: #87939a;

  font-size: 9px;
}

/* =====================================
   SMALL MOBILE
===================================== */

@media (max-width: 370px) {

  .page {
    padding-left: 7px;
    padding-right: 7px;
  }

  .header {
    grid-template-columns:
      70px
      1fr
      40px;

    padding: 9px;
  }

  .brand {
    font-size: 21px;
  }

  .backButton {
    font-size: 9px;
  }

  .headerShield {
    width: 37px;
    height: 37px;
  }

  .balanceCard {
    padding: 17px;
  }

  .balance {
    font-size: 35px;
  }

  .card {
    padding: 14px;
  }

  .cardHeading h2,
  .historyHeading h2 {
    font-size: 18px;
  }

  .methodButton {
    min-height: 82px;
  }

  .methodIcon {
    font-size: 21px;
  }

  .historyInfo strong {
    font-size: 13px;
  }

  .status {
    min-width: 55px;
    padding-left: 5px;
    padding-right: 5px;
  }
}

/* =====================================
   DESKTOP — APP STYLE
===================================== */

@media (min-width: 700px) {

  .page {
    padding-top: 25px;
    padding-bottom: 45px;
  }

  .container {
    max-width: 620px;
  }

  .header {
    min-height: 80px;
  }

  .balanceCard {
    padding: 24px;
  }

  .card {
    padding: 21px;
  }
}
`;
