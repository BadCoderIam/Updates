"use client";

import { useCallback } from "react";

function trackEnterApp(source: string) {
  try {
    const payload = JSON.stringify({ source, path: "/", meta: { ts: Date.now() } });
    // Prefer sendBeacon so navigation isn't blocked
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav: any = navigator as any;
    if (nav?.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      nav.sendBeacon("/api/track/enter-app", blob);
      return;
    }
    fetch("/api/track/enter-app", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

export default function Splash() {
  const onEnter = useCallback(() => {
    trackEnterApp("splash");
    window.location.href = "/start";
  }, []);

  return (
    <main className="splashRoot" role="main" aria-label="LevelUp Pro splash">
      <div className="splashBg" />
      <div className="splashInner">
        <button className="splashEnterBtn" onClick={onEnter}>
          Enter App →
        </button>
      </div>
    </main>
  );
}
