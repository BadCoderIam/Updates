"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Exam = "A_PLUS" | "SECURITY_PLUS" | "AZ_900";
type Q = {
  id?: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation?: string | null;
};

export default function CertMCQPage() {
  const [exam, setExam] = useState<Exam>("A_PLUS");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [setLabel, setSetLabel] = useState<string>("Certifications");
  const [loading, setLoading] = useState(true);

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  const examLabel = useMemo(() => {
    if (exam === "A_PLUS") return "A+";
    if (exam === "SECURITY_PLUS") return "Security+";
    return "AZ-900";
  }, [exam]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/content/active?lane=CERTIFICATIONS&certExam=${encodeURIComponent(exam)}`, { cache: "no-store" as any });
        const json = await res.json();
        const qs = (json?.questions || []).map((q: any) => ({
          id: q.id,
          prompt: q.prompt,
          choices: Array.isArray(q.choices) ? q.choices : q.choices?.choices || q.choices,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        })) as Q[];

        if (mounted) {
          setQuestions(qs);
          setSetLabel(json?.set?.name ? `Certifications · ${examLabel} · ${json.set.name}` : `Certifications · ${examLabel}`);
          setIdx(0);
          setSelected(null);
          setSubmitted(false);
          setScore(0);
        }
      } catch {
        if (mounted) setQuestions([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [exam, examLabel]);

  const q = questions[idx];
  const total = questions.length;
  const canSubmit = selected !== null && !submitted;
  const isCorrect = submitted && selected === q?.correctIndex;

  function submit() {
    if (!q || selected === null || submitted) return;
    setSubmitted(true);
    if (selected === q.correctIndex) setScore((s) => s + 1);
  }

  function next() {
    if (idx + 1 >= total) return;
    setIdx(idx + 1);
    setSelected(null);
    setSubmitted(false);
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 980 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 12 }}>
          <div>
            <div className="muted" style={{ fontWeight: 700, letterSpacing: 0.2 }}>{setLabel}</div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>Practice Test</div>
          </div>
          <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div className="pill">Score: {score}/{total}</div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" onClick={() => setExam("A_PLUS")} style={{ opacity: exam === "A_PLUS" ? 1 : 0.6 }}>A+</button>
              <button className="btn" onClick={() => setExam("SECURITY_PLUS")} style={{ opacity: exam === "SECURITY_PLUS" ? 1 : 0.6 }}>Security+</button>
              <button className="btn" onClick={() => setExam("AZ_900")} style={{ opacity: exam === "AZ_900" ? 1 : 0.6 }}>AZ-900</button>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          {loading ? (
            <div className="muted">Loading assigned certification set…</div>
          ) : !q ? (
            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>No certification set assigned</div>
              <div className="muted" style={{ marginTop: 8 }}>
                In Admin → select a set → Assign → Use for Certifications ({examLabel}).
              </div>
              <div style={{ marginTop: 14 }}>
                <Link className="btn" href="/admin">Open Admin</Link>
              </div>
            </div>
          ) : (
            <>
              <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 800 }}>Question {idx + 1} of {total}</div>
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
                  {q.explanation ? <div className="muted" style={{ marginTop: 6 }}>{q.explanation}</div> : null}
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
                  <button className="btn" disabled={!submitted || idx + 1 >= total} onClick={next} style={{ opacity: submitted && idx + 1 < total ? 1 : 0.45 }}>
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
