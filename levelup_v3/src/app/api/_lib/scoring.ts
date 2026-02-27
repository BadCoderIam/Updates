/**
 * Scoring v0.2 — IT Support MVP
 * - Practice answers award XP and domain XP
 * - Interview sessions compute a pass/fail score
 *
 * Replace later with rubric-based grading + LLM and integrity signals.
 */

export type Track = "IT_SUPPORT";

export type AnswerScore = {
  correctness: number;   // 0..1
  completeness: number;  // 0..1
  structure: number;     // 0..1
  confidence: number;    // 0..1
  total: number;         // 0..1
  xpAwarded: number;
};

export function gradeAnswer(opts: {
  tier: 1 | 2 | 3 | 4;
  answerText: string;
}): AnswerScore {
  const a = opts.answerText.trim();
  const len = a.length;

  // Heuristic placeholder grading.
  const structure = Math.min(1, (a.split(/\n|\.|\-|\d\)/).filter(Boolean).length / 6));
  const completeness = Math.min(1, len / 900);
  const correctness = Math.min(1, 0.35 + (len > 120 ? 0.3 : 0) + (len > 320 ? 0.25 : 0));
  const confidence = Math.min(1, 0.65 + (a.includes("I would") ? 0.05 : 0) - (a.includes("maybe") ? 0.1 : 0));

  const total = clamp01(0.35 * correctness + 0.30 * completeness + 0.25 * structure + 0.10 * confidence);
  const tierMult = ({ 1: 1.0, 2: 1.25, 3: 1.6, 4: 2.0 } as const)[opts.tier];

  const xpAwarded = Math.round(20 * tierMult * (0.4 + total));
  return { correctness, completeness, structure, confidence, total, xpAwarded };
}

export function readinessFromXP(xp: number): number {
  return clamp01(Math.log10(1 + xp / 10) / 2) * 100;
}

export function rankLabelIT(xp: number): string {
  const bands = [
    { min: 0, label: "IT Support L1 (Candidate)" },
    { min: 250, label: "IT Support L1 (Ready)" },
    { min: 650, label: "IT Support L2" },
    { min: 1200, label: "IT Support L3" },
    { min: 2000, label: "IT Support (Advanced)" },
  ];
  return [...bands].reverse().find(b => xp >= b.min)?.label ?? bands[0].label;
}

export function qualifiesForHR(opts: { userXP: number; readiness: number; domainMasteryCount: number }): boolean {
  // MVP: require a minimum overall readiness AND breadth across domains.
  return opts.userXP >= 250 && opts.readiness >= 35 && opts.domainMasteryCount >= 3;
}

export function interviewPassFail(opts: { hrAvg?: number; techAvg?: number }): { pass: boolean; summary: string } {
  // MVP pass thresholds.
  const hr = opts.hrAvg ?? 0;
  const tech = opts.techAvg ?? 0;

  if (opts.hrAvg !== undefined && hr < 0.62) return { pass: false, summary: "HR screen needs more clarity/structure (use STAR and be concise)." };
  if (opts.techAvg !== undefined && tech < 0.68) return { pass: false, summary: "Tech interview needs stronger troubleshooting depth and step-by-step reasoning." };

  return { pass: true, summary: "Great job. You met the MVP pass threshold." };
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
