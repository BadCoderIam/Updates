import Link from "next/link";

const TIERS = [
  {
    name: "Bronze",
    desc: "Level-up crate. Mostly tokens + XP.",
    items: [
      "🪙 Tokens (common)",
      "⚡ XP reward (uncommon)",
      "🏅 Badge / cosmetic (rare, later)",
    ],
  },
  {
    name: "Silver",
    desc: "Better odds + larger payouts.",
    items: ["🪙 More tokens", "⚡ Larger XP rewards", "🎟️ Raffle entry (rare)"],
  },
  {
    name: "Gold",
    desc: "Rare drops are more likely.",
    items: ["⚡ Big XP", "🎟️ Raffle entry", "🏷️ Coupon / merch credit"],
  },
  {
    name: "Platinum",
    desc: "High-value crate.",
    items: ["🎟️ Guaranteed premium slot (later)", "🏷️ Bigger coupons", "💎 Prize eligibility (rare)"],
  },
  {
    name: "Diamond",
    desc: "Leaderboard + paid prizes (real world).",
    items: ["💎 Real-world prizes", "🏷️ Premium rewards", "🎟️ High-value entries"],
  },
];

export default function RewardsPage() {
  return (
    <main className="luPage">
      <div className="luTopRow" style={{ marginBottom: 14 }}>
        <div>
          <h1 className="luH1" style={{ margin: 0 }}>Rewards</h1>
          <div className="muted" style={{ marginTop: 6 }}>What you can win from loot boxes.</div>
        </div>
        <Link href="/dashboard" className="btn">← Back to dashboard</Link>
      </div>

      <div className="luGrid" style={{ display: "grid", gap: 12 }}>
        {TIERS.map((t) => (
          <div key={t.name} className="luCard" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{t.name} Loot Box</div>
              <div className="luPill">Preview</div>
            </div>
            <div className="muted" style={{ marginTop: 6 }}>{t.desc}</div>
            <ul style={{ marginTop: 10, paddingLeft: 18 }}>
              {t.items.map((i) => <li key={i} style={{ marginTop: 6 }}>{i}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
