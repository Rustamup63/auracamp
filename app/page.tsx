
export default function Home() {
  return (
    <main
      style={{
        padding: 40,
        fontFamily: "Arial",
        textAlign: "center",
      }}
    >
      <h1 style={{ color: "#173b8f", fontSize: 48 }}>
        AURA<span style={{ color: "#f28c28" }}>CAMP</span>
      </h1>

      <p>Earn • Explore • Grow</p>

      <h2>Earn smarter with AURACAMP</h2>

      <p>
        Complete offers, track your earnings and withdraw your rewards.
      </p>

      <a
        href="/login"
        style={{
          display: "inline-block",
          marginTop: 20,
          padding: "14px 24px",
          background: "#173b8f",
          color: "white",
          borderRadius: 10,
          textDecoration: "none",
        }}
      >
        Get Started
      </a>
    </main>
  );
}
