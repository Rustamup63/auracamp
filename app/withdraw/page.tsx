"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

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

  const [method, setMethod] = useState<"upi" | "bank">("upi");

  const [amount, setAmount] = useState("");

  // UPI
  const [upiId, setUpiId] = useState("");

  // Common
  const [accountName, setAccountName] = useState("");

  // Bank
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadWithdrawalData();
  }, []);

  async function loadWithdrawalData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    // Load wallet balance
    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_balance")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) {
      setBalance(Number(profile.wallet_balance || 0));
    }

    // Load withdrawal history
    const { data: withdrawalData } = await supabase
      .from("withdrawals")
      .select("id, amount, method, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    setWithdrawals(withdrawalData || []);

    // Load saved payment accounts
    const { data: accountData, error: accountError } =
      await supabase
        .from("withdrawal_accounts")
        .select(
          "id, method, account_name, upi_id, bank_name, account_number, ifsc_code, is_default"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

    if (accountError) {
      console.error(
        "Saved account loading error:",
        accountError
      );
      return;
    }

    setSavedAccounts(accountData || []);

    // Automatically load selected method's saved account
    const savedForMethod = (accountData || []).find(
      (item) => item.method === method
    );

    if (savedForMethod) {
      loadAccountIntoForm(savedForMethod);
    }
  }

  function loadAccountIntoForm(account: SavedAccount) {
    setAccountName(account.account_name || "");

    if (account.method === "upi") {
      setUpiId(account.upi_id || "");
      setBankName("");
      setAccountNumber("");
      setIfscCode("");
    } else {
      setUpiId("");
      setBankName(account.bank_name || "");
      setAccountNumber(account.account_number || "");
      setIfscCode(account.ifsc_code || "");
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

  function handleMethodChange(nextMethod: "upi" | "bank") {
    setMethod(nextMethod);
    setMessage("");
    setEditingAccount(false);

    const savedAccount = savedAccounts.find(
      (account) => account.method === nextMethod
    );

    if (savedAccount) {
      loadAccountIntoForm(savedAccount);
    } else {
      clearPaymentForm();
    }
  }

  async function savePaymentAccount() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (!accountName.trim()) {
      setMessage("Please enter account holder name.");
      return;
    }

    if (method === "upi" && !upiId.trim()) {
      setMessage("Please enter your UPI ID.");
      return;
    }

    if (
      method === "bank" &&
      (!accountNumber.trim() || !ifscCode.trim())
    ) {
      setMessage("Please complete all bank details.");
      return;
    }

    setSavingAccount(true);
    setMessage("");

    try {
      const accountData = {
        user_id: user.id,
        method,
        account_name: accountName.trim(),
        upi_id: method === "upi" ? upiId.trim() : null,
        bank_name:
          method === "bank"
            ? bankName.trim() || null
            : null,
        account_number:
          method === "bank"
            ? accountNumber.trim()
            : null,
        ifsc_code:
          method === "bank"
            ? ifscCode.trim().toUpperCase()
            : null,
        is_default: true,
      };

      const { data, error } = await supabase
        .from("withdrawal_accounts")
        .upsert(accountData, {
          onConflict: "user_id,method",
        })
        .select(
          "id, method, account_name, upi_id, bank_name, account_number, ifsc_code, is_default"
        )
        .single();

      if (error) {
        console.error("Save account error:", error);
        setMessage(error.message);
        return;
      }

      setSavedAccounts((previous) => {
        const filtered = previous.filter(
          (item) => item.method !== method
        );

        return [...filtered, data];
      });

      setEditingAccount(false);

      setMessage(
        method === "upi"
          ? "UPI details saved successfully."
          : "Bank details saved successfully."
      );
    } catch (error) {
      console.error(error);
      setMessage("Unable to save payment details.");
    } finally {
      setSavingAccount(false);
    }
  }

  async function submitWithdrawal(
    e: React.FormEvent
  ) {
    e.preventDefault();
    setMessage("");

    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount < 100) {
      setMessage("Minimum withdrawal amount is ₹100.");
      return;
    }

    if (numericAmount > balance) {
      setMessage("Insufficient wallet balance.");
      return;
    }

    // Account name required for BOTH UPI and Bank
    if (!accountName.trim()) {
      setMessage("Please enter account holder name.");
      return;
    }

    if (method === "upi" && !upiId.trim()) {
      setMessage("Please enter your UPI ID.");
      return;
    }

    if (
      method === "bank" &&
      (!accountNumber.trim() || !ifscCode.trim())
    ) {
      setMessage("Please complete all bank details.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      // First save/update payment details
      const paymentData = {
        user_id: user.id,
        method,
        account_name: accountName.trim(),
        upi_id: method === "upi" ? upiId.trim() : null,
        bank_name:
          method === "bank"
            ? bankName.trim() || null
            : null,
        account_number:
          method === "bank"
            ? accountNumber.trim()
            : null,
        ifsc_code:
          method === "bank"
            ? ifscCode.trim().toUpperCase()
            : null,
        is_default: true,
      };

      const { error: saveError } = await supabase
        .from("withdrawal_accounts")
        .upsert(paymentData, {
          onConflict: "user_id,method",
        });

      if (saveError) {
        console.error(
          "Payment account save error:",
          saveError
        );

        setMessage(
          "Unable to save payment details. Withdrawal was not submitted."
        );

        return;
      }

      // Submit withdrawal
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
              ? ifscCode.trim().toUpperCase()
              : "",
        }
      );

      if (error) {
        console.error(
          "Withdrawal error:",
          error
        );

        setMessage(error.message);
        return;
      }

      setMessage(
        "Withdrawal request submitted successfully."
      );

      // Clear amount only.
      // Keep payment details saved and visible.
      setAmount("");

      await loadWithdrawalData();
    } catch (error) {
      console.error(error);
      setMessage(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function statusStyle(status: string) {
    if (status === "paid") {
      return {
        background: "#dcfce7",
        color: "#166534",
      };
    }

    if (status === "rejected") {
      return {
        background: "#fee2e2",
        color: "#991b1b",
      };
    }

    if (status === "processing") {
      return {
        background: "#fef3c7",
        color: "#92400e",
      };
    }

    return {
      background: "#e0e7ff",
      color: "#3730a3",
    };
  }

  const savedCurrentAccount = savedAccounts.find(
    (account) => account.method === method
  );

  const isSuccess =
    message.toLowerCase().includes("successfully") ||
    message.toLowerCase().includes("saved successfully");

  return (
    <main style={styles.page}>
      <div style={styles.container}>

        {/* HEADER */}
        <header style={styles.header}>
          <button
            onClick={() => (window.location.href = "/")}
            style={styles.backButton}
          >
            ← Back
          </button>

          <div>
            <div style={styles.brand}>
              AURACAMP
            </div>

            <div style={styles.subtitle}>
              Withdrawal
            </div>
          </div>

          <div style={{ width: 65 }} />
        </header>

        {/* BALANCE */}
        <section style={styles.balanceCard}>
          <div style={styles.balanceLabel}>
            Available Balance
          </div>

          <div style={styles.balance}>
            ₹{balance.toFixed(2)}
          </div>

          <div style={styles.balanceHint}>
            Minimum withdrawal: ₹100
          </div>
        </section>

        {/* WITHDRAW CARD */}
        <section style={styles.card}>
          <h2 style={styles.title}>
            Withdraw Money
          </h2>

          <p style={styles.description}>
            Choose your payment method and submit a
            withdrawal request.
          </p>

          {/* METHOD */}
          <div style={styles.methodGrid}>

            <button
              type="button"
              onClick={() =>
                handleMethodChange("upi")
              }
              style={{
                ...styles.methodButton,
                ...(method === "upi"
                  ? styles.methodActive
                  : {}),
              }}
            >
              <span style={styles.methodIcon}>
                📱
              </span>

              UPI
            </button>

            <button
              type="button"
              onClick={() =>
                handleMethodChange("bank")
              }
              style={{
                ...styles.methodButton,
                ...(method === "bank"
                  ? styles.methodActive
                  : {}),
              }}
            >
              <span style={styles.methodIcon}>
                🏦
              </span>

              Bank
            </button>

          </div>

          {/* SAVED ACCOUNT */}
          {savedCurrentAccount && !editingAccount && (
            <div style={styles.savedBox}>

              <div style={styles.savedHeader}>
                <div>
                  <div style={styles.savedTitle}>
                    Saved {method === "upi" ? "UPI" : "Bank"} Account
                  </div>

                  <div style={styles.savedSubtitle}>
                    Ready for withdrawal
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setEditingAccount(true)
                  }
                  style={styles.editButton}
                >
                  ✏️ Edit
                </button>
              </div>

              <div style={styles.savedDetails}>

                <div style={styles.savedRow}>
                  <span>
                    Account Name
                  </span>

                  <strong>
                    {savedCurrentAccount.account_name}
                  </strong>
                </div>

                {method === "upi" ? (
                  <div style={styles.savedRow}>
                    <span>
                      UPI ID
                    </span>

                    <strong>
                      {savedCurrentAccount.upi_id}
                    </strong>
                  </div>
                ) : (
                  <>
                    {savedCurrentAccount.bank_name && (
                      <div style={styles.savedRow}>
                        <span>
                          Bank
                        </span>

                        <strong>
                          {savedCurrentAccount.bank_name}
                        </strong>
                      </div>
                    )}

                    <div style={styles.savedRow}>
                      <span>
                        Account Number
                      </span>

                      <strong>
                        {savedCurrentAccount.account_number}
                      </strong>
                    </div>

                    <div style={styles.savedRow}>
                      <span>
                        IFSC
                      </span>

                      <strong>
                        {savedCurrentAccount.ifsc_code}
                      </strong>
                    </div>
                  </>
                )}

              </div>

            </div>
          )}

          <form onSubmit={submitWithdrawal}>

            {/* AMOUNT */}
            <label style={styles.label}>
              Withdrawal Amount
            </label>

            <div style={styles.inputWrap}>
              <span style={styles.rupee}>
                ₹
              </span>

              <input
                type="number"
                min="100"
                step="1"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value)
                }
                style={styles.amountInput}
              />
            </div>

            {/* EDIT / NEW PAYMENT DETAILS */}
            {(!savedCurrentAccount || editingAccount) && (
              <>
                {/* ACCOUNT NAME */}
                <label style={styles.label}>
                  Account Holder Name
                </label>

                <input
                  type="text"
                  placeholder="Enter account holder name"
                  value={accountName}
                  onChange={(e) =>
                    setAccountName(e.target.value)
                  }
                  style={styles.input}
                />

                {/* UPI */}
                {method === "upi" ? (
                  <>
                    <label style={styles.label}>
                      UPI ID
                    </label>

                    <input
                      type="text"
                      placeholder="example@upi"
                      value={upiId}
                      onChange={(e) =>
                        setUpiId(e.target.value)
                      }
                      style={styles.input}
                    />
                  </>
                ) : (
                  <>
                    {/* BANK NAME */}
                    <label style={styles.label}>
                      Bank Name
                    </label>

                    <input
                      type="text"
                      placeholder="Enter bank name"
                      value={bankName}
                      onChange={(e) =>
                        setBankName(e.target.value)
                      }
                      style={styles.input}
                    />

                    {/* ACCOUNT NUMBER */}
                    <label style={styles.label}>
                      Account Number
                    </label>

                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Enter account number"
                      value={accountNumber}
                      onChange={(e) =>
                        setAccountNumber(
                          e.target.value
                        )
                      }
                      style={styles.input}
                    />

                    {/* IFSC */}
                    <label style={styles.label}>
                      IFSC Code
                    </label>

                    <input
                      type="text"
                      placeholder="Example: SBIN0001234"
                      value={ifscCode}
                      onChange={(e) =>
                        setIfscCode(
                          e.target.value.toUpperCase()
                        )
                      }
                      style={styles.input}
                    />
                  </>
                )}

                {/* SAVE DETAILS */}
                <button
                  type="button"
                  disabled={savingAccount}
                  onClick={savePaymentAccount}
                  style={{
                    ...styles.saveButton,
                    opacity: savingAccount ? 0.6 : 1,
                  }}
                >
                  {savingAccount
                    ? "Saving..."
                    : editingAccount
                    ? "Save Changes"
                    : "Save Payment Details"}
                </button>

                {/* CANCEL EDIT */}
                {editingAccount && (
                  <button
                    type="button"
                    onClick={() => {
                      if (savedCurrentAccount) {
                        loadAccountIntoForm(
                          savedCurrentAccount
                        );
                      } else {
                        setEditingAccount(false);
                      }
                    }}
                    style={styles.cancelButton}
                  >
                    Cancel
                  </button>
                )}
              </>
            )}

            {/* MESSAGE */}
            {message && (
              <div
                style={{
                  ...styles.message,
                  color: isSuccess
                    ? "#166534"
                    : "#b91c1c",
                  background: isSuccess
                    ? "#dcfce7"
                    : "#fee2e2",
                }}
              >
                {message}
              </div>
            )}

                        {/* WITHDRAW BUTTON */}
            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.submitButton,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading
                ? "Submitting..."
                : "Request Withdrawal"}
            </button>

          </form>
        </section>

        {/* WITHDRAWAL HISTORY */}
        <section style={styles.card}>
          <h2 style={styles.title}>
            Withdrawal History
          </h2>

          {withdrawals.length === 0 ? (
            <div style={styles.empty}>
              <div style={styles.emptyIcon}>
                💸
              </div>

              <strong>
                No withdrawals yet
              </strong>

              <p>
                Your withdrawal requests will
                appear here.
              </p>
            </div>
          ) : (
            <div>
              {withdrawals.map((item) => (
                <div
                  key={item.id}
                  style={styles.historyRow}
                >
                  <div>
                    <strong>
                      ₹
                      {Number(item.amount).toFixed(2)}
                    </strong>

                    <div
                      style={styles.historyDate}
                    >
                      {item.method.toUpperCase()} •{" "}
                      {new Date(
                        item.created_at
                      ).toLocaleDateString("en-IN")}
                    </div>
                  </div>

                  <span
                    style={{
                      ...styles.status,
                      ...statusStyle(item.status),
                    }}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* FOOTER */}
        <footer style={styles.footer}>
          AURACAMP • Secure Withdrawal
        </footer>

      </div>
    </main>
  );
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    fontFamily: "Arial, sans-serif",
    color: "#111827",
    padding: "18px 14px 45px",
  },

  container: {
    maxWidth: "650px",
    margin: "0 auto",
  },

  header: {
    background: "#101827",
    color: "#fff",
    borderRadius: "18px",
    padding: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px",
  },

  backButton: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.25)",
    color: "#fff",
    borderRadius: "9px",
    padding: "9px 11px",
    cursor: "pointer",
  },

  brand: {
    fontSize: "20px",
    fontWeight: "800",
    textAlign: "center",
  },

  subtitle: {
    fontSize: "11px",
    opacity: 0.65,
    textAlign: "center",
    marginTop: "3px",
  },

  balanceCard: {
    background: "#173bff",
    color: "#fff",
    borderRadius: "20px",
    padding: "25px",
    marginBottom: "16px",
  },

  balanceLabel: {
    fontSize: "14px",
    opacity: 0.8,
  },

  balance: {
    fontSize: "36px",
    fontWeight: "800",
    marginTop: "7px",
  },

  balanceHint: {
    fontSize: "12px",
    opacity: 0.7,
    marginTop: "5px",
  },

  card: {
    background: "#fff",
    borderRadius: "20px",
    padding: "22px",
    marginBottom: "16px",
    boxShadow:
      "0 5px 20px rgba(0,0,0,0.04)",
  },

  title: {
    margin: "0",
    fontSize: "21px",
  },

  description: {
    color: "#6b7280",
    fontSize: "13px",
    lineHeight: "1.5",
    marginTop: "7px",
  },

  methodGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    margin: "20px 0",
  },

  methodButton: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "14px",
    fontWeight: "700",
    cursor: "pointer",
    minHeight: "78px",
  },

  methodActive: {
    background: "#eef2ff",
    border: "2px solid #173bff",
    color: "#173bff",
  },

  methodIcon: {
    display: "block",
    fontSize: "22px",
    marginBottom: "5px",
  },

  savedBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "14px",
    padding: "14px",
    marginBottom: "18px",
  },

  savedHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "12px",
  },

  savedTitle: {
    fontSize: "14px",
    fontWeight: "800",
    color: "#166534",
  },

  savedSubtitle: {
    fontSize: "11px",
    color: "#4b7a59",
    marginTop: "3px",
  },

  editButton: {
    border: "1px solid #86efac",
    background: "#fff",
    color: "#166534",
    borderRadius: "9px",
    padding: "8px 10px",
    fontWeight: "700",
    cursor: "pointer",
  },

  savedDetails: {
    background: "#fff",
    borderRadius: "10px",
    padding: "10px 12px",
  },

  savedRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    padding: "7px 0",
    borderBottom: "1px solid #f0fdf4",
    fontSize: "12px",
  },

  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: "700",
    margin: "15px 0 7px",
  },

  inputWrap: {
    display: "flex",
    alignItems: "center",
    border: "1px solid #d1d5db",
    borderRadius: "11px",
    overflow: "hidden",
  },

  rupee: {
    paddingLeft: "13px",
    fontWeight: "700",
    color: "#6b7280",
  },

  amountInput: {
    width: "100%",
    border: "none",
    outline: "none",
    padding: "13px",
    fontSize: "16px",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: "11px",
    padding: "13px",
    fontSize: "14px",
    outline: "none",
  },

  saveButton: {
    width: "100%",
    marginTop: "15px",
    background: "#173bff",
    color: "#fff",
    border: "none",
    borderRadius: "11px",
    padding: "13px",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer",
  },

  cancelButton: {
    width: "100%",
    marginTop: "8px",
    background: "#f3f4f6",
    color: "#374151",
    border: "none",
    borderRadius: "11px",
    padding: "12px",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer",
  },

  message: {
    marginTop: "15px",
    padding: "12px",
    borderRadius: "10px",
    fontSize: "13px",
  },

  submitButton: {
    width: "100%",
    marginTop: "18px",
    background: "#101827",
    color: "#fff",
    border: "none",
    borderRadius: "11px",
    padding: "14px",
    fontWeight: "700",
    fontSize: "15px",
    cursor: "pointer",
  },

  empty: {
    textAlign: "center",
    color: "#6b7280",
    padding: "25px 10px",
  },

  emptyIcon: {
    fontSize: "35px",
    marginBottom: "8px",
  },

  historyRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    padding: "15px 0",
    borderBottom: "1px solid #f0f0f0",
  },

  historyDate: {
    color: "#9ca3af",
    fontSize: "11px",
    marginTop: "5px",
  },

  status: {
    padding: "6px 9px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "capitalize",
  },

  footer: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: "11px",
    padding: "10px",
  },
};
