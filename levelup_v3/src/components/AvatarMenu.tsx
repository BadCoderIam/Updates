"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ProfileModal from "@/components/ProfileModal";

function initialsFrom(label?: string) {
  if (!label) return "U";
  const parts = label.split(/\s+|@/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

export default function AvatarMenu(props: {
  userLabel?: string;
  avatarUrl?: string | null;
  onLogout?: () => void;
}) {
  const { userLabel, avatarUrl, onLogout } = props;
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const initials = useMemo(() => initialsFrom(userLabel), [userLabel]);
  const isAuthed = Boolean(userLabel);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <div className="luAvatarRoot" ref={rootRef}>
      <button
        className="luAvatarBtn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Profile menu"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="luAvatarImg" src={avatarUrl} alt="Profile" />
        ) : (
          <span className="luAvatarInitials">{initials}</span>
        )}
      </button>

      {open && (
        <div className="luDropdown" role="menu" aria-label="Profile">
          <div className="luDropdownHeader">
            <div className="luDropdownTitle">{isAuthed ? "Signed in" : "Guest"}</div>
            <div className="luDropdownSub">{userLabel ?? "Enter the app to sign in"}</div>
          </div>
          <button
            className="luDropdownItem"
            onClick={() => {
              setOpen(false);
              setProfileOpen(true);
            }}
            role="menuitem"
          >
            Profile
          </button>
          {isAuthed ? (
            <button
              className="luDropdownItem luDanger"
              onClick={() => {
                setOpen(false);
                onLogout?.();
              }}
              role="menuitem"
            >
              Log out
            </button>
          ) : (
            <a className="luDropdownItem" href="/dashboard" role="menuitem">
              Enter app
            </a>
          )}
        </div>
      )}

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} userLabel={userLabel} />
    </div>
  );
}
