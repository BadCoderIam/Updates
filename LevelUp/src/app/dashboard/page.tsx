"use client";

import { useEffect, useMemo, useState } from "react";
import ProgressBar from "@/components/ProgressBar";
import MerchModal from "@/components/MerchModal";

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
  return t;
}

export default function Dashboard() {
  const userId = "demo-user";

  const [elig, setElig] = useState<Eligibility | null>(null);
  const [user, setUser] = useState<{ startingPosition: string | null } | null>(null);
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [merchOpen, setMerchOpen] = useState(false);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [positionChangeMode, setPositionChangeMode] = useState(false);
  const [pendingPos, setPendingPos] = useState<string | null>(null);
  const [posSaving, setPosSaving] = useState(false);

  const [notes, setNotes] = useState<Notification[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [hrPassed, setHrPassed] = useState<boolean>(false);

  const hasHRInvite = useMemo(() => notes.some(n => n.type === "HR_INVITE"), [notes]);
  const hasTechReady = useMemo(() => notes.some(n => n.type === "TECH_INTERVIEW_READY"), [notes]);

  const xp = useMemo(() => (elig?.xp ?? 0), [elig]);
  const levelMax = 500;

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/summary?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setNotes(data.notifications ?? []);
      setUser(data.user ?? null);
      if (!data.user?.startingPosition) { setPositionChangeMode(false); setPendingPos(null); setShowPositionModal(true); }

      setBadges(data.badges ?? []);
      setOffers(data.offers ?? []);
      setElig((prev) => prev ? { ...prev, xp: data.xp ?? prev.xp } : null);

      const hrRes = await fetch(`/api/interviews/hr/status?userId=${encodeURIComponent(userId)}`);
      const hrData = await hrRes.json();
      if (hrRes.ok) setHrPassed(Boolean(hrData.passed));
    } catch (e: any) {
      alert(e.message ?? "Error");
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
      alert(e?.message ?? "Error");
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
      await refresh();
    } catch (e: any) {
      alert(e.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const highlight = notes.find(n => n.type === "TECH_INTERVIEW_READY") ?? notes[0];

  return (

    <>

      <header className="navTop" style={{ position: "sticky", top: 0, zIndex: 30, marginBottom: 18 }}>
        <div className="brandLock">
          <div className="brandMark">L</div>
          <div className="brandText">
          </div>
        </div>

        <nav className="navLinks">
          <a href="/dashboard">Dashboard</a>
          <a href="/position-training">Training</a>
          <a href="/cert-mcq">Certifications</a>
          <a href="#" onClick={(e) => (e.preventDefault(), setMerchOpen(true))}>Merch</a>
          <a href="/admin">Admin</a>
        </nav>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="secondaryBtn" type="button" onClick={() => (window.location.href = "/start#pricing")}>Pricing</button>
          <button className="primaryBtn" type="button" onClick={() => setShowLaunchModal(true)}>Start Now →</button>
          <div className="userPill">
            <span className="userDot" />
            <span>{userId}</span>
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
                <button className="luRoleCard" type="button" onClick={() => (window.location.href="/position-training")}>
                  <div className="luRoleIcon" aria-hidden="true">🎯</div>
                  <div className="luRoleTitle">Position training</div>
                  <div className="luRoleDesc">Practice role-based questions and earn XP.</div>
                </button>

                <button className="luRoleCard" type="button" onClick={() => (window.location.href="/cert-mcq")}>
                  <div className="luRoleIcon" aria-hidden="true">📚</div>
                  <div className="luRoleTitle">Certifications</div>
                  <div className="luRoleDesc">A+, Security+, AZ-900 practice modules.</div>
                </button>

                <button className="luRoleCard" type="button" onClick={() => (window.location.href="/test-now")}>
                  <div className="luRoleIcon" aria-hidden="true">⚡</div>
                  <div className="luRoleTitle">Test now!</div>
                  <div className="luRoleDesc">Timed mini-check to benchmark your level.</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
            {hrPassed && hasTechReady ? (
              <button className="gold" style={{ width: "100%" }} onClick={() => window.location.href="/interview/tech"}>
                Begin Tech Interview →
              </button>
            ) : (
              <button style={{ width: "100%" }} disabled>
                Begin Tech Interview →
              </button>
            )}
            <small style={{ display: "block", marginTop: 6, opacity: 0.8 }}>
              {hrPassed && hasTechReady ? "Final step before the offer!" : "Unlock after HR pass + Tech Ready"}
            </small>
          </div>

          <hr style={{ margin: "14px 0" }} />

          <h4 style={{ margin: "0 0 8px 0" }}>Progress</h4>

          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <small>Helpdesk Support Level 1</small>
              <small>{elig?.readiness ? `${elig.readiness.toFixed(0)}% ready` : "—"}</small>
            </div>
            <div style={{ marginTop: 10 }}>
              <ProgressBar value={Number.isFinite(xp) ? xp : 0} max={levelMax} />
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
              <b>Welcome!</b>
              <div><small>{userId}</small></div>
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
              <button onClick={refresh} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button>
              <button className="primary" onClick={checkEligibility} disabled={loading}>Check Eligibility</button>
              {hasHRInvite && <button className="primary" onClick={() => window.location.href="/interview/hr"}>Start HR Interview</button>}
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Notifications</h3>
            {highlight ? (
              <div className={"card " + (highlight.type === "TECH_INTERVIEW_READY" ? "notifHighlight" : "")} style={{ marginTop: 10 }}>
                <p style={{ margin: 0 }}><b>{highlight.title}</b></p>
                <p style={{ margin: "6px 0" }}><small>{prettyType(highlight.type)} • {new Date(highlight.createdAt).toLocaleString()}</small></p>
                <p style={{ margin: 0 }}>{highlight.body}</p>
                {highlight.scheduledAt && <p style={{ margin: "6px 0 0 0" }}><small>Scheduled: {new Date(highlight.scheduledAt).toLocaleString()}</small></p>}
              </div>
            ) : (
              <p><small>No notifications yet.</small></p>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Your Progress</h3>
            <div className="row" style={{ alignItems: "center" }}>
              <span className="badge"><b>Helpdesk Support Level 1</b></span>
              <span className="badge">XP: {Number.isFinite(xp) ? xp : 0} / {levelMax}</span>
              <span className="badge">{elig?.eligible ? "Interview Ready" : "Not ready yet"}</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <ProgressBar value={Number.isFinite(xp) ? xp : 0} max={levelMax} />
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Results</h3>
            {offers.length ? (
              offers.map((o) => (
                <div key={o.id} className="card" style={{ marginTop: 10 }}>
                  <p style={{ margin: 0 }}><b>{o.title}</b></p>
                  <p style={{ margin: "6px 0" }}><small>{o.companyName} • {o.roleLabel} • {new Date(o.createdAt).toLocaleString()}</small></p>
                  <p style={{ margin: 0 }}><b>Comp</b>: {o.salaryText}</p>
                </div>
              ))
            ) : (
              <p style={{ opacity: 0.8 }}>No Results Yet<br/><small>Earn a mock job offer and badge!</small></p>
            )}

            {badges.length ? (
              <div style={{ marginTop: 12 }}>
                <small><b>Badges</b></small>
                {badges.slice(0, 2).map((b) => (
                  <div key={b.id} style={{ marginTop: 8 }}>
                    <small>• {b.label} (expires {new Date(b.expiresAt).toLocaleDateString()})</small>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
            </div>
    </div>
    </main>
      <MerchModal open={merchOpen} onClose={() => setMerchOpen(false)} />
</>
  );
}
