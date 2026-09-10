export default function Home() {
  return (
    <main>
      <nav className="nav">
        <div className="brand"><span>AURA</span><b>CAMP</b></div>
        <a className="login" href="/login">Login</a>
      </nav>
      <section className="hero">
        <div className="pill">EARN • EXPLORE • GROW</div>
        <h1>Earn smarter with <span>AURACAMP</span></h1>
        <p>Complete verified offers, track your earnings and withdraw your rewards.</p>
        <div className="actions">
          <a className="primary" href="/login">Get Started</a>
          <a className="secondary" href="#features">Explore</a>
        </div>
      </section>
      <section id="features" className="features">
        <article><strong>🎯</strong><h3>Verified Offers</h3><p>Discover campaigns and track every activity.</p></article>
        <article><strong>💰</strong><h3>Wallet</h3><p>See approved, pending and withdrawn earnings.</p></article>
        <article><strong>👥</strong><h3>Refer & Earn</h3><p>Invite friends and earn referral rewards.</p></article>
      </section>
      <footer>© 2026 AURACAMP</footer>
    </main>
  );
}