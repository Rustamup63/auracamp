"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

type Ticket = {
  id: string;
  subject: string;
  category: string;
  message: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const [category, setCategory] = useState("General");
  const [subject, setSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");

  async function loadTickets() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data, error } = await supabase
        .from("support_tickets")
        .select(
          "id, subject, category, message, status, admin_reply, created_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        setMessage("Unable to load support tickets.");
      } else {
        setTickets(data || []);
      }
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTickets();
  }, []);

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!subject.trim()) {
      setMessage("Please enter a subject.");
      return;
    }

    if (!ticketMessage.trim()) {
      setMessage("Please describe your issue.");
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { error } = await supabase.from("support_tickets").insert({
        user_id: user.id,
        subject: subject.trim(),
        category,
        message: ticketMessage.trim(),
        status: "open",
      });

      if (error) {
        console.error(error);
        setMessage(error.message);
        return;
      }

      setSubject("");
      setTicketMessage("");
      setCategory("General");
      setMessage("Support ticket created successfully.");

      await loadTickets();
    } catch (error) {
      console.error(error);
      setMessage("Unable to create ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  function statusStyle(status: string) {
    if (status === "resolved") {
      return {
        background: "#dcfce7",
        color: "#15803d",
      };
    }

    if (status === "closed") {
      return {
        background: "#e5e7eb",
        color: "#374151",
      };
    }

    if (status === "pending") {
      return {
        background: "#fef3c7",
        color: "#b45309",
      };
    }

    return {
      background: "#dbeafe",
      color: "#1d4ed8",
    };
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <div style={styles.logo}>AURACAMP</div>
            <div style={styles.tagline}>Earn • Explore • Grow</div>
          </div>

          <button
            style={styles.backButton}
            onClick={() => (window.location.href = "/")}
          >
            Home
          </button>
        </header>

        <section style={styles.hero}>
          <div style={styles.heroIcon}>🎧</div>
          <h1 style={styles.heroTitle}>Support Center</h1>
          <p style={styles.heroText}>
            Need help? Create a support ticket and our team will review it.
          </p>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Create Support Ticket</h2>
          <p style={styles.cardSubtitle}>
            Tell us what went wrong and we will get back to you.
          </p>

          <form onSubmit={createTicket}>
            <label style={styles.label}>Category</label>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={styles.input}
            >
              <option>General</option>
              <option>Offer</option>
              <option>Payment</option>
              <option>Withdrawal</option>
              <option>Account</option>
              <option>Technical</option>
              <option>Other</option>
            </select>

            <label style={styles.label}>Subject</label>

            <input
              type="text"
              placeholder="Example: Reward not received"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={styles.input}
              maxLength={100}
            />

            <label style={styles.label}>Message</label>

            <textarea
              placeholder="Describe your issue..."
              value={ticketMessage}
              onChange={(e) => setTicketMessage(e.target.value)}
              style={styles.textarea}
              rows={6}
              maxLength={1000}
            />

            {message && (
              <div
                style={{
                  ...styles.message,
                  background: message.includes("successfully")
                    ? "#dcfce7"
                    : "#fee2e2",
                  color: message.includes("successfully")
                    ? "#15803d"
                    : "#b91c1c",
                }}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                ...styles.submitButton,
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? "Submitting..." : "Submit Ticket"}
            </button>
          </form>
        </section>

        <section style={styles.card}>
          <div style={styles.historyHeader}>
            <div>
              <h2 style={styles.cardTitle}>My Support Tickets</h2>
              <p style={styles.cardSubtitle}>
                Track your previous support requests.
              </p>
            </div>

            <span style={styles.count}>{tickets.length}</span>
          </div>

          {loading ? (
            <div style={styles.empty}>Loading tickets...</div>
          ) : tickets.length === 0 ? (
            <div style={styles.empty}>
              <div style={styles.emptyIcon}>💬</div>
              <h3 style={styles.emptyTitle}>No tickets yet</h3>
              <p style={styles.emptyText}>
                Your support requests will appear here.
              </p>
            </div>
          ) : (
            <div>
              {tickets.map((ticket) => (
                <div key={ticket.id} style={styles.ticket}>
                  <div style={styles.ticketTop}>
                    <div>
                      <div style={styles.ticketSubject}>
                        {ticket.subject}
                      </div>

                      <div style={styles.ticketMeta}>
                        {ticket.category} •{" "}
                        {new Date(ticket.created_at).toLocaleDateString(
                          "en-IN"
                        )}
                      </div>
                    </div>

                    <span
                      style={{
                        ...styles.status,
                        ...statusStyle(ticket.status),
                      }}
                    >
                      {ticket.status}
                    </span>
                  </div>

                  <p style={styles.ticketMessage}>{ticket.message}</p>

                  {ticket.admin_reply && (
                    <div style={styles.reply}>
                      <strong>Support Team</strong>
                      <p style={{ margin: "6px 0 0" }}>
                        {ticket.admin_reply}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

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
    color: "#111827",
    fontFamily: "Arial, sans-serif",
    padding: "20px 14px 50px",
  },

  container: {
    maxWidth: "900px",
    margin: "0 auto",
  },

  header: {
    background: "#101827",
    color: "#fff",
    borderRadius: "22px",
    padding: "22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "22px",
  },

  logo: {
    fontSize: "24px",
    fontWeight: 800,
    letterSpacing: "1px",
  },

  tagline: {
    fontSize: "13px",
    opacity: 0.7,
    marginTop: "4px",
  },

  backButton: {
    background: "#fff",
    color: "#111827",
    border: "none",
    borderRadius: "12px",
    padding: "11px 17px",
    fontWeight: 700,
    cursor: "pointer",
  },

  hero: {
    background: "#fff",
    borderRadius: "22px",
    padding: "28px 22px",
    textAlign: "center",
    marginBottom: "18px",
    boxShadow: "0 6px 25px rgba(0,0,0,0.04)",
  },

  heroIcon: {
    fontSize: "42px",
    marginBottom: "8px",
  },

  heroTitle: {
    fontSize: "30px",
    margin: "0 0 8px",
  },

  heroText: {
    color: "#6b7280",
    margin: 0,
    lineHeight: 1.5,
  },

  card: {
    background: "#fff",
    borderRadius: "22px",
    padding: "24px",
    marginBottom: "18px",
    boxShadow: "0 6px 25px rgba(0,0,0,0.04)",
  },

  cardTitle: {
    fontSize: "23px",
    margin: 0,
  },

  cardSubtitle: {
    color: "#6b7280",
    margin: "7px 0 22px",
    lineHeight: 1.5,
  },

  label: {
    display: "block",
    fontWeight: 700,
    margin: "16px 0 8px",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: "13px",
    padding: "14px",
    fontSize: "16px",
    background: "#fff",
    outline: "none",
  },

  textarea: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d1d5db",
    borderRadius: "13px",
    padding: "14px",
    fontSize: "16px",
    resize: "vertical",
    outline: "none",
    fontFamily: "Arial, sans-serif",
  },

  message: {
    padding: "13px",
    borderRadius: "12px",
    marginTop: "16px",
    lineHeight: 1.4,
  },

  submitButton: {
    width: "100%",
    marginTop: "16px",
    background: "#101827",
    color: "#fff",
    border: "none",
    borderRadius: "13px",
    padding: "15px",
    fontSize: "16px",
    fontWeight: 700,
    cursor: "pointer",
  },

  historyHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  count: {
    background: "#eef2ff",
    color: "#1d4ed8",
    borderRadius: "30px",
    padding: "9px 14px",
    fontWeight: 700,
  },

  empty: {
    background: "#f8fafc",
    borderRadius: "16px",
    padding: "35px 20px",
    textAlign: "center",
    color: "#6b7280",
  },

  emptyIcon: {
    fontSize: "35px",
  },

  emptyTitle: {
    color: "#111827",
    margin: "10px 0 5px",
  },

  emptyText: {
    margin: 0,
  },

  ticket: {
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "17px",
    marginBottom: "12px",
  },

  ticketTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
  },

  ticketSubject: {
    fontSize: "17px",
    fontWeight: 700,
  },

  ticketMeta: {
    fontSize: "12px",
    color: "#6b7280",
    marginTop: "5px",
  },

  status: {
    borderRadius: "20px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "capitalize",
    whiteSpace: "nowrap",
  },

  ticketMessage: {
    color: "#4b5563",
    lineHeight: 1.5,
    margin: "14px 0 0",
    whiteSpace: "pre-wrap",
  },

  reply: {
    background: "#f1f5f9",
    borderRadius: "12px",
    padding: "13px",
    marginTop: "14px",
    color: "#374151",
    lineHeight: 1.5,
  },

  footer: {
    display: "flex",
    justifyContent: "space-between",
    color: "#9ca3af",
    fontSize: "12px",
    padding: "12px 5px",
  },
};
