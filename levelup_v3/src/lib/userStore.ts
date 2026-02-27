"use client";

export type TrackId = "azure_m365" | "aws" | "helpdesk" | "desktop";

export type LocalUser = {
  id: string;
  displayName: string;
  email?: string;
  xp: number;
  level: number; // 1..5 (local only for now)
  trackProgress: Record<TrackId, number>; // 0..100
  createdAt: string;
};

const USERS_KEY = "lu_users";
const ACTIVE_KEY = "lu_active_user_id";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function computeLevel(xp: number) {
  // Simple 1..5 curve. Easy to tweak later.
  if (xp >= 2000) return 5;
  if (xp >= 1500) return 4;
  if (xp >= 1000) return 3;
  if (xp >= 500) return 2;
  return 1;
}

export function getUsers(): LocalUser[] {
  if (typeof window === "undefined") return [];
  const users = safeParse<any[]>(localStorage.getItem(USERS_KEY), []);
  const list = Array.isArray(users) ? users : [];
  // Lightweight migration: older saves didn't include `level`.
  return list.map((u) => {
    const xp = typeof u?.xp === "number" ? u.xp : 0;
    const level = typeof u?.level === "number" ? u.level : computeLevel(xp);
    return {
      id: String(u?.id ?? "demo-user"),
      displayName: String(u?.displayName ?? "demo-user"),
      email: u?.email ? String(u.email) : undefined,
      xp,
      level,
      trackProgress: (u?.trackProgress as any) ?? { azure_m365: 0, aws: 0, helpdesk: 0, desktop: 0 },
      createdAt: String(u?.createdAt ?? nowIso()),
    } as LocalUser;
  });
}

// Backwards-compatible alias (admin UI uses this name)
export function listLocalUsers(): LocalUser[] {
  return getUsers();
}

export function updateUserById(id: string, patch: Partial<LocalUser>) {
  if (typeof window === "undefined") return;
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) return;
  const prev = users[idx];
  const nextXp = typeof patch.xp === "number" ? Math.max(0, Math.floor(patch.xp)) : prev.xp;
  const next: LocalUser = {
    ...prev,
    ...patch,
    xp: nextXp,
    level: computeLevel(nextXp),
    trackProgress: patch.trackProgress ? { ...prev.trackProgress, ...patch.trackProgress } : prev.trackProgress,
  };
  users[idx] = next;
  saveUsers(users);
  return next;
}

export function deleteUserById(id: string) {
  if (typeof window === "undefined") return;
  if (id === "demo-user") return; // keep demo user for testing
  const users = getUsers().filter((u) => u.id !== id);
  saveUsers(users);
  const activeId = localStorage.getItem(ACTIVE_KEY) ?? "demo-user";
  if (activeId === id) localStorage.setItem(ACTIVE_KEY, "demo-user");
}

export function saveUsers(users: LocalUser[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function ensureDemoUser(): LocalUser {
  const demo: LocalUser = {
    id: "demo-user",
    displayName: "demo-user",
    xp: 0,
    level: 1,
    trackProgress: { azure_m365: 0, aws: 0, helpdesk: 0, desktop: 0 },
    createdAt: nowIso(),
  };

  if (typeof window === "undefined") return demo;

  const users = getUsers();
  const hasDemo = users.some((u) => u.id === demo.id);
  if (!hasDemo) {
    saveUsers([demo, ...users]);
  }

  const active = localStorage.getItem(ACTIVE_KEY);
  if (!active) localStorage.setItem(ACTIVE_KEY, demo.id);

  return demo;
}

export function getActiveUser(): LocalUser {
  if (typeof window === "undefined") {
    return {
      id: "demo-user",
      displayName: "demo-user",
      xp: 0,
      level: 1,
      trackProgress: { azure_m365: 0, aws: 0, helpdesk: 0, desktop: 0 },
      createdAt: nowIso(),
    };
  }

  ensureDemoUser();
  const users = getUsers();
  const activeId = localStorage.getItem(ACTIVE_KEY) ?? "demo-user";
  const found = users.find((u) => u.id === activeId) ?? users.find((u) => u.id === "demo-user");
  return (
    found ?? {
      id: "demo-user",
      displayName: "demo-user",
      xp: 0,
      level: 1,
      trackProgress: { azure_m365: 0, aws: 0, helpdesk: 0, desktop: 0 },
      createdAt: nowIso(),
    }
  );
}

export function setActiveUserId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_KEY, id);
}

export function upsertUser(user: LocalUser) {
  if (typeof window === "undefined") return;
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx >= 0) users[idx] = user;
  else users.unshift(user);
  saveUsers(users);
}

export function createUser(input: { displayName: string; email?: string }): LocalUser {
  const baseId = (input.email ?? input.displayName).toLowerCase().replace(/[^a-z0-9\-_.@]/g, "-");
  const id = `u_${baseId}_${Math.random().toString(16).slice(2, 8)}`;
  const user: LocalUser = {
    id,
    displayName: input.displayName.trim() || "Student",
    email: input.email?.trim() || undefined,
    xp: 0,
    level: 1,
    trackProgress: { azure_m365: 0, aws: 0, helpdesk: 0, desktop: 0 },
    createdAt: nowIso(),
  };
  upsertUser(user);
  setActiveUserId(id);
  return user;
}

export function awardXp(amount: number) {
  if (typeof window === "undefined") return;
  const u = getActiveUser();
  const nextXp = Math.max(0, (u.xp ?? 0) + Math.floor(amount));
  const next = { ...u, xp: nextXp, level: computeLevel(nextXp) };
  upsertUser(next);
  return next;
}

export function setTrackProgress(track: TrackId, pct: number) {
  if (typeof window === "undefined") return;
  const u = getActiveUser();
  const nextPct = Math.max(0, Math.min(100, Math.round(pct)));
  const next = {
    ...u,
    trackProgress: { ...u.trackProgress, [track]: Math.max(u.trackProgress?.[track] ?? 0, nextPct) },
  };
  upsertUser(next);
  return next;
}
