"use client";

import { useEffect } from "react";

/**
 * AmbientFX
 * - Writes CSS vars (--mx/--my) so CSS can render a subtle cursor glow.
 * - Safe: no-op on touch / reduced motion.
 */
export default function AmbientFX() {
  useEffect(() => {
    const mqlReduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const isReduced = !!mqlReduce?.matches;
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (isReduced || isTouch) return;

    const root = document.documentElement;

    const onMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      root.style.setProperty("--mx", String(x));
      root.style.setProperty("--my", String(y));
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    // initialize center
    root.style.setProperty("--mx", "0.5");
    root.style.setProperty("--my", "0.35");

    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return null;
}
