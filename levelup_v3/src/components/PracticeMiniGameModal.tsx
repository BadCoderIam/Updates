"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { awardXp, getActiveUser } from "@/lib/userStore";
import { addActivity } from "@/lib/activityStore";
import {
  CertTrack,
  PositionPath,
  PracticeQuestion,
  getCertPool,
  getPositionPool,
  getTestNowPool,
} from "@/lib/practicePools";

type Kind = "position" | "cert" | "test";

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickN<T>(arr: T[], n: number) {
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}

function xpForCorrect(q: PracticeQuestion) {
  const d = q.difficulty ?? "easy";
  if (d === "hard") return 40;
  if (d === "medium") return 25;
  return 15;
}

export default function PracticeMiniGameModal(props: {
  open: boolean;
  kind: Kind;
  defaultPath?: PositionPath;
  onClose: () => void;
  onXpChange?: (xp: number, level: number) => void;
}) {
  const { open, kind, defaultPath, onClose, onXpChange } = props;
  const [step, setStep] = useState<"setup" | "quiz" | "summary">("setup");
  const [path, setPath] = useState<PositionPath>(defaultPath ?? "HELPDESK_SUPPORT");
  const [cert, setCert] = useState<CertTrack>("A_PLUS");

  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [earned, setEarned] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<number | null>(null);

  const title =
    kind === "position" ? "Position training" : kind === "cert" ? "Certification practice" : "Test now!";
  const subtitle =
    kind === "position"
      ? "Role-based questions • XP per correct answer"
      : kind === "cert"
        ? "Practice packs • XP per correct answer"
        : "Timed mini-check • bonus XP for speed";

  const isTimed = kind === "test";

  useEffect(() => {
    if (!open) return;
    // Reset modal state every open.
    setStep("setup");
    setIdx(0);
    setSelected(null);
    setLocked(false);
    setCorrect(0);
    setEarned(0);
    setStreak(0);
    setTimeLeft(0);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!isTimed || step !== "quiz") return;
    if (timeLeft <= 0) {
      // Auto-finish.
      setStep("summary");
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
  }, [isTimed, step, timeLeft]);

  const current = questions[idx];
  const progressPct = questions.length ? Math.round(((idx + 1) / questions.length) * 100) : 0;

  function start() {
    let pool: PracticeQuestion[] = [];
    if (kind === "position") pool = getPositionPool(path);
    if (kind === "cert") pool = getCertPool(cert);
    if (kind === "test") pool = getTestNowPool();

    const count = kind === "test" ? 10 : 8;
    setQuestions(pickN(pool, count));
    setIdx(0);
    setSelected(null);
    setLocked(false);
    setCorrect(0);
    setEarned(0);
    setStreak(0);
    setStep("quiz");

    if (kind === "test") {
      setTimeLeft(90);
      timerRef.current = window.setInterval(() => setTimeLeft((t) => t - 1), 1000) as any;
    }
  }

  function close() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    onClose();
  }

  function pickAnswer(i: number) {
    if (!current || locked) return;
    setSelected(i);
    setLocked(true);
    const ok = i === current.correctIndex;
    const base = ok ? xpForCorrect(current) : 0;
    const streakBonus = ok ? Math.min(20, streak * 3) : 0;
    const total = base + streakBonus;
    if (ok) {
      setCorrect((c) => c + 1);
      setStreak((s) => s + 1);
      setEarned((x) => x + total);
    } else {
      setStreak(0);
    }

    // small delay so feedback reads nicely
    window.setTimeout(() => {
      const isLast = idx >= questions.length - 1;
      if (isLast) {
        // Award XP once at the end (prevents double-award on refresh)
        const bonus = kind === "test" ? Math.max(0, Math.floor(timeLeft / 6)) : 0;
        const finalEarn = (ok ? total : 0) + bonus;
        const nextEarned = earned + finalEarn;
        setEarned(nextEarned);
        const u = awardXp(nextEarned);
        if (u && onXpChange) onXpChange(u.xp, u.level);

        // Local notification feed (shown on dashboard)
        try {
          const au = getActiveUser();
          addActivity(au.id, {
            type:
              kind === "position"
                ? "COMPLETE_POSITION_TRAINING"
                : kind === "cert"
                  ? "COMPLETE_CERT_PRACTICE"
                  : "COMPLETE_TEST_NOW",
            title: `${title} complete`,
            body: `Score: ${correct + (ok ? 1 : 0)}/${questions.length} • +${nextEarned} XP`,
          });
        } catch {}
        setStep("summary");
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        // Neon pulse + confetti-lite
        try {
          document.body.classList.add("luPulse");
          setTimeout(() => document.body.classList.remove("luPulse"), 900);
        } catch {}
      } else {
        setIdx((n) => n + 1);
        setSelected(null);
        setLocked(false);
      }
    }, 520);
  }

  if (!open) return null;

  return (
    <div className="luModalOverlay" onMouseDown={close}>
      <div className="luModal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="luModalHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <b style={{ fontSize: 18 }}>{title}</b>
            <div>
              <small className="luHint">{subtitle}</small>
            </div>
          </div>
          <button className="secondaryBtn" type="button" onClick={close}>
            ✕
          </button>
        </div>

        <div className="luModalBody">
          {step === "setup" && (
            <div className="card" style={{ padding: 14 }}>
              {kind === "position" && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 800, marginBottom: 2 }}>Choose your path</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {([
                      ["HELPDESK_SUPPORT", "Helpdesk"],
                      ["DESKTOP_TECHNICIAN", "Desktop"],
                      ["CLOUD_ENGINEER", "Cloud"],
                    ] as any).map(([k, label]: [PositionPath, string]) => (
                      <button
                        key={k}
                        className={"trackBtn" + (path === k ? " active" : "")}
                        type="button"
                        onClick={() => setPath(k)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <small className="luHint">8 randomized MCQs per run • XP on correct answers</small>
                </div>
              )}

              {kind === "cert" && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 800, marginBottom: 2 }}>Choose a certification pack</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {([
                      ["A_PLUS", "A+"],
                      ["SECURITY_PLUS", "Security+"],
                      ["AZ_900", "AZ-900"],
                    ] as any).map(([k, label]: [CertTrack, string]) => (
                      <button
                        key={k}
                        className={"trackBtn" + (cert === k ? " active" : "")}
                        type="button"
                        onClick={() => setCert(k)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <small className="luHint">8 randomized MCQs per run • XP on correct answers</small>
                </div>
              )}

              {kind === "test" && (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontWeight: 800, marginBottom: 2 }}>Quick timed check</div>
                  <small className="luHint">10 mixed questions • 90 seconds • bonus XP based on time left</small>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                <button className="primaryBtn" type="button" onClick={start}>
                  Start →
                </button>
              </div>
            </div>
          )}

          {step === "quiz" && current && (
            <div className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div style={{ fontWeight: 900 }}>Q{idx + 1} / {questions.length}</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {isTimed && (
                    <span className="badge" style={{ fontVariantNumeric: "tabular-nums" }}>
                      ⏱ {Math.max(0, timeLeft)}s
                    </span>
                  )}
                  <span className="badge">XP +{earned}</span>
                  <span className="badge">{progressPct}%</span>
                </div>
              </div>

              <div style={{ marginTop: 12, fontSize: 16, fontWeight: 800 }}>{current.prompt}</div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {current.choices.map((c, i) => {
                  const isSel = selected === i;
                  const isOk = locked && i === current.correctIndex;
                  const isBad = locked && isSel && i !== current.correctIndex;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={
                        "choiceBtn" +
                        (isSel ? " selected" : "") +
                        (isOk ? " correct" : "") +
                        (isBad ? " wrong" : "")
                      }
                      onClick={() => pickAnswer(i)}
                      disabled={locked}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>

              {locked && (
                <div style={{ marginTop: 12 }}>
                  <div className="card" style={{ padding: 12, background: "rgba(255,255,255,0.04)" }}>
                    <div style={{ fontWeight: 900 }}>
                      {selected === current.correctIndex ? "✅ Correct" : "❌ Not quite"}
                    </div>
                    <div style={{ opacity: 0.9, marginTop: 6 }}>{current.explanation}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "summary" && (
            <div className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 950 }}>Run complete</div>
                  <small className="luHint">XP is saved to your local profile.</small>
                </div>
                <span className="badge">+{earned} XP</span>
              </div>
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <div className="card" style={{ padding: 12, background: "rgba(255,255,255,0.04)" }}>
                  <b>Score</b>: {correct} / {questions.length}
                </div>
                {kind === "test" && (
                  <div className="card" style={{ padding: 12, background: "rgba(255,255,255,0.04)" }}>
                    <b>Time left</b>: {Math.max(0, timeLeft)}s
                  </div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button className="secondaryBtn" type="button" onClick={() => setStep("setup")}>
                  Try again
                </button>
                <button className="primaryBtn" type="button" onClick={close}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
