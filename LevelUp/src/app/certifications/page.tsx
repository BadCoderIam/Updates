"use client";

import { useMemo, useState } from "react";

type Exam = "A_PLUS" | "SECURITY_PLUS" | "AZ_900";

const exams: { id: Exam; label: string; sample: string }[] = [
  { id: "A_PLUS", label: "CompTIA A+ (Practice)", sample: "What is the purpose of DHCP?" },
  { id: "SECURITY_PLUS", label: "Security+ (Practice)", sample: "Explain the difference between authentication and authorization." },
  { id: "AZ_900", label: "AZ-900 (Practice)", sample: "What is the shared responsibility model in cloud computing?" },
];

export default function CertificationsPage() {
  const userId = "demo-user";
  const [open, setOpen] = useState(false);
  const [exam, setExam] = useState<Exam>("A_PLUS");
  const [question, setQuestion] = useState(exams[0].sample);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const canSubmit = useMemo(() => answer.trim().length >= 10, [answer]);

  function onExamChange(v: Exam) {
    setExam(v);
    setQuestion(exams.find((x) => x.id === v)?.sample ?? "");
    setAnswer("");
  }

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch("/api/certifications/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, exam, prompt: question, answer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setAnswer("");
      alert(`Saved. XP +${data.xpAwarded} (cert practice)`);
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
      <div className="card" style={{ flex: "1 1 640px" }}>
        <h2 style={{ marginTop: 0 }}>Certifications</h2>
        <p><small>Practice tests live in a separate module from interview questions.</small></p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="primary" onClick={() => setOpen(true)}>Start Certification Practice</button>
          <a href="/"><button>Home</button></a>
          <a href="/dashboard"><button>Dashboard</button></a>
        </div>

        <hr style={{ margin: "14px 0" }} />

        <h3>Included practice tracks</h3>
        <ul>
          <li>CompTIA A+ (Practice)</li>
          <li>Security+ (Practice)</li>
          <li>AZ-900 (Practice)</li>
        </ul>

        <p><small>Note: exam names are trademarks of their respective owners. This module provides practice content only.</small></p>
      </div>

      <div className="card" style={{ flex: "1 1 360px" }}>
        <h3 style={{ marginTop: 0 }}>Tip</h3>
        <p><small>Next: timed exams, scoring, and per-domain analytics per certification.</small></p>
      </div>

      {open && (
        <div className="modalOverlay" onMouseDown={() => setOpen(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <b>Certification Practice</b>
                <div><small>Module window • separate from interviews</small></div>
              </div>
              <button className="danger" onClick={() => setOpen(false)}>Close</button>
            </div>

            <div className="modalBody">
              <label>Certification</label>
              <select value={exam} onChange={(e) => onExamChange(e.target.value as Exam)}>
                {exams.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>

              <label style={{ display: "block", marginTop: 12 }}>Question prompt</label>
              <textarea rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} />

              <label style={{ display: "block", marginTop: 12 }}>Your answer</label>
              <textarea rows={8} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Explain the concept clearly, as if teaching someone." />

              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <button className="primary" disabled={!canSubmit || loading} onClick={submit}>
                  {loading ? "Saving..." : "Start Now!"}
                </button>
                <small>{!canSubmit ? "Write at least a sentence." : " "}</small>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
    </>
  );
}
