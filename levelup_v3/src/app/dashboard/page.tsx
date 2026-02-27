"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ProgressBar from "@/components/ProgressBar";
import MerchModal from "@/components/MerchModal";
import MockInterviewModal from "@/components/MockInterviewModal";
import PracticeMiniGameModal from "@/components/PracticeMiniGameModal";
import WhatsNextPanel from "@/components/WhatsNextPanel";
import AvatarMenu from "@/components/AvatarMenu";
import LootVaultModal from "@/components/LootVaultModal";
import { getActiveUser, setActiveUserId } from "@/lib/userStore";
import { addActivity, getActivities, clearActivitiesByType, clearActivities, removeActivity, type ActivityItem } from "@/lib/activityStore";

type Eligibility = {
  eligible: boolean;
  readiness: number;
  xp: number;
  reason: string;
};

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  scheduledAt?: string | null;
  createdAt: string;
};

type Badge = { id: string; label: string; issuedAt: string; expiresAt: string; code: string };
type Offer = { id: string; title: string; salaryText: string; createdAt: string; companyName: string; roleLabel: string };


function labelPos(p: string){
  if (p === "HELPDESK_SUPPORT") return "Helpdesk Support";
  if (p === "DESKTOP_TECHNICIAN") return "Desktop Technician";
  if (p === "CLOUD_ENGINEER") return "Cloud Engineer";
  return p;
}

function RoleCard(props: { title: string; desc: string; icon: string; selected: boolean; onClick: () => void }){
  return (
    <button className={"luRoleCard" + (props.selected ? " selected" : "")} onClick={props.onClick} type="button">
      <div className="luRoleIcon" aria-hidden="true">{props.icon}</div>
      <div className="luRoleTitle">{props.title}</div>
      <div className="luRoleDesc">{props.desc}</div>
      <div className="luRoleCheck" aria-hidden="true">{props.selected ? "✓" : ""}</div>
    </button>
  );
}

function prettyType(t: string){
  if (t === "HR_INVITE") return "Hiring Manager Ping";
  if (t === "TECH_INTERVIEW_READY") return "Tech Interview Ready";
  if (t === "LOOT_BOX_EARNED") return "Reward";
  return t;
}

export default function Dashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState<string | null>(null);
  const [localXp, setLocalXp] = useState<number>(0);
  const [localLevel, setLocalLevel] = useState<number>(1);

  const [elig, setElig] = useState<Eligibility | null>(null);
  const [user, setUser] = useState<{ startingPosition: string | null } | null>(null);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [merchOpen, setMerchOpen] = useState(false);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [positionTrainingOpen, setPositionTrainingOpen] = useState(false);
  const [certPracticeOpen, setCertPracticeOpen] = useState(false);
  const [testNowOpen, setTestNowOpen] = useState(false);
  const [mockInterviewOpen, setMockInterviewOpen] = useState(false);
  const [positionChangeMode, setPositionChangeMode] = useState(false);
  const [pendingPos, setPendingPos] = useState<string | null>(null);
  const [posSaving, setPosSaving] = useState(false);

  const [notes, setNotes] = useState<Notification[]>([]);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [hrPassed, setHrPassed] = useState<boolean>(false);
  const [lootOpen, setLootOpen] = useState(false);

  // Level-up detection (notification-only; user opens vault when ready)
  const prevLevelRef = useRef<number>(0);

  const hasHRInvite = useMemo(() => notes.some(n => n.type === "HR_INVITE"), [notes]);
  const hasTechReady = useMemo(() => notes.some(n => n.type === "TECH_INTERVIEW_READY"), [notes]);

  // Prefer local XP (from interviews / practice) so the dashboard reacts immediately.
  const xp = useMemo(() => (localXp ?? elig?.xp ?? 0), [localXp, elig]);
  // Show progress within the CURRENT level (each level = 500 XP).
  const levelSpan = 500;
  const xpIntoLevel = Math.max(0, xp - (Math.max(1, localLevel) - 1) * levelSpan);
  const levelMax = levelSpan;

  function setLaunchGate(target: "position-training" | "cert-mcq" | "test-now") {
    try {
      localStorage.setItem(
        "lu_module_gate_v1",
        JSON.stringify({ target, exp: Date.now() + 2 * 60 * 1000 })
      );
    } catch {}
  }

  async function refresh(activeUserId: string) {
    setLoading(true);
    try {
      // Re-hydrate local XP/level on refresh (in case another modal updated it).
      try {
        const u = getActiveUser();
        setLocalXp(u.xp ?? 0);
        setLocalLevel((u as any).level ?? 1);
        setUserLabel(u.displayName);
        setActivity(getActivities(u.id));
      } catch {}

      const res = await fetch(`/api/users/summary?userId=${encodeURIComponent(activeUserId)}`);
      const text = await res.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      if (!res.ok) throw new Error(data?.error ?? data?.detail ?? text ?? "Failed");
      setNotes(data.notifications ?? []);
      setUser(data.user ?? null);
      setTokenBalance(Number(data.tokenBalance ?? data.user?.tokenBalance ?? 0) || 0);
      if (!data.user?.startingPosition) { setPositionChangeMode(false); setPendingPos(null); setShowPositionModal(true); }

      setBadges(data.badges ?? []);
      setOffers(data.offers ?? []);
      setElig((prev) => prev ? { ...prev, xp: data.xp ?? prev.xp } : null);

      const hrRes = await fetch(`/api/interviews/hr/status?userId=${encodeURIComponent(activeUserId)}`);
      const hrText = await hrRes.text();
      let hrData: any = null;
      try { hrData = hrText ? JSON.parse(hrText) : null; } catch { hrData = null; }
      if (hrRes.ok) setHrPassed(Boolean(hrData?.passed));
    } catch (e: any) {
      console.error(e.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }
  async function confirmPosition(){
    if (!pendingPos) return;
    setPosSaving(true);
    try{
      const res = await fetch("/api/users/set-position", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, startingPosition: pendingPos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to save position");
      setShowPositionModal(false);
      setPositionChangeMode(false);

      setUser({ startingPosition: pendingPos });
    }catch(e: any){
      console.error(e?.message ?? "Error");
    }finally{
      setPosSaving(false);
    }
  }


  async function checkEligibility() {
    setLoading(true);
    try {
      const res = await fetch("/api/interviews/qualify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setElig(data);

      if (data.eligible) {
        await fetch("/api/notifications/create-hr-invite", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId }),
        });
      }
      if (userId) await refresh(userId);
    } catch (e: any) {
      console.error(e.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Local auth (demo + local accounts) until Google sign-in is wired.
    try {
      const u = getActiveUser();
      setUserId(u.id);
      setUserLabel(u.displayName);
      setLocalXp(u.xp ?? 0);
      setLocalLevel((u as any).level ?? 1);
      setActivity(getActivities(u.id));
      localStorage.setItem("lu_demo_user", u.displayName);
    } catch {
      setUserId("demo-user");
      setUserLabel("demo-user");
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    const prev = Number(prevLevelRef.current ?? 0);
    const next = Number(localLevel ?? 1);
    // On initial mount, just sync the ref so refresh doesn't re-grant loot.
    if (prev === 0) {
      prevLevelRef.current = next;
      return;
    }
    if (next <= prev) {
      prevLevelRef.current = next;
      return;
    }

    const gained = next - prev;
    prevLevelRef.current = next;

    // Immediate local notification (will be cleared on click/claim)
    addActivity(userId, {
      type: "LOOT_BOX_EARNED",
      title: "Reward unlocked!",
      body: `You reached Level ${next}. Loot box earned (${gained}). Open when you're ready.`,
    });
    setActivity(getActivities(userId));

    // Server-backed loot + persistent notification (server mints only when XP crosses level threshold)
    fetch("/api/loot/earn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, xpAfter: xp, source: "level_up" }),
    })
      .then(() => {
        // refresh notifications so server notices appear without reload
        try { userId && refresh(userId); } catch {}
      })
      .catch(() => {});
  }, [localLevel, userId, xp]);

  useEffect(() => {
    if (!userId) return;
    refresh(userId);
  }, [userId]);

  useEffect(() => {
    if (mockInterviewOpen) return;
    // When the interview modal closes, refresh local XP/level so the UI updates instantly.
    try {
      const u = getActiveUser();
      setLocalXp(u.xp ?? 0);
      setLocalLevel((u as any).level ?? 1);
      setUserLabel(u.displayName);
      setActivity(getActivities(u.id));
    } catch {}
  }, [mockInterviewOpen]);

  const highlight = notes.find(n => n.type === "TECH_INTERVIEW_READY") ?? notes[0];

  const combinedNotes = useMemo(() => {
    const local = activity.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      body: a.body,
      createdAt: a.createdAt,
      _source: "local",
    })) as any[];
    const server = (notes as any[]).map((n) => ({ ...n, _source: "server" }));
    return [...local, ...server].slice(0, 8);
  }, [activity, notes]);

  async function markNotificationReadAndRemove(n: any) {
    if (!userId) return;
    // Local activity notification
    if (n._source === "local") {
      try {
        removeActivity(userId, n.id);
        setActivity(getActivities(userId));
      } catch {}
      return;
    }

    // Server notification
    try {
      await fetch("/api/notifications/clear", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, ids: [n.id] }),
      });
    } catch {}
    setNotes((prev) => prev.filter((x) => x.id !== n.id));
  }

  if (!userId) {
    return (
      <main style={{ padding: 24 }}>
        <div className="card" style={{ maxWidth: 720, margin: "0 auto", padding: 18 }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>You’re logged out</div>
          <div style={{ marginTop: 8, opacity: 0.85 }}>
            For now, LevelUp uses a demo account while we wire real sign-in.
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              className="primaryBtn"
              type="button"
              onClick={() => {
                try {
                  setActiveUserId("demo-user");
                  const u = getActiveUser();
                  localStorage.setItem("lu_demo_user", u.displayName);
                } catch {}
                setUserId("demo-user");
              }}
            >
              Use demo account →
            </button>
            <button className="secondaryBtn" type="button" onClick={() => (window.location.href = "/start")}>
              Back to Start
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>

      <div className="dashBg" aria-hidden="true" />

      <header className="navTop" style={{ marginBottom: 18 }}>
        <div className="navTopInner">
        <div className="brandLock">
          <div className="brandMark">L</div>
          <div className="brandText">
            <b>LevelUp Pro</b>
            <small>Dashboard</small>
          </div>
        </div>

        <nav className="navLinks">
          <a href="/dashboard">Dashboard</a>
          <a href="/training">Training</a>
          <a href="/certifications">Certifications</a>
          <a href="/rewards">Rewards</a>
          <a href="#" onClick={(e) => (e.preventDefault(), setMerchOpen(true))}>Merch</a>
          <a href="/admin">Admin</a>
        </nav>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="secondaryBtn" type="button" onClick={() => (window.location.href = "/start#pricing")}>Pricing</button>
          <button className="primaryBtn" type="button" onClick={() => setShowLaunchModal(true)}>Start Now →</button>
          <div
            className="card"
            style={{
              padding: "8px 10px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
            }}
            title="XP is earned across interviews and practice. Levels auto-save to your local profile."
          >
            <span style={{ fontWeight: 900, fontSize: 12 }}>Lvl {localLevel}</span>
            <span style={{ opacity: 0.8, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>XP {xp}</span>
          </div>
          <AvatarMenu
            userLabel={userLabel ?? userId}
            avatarUrl={null}
            onLogout={() => {
              try {
                setActiveUserId("demo-user");
                const u = getActiveUser();
                localStorage.setItem("lu_demo_user", u.displayName);
              } catch {}
              setUserId("demo-user");
              setUserLabel("demo-user");
              try {
                const u2 = getActiveUser();
                setLocalXp(u2.xp ?? 0);
                setLocalLevel((u2 as any).level ?? 1);
              } catch {}
            }}
          />
        </div>
        </div>
      </header>

      {showLaunchModal && (
        <div className="luModalOverlay">
          <div className="luModal" role="dialog" aria-modal="true" aria-label="Choose what to start">
            <div className="luModalHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <b style={{ fontSize: 18 }}>Start leveling</b>
                <div><small className="luHint">Choose what you want to work on right now.</small></div>
              </div>
              <button className="secondaryBtn" type="button" onClick={() => setShowLaunchModal(false)}>✕</button>
            </div>

            <div className="luModalBody">
              <div className="luGrid3">
                <button
                  className="luRoleCard"
                  type="button"
                  onClick={() => {
                    setShowLaunchModal(false);
                    setPositionTrainingOpen(true);
                  }}
                >
                  <div className="luRoleIcon" aria-hidden="true">🎯</div>
                  <div className="luRoleTitle">Position training</div>
                  <div className="luRoleDesc">Practice role-based questions and earn XP.</div>
                </button>

                <button
                  className="luRoleCard"
                  type="button"
                  onClick={() => {
                    setShowLaunchModal(false);
                    setCertPracticeOpen(true);
                  }}
                >
                  <div className="luRoleIcon" aria-hidden="true">📚</div>
                  <div className="luRoleTitle">Certifications</div>
                  <div className="luRoleDesc">A+, Security+, AZ-900 practice modules.</div>
                </button>

                <button
                  className="luRoleCard"
                  type="button"
                  onClick={() => {
                    setShowLaunchModal(false);
                    setTestNowOpen(true);
                  }}
                >
                  <div className="luRoleIcon" aria-hidden="true">⚡</div>
                  <div className="luRoleTitle">Test now!</div>
                  <div className="luRoleDesc">Timed mini-check to benchmark your level.</div>
                </button>

                {/* Keep the mock interview inside the same "Start Now" experience */}
                <button
                  className="luRoleCard"
                  type="button"
                  onClick={() => {
                    setShowLaunchModal(false);
                    setMockInterviewOpen(true);
                  }}
                >
                  <div className="luRoleIcon" aria-hidden="true">🧠</div>
                  <div className="luRoleTitle">Mock tech interview</div>
                  <div className="luRoleDesc">Stage 1 MCQ → unlock Stage 2 mixed interview.</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PracticeMiniGameModal
        open={positionTrainingOpen}
        kind="position"
        defaultPath={(user?.startingPosition as any) ?? "HELPDESK_SUPPORT"}
        onClose={() => setPositionTrainingOpen(false)}
        onXpChange={(xp, level) => {
          setLocalXp(xp);
          setLocalLevel(level);
        }}
      />

      <LootVaultModal
        open={lootOpen}
        userId={userId}
        onClose={() => setLootOpen(false)}
        onClaimed={() => {
          // Clear LOOT notifications locally + server-side
          try { clearActivitiesByType(userId, ["LOOT_BOX_EARNED"]); setActivity(getActivities(userId)); } catch {}
          fetch('/api/notifications/clear', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, type: 'LOOT_BOX_EARNED' }) }).catch(() => {});
          // Remove LOOT notifications from the current UI list immediately
          setNotes((prev) => prev.filter((n) => n.type !== 'LOOT_BOX_EARNED'));
          // refresh dashboard data after claim so token balances etc. can be used later
          try { userId && refresh(userId); } catch {}
        }}
      />

      <PracticeMiniGameModal
        open={certPracticeOpen}
        kind="cert"
        onClose={() => setCertPracticeOpen(false)}
        onXpChange={(xp, level) => {
          setLocalXp(xp);
          setLocalLevel(level);
        }}
      />

      <PracticeMiniGameModal
        open={testNowOpen}
        kind="test"
        onClose={() => setTestNowOpen(false)}
        onXpChange={(xp, level) => {
          setLocalXp(xp);
          setLocalLevel(level);
        }}
      />

      {showPositionModal && (
        <div className="luModalOverlay">
          <div className="luModal" role="dialog" aria-modal="true" aria-label="Choose starting position">
            <div className="luModalHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              
              <div>
                <b style={{ fontSize: 18 }}>Choose Your Starting Position</b>
                <div><small className="luHint">This personalizes your learning path. You can change it later.</small></div>
              </div>
              {positionChangeMode && (
                <button className="secondaryBtn" type="button" onClick={() => setShowPositionModal(false)}>✕</button>
              )}
            </div>

            <div className="luModalBody">
              <div className="luGrid3">
                <RoleCard
                  title="Helpdesk Support"
                  desc="Entry-level IT support: tickets, troubleshooting, user support."
                  icon="🧑‍💻"
                  selected={pendingPos === "HELPDESK_SUPPORT"}
                  onClick={() => setPendingPos("HELPDESK_SUPPORT")}
                />
                <RoleCard
                  title="Desktop Technician"
                  desc="Hardware, imaging, endpoint tooling, onsite escalations."
                  icon="🛠️"
                  selected={pendingPos === "DESKTOP_TECHNICIAN"}
                  onClick={() => setPendingPos("DESKTOP_TECHNICIAN")}
                />
                <RoleCard
                  title="Cloud Engineer"
                  desc="Cloud fundamentals, IAM, networking, services, and automation."
                  icon="☁️"
                  selected={pendingPos === "CLOUD_ENGINEER"}
                  onClick={() => setPendingPos("CLOUD_ENGINEER")}
                />
              </div>
            </div>

            <div className="luModalFooter">
              <button className="primary" disabled={!pendingPos || posSaving} onClick={confirmPosition}>
                {posSaving ? "Saving..." : "Start Leveling"}
              </button>
            </div>
          </div>
        </div>
      )}

      <main>
      <div className="bgPattern" />
      <div className="heroBlur" />

      <div className="appContainer">
      <div className="shell">
        <aside className="sidebar">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.10)", border: "1px solid var(--cardBorder)" }} />
            <div>
              <img src="/levelup-pro-logo.svg" alt="LevelUp Pro" style={{height: 22, width: "auto", opacity: 0.95}} />
              <div><small>Interview Prep</small></div>
            </div>
          </div>

          <button className="primary" style={{ width: "100%", marginTop: 8 }} onClick={() => setShowLaunchModal(true)}>
            Start Now!
          </button>

          <div style={{ marginTop: 10 }}>
            {(
              <button className="gold" style={{ width: "100%" }} onClick={() => setMockInterviewOpen(true)}>
                Begin Tech Interview →
              </button>
            )}
            <small style={{ display: "block", marginTop: 6, opacity: 0.8 }}>
              (Test mode) Launches the new mock interview modal.
            </small>
          </div>

          <hr style={{ margin: "14px 0" }} />

          <h4 style={{ margin: "0 0 8px 0" }}>Progress</h4>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <small>Helpdesk Support • Level {localLevel}</small>
              <small>{elig?.readiness ? `${elig.readiness.toFixed(0)}% ready` : "—"}</small>
            </div>
            <div style={{ marginTop: 10 }}>
              <ProgressBar value={Number.isFinite(xpIntoLevel) ? xpIntoLevel : 0} max={levelMax} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, opacity: 0.85 }}>
              <small>XP: {Number.isFinite(xpIntoLevel) ? xpIntoLevel : 0} / {levelMax}</small>
              <small>Tokens: {Number.isFinite(tokenBalance) ? tokenBalance : 0}</small>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: (elig?.eligible ? "rgba(120,220,160,0.8)" : "rgba(255,255,255,0.25)") }} />
              <small>Eligibility for Interview Unlocked!</small>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(255,255,255,0.25)" }} />
              <small>Domain Mastery</small>
              <span style={{ marginLeft: "auto" }}><small>● ● ●</small></span>
            </div>
          </div>
        </aside>

        <section className="maincol">
          <div className="topbar">
            <div>
              <b>Welcome back</b>
              <div><small>Signed in as <span style={{ opacity: 0.95 }}>{userId}</span></small></div>
            </div>

            <div className="kpiRow">
              <span className="badge"><b>Path</b>: {user?.startingPosition ? labelPos(user.startingPosition) : "Not set"}</span>
              {user?.startingPosition && (
                <button className="secondaryBtn" type="button" onClick={() => {
                  setPendingPos(user.startingPosition);
                  setPositionChangeMode(true);
                  setShowPositionModal(true);
                }}>
                  Change
                </button>
              )}

              <span className="badge"><b>HR</b>: {hrPassed ? "Passed ✅" : "Not passed"}</span>
              <span className="badge"><b>Tech Ready</b>: {hasTechReady ? "Yes" : "No"}</span>
              <button onClick={() => userId && refresh(userId)} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button>
              <button className="primary" onClick={checkEligibility} disabled={loading}>Check Eligibility</button>
              {hasHRInvite && <button className="primary" onClick={() => window.location.href="/interview/hr"}>Start HR Interview</button>}
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Notifications</h3>
            {combinedNotes.length ? (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {combinedNotes.map((n: any) => (
                  <div
                    key={n.id}
                    className={"card " + (n.type === "TECH_INTERVIEW_READY" ? "notifHighlight" : "")}
                    role="button"
                    tabIndex={0}
                    onClick={() => markNotificationReadAndRemove(n)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") markNotificationReadAndRemove(n);
                    }}
                    style={{ cursor: "pointer" }}
                    title="Click to mark as read"
                  >
                    <p style={{ margin: 0 }}><b>{n.title}</b></p>
                    <p style={{ margin: "6px 0" }}><small>{prettyType(n.type)} • {new Date(n.createdAt).toLocaleString()}</small></p>
                    <p style={{ margin: 0 }}>{n.body}</p>
                    {n.scheduledAt && <p style={{ margin: "6px 0 0 0" }}><small>Scheduled: {new Date(n.scheduledAt).toLocaleString()}</small></p>}

                    {n.type === "LOOT_BOX_EARNED" && (
                      <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
                        <button
                          className="primary"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Clear this notification immediately (read/cleared)
                            markNotificationReadAndRemove(n);
                            // Also clear any local loot-earned activities so they don't pile up
                            try { clearActivitiesByType(userId ?? "", ["LOOT_BOX_EARNED"]); setActivity(getActivities(userId ?? "")); } catch {}
                            setLootOpen(true);
                          }}
                        >
                          Open Loot Vault
                        </button>
                        <small style={{ opacity: 0.75 }}>Your rewards stack up until you open them.</small>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p><small>No notifications yet.</small></p>
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            <WhatsNextPanel
              hrPassed={hrPassed}
              techReady={hasTechReady}
              onOpenStartNow={() => setShowLaunchModal(true)}
              onOpenMockInterview={() => setMockInterviewOpen(true)}
            />
          </div>


          {/* Removed duplicate progress bar in main column (sidebar already contains the primary progress UI). */}

          {/* "What's next" lives in a premium modal now (open via top bar). */}
        </section>
            </div>
    </div>
    </main>
      <MerchModal open={merchOpen} onClose={() => setMerchOpen(false)} />
      <MockInterviewModal open={mockInterviewOpen} onClose={() => setMockInterviewOpen(false)} />
</>
  );
}
