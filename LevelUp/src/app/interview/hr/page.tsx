"use client";

import { useEffect, useState } from "react";

type Session = { id: string; stage: string; status: string; startedAt: string; finishedAt?: string | null };

export default function HRInterviewPage() {
  const userId = "demo-user";
  const [session, setSession] = useState<Session | null>(null);
  const [question, setQuestion] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  async function start() {
    setLoading(true);
    try {
      const res = await fetch("/api/interviews/hr/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setSession(data.session);
      setQuestion(data.nextQuestion);
      setLog((l) => [...l, "HR Screen started."]);
    } catch (e: any) {
      alert(e.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  async function submitTurn() {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch("/api/interviews/hr/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, answer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setLog((l) => [...l, `You: ${answer}`, `HM: ${data.nextQuestion}`]);
      setAnswer("");
      setQuestion(data.nextQuestion);
    } catch (e: any) {
      alert(e.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  async function finish() {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch("/api/interviews/hr/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setLog((l) => [...l, `Result: ${data.pass ? "PASS ✅" : "FAIL ❌"} — ${data.summary}`]);
      setSession(null);
      setQuestion("");
    } catch (e: any) {
      alert(e.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="bgPattern" />
      <div className="heroBlur" />
    <main className="row">
      <div className="card" style={{ flex: "1 1 660px" }}>
        <h2 style={{ marginTop: 0 }}>HR Screen (1:1 Hiring Manager)</h2>
        <p><small>This is the MVP text interview flow. Avatars/voice come later.</small></p>

        {!session ? (
          <button onClick={start} disabled={loading}>{loading ? "Starting..." : "Start HR Screen"}</button>
        ) : (
          <>
            <div className="card" style={{ marginTop: 12 }}>
              <p style={{ margin: 0 }}><b>Hiring Manager:</b></p>
              <p style={{ margin: "6px 0 0 0" }}>{question}</p>
            </div>

            <label style={{ display: "block", marginTop: 12 }}>Your answer</label>
            <textarea rows={6} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Use STAR when possible. Be clear and structured." />

            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={submitTurn} disabled={loading || answer.trim().length < 20}>
                {loading ? "Submitting..." : "Submit Answer"}
              </button>
              <button onClick={finish} disabled={loading}>Finish + Score</button>
              <a href="/dashboard"><button>Back to Dashboard</button></a>
            </div>
          </>
        )}
      </div>

      <div className="card" style={{ flex: "1 1 360px" }}>
        <h3 style={{ marginTop: 0 }}>Session log</h3>
        {log.length ? log.map((x, i) => <p key={i} style={{ margin: "6px 0" }}><small>{x}</small></p>) : <p><small>No session yet.</small></p>}
      </div>
    </main>
    </>
  );
}
