export default function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / Math.max(1, max)) * 100)));
  return (
    <div>
      <div className="progressBar" aria-label="progress">
        <div className="progressFill" style={{ width: `${pct}%` }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <small>XP: {value} / {max}</small>
        <small>{pct}%</small>
      </div>
    </div>
  );
}
