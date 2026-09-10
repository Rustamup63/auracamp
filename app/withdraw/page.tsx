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

export default function WithdrawPage() {
  const [balance, setBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [method, setMethod] = useState<"upi" | "bank">("upi");
  const [amount, setAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [loading, setLoading] = useState(false);
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("wallet_balance")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) {
      setBalance(Number(profile.wallet_balance || 0));
    }

    const { data } = await supabase
      .from("withdrawals")
      .select("id, amount, method, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    setWithdrawals(data || []);
  }

  async function submitWithdrawal(e: React.FormEvent) {
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

    if (method === "upi" && !upiId.trim()) {
      setMessage("Please enter your UPI ID.");
      return;
    }

    if (
      method === "bank" &&
      (!accountName.trim() ||
        !accountNumber.trim() ||
        !ifscCode.trim())
    ) {
      setMessage("Please complete all bank details.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.rpc("request_withdrawal", {
        p_amount: numericAmount,
        p_method: method,
        p_upi_id: method === "upi" ? upiId.trim() : "",
        p_account_name:
          method === "bank" ? accountName.trim() : "",
        p_account_number:
          method === "bank" ? accountNumber.trim() : "",
        p_ifsc_code:
          method === "bank" ? ifscCode.trim().toUpperCase() : "",
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage(
        "Withdrawal request submitted successfully."
      );

      setAmount("");
      setUpiId("");
      setAccountName("");
      setAccountNumber("");
      setIfscCode("");

      await loadWithdrawalData();
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong. Please try again.");
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

  return (
    <main style={styles.page}>
      <div style={styles.container}>

        <header style={styles.header}>
          <button
            onClick={() => (window.location.href = "/")}
            style={styles.backButton}
          >
            ← Back
          </button>

          <div>
            <div style={styles.brand}>AURACAMP</div>
            <div style={styles.subtitle}>Withdrawal</div>
          </div>

          <div style={{ width: 65 }} />
        </header>

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

        <section style={styles.card}>
          <h2 style={styles.title}>Withdraw Money</h2>

          <p style={styles.description}>
            Choose your payment method and submit a withdrawal request.
          </p>

          <div style={styles.methodGrid}>
            <button
              type="button"
              onClick={() => setMethod("upi")}
              style={{
                ...styles.methodButton,
                ...(method === "upi"
                  ? styles.methodActive
                  : {}),
              }}
            >
              <span style={styles.methodIcon}>📱</span>
              UPI
            </button>

            <button
              type="button"
              onClick={() => setMethod("bank")}
              style={{
                ...styles.methodButton,
                ...(method === "bank"
                  ? styles.methodActive
                  : {}),
              }}
            >
              <span style={styles.methodIcon}>🏦</span>
              Bank
            </button>
          </div>

          <form onSubmit={submitWithdrawal}>

            <label style={styles.label}>
              Withdrawal Amount
            </label>

            <div style={styles.inputWrap}>
              <span style={styles.rupee}>₹</span>

              <input
                type="number"
                min="100"
                step="1"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={styles.amountInput}
              />
            </div>

            {method === "upi" ? (
              <>
                <label style={styles.label}>
                  UPI ID
                </label>

                <input
                  type="text"
                  placeholder="example@upi"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  style={styles.input}
                />
              </>
            ) : (
              <>
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

                <label style={styles.label}>
                  Account Number
                </label>

                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter account number"
                  value={accountNumber}
                  onChange={(e) =>
                    setAccountNumber(e.target.value)
                  }
                  style={styles.input}
                />

                <label style={styles.label}>
                  IFSC Code
                </label>

                <input
                  type="text"
                  placeholder="Example: SBIN0001234"
                  value={ifscCode}
                  onChange={(e) =>
                    setIfscCode(e.target.value.toUpperCase())
                  }
                  style={styles.input}
                />
              </>
            )}

            {message && (
              <div
                style={{
                  ...styles.message,
                  color: message.includes("success")
                    ? "#166534"
                    : "#b91c1c",
                  background: message.includes("success")
                    ? "#dcfce7"
                    : "#fee2e2",
                }}
              >
                {message}
              </div>
            )}

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

        <section style={styles.card}>
          <h2 style={styles.title}>Withdrawal History</h2>

          {withdrawals.length === 0 ? (
            <div style={styles.empty}>
              <div style={styles.emptyIcon}>💸</div>
              <strong>No withdrawals yet</strong>
              <p>Your withdrawal requests will appear here.</p>
            </div>
          ) : (
            <div>
              {withdrawals.map((item) => (
                <div key={item.id} style={styles.historyRow}>
                  <div>
                    <strong>
                      ₹{Number(item.amount).toFixed(2)}
                    </strong>

                    <div style={styles.historyDate}>
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

        <footer style={styles.footer}>
          AURACAMP • Secure Withdrawal
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
    boxShadow: "0 5px 20px rgba(0,0,0,0.04)",
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
