"use client";

import React, { useMemo } from "react";
import { getActiveUser } from "@/lib/userStore";

type WhatsNextAction = "start_now" | "mock_interview";

type WhatsNextItem = {
  id: string;
  title: string;
  subtitle: string;
  status: "todo" | "locked" | "done";
  action: WhatsNextAction;
  cta: string;
  badge?: string;
};

function getTrackForPosition(pos?: string): "helpdesk" | "desktop" | "aws" | "azure_m365" {
  if (!pos) return "helpdesk";
  const p = pos.toUpperCase();
  if (p.includes("DESKTOP")) return "desktop";
  if (p.includes("CLOUD")) return "aws";
  return "helpdesk";
}

function readBool(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export default function WhatsNextPanel(props: {
  hrPassed: boolean;
  techReady: boolean;
  onOpenStartNow: () => void;
  onOpenMockInterview: () => void;
}) {
  const { hrPassed, techReady, onOpenStartNow, onOpenMockInterview } = props;

  const items = useMemo<WhatsNextItem[]>(() => {
    const u = getActiveUser();
    const userId = u?.id ?? "demo-user";
    const track = getTrackForPosition(u?.startingPosition);

    const passedS1 = readBool(`lu_mock_passed_s1_${track}_${userId}`);
    const passedS2 = readBool(`lu_mock_passed_s2_${track}_${userId}`);

    const out: WhatsNextItem[] = [];

    out.push({
      id: "hr",
      title: "HR screen",
      subtitle: "Pass the HR screen to unlock tech readiness flags.",
      status: hrPassed ? "done" : "todo",
      action: "start_now",
      cta: hrPassed ? "View" : "Start",
      badge: hrPassed ? "Passed" : undefined,
    });

    out.push({
      id: "mock_s1",
      title: "Mock tech interview — Stage 1",
      subtitle: "MCQ-only interview. Pass to unlock Stage 2.",
      status: passedS1 ? "done" : "todo",
      action: "mock_interview",
      cta: "Open",
      badge: passedS1 ? "Passed" : undefined,
    });

    out.push({
      id: "mock_s2",
      title: "Mock tech interview — Stage 2",
      subtitle: "Mixed interview (MCQ + short response).",
      status: passedS1 ? (passedS2 ? "done" : "todo") : "locked",
      action: "mock_interview",
      cta: passedS1 ? "Open" : "Locked",
      badge: passedS2 ? "Passed" : passedS1 ? "Unlocked" : undefined,
    });

    out.push({
      id: "position_training",
      title: "Position training",
      subtitle: "Role-based practice questions that award XP.",
      status: "todo",
      action: "start_now",
      cta: "Open Start Now",
    });
    out.push({
      id: "cert_practice",
      title: "Certification practice",
      subtitle: "A+, Security+, AZ-900 MCQ practice modules.",
      status: "todo",
      action: "start_now",
      cta: "Open Start Now",
    });
    out.push({
      id: "test_now",
      title: "Test now",
      subtitle: "Timed mini-check to benchmark your current level.",
      status: techReady ? "todo" : "locked",
      action: "start_now",
      cta: techReady ? "Open Start Now" : "Locked",
      badge: techReady ? "Ready" : "Tech Ready: No",
    });

    const rank = (s: WhatsNextItem["status"]) => (s === "todo" ? 0 : s === "locked" ? 1 : 2);
    return out.sort((a, b) => rank(a.status) - rank(b.status));
  }, [hrPassed, techReady]);

  const handleAction = (a: WhatsNextAction) => {
    if (a === "mock_interview") return onOpenMockInterview();
    return onOpenStartNow();
  };

  return (
    <div className="card whatsNextCard" aria-label="What's next">
      <div className="whatsNextHeader">
        <div>
          <div className="cardTitle">What’s next</div>
          <div className="cardSub">Fast wins based on what you haven’t finished yet.</div>
        </div>
        <div className="whatsNextHint">Auto-scroll</div>
      </div>

      <div className="whatsNextMarquee" role="region" aria-label="Next steps carousel">
        <div className="whatsNextTrack">
          {[...items, ...items].map((it, idx) => (
            <div key={`${it.id}-${idx}`} className={`whatsNextTile status-${it.status}`}>
              <div className="tileTop">
                <div className="tileTitle">{it.title}</div>
                <div className="tileMeta">
                  {it.badge ? <span className="tileBadge">{it.badge}</span> : null}
                  <span className={`tilePill pill-${it.status}`}>{it.status === "todo" ? "To do" : it.status}</span>
                </div>
              </div>
              <div className="tileSub">{it.subtitle}</div>
              <div className="tileActions">
                <button
                  className="btnSecondary"
                  onClick={() => handleAction(it.action)}
                  disabled={it.status === "locked"}
                >
                  {it.cta}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
