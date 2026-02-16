"use client";

import { useEffect, useMemo, useState } from "react";

const SAMPLE = [
  { q: "What does DNS do?", a: ["Encrypts traffic", "Resolves names to IP addresses", "Blocks malware"], correct: 1 },
  { q: "Which Windows tool shows running processes?", a: ["Task Manager", "Disk Management", "Event Viewer"], correct: 0 },
  { q: "What is MFA?", a: ["Multi-Factor Authentication", "Managed File Access", "Master File Allocation"], correct: 0 },
];

export default function TestNowPage(){
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [secs, setSecs] = useState(300); // 5 min

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [done]);

  useEffect(() => {
    if (secs === 0 && !done) setDone(true);
  }, [secs, done]);

  const cur = SAMPLE[idx];

  function next(){
    if (picked === null) return;
    if (picked === cur.correct) setScore(s => s + 1);
    setPicked(null);
    if (idx >= SAMPLE.length - 1) setDone(true);
    else setIdx(i => i + 1);
  }

  const mm = String(Math.floor(secs / 60)).padStart(2,"0");
  const ss = String(secs % 60).padStart(2,"0");

  return (
    <main className="appContainer" style={{ paddingTop: 28 }}>
      <div className="card" style={{ padding: 18, maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <b style={{ fontSize: 18 }}>Test Now</b>
            <div className="muted" style={{ marginTop: 4 }}>Timed mini-check (placeholder). We'll expand into full practice exams.</div>
          </div>
          <div className="badge"><b>Time</b>: {mm}:{ss}</div>
        </div>

        <hr style={{ margin: "14px 0", opacity: 0.35 }} />

        {!done ? (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{idx + 1}. {cur.q}</div>
            <div style={{ display: "grid", gap: 10 }}>
              {cur.a.map((opt, i) => (
                <button
                  key={i}
                  className={"featureCard" + (picked === i ? " selected" : "")}
                  style={{ textAlign: "left", padding: 12 }}
                  onClick={() => setPicked(i)}
                  type="button"
                >
                  {opt}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14, gap: 10 }}>
              <button className="secondaryBtn" onClick={() => (window.location.href="/dashboard")} type="button">Back</button>
              <button className="gold" onClick={next} type="button" disabled={picked === null}>Next →</button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "22px 0 10px" }}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>Score: {score} / {SAMPLE.length}</div>
            <div className="muted" style={{ marginTop: 8 }}>Nice! This is just a starter. We'll add full tests + explanations.</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16 }}>
              <button className="secondaryBtn" type="button" onClick={() => window.location.href="/dashboard"}>Back to Dashboard</button>
              <button className="gold" type="button" onClick={() => window.location.reload()}>Retry</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
