"use client";

import { useMemo } from "react";
import { getActivities } from "@/lib/activityStore";

type NextAction =
  | "start_now"
  | "mock_interview"
  | "position_training"
  | "cert_practice"
  | "test_now"
  | "hr_interview";

type NextItem = {
  id: string;
  title: string;
  desc: string;
  status: "todo" | "done" | "locked";
  action?: NextAction;
  pill?: string;
};

export default function WhatsNextModal(props: {
  open: boolean;
  onClose: () => void;
  userId: string;
  hrPassed: boolean;
  onAction: (action: NextAction) => void;
}) {
  const { open, onClose, userId, hrPassed, onAction } = props;

  const items = useMemo<NextItem[]>(() => {
    const acts = getActivities(userId);
    const has = (t: string) => acts.some((a) => a.type === t);

    const passedS1 = has("PASS_INTERVIEW_STAGE1");
    const passedS2 = has("PASS_INTERVIEW_STAGE2");
    const didPos = has("COMPLETE_POSITION_TRAINING");
    const didCert = has("COMPLETE_CERT_PRACTICE");
    const didTestNow = has("COMPLETE_TEST_NOW");

    const list: NextItem[] = [
      {
        id: "hr",
        title: "HR screen",
        desc: "Pass the HR screen to unlock tech readiness flags.",
        status: hrPassed ? "done" : "todo",
        action: hrPassed ? undefined : "hr_interview",
        pill: hrPassed ? "Passed" : "Start",
      },
      {
        id: "s1",
        title: "Mock tech interview – Stage 1",
        desc: "MCQ-only interview. Pass to unlock Stage 2.",
        status: passedS1 ? "done" : "todo",
        action: passedS1 ? undefined : "mock_interview",
        pill: passedS1 ? "Passed" : "Open",
      },
      {
        id: "s2",
        title: "Mock tech interview – Stage 2",
        desc: "Mixed interview (MCQ + short answers).",
        status: passedS2 ? "done" : passedS1 ? "todo" : "locked",
        action: passedS2 ? undefined : passedS1 ? "mock_interview" : undefined,
        pill: passedS2 ? "Passed" : passedS1 ? "Open" : "Locked",
      },
      {
        id: "pos",
        title: "Position training",
        desc: "Role-based practice rounds that award XP per correct answer.",
        status: didPos ? "done" : "todo",
        action: didPos ? undefined : "position_training",
        pill: didPos ? "Complete" : "Play",
      },
      {
        id: "cert",
        title: "Certification practice",
        desc: "A+, Security+, AZ-900 MCQ practice modules.",
        status: didCert ? "done" : "todo",
        action: didCert ? undefined : "cert_practice",
        pill: didCert ? "Complete" : "Practice",
      },
      {
        id: "test",
        title: "Test now",
        desc: "Timed mini-check to benchmark your current level.",
        status: didTestNow ? "done" : "todo",
        action: didTestNow ? undefined : "test_now",
        pill: didTestNow ? "Complete" : "Start",
      },
    ];

    // If everything is done, keep it celebratory but useful.
    const allDone = list.every((x) => x.status === "done");
    if (allDone) {
      list.unshift({
        id: "done",
        title: "You’re fully up to date",
        desc: "Nice work — keep practicing to earn more XP and stay sharp.",
        status: "done",
        action: "start_now",
        pill: "Keep going",
      });
    }
    return list;
  }, [userId, hrPassed]);

  if (!open) return null;

  // Duplicate the list for a seamless marquee scroll.
  const track = [...items, ...items];

  return (
    <div className="luModalOverlay" onClick={onClose}>
      <div className="luModal luWhatsNextModal" role="dialog" aria-modal="true" aria-label="What's next" onClick={(e) => e.stopPropagation()}>
        <div className="luModalHeader">
          <div>
            <b style={{ fontSize: 18 }}>What's next</b>
            <div style={{ opacity: 0.8, fontSize: 13 }}>Suggested modules to level up (saved to your profile).</div>
          </div>
          <button className="secondaryBtn" onClick={onClose}>Close</button>
        </div>

        <div className="nextMarquee" role="list" aria-label="Next steps">
          <div className="nextTrack">
            {track.map((it, i) => (
              <div
                key={`${it.id}-${i}`}
                className={"nextCard" + (it.status === "done" ? " done" : it.status === "locked" ? " locked" : "")}
                role="listitem"
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div className="nextTitle">{it.title}</div>
                  {it.pill ? <span className="badge">{it.pill}</span> : null}
                </div>
                <div className="nextDesc">{it.desc}</div>
                <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <small style={{ opacity: 0.6, whiteSpace: "nowrap" }}>{it.status === "done" ? "Done" : it.status === "locked" ? "Locked" : "To do"}</small>
                  {it.action ? (
                    <button className="primary" onClick={() => onAction(it.action!)} disabled={it.status === "locked"}>
                      {it.status === "locked" ? "Locked" : "Open"}
                    </button>
                  ) : (
                    <button className="secondaryBtn" disabled>Completed</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
