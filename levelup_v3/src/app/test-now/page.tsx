"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Q = {
  id?: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation?: string | null;
};

const FALLBACK: Q[] = [
  {
    prompt: "A user cannot access any websites but can ping 8.8.8.8 successfully. What is the MOST likely issue?",
    choices: ["Default gateway", "DNS server", "Duplex mismatch", "IP conflict"],
    correctIndex: 1,
    explanation: "If IP connectivity works (ping 8.8.8.8) but names fail, DNS is the likely culprit.",
  },
];

export default function TestNowPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Q[]>([]);
  const [setLabel, setSetLabel] = useState<string>("Test Now");
  const [loading, setLoading] = useState(true);

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  const [secondsLeft, setSecondsLeft] = useState(15 * 60);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Gate: this module should be launched from Dashboard → Start Now.
    try {
      const raw = localStorage.getItem("lu_module_gate_v1");
      const gate = raw ? JSON.parse(raw) : null;
      const ok = gate && gate.target === "test-now" && typeof gate.exp === "number" && gate.exp > Date.now();
      if (!ok) {
        router.replace("/dashboard");
        return;
      }
      localStorage.removeItem("lu_module_gate_v1");
    } catch {
      router.replace("/dashboard");
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/content/active?lane=TEST_NOW", { cache: "no-store" as any });
        const json = await res.json();
        const qs = (json?.questions || []).map((q: any) => ({
          id: q.id,
          prompt: q.prompt,
          choices: Array.isArray(q.choices) ? q.choices : q.choices?.choices || q.choices,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        })) as Q[];

        if (mounted) {
          if (qs.length) {
            setQuestions(qs);
            setSetLabel(json?.set?.name ? `Test Now · ${json.set.name}` : "Test Now");
          } else {
            setQuestions(FALLBACK);
            setSetLabel("Test Now · Sample");
          }
        }
      } catch {
        if (mounted) {
          setQuestions(FALLBACK);
          setSetLabel("Test Now · Sample");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [done]);

  useEffect(() => {
    if (secondsLeft === 0 && !done) setDone(true);
  }, [secondsLeft, done]);

  const q = questions[idx];
  const total = questions.length;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const canSubmit = selected !== null && !submitted;
  const isCorrect = submitted && selected === q?.correctIndex;

  function resetForNext(newIdx: number) {
    setIdx(newIdx);
    setSelected(null);
    setSubmitted(false);
  }

  function submit() {
    if (!q || selected === null || submitted) return;
    setSubmitted(true);
    if (selected === q.correctIndex) setScore((s) => s + 1);
  }

  function next() {
    if (idx + 1 >= total) {
      setDone(true);
      return;
    }
    resetForNext(idx + 1);
  }

  const progress = total ? Math.round(((idx + (done ? 1 : 0)) / total) * 100) : 0;

  if (loading) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 980 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Loading Test…</div>
            <div className="muted" style={{ marginTop: 8 }}>
              Pulling the active set from your admin placement.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 980 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>No questions available</div>
            <div className="muted" style={{ marginTop: 8 }}>
              Assign a set to <b>TEST_NOW</b> in the Admin portal, or upload questions to a set first.
            </div>
            <div style={{ marginTop: 14 }}>
              <Link className="btn" href="/admin">Open Admin</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 980 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 12 }}>
          <div>
            <div className="muted" style={{ fontWeight: 700, letterSpacing: 0.2 }}>{setLabel}</div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>Timed Quiz</div>
          </div>
          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <div className="pill">Time: {mm}:{ss}</div>
            <div className="pill">Score: {score}/{total}</div>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 800 }}>Question {idx + 1} of {total}</div>
            <div className="muted">Progress: {progress}%</div>
          </div>

          <div style={{ height: 10 }} />

          <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.25 }}>{q.prompt}</div>

          <div style={{ height: 12 }} />

          <div className="col" style={{ gap: 10 }}>
            {q.choices.map((c, i) => {
              const isSel = selected === i;
              const isRight = submitted && i === q.correctIndex;
              const isWrong = submitted && isSel && i !== q.correctIndex;

              const border = isRight
                ? "rgba(34,197,94,0.55)"
                : isWrong
                ? "rgba(239,68,68,0.55)"
                : isSel
                ? "rgba(251,191,36,0.55)"
                : "rgba(255,255,255,0.12)";

              const bg = isRight
                ? "rgba(34,197,94,0.10)"
                : isWrong
                ? "rgba(239,68,68,0.10)"
                : isSel
                ? "rgba(251,191,36,0.10)"
                : "rgba(255,255,255,0.04)";

              return (
                <button
                  key={i}
                  className="btn"
                  style={{
                    textAlign: "left",
                    justifyContent: "flex-start",
                    padding: "12px 12px",
                    borderRadius: 14,
                    border: `1px solid ${border}`,
                    background: bg,
                    cursor: submitted ? "not-allowed" : "pointer",
                  }}
                  onClick={() => !submitted && setSelected(i)}
                >
                  <span style={{ width: 22, height: 22, borderRadius: 999, border: `1px solid ${border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginRight: 10, fontWeight: 900 }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span style={{ fontWeight: 700 }}>{c}</span>
                </button>
              );
            })}
          </div>

          <div style={{ height: 14 }} />

          {submitted ? (
            <div style={{ padding: 12, borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: isCorrect ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)" }}>
              <div style={{ fontWeight: 900 }}>{isCorrect ? "Correct" : "Incorrect"}</div>
              {!isCorrect ? (
                <div className="muted" style={{ marginTop: 6 }}>
                  Correct answer: <b>{q.choices[q.correctIndex]}</b>
                </div>
              ) : null}
              {q.explanation ? (
                <div className="muted" style={{ marginTop: 6 }}>{q.explanation}</div>
              ) : null}
            </div>
          ) : (
            <div className="muted">Select an answer, then submit to see feedback.</div>
          )}

          <div style={{ height: 14 }} />

          <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn" href="/dashboard">Back</Link>
            <div className="row" style={{ gap: 10 }}>
              <button className="btn" disabled={!canSubmit} onClick={submit} style={{ opacity: canSubmit ? 1 : 0.45 }}>
                Submit
              </button>
              <button className="btn" disabled={!submitted} onClick={next} style={{ opacity: submitted ? 1 : 0.45 }}>
                {idx + 1 >= total ? "Finish" : "Next"}
              </button>
            </div>
          </div>
        </div>

        {done ? (
          <div className="card" style={{ padding: 16, marginTop: 14 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Test complete</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Score: <b>{score}</b> / {total}
            </div>
            <div style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => { setIdx(0); setSelected(null); setSubmitted(false); setScore(0); setSecondsLeft(15*60); setDone(false); }}>
                Retake
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
