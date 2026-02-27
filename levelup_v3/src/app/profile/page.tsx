import Link from "next/link";

export default function ProfilePage() {
  return (
    <main className="row">
      <div className="card" style={{ flex: "1 1 560px" }}>
        <h2 style={{ marginTop: 0 }}>Profile (placeholder)</h2>
        <p>This page will show:</p>
        <ul>
          <li>Rank + readiness</li>
          <li>Badges (including 90-day verified badge)</li>
          <li>Mock offers earned</li>
          <li>Interview history + replays</li>
        </ul>
        <p><Link href="/practice">Go practice →</Link></p>
      </div>
    </main>
  );
}
