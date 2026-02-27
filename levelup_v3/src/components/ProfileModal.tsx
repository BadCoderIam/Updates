"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createUser, getActiveUser, getUsers, setActiveUserId } from "@/lib/userStore";
import RewardsHistoryModal from "@/components/RewardsHistoryModal";

export default function ProfileModal(props: {
  open: boolean;
  onClose: () => void;
  userLabel?: string;
}) {
  const { open, onClose, userLabel } = props;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tick, setTick] = useState(0);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const active = useMemo(() => getActiveUser(), [open, tick]);
  const userId = (active as any)?.id ?? "demo-user";

  // Portal target: avoids "position: fixed" being trapped by a transformed ancestor.
  const mountNode = useMemo(() => {
    if (typeof window === "undefined") return null;
    return document.body;
  }, []);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    // prevent background scroll while modal is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mountNode) return null;
  const users = getUsers();

  return createPortal(
    <div
      className="luModalOverlay"
      role="dialog"
      aria-modal="true"
      aria-label="Profile"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="luModal" style={{ maxWidth: 860 }}>
        <div className="luModalHeader">
          <div>
            <div className="luModalTitle">Profile</div>
            <div className="luModalSub">{userLabel ?? "Guest"}</div>
          </div>
          <button className="luIconBtn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="luModalBody">
          <div className="grid2">
            <div className="card" style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ marginTop: 0 }}>Account</h3>
              <p className="muted" style={{ marginTop: 6 }}>
                For now, accounts are stored locally in your browser. Later this will map to Google login.
              </p>
              <div className="divider" />

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ minWidth: 220 }}>
                  <div className="muted" style={{ fontSize: 12 }}>Active user</div>
                  <div style={{ fontWeight: 700 }}>{active.displayName}</div>
                  <div className="muted" style={{ fontSize: 12 }}>XP: <b>{active.xp}</b></div>
                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button className="btn" type="button" onClick={() => setRewardsOpen(true)}>🎁 View Rewards</button>
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 260 }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Switch user</div>
                  <select
                    className="luInput"
                    value={active.id}
                    onChange={(e) => {
                      setActiveUserId(e.target.value);
                      setTick((t) => t + 1);
                    }}
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName} ({u.xp} XP)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="divider" />
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Create a new local account</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  className="luInput"
                  placeholder="Display name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ minWidth: 220 }}
                />
                <input
                  className="luInput"
                  placeholder="Email (optional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ minWidth: 260 }}
                />
                <button
                  className="btn primary"
                  onClick={() => {
                    const dn = name.trim();
                    if (!dn) return;
                    createUser({ displayName: dn, email: email.trim() || undefined });
                    setName("");
                    setEmail("");
                    setTick((t) => t + 1);
                  }}
                >
                  Create
                </button>
              </div>
              {/* tick is used to refresh derived values via re-render */}
              <div style={{ display: "none" }}>{tick}</div>
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0 }}>Student</h3>
              <p className="muted" style={{ marginTop: 6 }}>
                Rank up by completing lessons and tests.
              </p>
              <div className="divider" />
              <p className="muted" style={{ margin: 0 }}>
                Monthly drawings unlock at <b>Professional</b> status.
              </p>
            </div>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Quick links</h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a className="btn" href="/profile">
                  Open full profile →
                </a>
                <a className="btn" href="/dashboard">
                  Go to dashboard →
                </a>
              </div>
            </div>
            <div className="card" style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ marginTop: 0 }}>Resume</h3>
              <p className="muted" style={{ marginTop: 6 }}>
                Resume upload + ATS templates will appear here in the next update.
              </p>
            </div>
          </div>
        </div>
      </div>
            <RewardsHistoryModal open={rewardsOpen} onClose={() => setRewardsOpen(false)} userId={userId} />
</div>,
    mountNode
  );
}