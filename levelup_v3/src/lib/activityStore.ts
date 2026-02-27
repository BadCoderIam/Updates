"use client";

export type ActivityType =
  | "PASS_INTERVIEW_STAGE1"
  | "PASS_INTERVIEW_STAGE2"
  | "COMPLETE_POSITION_TRAINING"
  | "COMPLETE_CERT_PRACTICE"
  | "COMPLETE_TEST_NOW"
  | "LOOT_BOX_EARNED";

export type ActivityItem = {
  id: string;
  type: ActivityType;
  title: string;
  body: string;
  createdAt: string;
};

function key(userId: string) {
  return `lu_activity_v1_${userId}`;
}

function nowIso() {
  return new Date().toISOString();
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getActivities(userId: string): ActivityItem[] {
  if (typeof window === "undefined") return [];
  const list = safeParse<ActivityItem[]>(localStorage.getItem(key(userId)), []);
  return Array.isArray(list) ? list : [];
}

export function addActivity(userId: string, item: Omit<ActivityItem, "id" | "createdAt">) {
  if (typeof window === "undefined") return;
  const list = getActivities(userId);
  const next: ActivityItem = {
    id: `act_${Math.random().toString(16).slice(2)}_${Date.now()}`,
    createdAt: nowIso(),
    ...item,
  };
  const out = [next, ...list].slice(0, 50);
  localStorage.setItem(key(userId), JSON.stringify(out));
  return next;
}

export function clearActivities(userId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key(userId));
}


export function removeActivity(userId: string, activityId: string) {
  if (typeof window === "undefined") return;
  const list = getActivities(userId).filter((a) => a.id !== activityId);
  localStorage.setItem(key(userId), JSON.stringify(list));
}

export function clearActivitiesByType(userId: string, types: ActivityType[]) {
  if (typeof window === "undefined") return;
  const set = new Set(types);
  const list = getActivities(userId).filter((a) => !set.has(a.type));
  localStorage.setItem(key(userId), JSON.stringify(list));
}
