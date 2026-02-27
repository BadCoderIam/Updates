"use client";

import React from "react";

export default function HealthBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  // green->yellow->red gradient
  const fillStyle: React.CSSProperties = {
    height: `${clamped}%`,
    marginTop: `${100 - clamped}%`,
    background:
      // Low health should look dangerous (red) at the bottom, high health should look safe (green) at the top.
      "linear-gradient(to top, rgba(239,68,68,.95), rgba(250,204,21,.95), rgba(34,197,94,.95))",
    transition: "all 400ms ease",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 700 }}>Interview Health</div>
      <div
        style={{
          height: 260,
          width: 22,
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid var(--cardBorder)",
          overflow: "hidden",
        }}
        aria-label={`Health ${clamped} out of 100`}
      >
        <div style={fillStyle} />
      </div>
      <div style={{ fontSize: 12, opacity: 0.8, fontVariantNumeric: "tabular-nums" }}>
        {clamped}/100
      </div>
    </div>
  );
}
