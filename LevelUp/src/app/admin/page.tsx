"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const PIN = "13371337"; // TODO: move server-side later

type QuestionSet = { id: string; domain: string; name: string; status: string; createdAt: string };
type Question = {
  id: string;
  setId: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation?: string | null;
  difficulty: number;
  tags?: string[];
  sortOrder?: number;
  createdAt: string;
};
type AdminUser = {
  id: string;
  email: string;
  displayName?: string | null;
  xp: number;
  startingPosition?: string | null;
  moduleChoice?: string | null;
  createdAt: string;
  lastActiveAt?: string | null;
};

function safeJsonParse<T>(s: string, fallback: T): T {
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function Modal({ open, title, onClose, children }:{
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}){
  if (!open) return null;
  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="modal" style={{ maxWidth: 860 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modalBody">{children}</div>
      </div>
    </div>
  );
}

function Toast({ msg }:{ msg: string }){
  return (
    <div style={{
      position:"fixed", right: 18, bottom: 18, zIndex: 60,
      background:"rgba(0,0,0,0.65)", border:"1px solid rgba(255,255,255,0.18)",
      borderRadius: 14, padding:"10px 12px", backdropFilter:"blur(10px)"
    }}>
      <small style={{ color: "rgba(231,238,252,0.9)" }}>{msg}</small>
    </div>
  );
}

export default function AdminPage(){
  const [ok, setOk] = useState(false);
  const [pin, setPin] = useState("");
  const [tab, setTab] = useState<"questions" | "users">("questions");

  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Users
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userEdits, setUserEdits] = useState<Record<string, Partial<AdminUser>>>({});

  // Question bank
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);
  const [assignStartPos, setAssignStartPos] = useState<"HELPDESK_SUPPORT" | "DESKTOP_TECHNICIAN" | "CLOUD_ENGINEER">("HELPDESK_SUPPORT");
  const [assignCertExam, setAssignCertExam] = useState<"A_PLUS" | "SECURITY_PLUS" | "AZ_900">("A_PLUS");

  const [selectedSet, setSelectedSet] = useState<string>("");
  const [newSetName, setNewSetName] = useState("Networking Set 1");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [dirtyOrder, setDirtyOrder] = useState(false);

  const [qDraft, setQDraft] = useState(`{
  "prompt": "A user reports intermittent connectivity over Wi-Fi. Which step should you do FIRST?",
  "choices": ["Replace the laptop", "Check signal strength and interference", "Reimage the OS", "Disable the firewall"],
  "correctIndex": 1,
  "explanation": "Start with the least invasive troubleshooting: verify RSSI/interference before replacing hardware.",
  "difficulty": 1,
  "tags": ["Wi-Fi", "Troubleshooting"]
}`);

  const [previewQ, setPreviewQ] = useState<Question | null>(null);
  const [uploadPreview, setUploadPreview] = useState<any[] | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("lu_admin_ok");
    if (saved === "1") setOk(true);
  }, []);

  function popToast(msg: string){
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  async function submitPin(){
    setErr(null);
    if (pin !== PIN) { setErr("Invalid PIN"); return; }
    sessionStorage.setItem("lu_admin_ok","1");
    setOk(true);
  }

  // ===== Users =====
  async function refreshUsers(){
    setErr(null);
    const r = await fetch("/api/admin/users");
    const j = await r.json();
    if (!r.ok) { setErr(j?.error || "Failed to load users"); return; }
    setUsers(j.users || []);
  }

  async function saveUser(id: string){
    setErr(null);
    const patch = userEdits[id];
    if (!patch || Object.keys(patch).length === 0) return;
    const r = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch, xp: typeof patch.xp === "string" ? Number(patch.xp) : patch.xp }),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j?.error || "Failed to update user"); return; }
    popToast("User updated");
    setUserEdits(prev => ({ ...prev, [id]: {} }));
    await refreshUsers();
  }

  // ===== Question Sets / Questions =====
  async function assignPlacement(lane: "TEST_NOW" | "TRAINING" | "CERTIFICATIONS") {
    try {
      setAssignMsg(null);
      const body: any = { setId: selectedSetId, lane };
      if (lane === "TRAINING") body.startingPosition = assignStartPos;
      if (lane === "CERTIFICATIONS") body.certExam = assignCertExam;

      const res = await fetch("/api/admin/placements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to assign");
      setAssignMsg(`Assigned: ${lane}${lane === "TRAINING" ? " (" + assignStartPos + ")" : ""}${lane === "CERTIFICATIONS" ? " (" + assignCertExam + ")" : ""}`);
    } catch (e: any) {
      setAssignMsg(e?.message || "Failed to assign");
    }
  }

  async function refreshSets(){
    setErr(null);
    const r = await fetch("/api/admin/qsets");
    const j = await r.json();
    if (!r.ok) { setErr(j?.error || "Failed to load sets"); return; }
    setSets(j.sets || []);
    if (!selectedSet && j.sets?.[0]?.id) setSelectedSet(j.sets[0].id);
  }

  async function refreshQuestions(setId: string){
    if (!setId) return;
    setErr(null);
    const r = await fetch(`/api/admin/questions?setId=${encodeURIComponent(setId)}`);
    const j = await r.json();
    if (!r.ok) { setErr(j?.error || "Failed to load questions"); return; }
    setQuestions((j.questions || []).map((q: any) => ({
      ...q,
      choices: Array.isArray(q.choices) ? q.choices : safeJsonParse<string[]>(q.choices, []),
    })));
    setDirtyOrder(false);
  }

  useEffect(() => {
    if (!ok) return;
    refreshSets();
    refreshUsers();
  }, [ok]);

  useEffect(() => {
    if (ok && selectedSet) refreshQuestions(selectedSet);
  }, [ok, selectedSet]);

  async function createSet(){
    setErr(null);
    const r = await fetch("/api/admin/qsets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: "NETWORKING", name: newSetName, status: "DRAFT" }),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j?.error || "Failed to create set"); return; }
    popToast("Set created");
    await refreshSets();
  }

  async function saveSingleQuestion(){
    setErr(null);
    if (!selectedSet) { setErr("Select a set first"); return; }
    const q = safeJsonParse<any>(qDraft, null);
    if (!q) { setErr("Invalid JSON"); return; }
    const r = await fetch("/api/admin/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId: selectedSet, ...q }),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j?.error || "Failed to save"); return; }
    popToast("Question saved");
    await refreshQuestions(selectedSet);
  }

  async function uploadJsonFile(file: File){
    setErr(null);
    if (!selectedSet) { setErr("Select a set first"); return; }
    const text = await file.text();
    const parsed = safeJsonParse<any>(text, null);
    if (!parsed) { setErr("Could not parse JSON file"); return; }

    const qList = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.questions) ? parsed.questions : null);
    if (!qList) { setErr("JSON must be an array or { questions: [...] }"); return; }

    // show preview modal (first 10)
    setUploadPreview(qList.slice(0, 10));

    const r = await fetch("/api/admin/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId: selectedSet, questions: qList }),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j?.error || "Upload failed"); return; }

    popToast(`Imported ${j.inserted ?? 0} question(s)`);
    await refreshQuestions(selectedSet);
  }

  function moveQuestion(idx: number, dir: -1 | 1){
    const next = [...questions];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    const a = next[idx];
    next[idx] = next[target];
    next[target] = a;
    setQuestions(next);
    setDirtyOrder(true);
  }

  async function saveOrder(){
    setErr(null);
    if (!selectedSet) return;
    const order = questions.map(q => q.id);
    const r = await fetch("/api/admin/questions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId: selectedSet, order }),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j?.error || "Failed to save order"); return; }
    popToast("Order saved");
    await refreshQuestions(selectedSet);
  }

  const selectedSetObj = useMemo(() => sets.find(s => s.id === selectedSet) || null, [sets, selectedSet]);

  if (!ok){
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", padding: 18 }}>
        <div className="topbar">
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, display:"grid", placeItems:"center", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.18)" }}>L</div>
            <div>
              <div style={{ fontWeight: 800 }}>LevelUp Pro</div>
              <small>Admin</small>
            </div>
          </div>
          <span className="badge">🔒 PIN required</span>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Enter admin PIN</div>
          <div className="row" style={{ alignItems:"center" }}>
            <input value={pin} onChange={e => setPin(e.target.value)} placeholder="13371337" />
            <button className="primary" onClick={submitPin} style={{ width: 140 }}>Unlock</button>
          </div>
          {err ? <div style={{ marginTop: 10 }}><small style={{ color:"#ffb4b4" }}>{err}</small></div> : null}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin:"0 auto", padding: 18 }}>
      <div className="topbar">
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, display:"grid", placeItems:"center", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.18)" }}>L</div>
          <div>
            <div style={{ fontWeight: 900 }}>LevelUp Pro</div>
            <small>Admin portal</small>
          </div>
        </div>

        <div className="row" style={{ alignItems:"center", gap: 10 }}>
          <button onClick={() => setTab("questions")} className={tab==="questions" ? "primary" : ""}>Question Bank</button>
          <button onClick={() => setTab("users")} className={tab==="users" ? "primary" : ""}>Users</button>
          <button className="danger" onClick={() => { sessionStorage.removeItem("lu_admin_ok"); location.reload(); }}>Lock</button>
        </div>
      </div>

      {err ? (
        <div className="card" style={{ marginTop: 14, borderColor:"rgba(255,80,80,0.35)", background:"rgba(255,80,80,0.08)" }}>
          <b>Error:</b> {err}
        </div>
      ) : null}

      {tab === "users" ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 20 }}>User Accounts</div>
              <small>Read and edit basic fields stored in the database.</small>
            </div>
            <button onClick={refreshUsers}>Refresh</button>
          </div>

          <div style={{ marginTop: 12, overflowX: "auto" }}>
            <table className="luTable">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>User ID</th>
                  <th>XP</th>
                  <th>Starting Position</th>
                  <th>Module</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const edit = userEdits[u.id] || {};
                  return (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td><small>{u.id}</small></td>
                      <td style={{ width: 120 }}>
                        <input
                          value={(edit.xp ?? u.xp) as any}
                          onChange={(e) => setUserEdits(prev => ({ ...prev, [u.id]: { ...prev[u.id], xp: Number(e.target.value) } }))}
                          type="number"
                        />
                      </td>
                      <td style={{ width: 220 }}>
                        <select
                          value={(edit.startingPosition ?? u.startingPosition ?? "") as any}
                          onChange={(e) => setUserEdits(prev => ({ ...prev, [u.id]: { ...prev[u.id], startingPosition: e.target.value } }))}
                        >
                          <option value="">(none)</option>
                          <option value="HELPDESK_SUPPORT">Helpdesk Support</option>
                          <option value="DESKTOP_TECHNICIAN">Desktop Technician</option>
                          <option value="CLOUD_ENGINEER">Cloud Engineer</option>
                        </select>
                      </td>
                      <td style={{ width: 160 }}>
                        <select
                          value={(edit.moduleChoice ?? u.moduleChoice ?? "") as any}
                          onChange={(e) => setUserEdits(prev => ({ ...prev, [u.id]: { ...prev[u.id], moduleChoice: e.target.value } }))}
                        >
                          <option value="">(none)</option>
                          <option value="INTERVIEW">Interview</option>
                          <option value="CERTIFICATIONS">Certifications</option>
                          <option value="PRO_DEV">Pro Dev</option>
                        </select>
                      </td>
                      <td><small>{new Date(u.createdAt).toLocaleString()}</small></td>
                      <td style={{ width: 120 }}>
                        <button className="primary" onClick={() => saveUser(u.id)}>Save</button>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 ? (
                  <tr><td colSpan={7}><small>No users found.</small></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 14, display:"grid", gridTemplateColumns:"360px 1fr", gap: 14 }}>
          <div className="card">
            <div style={{ fontWeight: 900, fontSize: 18 }}>Question Sets</div>
            <small>Pick a set to import/review questions.</small>

            <div className="row" style={{ marginTop: 10 }}>
              <button onClick={refreshSets}>Refresh</button>
            </div>

            <div style={{ marginTop: 10 }}>
              <label><small>Selected set</small></label>
              <select value={selectedSet} onChange={e => setSelectedSet(e.target.value)}>
                <option value="">Select…</option>
                {sets.map(s => <option key={s.id} value={s.id}>{s.name} ({s.domain})</option>)}
              </select>
              {selectedSetObj ? (
                <div className="row" style={{ marginTop: 10 }}>
                  <span className="badge">Domain: {selectedSetObj.domain}</span>
                  <span className="badge">Status: {selectedSetObj.status}</span>
                </div>
              ) : null}
            </div>

            
            {selectedSetObj ? (
              <div className="card" style={{ marginTop: 12, padding: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Assign this set to the app</div>
                <div className="muted" style={{ marginBottom: 10 }}>
                  Choose where these questions appear (Test Now / Position Training / Certifications).
                </div>
                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <button className="btn" onClick={() => assignPlacement("TEST_NOW")}>Use for Test Now</button>

                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <select value={assignStartPos} onChange={(e) => setAssignStartPos(e.target.value as any)}>
                      <option value="HELPDESK_SUPPORT">Helpdesk Support</option>
                      <option value="DESKTOP_TECHNICIAN">Desktop Technician</option>
                      <option value="CLOUD_ENGINEER">Cloud Engineer</option>
                    </select>
                    <button className="btn" onClick={() => assignPlacement("TRAINING")}>Use for Training</button>
                  </div>

                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <select value={assignCertExam} onChange={(e) => setAssignCertExam(e.target.value as any)}>
                      <option value="A_PLUS">A+</option>
                      <option value="SECURITY_PLUS">Security+</option>
                      <option value="AZ_900">AZ-900</option>
                    </select>
                    <button className="btn" onClick={() => assignPlacement("CERTIFICATIONS")}>Use for Certifications</button>
                  </div>
                </div>
                {assignMsg ? (
                  <div style={{ marginTop: 10 }} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: assignMsg.startsWith("Assigned") ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)" }}>
                    {assignMsg}
                  </div>
                ) : null}
              </div>
            ) : null}

            <hr style={{ marginTop: 14, marginBottom: 14 }} />

            <div style={{ fontWeight: 800 }}>Create new set</div>
            <div className="row" style={{ marginTop: 8 }}>
              <input value={newSetName} onChange={e => setNewSetName(e.target.value)} placeholder="Networking Set 1" />
              <button className="primary" onClick={createSet} style={{ width: 140 }}>Create</button>
            </div>
          </div>

          <div className="card">
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>Import / Add Questions</div>
                <small>Upload JSON, preview it, then reorder questions to build the test.</small>
              </div>
              <button onClick={() => selectedSet && refreshQuestions(selectedSet)}>Refresh</button>
            </div>

            <div style={{ marginTop: 10, display:"grid", gridTemplateColumns:"1fr 1fr", gap: 14 }}>
              <div className="card" style={{ background:"rgba(255,255,255,0.035)" }}>
                <div style={{ fontWeight: 800 }}>Upload JSON file</div>
                <small>Accepted: <code>[...]</code> or <code>{"{ questions: [...] }"}</code>. Imports into the selected set.</small>

                <div className="row" style={{ marginTop: 10 }}>
                  <input ref={fileRef} type="file" accept="application/json" />
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <button
                    className="primary"
                    onClick={() => {
                      const f = fileRef.current?.files?.[0];
                      if (f) uploadJsonFile(f);
                      else setErr("Choose a .json file first");
                    }}
                  >
                    Import JSON
                  </button>
                  <button onClick={() => setUploadPreview(null)}>Clear preview</button>
                </div>
              </div>

              <div className="card" style={{ background:"rgba(255,255,255,0.035)" }}>
                <div style={{ fontWeight: 800 }}>Add one question (JSON)</div>
                <small>Paste a single question JSON object. <code>correctIndex</code> is 0-based.</small>
                <textarea value={qDraft} onChange={e => setQDraft(e.target.value)} style={{ minHeight: 170, marginTop: 10 }} />
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="primary" onClick={saveSingleQuestion}>Save question</button>
                </div>
              </div>
            </div>

            
            {selectedSetObj ? (
              <div className="card" style={{ marginTop: 12, padding: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Assign this set to the app</div>
                <div className="muted" style={{ marginBottom: 10 }}>
                  Choose where these questions appear (Test Now / Position Training / Certifications).
                </div>
                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                  <button className="btn" onClick={() => assignPlacement("TEST_NOW")}>Use for Test Now</button>

                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <select value={assignStartPos} onChange={(e) => setAssignStartPos(e.target.value as any)}>
                      <option value="HELPDESK_SUPPORT">Helpdesk Support</option>
                      <option value="DESKTOP_TECHNICIAN">Desktop Technician</option>
                      <option value="CLOUD_ENGINEER">Cloud Engineer</option>
                    </select>
                    <button className="btn" onClick={() => assignPlacement("TRAINING")}>Use for Training</button>
                  </div>

                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <select value={assignCertExam} onChange={(e) => setAssignCertExam(e.target.value as any)}>
                      <option value="A_PLUS">A+</option>
                      <option value="SECURITY_PLUS">Security+</option>
                      <option value="AZ_900">AZ-900</option>
                    </select>
                    <button className="btn" onClick={() => assignPlacement("CERTIFICATIONS")}>Use for Certifications</button>
                  </div>
                </div>
                {assignMsg ? (
                  <div style={{ marginTop: 10 }} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: assignMsg.startsWith("Assigned") ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)" }}>
                    {assignMsg}
                  </div>
                ) : null}
              </div>
            ) : null}

            <hr style={{ marginTop: 14, marginBottom: 14 }} />

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>Questions</div>
                <small>{selectedSet ? `${questions.length} question(s) in this set` : "Select a set to view questions."}</small>
              </div>
              <div className="row" style={{ alignItems:"center" }}>
                <button onClick={() => selectedSet && refreshQuestions(selectedSet)}>Refresh</button>
                <button className={dirtyOrder ? "primary" : ""} onClick={saveOrder} disabled={!dirtyOrder}>Save order</button>
              </div>
            </div>

            <div style={{ marginTop: 10, display:"grid", gap: 10 }}>
              {questions.map((q, idx) => (
                <div key={q.id} className="card" style={{ background:"rgba(255,255,255,0.03)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", gap: 10, alignItems:"flex-start" }}>
                    <div style={{ flex: "1 1 auto" }}>
                      <div style={{ fontWeight: 800 }}>{idx + 1}. {q.prompt}</div>
                      <div className="row" style={{ marginTop: 8 }}>
                        <span className="badge">Difficulty: {q.difficulty}</span>
                        <span className="badge">Correct: {q.correctIndex + 1}</span>
                        {q.tags?.slice(0,3)?.map(t => <span className="badge" key={t}>#{t}</span>)}
                      </div>
                    </div>
                    <div className="row" style={{ alignItems:"center" }}>
                      <button onClick={() => setPreviewQ(q)}>Preview</button>
                      <button onClick={() => moveQuestion(idx, -1)} disabled={idx === 0}>↑</button>
                      <button onClick={() => moveQuestion(idx, 1)} disabled={idx === questions.length - 1}>↓</button>
                    </div>
                  </div>
                </div>
              ))}
              {selectedSet && questions.length === 0 ? (
                <div className="card" style={{ background:"rgba(255,255,255,0.03)" }}>
                  <small>No questions yet. Upload a JSON file or add one above.</small>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <Modal open={!!previewQ} title="Question preview" onClose={() => setPreviewQ(null)}>
        {previewQ ? (
          <div style={{ display:"grid", gap: 10 }}>
            <div><b>Prompt:</b> {previewQ.prompt}</div>
            <div>
              <b>Choices:</b>
              <ol style={{ marginTop: 6 }}>
                {previewQ.choices.map((c, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    {c} {i === previewQ.correctIndex ? <span className="badge" style={{ marginLeft: 8 }}>Correct</span> : null}
                  </li>
                ))}
              </ol>
            </div>
            {previewQ.explanation ? <div><b>Explanation:</b> {previewQ.explanation}</div> : null}
            <div className="row">
              <span className="badge">Difficulty: {previewQ.difficulty}</span>
              <span className="badge">Created: {new Date(previewQ.createdAt).toLocaleString()}</span>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!uploadPreview} title="Upload preview (first 10)" onClose={() => setUploadPreview(null)}>
        {uploadPreview ? (
          <div style={{ display:"grid", gap: 10 }}>
            <small>Showing a quick preview of what was imported. (Your file may contain more.)</small>
            <div style={{ maxHeight: 420, overflow:"auto" }}>
              {uploadPreview.map((q, i) => (
                <div key={i} className="card" style={{ marginBottom: 10, background:"rgba(255,255,255,0.03)" }}>
                  <div style={{ fontWeight: 800 }}>{i+1}. {q.prompt || "(missing prompt)"}</div>
                  <small>choices: {Array.isArray(q.choices) ? q.choices.length : 0} • correctIndex: {q.correctIndex}</small>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>

      {toast ? <Toast msg={toast} /> : null}
    </div>
  );
}
