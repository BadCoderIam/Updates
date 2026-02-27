// Back-compat shim: older components import getLocalProgress from '@/lib/localProfile'.
// The current prototype uses userStore.ts for localStorage-backed profiles.

import { getProgress } from "./userStore";

export function getLocalProgress(userId: string) {
  return getProgress(userId);
}
