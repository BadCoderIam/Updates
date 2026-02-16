
"use client";

import { useEffect, useMemo, useRef, useState } from "react";


function trackEnterApp(source: string) {
  try {
    const payload = JSON.stringify({ source, path: "/start", meta: { ts: Date.now() } });
    // Prefer sendBeacon so the redirect isn't blocked
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav: any = navigator as any;
    if (nav?.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      nav.sendBeacon("/api/track/enter-app", blob);
      return;
    }
    fetch("/api/track/enter-app", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

function goEnterApp(source: string) {
  trackEnterApp(source);
  window.location.href = "/dashboard";
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Home() {
  const raf = useRef<number | null>(null);
  const [planModal, setPlanModal] = useState<null | { plan: string; price: string }>(null);

  useEffect(() => {
    const onScroll = () => {
      if (raf.current) return;
      raf.current = window.requestAnimationFrame(() => {
        const y = window.scrollY || 0;

        // Subtle depth: hero background moves slower than page
        const heroShift = Math.min(0, -y * 0.12);
        const cardShift = Math.min(0, -y * 0.06);

        document.documentElement.style.setProperty("--heroShift", `${heroShift}px`);
        document.documentElement.style.setProperty("--cardShift", `${cardShift}px`);
        raf.current = null;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <main className="landing">
      <header className="navTop">
        <div className="brandLock">
          <div className="brandMark">L</div>
          <div className="brandText">
            <b>LevelUp Pro</b>
            <small>Gamified IT training</small>
          </div>
        </div>

        <nav className="navLinks">
          <a href="#how" onClick={(e) => (e.preventDefault(), scrollToId("how"))}>How it works</a>
          <a href="#features" onClick={(e) => (e.preventDefault(), scrollToId("features"))}>Features</a>
          <a href="#pricing" onClick={(e) => (e.preventDefault(), scrollToId("pricing"))}>Pricing</a>
          <a href="#resources" onClick={(e) => (e.preventDefault(), scrollToId("resources"))}>Resources</a>
        </nav>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="secondaryBtn" onClick={() => scrollToId("pricing")}>View pricing</button>
          <button className="gold" onClick={() => goEnterApp("nav")}>Enter app →</button>
        </div>
      </header>

      {planModal && (
        <div className="luModalOverlay" onClick={() => setPlanModal(null)}>
          <div className="luModal" role="dialog" aria-modal="true" aria-label="Pricing details" onClick={(e) => e.stopPropagation()}>
            <div className="luModalHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <b style={{ fontSize: 18 }}>{planModal.plan} — {planModal.price}</b>
                <div><small className="luHint">Billing is coming next. We’ll wire Stripe when you’re ready.</small></div>
              </div>
              <button className="secondaryBtn" type="button" onClick={() => setPlanModal(null)}>✕</button>
            </div>

            <div className="luModalBody">
              <div className="featureCard" style={{ padding: 12 }}>
                <b>What happens next</b>
                <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                  This button will become a secure checkout. For now, it’s a placeholder so we can finish the product flow first.
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button className="secondaryBtn" type="button" onClick={() => setPlanModal(null)}>Close</button>
                <button className="gold" type="button" onClick={() => setPlanModal(null)}>Sounds good</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="hero">
        <div className="heroBg" />
        <div className="heroShade" />

        <div className="heroContent">
          <div>
            <h1 className="heroH1">Level up your IT career — like a game.</h1>
            <p className="heroP">
              Earn XP by practicing real-world questions, unlock interview simulations, and master certifications.
              Built for IT Support first, then Desktop and Cloud.
            </p>

            <div className="ctaRow">
              <button className="gold" onClick={() => goEnterApp("hero_primary")}>Start free →</button>
              <button className="secondaryBtn" onClick={() => scrollToId("how")}>See how it works</button>
            </div>

            <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
              Pro: <b>$5.99/mo</b> • Premium: <b>$19.99/mo</b> • Cancel anytime
            </p>
          </div>

          <div className="heroCard">
            <div className="kpiMini">
              <div><b>XP</b> <span className="muted">• 350 / 500</span></div>
              <div className="muted">Helpdesk L1</div>
            </div>
            <div className="xpBar"><div className="xpFill" /></div>

            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              <div className="featureCard" style={{ padding: 12 }}>
                <b>Interview Ready</b>
                <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                  Pass the HR screen → unlock the tech panel.
                </div>
              </div>

              <div className="featureCard" style={{ padding: 12 }}>
                <b>Certification practice</b>
                <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                  A+ • Security+ • AZ-900 — timed mode later.
                </div>
              </div>

              <div className="featureCard" style={{ padding: 12 }}>
                <b>Career outlook</b>
                <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                  Roles, salary ranges, and what to learn next.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="section">
        <h2 className="sectionTitle">How it works</h2>
        <p className="sectionSub">
          A modern training loop: pick a path, earn XP through practice, then unlock realistic interview milestones.
        </p>

        <div className="grid3">
          <div className="featureCard">
            <b>1) Choose your path</b>
            <p className="muted" style={{ margin: "8px 0 0 0" }}>
              Helpdesk Support → Desktop Technician → Cloud Engineer. Your plan adapts as you improve.
            </p>
          </div>
          <div className="featureCard">
            <b>2) Earn XP by practicing</b>
            <p className="muted" style={{ margin: "8px 0 0 0" }}>
              Answer questions, learn concepts, and build confidence with structured feedback.
            </p>
          </div>
          <div className="featureCard">
            <b>3) Unlock interviews + offers</b>
            <p className="muted" style={{ margin: "8px 0 0 0" }}>
              Pass HR → pass Tech → receive a mock offer letter + a professional badge.
            </p>
          </div>
        </div>
      </section>

      <section id="features" className="section">
        <h2 className="sectionTitle">What you get</h2>
        <p className="sectionSub">
          Built to feel like a 2026 product: clean, fast, and motivating — with subtle gamification that keeps you moving.
        </p>

        <div className="grid3">
          <div className="featureCard"><b>Interview simulations</b><p className="muted" style={{ marginTop: 8 }}>HR screen → Tech panel flow with unlocks.</p></div>
          <div className="featureCard"><b>Certification prep</b><p className="muted" style={{ marginTop: 8 }}>Practice tests for A+, Security+, and AZ-900.</p></div>
          <div className="featureCard"><b>Career outlook</b><p className="muted" style={{ marginTop: 8 }}>See next roles, salary ranges, and recommended certs.</p></div>
          <div className="featureCard"><b>XP + levels</b><p className="muted" style={{ marginTop: 8 }}>Progress you can feel: XP bars, ranks, and badges.</p></div>
          <div className="featureCard"><b>Personalized path</b><p className="muted" style={{ marginTop: 8 }}>Start where you are, and grow into Desktop and Cloud.</p></div>
          <div className="featureCard"><b>Offer PDFs</b><p className="muted" style={{ marginTop: 8 }}>Generate downloadable mock offer letters (Premium).</p></div>
        </div>
      </section>

      <section id="pricing" className="section">
        <h2 className="sectionTitle">Pricing</h2>
        <p className="sectionSub">Start free, upgrade when you’re ready. Cancel anytime.</p>

        <div className="priceGrid">
          <div className="priceCard">
            <b>Free</b>
            <div className="priceTag">$0</div>
            <div className="muted">For getting started</div>
            <ul style={{ marginTop: 12 }}>
              <li>Basic IT Support question bank</li>
              <li>XP tracking</li>
              <li>Career path preview</li>
              <li>Limited interview practice</li>
            </ul>
            <button className="primary" style={{ width: "100%" }} onClick={() => goEnterApp("nav")}>Start free</button>
          </div>

          <div className="priceCard priceCardPro">
            <b>Pro</b>
            <div className="priceTag">$5.99<span className="muted" style={{ fontSize: 14 }}>/mo</span></div>
            <div className="muted">Best value</div>
            <ul style={{ marginTop: 12 }}>
              <li>Unlimited daily practice</li>
              <li>Certification modules (A+, Sec+, AZ-900)</li>
              <li>Career outlook + salary insights</li>
              <li>More interview unlocks</li>
            </ul>
            <button className="gold" style={{ width: "100%" }} onClick={() => setPlanModal({ plan: "Pro", price: "$5.99/mo" })}>Go Pro</button>
          </div>

          <div className="priceCard">
            <b>Premium</b>
            <div className="priceTag">$19.99<span className="muted" style={{ fontSize: 14 }}>/mo</span></div>
            <div className="muted">For serious accelerators</div>
            <ul style={{ marginTop: 12 }}>
              <li>AI mock tech interview panel (coming)</li>
              <li>Advanced analytics</li>
              <li>Mock offer letters + badges</li>
              <li>Early access features</li>
            </ul>
            <button className="primary" style={{ width: "100%" }} onClick={() => setPlanModal({ plan: "Pro", price: "$5.99/mo" })}>Go Premium</button>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>
          Note: payment integration is planned (Stripe). For now, the buttons are placeholders.
        </p>
      </section>

      <section id="resources" className="section">
        <h2 className="sectionTitle">Resources</h2>
        <p className="sectionSub">
          Guides and study plans that help you move faster. (We’ll expand this section as you add content.)
        </p>

        <div className="grid3">
          <div className="featureCard"><b>IT Support roadmap</b><p className="muted" style={{ marginTop: 8 }}>What to learn first, what to skip, and how to practice.</p></div>
          <div className="featureCard"><b>Certification study plans</b><p className="muted" style={{ marginTop: 8 }}>A+, Security+, AZ-900 — weekly milestone plans.</p></div>
          <div className="featureCard"><b>Salary + roles guide</b><p className="muted" style={{ marginTop: 8 }}>How skills map to roles and pay bands.</p></div>
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="secondaryBtn" onClick={() => goEnterApp("nav")}>Enter app</button>
          <button className="secondaryBtn" onClick={() => scrollToId("pricing")}>View pricing</button>
        </div>
      </section>

      <footer className="footer">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <b>LevelUp Pro</b>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>Gamified IT training platform • 2026</div>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            © {new Date().getFullYear()} LevelUp Pro • <span style={{ opacity: 0.85 }}>All rights reserved</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
