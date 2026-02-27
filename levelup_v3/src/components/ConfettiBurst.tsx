"use client";

import React, { useEffect, useMemo, useState } from "react";

type Piece = { id: string; left: number; delay: number; rotate: number; drift: number; scale: number };

export default function ConfettiBurst({ fire, label }: { fire: boolean; label?: string }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!fire) return;
    setOn(true);
    const t = window.setTimeout(() => setOn(false), 1600);
    return () => window.clearTimeout(t);
  }, [fire]);

  const pieces = useMemo(() => {
    const arr: Piece[] = [];
    for (let i = 0; i < 40; i++) {
      arr.push({
        id: "c" + i,
        left: Math.random() * 100,
        delay: Math.random() * 0.2,
        rotate: Math.random() * 360,
        drift: (Math.random() - 0.5) * 220,
        scale: 0.8 + Math.random() * 0.9,
      });
    }
    return arr;
  }, [fire]);

  if (!on) return null;

  return (
    <div className="luConfettiWrap" aria-hidden="true">
      {label ? <div className="luConfettiLabel">{label}</div> : null}
      {pieces.map((p) => (
        <span
          key={p.id}
          className="luConfetti"
          style={{
            left: p.left + "%",
            animationDelay: p.delay + "s",
            transform: `translate3d(0,0,0) rotate(${p.rotate}deg) scale(${p.scale})`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ["--drift" as any]: p.drift + "px",
          }}
        />
      ))}
    </div>
  );
}
