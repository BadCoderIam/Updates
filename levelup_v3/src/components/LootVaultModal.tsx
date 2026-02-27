"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type LootBoxType = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";

type PendingBox = {
  id: string;
  type: LootBoxType;
  createdAt: string;
};

type Drop = {
  rewardType: string;
  rewardRef?: string | null;
  quantity: number;
  rarity?: string | null;
};

type OpenResult = {
  lootBoxId: string;
  boxType: LootBoxType;
  drops: Drop[];
};

const REWARD_VISUALS: { key: string; label: string; icon: string }[] = [
  { key: "TOKENS", label: "Tokens", icon: "🪙" },
  { key: "XP_BOOST", label: "XP Boost", icon: "⚡" },
  { key: "BADGE", label: "Badge", icon: "🏅" },
  { key: "RAFFLE_ENTRY", label: "Raffle Entry", icon: "🎟️" },
  { key: "COUPON", label: "Coupon", icon: "🏷️" },
  { key: "PRIZE", label: "Prize", icon: "💎" },
];

function prettyBox(t: LootBoxType) {
  if (t === "BRONZE") return "Bronze";
  if (t === "SILVER") return "Silver";
  if (t === "GOLD") return "Gold";
  if (t === "PLATINUM") return "Platinum";
  if (t === "DIAMOND") return "Diamond";
  return t;
}

function dropTitle(d: Drop) {
  if (d.rewardType === "TOKENS") return `${d.quantity} Tokens`;
  if (d.rewardType === "XP_BOOST") return `${d.quantity} XP Boost`;
  if (d.rewardType === "BADGE") return d.rewardRef ? `Badge: ${d.rewardRef}` : "Badge";
  if (d.rewardType === "RAFFLE_ENTRY") return `${d.quantity} Raffle Entry`;
  if (d.rewardType === "COUPON") return d.rewardRef ? `Coupon: ${d.rewardRef}` : "Coupon";
  if (d.rewardType === "PRIZE") return d.rewardRef ? `Prize: ${d.rewardRef}` : "Prize";
  return `${d.rewardType} x${d.quantity}`;
}

function visualForDrop(d: Drop) {
  const found = REWARD_VISUALS.find((v) => v.key === d.rewardType);
  return found ?? { key: d.rewardType, label: d.rewardType, icon: "🎁" };
}

export default function LootVaultModal(props: {
  open: boolean;
  userId: string;
  onClose: () => void;
  onClaimed?: () => void;
}) {
  const { open, userId, onClose, onClaimed } = props;

  const [pending, setPending] = useState<PendingBox[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Spin state
  const [skip, setSkip] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [results, setResults] = useState<OpenResult[]>([]);
  const [revealedIndex, setRevealedIndex] = useState<number>(-1);
  const [preview, setPreview] = useState<{ icon: string; label: string }>({ icon: "🎁", label: "Spinning…" });
  const intervalRef = useRef<number | null>(null);

  const pendingCount = pending.length;
  const canOpenOne = !spinning && pendingCount > 0;
  const canOpenAll = !spinning && pendingCount > 1;
  const hasResults = results.length > 0;
  const canClaim = hasResults && !spinning;

  const flattenedDrops = useMemo(() => {
    const all: { boxType: LootBoxType; lootBoxId: string; drop: Drop }[] = [];
    for (const r of results) {
      for (const d of r.drops) all.push({ boxType: r.boxType, lootBoxId: r.lootBoxId, drop: d });
    }
    return all;
  }, [results]);

  async function loadPending() {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/loot/pending?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load loot");
      setPending(Array.isArray(data?.pending) ? data.pending : []);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    // reset modal state each open
    setErrorMsg(null);
    setResults([]);
    setRevealedIndex(-1);
    setPreview({ icon: "🎁", label: "Ready" });
    setSpinning(false);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    loadPending();
  }, [open]);

  async function openBoxes(count: number | "all") {
    if (!canOpenOne) return;
    setSpinning(true);
    setErrorMsg(null);
    setResults([]);
    setRevealedIndex(-1);

    try {
      const res = await fetch("/api/loot/open", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to open loot");
      const opened: OpenResult[] = Array.isArray(data?.opened) ? data.opened : [];
      setResults(opened);

      // refresh pending list
      await loadPending();

      if (skip) {
        setRevealedIndex(opened.length - 1);
        setSpinning(false);
        return;
      }

      // sequential reveal
      for (let i = 0; i < opened.length; i++) {
        await spinOnce(opened[i]);
        setRevealedIndex(i);
      }

      setSpinning(false);
    } catch (e: any) {
      setSpinning(false);
      setErrorMsg(e?.message ?? "Error");
    }
  }

  function spinOnce(r: OpenResult) {
    // choose "headline" drop for the spin landing
    const headline = r.drops[0];
    const finalVisual = visualForDrop(headline);

    return new Promise<void>((resolve) => {
      let idx = 0;
      const start = Date.now();
      if (intervalRef.current) window.clearInterval(intervalRef.current);

      intervalRef.current = window.setInterval(() => {
        idx = (idx + 1) % REWARD_VISUALS.length;
        const v = REWARD_VISUALS[idx];
        setPreview({ icon: v.icon, label: v.label });
        if (Date.now() - start > 1550) {
          if (intervalRef.current) window.clearInterval(intervalRef.current);
          intervalRef.current = null;
          setPreview({ icon: finalVisual.icon, label: finalVisual.label });
          window.setTimeout(() => resolve(), 260);
        }
      }, 70);
    });
  }

  async function claimAll() {
    if (!canClaim) return;
    try {
      const lootBoxIds = results.map((r) => r.lootBoxId);
      const res = await fetch("/api/loot/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, lootBoxIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to claim");
      try {
        await fetch('/api/notifications/clear', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, type: 'LOOT_BOX_EARNED' }) });
      } catch {}
      onClaimed?.();
      onClose();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Error");
    }
  }

  if (!open) return null;

  return (
    <div className="luModalOverlay">
      <div className="luModal" role="dialog" aria-modal="true" aria-label="Loot Vault">
        <div className="luModalHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <b style={{ fontSize: 18 }}>🎁 Loot Vault</b>
            <div>
              <small className="luHint">You have <b>{pendingCount}</b> pending loot box{pendingCount === 1 ? "" : "es"}.</small>
            </div>
          </div>
          <button className="secondaryBtn" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="luModalBody">
          <div className="card" style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <div
                className="card"
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: 16,
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(0,0,0,0.20)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
                aria-hidden="true"
              >
                <div style={{ fontSize: 30, lineHeight: 1 }}>{preview.icon}</div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{spinning ? "Spinning…" : hasResults ? "Results" : "Ready"}</div>
                <div style={{ opacity: 0.75, fontSize: 13 }}>{preview.label}</div>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.9, fontSize: 13 }}>
              <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
              Skip animations
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button className="primary" type="button" disabled={!canOpenOne || loading} onClick={() => openBoxes(1)}>
              {spinning ? "Opening…" : "Open 1"}
            </button>
            <button className="secondaryBtn" type="button" disabled={!canOpenAll || loading} onClick={() => openBoxes("all")}
              title={pendingCount <= 1 ? "Need 2+ pending boxes" : "Open all pending"}
            >
              Open All ({pendingCount})
            </button>
            <button className="gold" type="button" disabled={!canClaim} onClick={claimAll}>
              Claim
            </button>
            <span style={{ marginLeft: "auto", opacity: 0.75, fontSize: 13 }}>{loading ? "Loading…" : ""}</span>
          </div>

          {errorMsg && (
            <div className="card" style={{ marginTop: 10, padding: 12, borderColor: "rgba(255,80,80,0.35)", background: "rgba(255,0,0,0.06)" }}>
              <small style={{ color: "rgba(255,180,180,0.95)" }}>
                {errorMsg}
              </small>
            </div>
          )}

          {/* Pending list */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <b>Pending</b>
              <small style={{ opacity: 0.7 }}>Open when you’re ready.</small>
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 10, maxHeight: 140, overflow: "auto" }}>
              {pendingCount ? (
                pending.slice(0, 12).map((b) => (
                  <div key={b.id} className="card" style={{ padding: 12, display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <b>{prettyBox(b.type)} loot box</b>
                      <div style={{ opacity: 0.7, fontSize: 12 }}>Earned {new Date(b.createdAt).toLocaleString()}</div>
                    </div>
                    <span className="badge" style={{ alignSelf: "center" }}>Pending</span>
                  </div>
                ))
              ) : (
                <div className="card" style={{ padding: 12, opacity: 0.75 }}>
                  No pending loot. Keep leveling up to earn rewards.
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          {hasResults && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <b>Revealed</b>
                <small style={{ opacity: 0.7 }}>
                  {skip ? "(Instant reveal)" : "(Sequential)"}
                </small>
              </div>
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {results.map((r, idx) => {
                  const isRevealed = skip || idx <= revealedIndex;
                  return (
                    <div key={r.lootBoxId} className="card" style={{ padding: 12, opacity: isRevealed ? 1 : 0.35 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <b>{prettyBox(r.boxType)} box</b>
                        <small style={{ opacity: 0.7 }}>{isRevealed ? "Opened" : "…"}</small>
                      </div>
                      <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                        {r.drops.map((d, i) => {
                          const v = visualForDrop(d);
                          return (
                            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                <span aria-hidden="true" style={{ fontSize: 16 }}>{v.icon}</span>
                                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {dropTitle(d)}
                                </span>
                              </div>
                              <small style={{ opacity: 0.7 }}>{d.rarity ?? ""}</small>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}