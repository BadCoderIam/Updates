"use client";

import React, { useEffect, useMemo, useState } from "react";
import HealthBar from "@/components/HealthBar";
import ProgressBar from "@/components/ProgressBar";
import { awardXp, getActiveUser, setTrackProgress, type TrackId } from "@/lib/userStore";
import { addActivity } from "@/lib/activityStore";

type Difficulty = "easy" | "medium" | "hard";

type Track = "azure_m365" | "aws" | "helpdesk" | "desktop";

type Question = {
  id: string;
  track: Track;
  kind: "mcq" | "short";
  question: string;
  idealAnswer: string;
  options?: string[];
  correctIndex?: number;
  rubricKeywords?: string[];
  difficulty: Difficulty;
  tags: string[];
};

function makeRepeatMCQs(opts: {
  track: Track;
  prefix: string;
  startN: number;
  count: number;
  difficulty?: Difficulty;
  tags: string[];
  question: (n: number) => string;
  options: string[];
  correctIndex: number;
  idealAnswer: string;
}): Question[] {
  const out: Question[] = [];
  for (let i = 0; i < opts.count; i++) {
    const n = opts.startN + i;
    out.push({
      id: `${opts.prefix}${n}`,
      track: opts.track,
      kind: "mcq",
      question: opts.question(n),
      options: opts.options,
      correctIndex: opts.correctIndex,
      idealAnswer: opts.idealAnswer,
      difficulty: opts.difficulty ?? (n % 4 === 0 ? "medium" : "easy"),
      tags: opts.tags,
    });
  }
  return out;
}

function makePromptMCQs(opts: {
  track: Track;
  prefix: string;
  prompts: string[];
  tags: string[];
  options: string[];
  correctIndex: number;
  idealAnswer: string;
  difficulty?: Difficulty;
}): Question[] {
  return opts.prompts.map((q, i) => ({
    id: `${opts.prefix}${i + 1}`,
    track: opts.track,
    kind: "mcq",
    question: q,
    options: opts.options,
    correctIndex: opts.correctIndex,
    idealAnswer: opts.idealAnswer,
    difficulty: opts.difficulty ?? ((i + 1) % 4 === 0 ? "medium" : "easy"),
    tags: opts.tags,
  }));
}

// ===== Stage 1 pool: 25 MCQs per track =====
const BANK_STAGE1: Question[] = [
  // --- Azure/M365 base ---
  {
    id: "s1_az1",
    track: "azure_m365",
    kind: "mcq",
    question: "In Entra ID (Azure AD), what is Conditional Access primarily used for?",
    options: [
      "Managing DNS zones for Microsoft 365",
      "Evaluating access signals and enforcing controls like MFA or compliant devices",
      "Creating on-prem domain trusts",
      "Replacing Intune device compliance policies",
    ],
    correctIndex: 1,
    idealAnswer:
      "Conditional Access evaluates signals (user, device, location, risk) and enforces controls like MFA, compliant devices, or blocking access.",
    difficulty: "easy",
    tags: ["Conditional Access", "Security"],
  },
  {
    id: "s1_az2",
    track: "azure_m365",
    kind: "mcq",
    question: "What does PIM (Privileged Identity Management) help you enforce?",
    options: [
      "Always-on Global Admin access for IT staff",
      "Just-in-time role elevation with approvals/time limits",
      "Passwordless login without MFA",
      "Email retention policies in Exchange Online",
    ],
    correctIndex: 1,
    idealAnswer:
      "PIM supports just-in-time privileged role activation with controls like MFA, approvals, and time limits.",
    difficulty: "easy",
    tags: ["PIM", "Least Privilege"],
  },
  {
    id: "s1_az3",
    track: "azure_m365",
    kind: "mcq",
    question: "Intune device compliance is commonly used with Conditional Access to…",
    options: [
      "Automatically renew SSL certificates",
      "Require a compliant device before allowing access to M365 resources",
      "Create VPC route tables",
      "Enable DHCP reservations",
    ],
    correctIndex: 1,
    idealAnswer:
      "Intune reports compliance to Entra ID so Conditional Access can require compliant devices for access.",
    difficulty: "medium",
    tags: ["Intune", "Conditional Access"],
  },
  {
    id: "s1_az4",
    track: "azure_m365",
    kind: "mcq",
    question: "Which control is MOST effective to prevent legacy authentication attacks in M365?",
    options: [
      "Enable POP/IMAP for all users",
      "Block legacy authentication using Conditional Access / security defaults",
      "Disable DNS",
      "Turn off MFA",
    ],
    correctIndex: 1,
    idealAnswer: "Blocking legacy auth prevents basic-auth protocols from bypassing modern controls like MFA/CA.",
    difficulty: "easy",
    tags: ["Security", "Legacy Auth"],
  },
  ...makePromptMCQs({
    track: "azure_m365",
    prefix: "s1_azx_",
    tags: ["Security", "M365"],
    prompts: [
      "You suspect impossible travel sign-ins. What should you check first in Entra ID?",
      "A VIP is targeted by phishing. Which control most reduces account takeover risk?",
      "A contractor needs admin rights for 2 hours. What is the safest approach?",
      "You want to require managed devices for SharePoint access. What do you use?",
      "How do you protect a tenant from lockout if MFA/CA breaks?",
      "Where do you confirm whether a user was challenged for MFA?",
      "What is the best way to reduce privilege standing access for admins?",
      "A user complains Outlook keeps prompting. What sign-in signal is most useful?",
      "You want to stop basic auth protocols from bypassing MFA. What do you do?",
      "What does a 'compliant device' requirement typically validate?",
      "A device is lost. What is the best immediate action in Intune?",
      "You need to see risky users/sign-ins driven by identity signals. What product helps?",
      "A mailbox needs litigation hold. Where is this configured?",
      "You want to control who can register MFA methods. Where do you manage that?",
      "How do you detect mass file downloads in M365?",
      "A user needs access from a new country. What is a safe way to allow it?",
      "What is the purpose of Azure AD / Entra ID role assignments?",
      "An app requests high permissions. What should you review first?",
      "You want central device policy + app deployment. Which service?",
      "Where do you configure passwordless authentication methods?",
      "How do you enforce least privilege for Microsoft 365 admin roles?",
    ],
    options: [
      "Disable auditing",
      "Review logs and enforce Conditional Access / least privilege",
      "Allow anonymous admin access",
      "Disable MFA",
    ],
    correctIndex: 1,
    idealAnswer: "Use sign-in/audit logs and enforce Conditional Access + least privilege to reduce tenant risk.",
  }),

  // --- AWS base ---
  {
    id: "s1_aws1",
    track: "aws",
    kind: "mcq",
    question: "What is the best description of an IAM Role?",
    options: [
      "A long-term identity with permanent access keys",
      "A temporary set of permissions that can be assumed",
      "A subnet-level firewall",
      "A storage class in S3",
    ],
    correctIndex: 1,
    idealAnswer: "An IAM role provides temporary permissions that a principal assumes for short-lived access.",
    difficulty: "easy",
    tags: ["IAM", "Security"],
  },
  {
    id: "s1_aws2",
    track: "aws",
    kind: "mcq",
    question: "Security Groups in AWS are…",
    options: [
      "Stateless and support explicit deny rules",
      "Stateful and act as instance-level firewalls",
      "Used only for S3 access control",
      "A replacement for route tables",
    ],
    correctIndex: 1,
    idealAnswer: "Security Groups are stateful instance-level firewalls that use allow rules.",
    difficulty: "medium",
    tags: ["VPC", "Networking"],
  },
  {
    id: "s1_aws3",
    track: "aws",
    kind: "mcq",
    question: "A VPC is best described as…",
    options: ["A global CDN", "A logically isolated virtual network in AWS", "An S3 bucket policy", "A database engine"],
    correctIndex: 1,
    idealAnswer: "A VPC is a logically isolated network where you define subnets, routes, and security controls.",
    difficulty: "easy",
    tags: ["VPC", "Networking"],
  },
  {
    id: "s1_aws4",
    track: "aws",
    kind: "mcq",
    question: "Which service is commonly used for object storage?",
    options: ["S3", "RDS", "EC2", "ECS"],
    correctIndex: 0,
    idealAnswer: "Amazon S3 is object storage.",
    difficulty: "easy",
    tags: ["S3"],
  },
  ...makePromptMCQs({
    track: "aws",
    prefix: "s1_awsx_",
    tags: ["IAM", "Security"],
    prompts: [
      "What is the safest way for an EC2 instance to access S3?",
      "You need to audit API activity across the account. What should be enabled?",
      "What is the main benefit of least privilege IAM policies?",
      "A public S3 bucket is a concern. What should you check first?",
      "Which is the best practice for root account usage?",
      "What does a Network ACL do that Security Groups do not?",
      "You need private connectivity between subnets. What controls routing?",
      "A developer needs temporary admin access. What is the preferred approach?",
      "How do you protect data at rest in S3?",
      "What is the difference between Security Groups and NACLs?",
      "Where do you configure inbound instance firewall rules?",
      "How do you avoid hardcoding credentials in code?",
      "What is a common use case for AWS KMS?",
      "What improves resilience for EC2 workloads?",
      "How do you restrict SSH/RDP access to instances?",
      "What is the purpose of VPC route tables?",
      "Which service helps distribute traffic globally with caching?",
      "How do you ensure logs are tamper-resistant?",
      "What is the best way to rotate credentials?",
      "When should you use an IAM role vs IAM user?",
      "How do you protect management console logins?",
    ],
    options: [
      "Use the root account for daily work",
      "Use IAM roles + least privilege + MFA",
      "Store credentials in public repos",
      "Disable CloudTrail",
    ],
    correctIndex: 1,
    idealAnswer: "Use roles, least privilege, and MFA; avoid root usage and avoid hardcoded credentials.",
  }),

  // --- Help Desk base ---
  {
    id: "s1_hd1",
    track: "helpdesk",
    kind: "mcq",
    question: "A user can ping 8.8.8.8 but cannot access google.com. What is the most likely issue?",
    options: ["DHCP failure", "DNS resolution issue", "CPU overheating", "Broken monitor"],
    correctIndex: 1,
    idealAnswer: "If IP connectivity works but name resolution fails, it points to DNS problems.",
    difficulty: "easy",
    tags: ["DNS", "Troubleshooting"],
  },
  {
    id: "s1_hd2",
    track: "helpdesk",
    kind: "mcq",
    question: "Ticket priority should primarily be determined by…",
    options: [
      "Who submitted it first",
      "Impact and urgency (users affected + business criticality)",
      "How loud the requester is",
      "Whether it involves a printer",
    ],
    correctIndex: 1,
    idealAnswer: "Prioritization is based on impact and urgency aligned to SLAs.",
    difficulty: "easy",
    tags: ["ITIL", "Process"],
  },
  {
    id: "s1_hd3",
    track: "helpdesk",
    kind: "mcq",
    question: "Which command quickly shows IP configuration on Windows?",
    options: ["ipconfig /all", "nslookup", "ping -t", "net user"],
    correctIndex: 0,
    idealAnswer: "ipconfig /all shows IP, gateway, DNS, and DHCP info.",
    difficulty: "easy",
    tags: ["Windows", "Networking"],
  },
  ...makePromptMCQs({
    track: "helpdesk",
    prefix: "s1_hdx_",
    tags: ["Troubleshooting", "Process"],
    prompts: [
      "A user says 'nothing works' after lunch. What is your first troubleshooting step?",
      "A ticket says 'VPN broken' with no details. What should you do first?",
      "Multiple users report slow internet. What is your first action?",
      "A printer is 'offline' for one user. What's the first thing to confirm?",
      "A user can't log in. What's your first check?",
      "Email isn't sending for one mailbox. What's the first step?",
      "A laptop won't connect to Wi‑Fi. What's the first step?",
      "Teams calls drop every 5 minutes. What's your first check?",
      "A user reports 'pop-ups' and ads. What's the first step?",
      "A ticket mentions 'blue screen'. What's the first step?",
      "A user can't access a shared drive. What's the first step?",
      "A user says 'my password keeps failing'. What's the first check?",
      "A user can't print to a network printer. What's the first step?",
      "A user says the PC is 'super slow'. What's the first step?",
      "A new hire can't access required apps. What's your first check?",
      "A user can't open internal websites but internet works. What's first?",
      "A user can't access a specific SaaS app. What's your first step?",
      "A ticket says 'monitor flickering'. What's your first check?",
      "A user can't open PDFs. What's your first step?",
      "A user is locked out frequently. What's your first check?",
      "A request comes in for admin rights. What's your first step?",
      "A user reports missing files. What's your first step?",
    ],
    options: [
      "Immediately reimage the device",
      "Clarify the issue, scope, impact, and recent changes",
      "Ignore the user",
      "Disable all security tools",
    ],
    correctIndex: 1,
    idealAnswer: "Start by gathering facts: symptoms, scope/impact, recent changes, and error messages before acting.",
  }),

  // --- Desktop Support base ---
  {
    id: "s1_ds1",
    track: "desktop",
    kind: "mcq",
    question: "BitLocker recovery prompts after a motherboard replacement are most commonly caused by…",
    options: [
      "DNS cache corruption",
      "TPM/hardware measurement changes triggering recovery mode",
      "A missing printer driver",
      "Low disk space",
    ],
    correctIndex: 1,
    idealAnswer: "Hardware changes affect TPM measurements, triggering BitLocker recovery until re-sealed.",
    difficulty: "medium",
    tags: ["BitLocker", "Security"],
  },
  {
    id: "s1_ds2",
    track: "desktop",
    kind: "mcq",
    question: "To isolate a user profile issue vs an application issue, the BEST next step is to…",
    options: [
      "Reinstall Windows immediately",
      "Test the same app with a different user or a new profile",
      "Disable the network adapter",
      "Delete System32",
    ],
    correctIndex: 1,
    idealAnswer: "Testing with another user/new profile isolates whether the issue follows the user or the app.",
    difficulty: "easy",
    tags: ["Troubleshooting", "Windows"],
  },
  {
    id: "s1_ds3",
    track: "desktop",
    kind: "mcq",
    question: "Which tool is commonly used to view Windows event logs?",
    options: ["Event Viewer", "Task Manager", "Paint", "Notepad"],
    correctIndex: 0,
    idealAnswer: "Event Viewer is used to inspect application/system/security event logs.",
    difficulty: "easy",
    tags: ["Windows", "Logs"],
  },
  ...makePromptMCQs({
    track: "desktop",
    prefix: "s1_dsx_",
    tags: ["Windows", "Repair"],
    prompts: [
      "Windows features are failing after an update. What is a safe built-in repair step?",
      "System apps crash at launch. What safe repair command helps restore system files?",
      "A user reports corrupted Windows components. What tool repairs the component store?",
      "A machine is acting unstable after power loss. What safe remediation do you try first?",
      "Start Menu is broken. Which safe repair command is commonly used?",
      "Explorer keeps crashing. What safe first remediation step applies?",
      "Windows Update errors persist. What safe built-in repair sequence helps?",
      "A user reports random app failures system-wide. What safe repair step?",
      "A driver install failed and OS feels inconsistent. What safe system check?",
      "You suspect system file corruption. What's a safe built-in remediation?",
      "DISM reports corruption. What do you run to repair it?",
      "After malware cleanup, the OS is flaky. What safe repair step?",
      "A user profile loads but apps fail. What safe repair step applies globally?",
      "PC crashes during normal operations. What safe first repair step?",
      "Windows settings pages won't open. What safe remediation?",
      "An endpoint has weird errors after disk cleanup. What safe remediation?",
      "A user can't open Control Panel items. What safe repair step?",
      "System components are missing. What safe tool can restore them?",
      "After a feature update, services won't start. What safe repair step?",
      "You want a low-risk repair before reimage. What do you run?",
      "Multiple built-in apps fail. What safe remediation?",
      "System seems corrupted. What's a safe command-line repair approach?",
    ],
    options: [
      "Run sfc /scannow and DISM /RestoreHealth",
      "Delete System32",
      "Disable firewall permanently",
      "Turn off updates forever",
    ],
    correctIndex: 0,
    idealAnswer: "SFC and DISM are safe built-in tools to repair system files and the Windows component store.",
  }),
].flat();

// ===== Stage 2 pool: mixed =====
const BANK_STAGE2: Question[] = [
  {
    id: "az2_1",
    track: "azure_m365",
    kind: "short",
    question: "Explain the difference between Entra ID (Azure AD) and on-prem Active Directory.",
    idealAnswer:
      "AD DS is on-prem domain services (Kerberos/LDAP, domain join). Entra ID is cloud identity for apps/SaaS using OAuth/OIDC/SAML and Conditional Access.",
    rubricKeywords: ["entra", "azure ad", "active directory", "kerberos", "ldap", "oauth", "saml", "conditional access"],
    difficulty: "easy",
    tags: ["Identity"],
  },
  {
    id: "az2_2",
    track: "azure_m365",
    kind: "mcq",
    question: "Which signal is commonly evaluated by Conditional Access?",
    options: ["CPU temperature", "Device compliance", "Printer toner level", "Monitor resolution"],
    correctIndex: 1,
    idealAnswer: "Conditional Access can evaluate device compliance and other signals.",
    difficulty: "easy",
    tags: ["Conditional Access"],
  },
  {
    id: "aws2_1",
    track: "aws",
    kind: "short",
    question: "Explain Security Groups vs NACLs in AWS.",
    idealAnswer:
      "Security Groups are stateful instance-level firewalls (allow rules). NACLs are stateless subnet-level controls and can include deny rules.",
    rubricKeywords: ["security group", "stateful", "instance", "nacl", "stateless", "subnet", "deny"],
    difficulty: "medium",
    tags: ["Networking"],
  },
  {
    id: "aws2_2",
    track: "aws",
    kind: "mcq",
    question: "Which service provides managed relational databases?",
    options: ["RDS", "S3", "CloudFront", "Route 53"],
    correctIndex: 0,
    idealAnswer: "RDS provides managed relational database engines.",
    difficulty: "easy",
    tags: ["RDS"],
  },
  {
    id: "hd2_1",
    track: "helpdesk",
    kind: "short",
    question: "Walk through your steps to troubleshoot a user who cannot access Teams.",
    idealAnswer:
      "Check service health, user licensing, network connectivity, sign-in status, client cache, and logs; test web vs desktop; escalate if service-wide.",
    rubricKeywords: ["service health", "license", "network", "sign in", "cache", "web", "desktop", "escalate"],
    difficulty: "medium",
    tags: ["M365", "Troubleshooting"],
  },
  {
    id: "ds2_1",
    track: "desktop",
    kind: "short",
    question: "Explain BitLocker recovery mode and how you would remediate it.",
    idealAnswer:
      "Hardware/TPM measurement changes can trigger recovery. Use recovery key, verify TPM/BIOS, and re-seal protectors as needed.",
    rubricKeywords: ["bitlocker", "recovery", "tpm", "bios", "re-seal", "protector", "key"],
    difficulty: "hard",
    tags: ["Security", "Windows"],
  },
].flat();

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s\-\+\.]/g, " ");
}

function keywordScore(answer: string, keywords: string[]) {
  const a = " " + normalize(answer) + " ";
  let hit = 0;
  for (const k of keywords) {
    const kn = normalize(k).trim();
    if (!kn) continue;
    if (a.includes(" " + kn + " ") || a.includes(kn)) hit++;
  }
  return { hit, total: keywords.length };
}

function deltaFromPct(pct: number) {
  if (pct >= 0.85) return { delta: 10, rating: "great" as const };
  if (pct >= 0.65) return { delta: 5, rating: "good" as const };
  if (pct >= 0.45) return { delta: -4, rating: "ok" as const };
  return { delta: -12, rating: "poor" as const };
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickN<T>(arr: T[], n: number) {
  const a = shuffle(arr);
  return a.slice(0, Math.min(n, a.length));
}

function ConfettiBurst() {
  const pieces = useMemo(() => {
    return Array.from({ length: 42 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.15,
      dur: 0.9 + Math.random() * 0.7,
      rot: Math.random() * 360,
      size: 6 + Math.random() * 6,
      top: -10 - Math.random() * 40,
    }));
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }}>
      <style>{`
        @keyframes lu_confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(120vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.left}vw`,
            top: `${p.top}px`,
            width: p.size,
            height: p.size * 0.6,
            background: "linear-gradient(90deg, rgba(56,189,248,.95), rgba(236,72,153,.95), rgba(250,204,21,.95))",
            borderRadius: 3,
            animation: `lu_confetti ${p.dur}s ease-out ${p.delay}s forwards`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export default function MockInterviewModal(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props;

  const [track, setTrack] = useState<Track>("azure_m365");
  const [stage, setStage] = useState<1 | 2>(1);
  const [step, setStep] = useState<"setup" | "quiz" | "summary">("setup");
  const [health, setHealth] = useState(70);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [pulseUnlock, setPulseUnlock] = useState(false);
  const [xpToast, setXpToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      getActiveUser();
    } catch {}
  }, []);

  useEffect(() => {
    if (!xpToast) return;
    const t = setTimeout(() => setXpToast(null), 1200);
    return () => clearTimeout(t);
  }, [xpToast]);

  const passedStage1 = useMemo(() => {
    try {
      return localStorage.getItem(`lu_mock_passed_s1_${track}`) === "1";
    } catch {
      return false;
    }
  }, [track, step]);

  const activeUser = getActiveUser();
  const trackPct = activeUser.trackProgress?.[track as TrackId] ?? 0;

  const current = sessionQuestions[idx];

  function resetSession() {
    setHealth(70);
    setIdx(0);
    setAnswer("");
    setSelected(null);
    setLastFeedback(null);
    try {
      sessionStorage.setItem("lu_mock_history", JSON.stringify([]));
    } catch {}
  }

  function start(nextStage: 1 | 2) {
    setStage(nextStage);
    resetSession();
    const src = nextStage === 1 ? BANK_STAGE1 : BANK_STAGE2;
    const pool = src.filter((q) => q.track === track);
    const count = nextStage === 1 ? 12 : 8;
    setSessionQuestions(pickN(pool, count));
    setStep("quiz");
  }

  function submit() {
    if (!current) return;

    let hit = 0;
    let total = 0;
    let delta = 0;
    let feedback = "";

    if (current.kind === "mcq") {
      total = 1;
      const correct = typeof current.correctIndex === "number" ? current.correctIndex : -1;
      const isCorrect = selected === correct;

      if (selected === null) {
        delta = -6;
        feedback = "Skipped. In interviews, make your best choice, then explain your reasoning.";
      } else if (isCorrect) {
        hit = 1;
        delta = 6;
        feedback = "Correct. Nice — keep the same pace and confidence.";
        const xp = current.difficulty === "hard" ? 16 : current.difficulty === "medium" ? 12 : 8;
        awardXp(xp);
        setXpToast(`+${xp} XP`);
      } else {
        delta = -10;
        feedback = "Not quite. Review the concept and pay attention to how similar options differ.";
        awardXp(2);
        setXpToast(`+2 XP (attempt)`);
      }
    } else {
      const keys = current.rubricKeywords ?? [];
      const score = keywordScore(answer, keys);
      hit = score.hit;
      total = score.total;
      const pct = total ? hit / total : 0;
      const r = deltaFromPct(pct);
      delta = r.delta;
      feedback =
        r.rating === "great"
          ? `Strong answer. You hit most of the key points (${hit}/${total}).`
          : r.rating === "good"
          ? `Good answer. You covered many key points (${hit}/${total}). Tighten it with a bit more structure.`
          : r.rating === "ok"
          ? `Decent start. You hit ${hit}/${total}. Add more specifics and keep it structured.`
          : `Needs improvement. You hit ${hit}/${total}. Focus on the missing points and give a structured answer.`;

      const xp = Math.max(2, 4 + Math.round(pct * 12));
      awardXp(xp);
      setXpToast(`+${xp} XP`);
    }

    const nextHealth = Math.max(0, Math.min(100, health + delta));
    setHealth(nextHealth);
    setLastFeedback(feedback);

    // save history row
    try {
      const raw = sessionStorage.getItem("lu_mock_history") || "[]";
      const h = JSON.parse(raw);
      const next = Array.isArray(h) ? h : [];
      next.push({
        q: current.question,
        a: current.kind === "mcq" ? (selected === null ? "(skipped)" : current.options?.[selected] ?? "") : answer,
        feedback,
        delta,
      });
      sessionStorage.setItem("lu_mock_history", JSON.stringify(next));
    } catch {}

    // advance
    const isLast = idx + 1 >= sessionQuestions.length;
    if (isLast) {
      const passed = nextHealth >= 60;

      if (stage === 1 && passed) {
        try {
          localStorage.setItem(`lu_mock_passed_s1_${track}`, "1");
        } catch {}
        setTrackProgress(track as TrackId, 50);
        setPulseUnlock(true);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1600);
        setTimeout(() => setPulseUnlock(false), 2400);
        awardXp(75);

        // Local notification (dashboard)
        try {
          const au = getActiveUser();
          addActivity(au.id, {
            type: "PASS_INTERVIEW_STAGE1",
            title: `Interview 1 passed (${title})`,
            body: `Stage 2 unlocked • +75 XP`,
          });
        } catch {}
      }

      if (stage === 2 && passed) {
        try {
          localStorage.setItem(`lu_mock_passed_s2_${track}`, "1");
          localStorage.setItem("lu_tech_ready", "1");
        } catch {}
        setTrackProgress(track as TrackId, 100);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1600);
        awardXp(150);

        // Local notification (dashboard)
        try {
          const au = getActiveUser();
          addActivity(au.id, {
            type: "PASS_INTERVIEW_STAGE2",
            title: `Interview 2 passed (${title})`,
            body: `Tech Ready ✅ • +150 XP`,
          });
        } catch {}
      }

      setStep("summary");
    } else {
      setIdx(idx + 1);
      setAnswer("");
      setSelected(null);
    }
  }

  const title =
    track === "azure_m365" ? "Azure / Microsoft 365" : track === "aws" ? "AWS" : track === "helpdesk" ? "Help Desk" : "Desktop Support";

  const subtitle =
    track === "azure_m365"
      ? "Identity, security, Intune, M365 troubleshooting"
      : track === "aws"
      ? "IAM, VPC, compute, storage"
      : track === "helpdesk"
      ? "Ticketing, triage, networking basics"
      : "Windows troubleshooting, endpoint security";

  if (!open) return null;

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <style>{`
        @keyframes lu_pulse {
          0% { box-shadow: 0 0 0 rgba(56,189,248,.0); }
          40% { box-shadow: 0 0 22px rgba(56,189,248,.35), 0 0 34px rgba(236,72,153,.25); }
          100% { box-shadow: 0 0 0 rgba(56,189,248,.0); }
        }
        .neonPulse { animation: lu_pulse 1.2s ease-in-out infinite; border-color: rgba(56,189,248,.45) !important; }
      `}</style>

      {showConfetti && <ConfettiBurst />}
      {xpToast && (
        <div style={{ position: "fixed", top: 18, right: 18, zIndex: 9999 }}>
          <div className="badge" style={{ background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.15)" }}>
            {xpToast}
          </div>
        </div>
      )}

      <div className="modal" style={{ maxWidth: 980 }}>
        <div className="modalHeader">
          <div>
            <div className="modalTitle">Mock Tech Interview</div>
            <div className="muted">Randomized quiz + feedback + health bar + XP</div>
          </div>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>

        {step === "setup" && (
          <div className="modalBody">
            <div className="grid2">
              <div className="card" style={{ gridColumn: "1 / -1" }}>
                <div className="cardTitle">Choose a track</div>
                <div className="muted">Interview 1 is MCQ-only. Pass to unlock Interview 2 (mixed).</div>

                <div className="trackGrid" style={{ marginTop: 14 }}>
                  {(
                    [
                      { id: "azure_m365", label: "Azure / M365", sub: "Identity • Intune • Security" },
                      { id: "aws", label: "AWS", sub: "IAM • VPC • Compute" },
                      { id: "helpdesk", label: "Help Desk", sub: "Triage • Tickets • Basics" },
                      { id: "desktop", label: "Desktop Support", sub: "Windows • Endpoint • Fixes" },
                    ] as const
                  ).map((t) => {
                    const passed = (() => {
                      try {
                        return localStorage.getItem(`lu_mock_passed_s1_${t.id}`) === "1";
                      } catch {
                        return false;
                      }
                    })();

                    return (
                      <button
                        key={t.id}
                        className={"trackBtn" + (track === t.id ? " active" : "")}
                        onClick={() => setTrack(t.id)}
                      >
                        <div style={{ fontWeight: 800 }}>{t.label}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{t.sub}</div>
                        {passed && <div className="badge" style={{ position: "absolute", top: 10, right: 10 }}>✓ Interview 1 Passed</div>}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginTop: 16 }}>
                  <div>
                    <div className="cardTitle" style={{ margin: 0 }}>{title}</div>
                    <div className="muted">{subtitle}</div>
                    <div className="muted" style={{ marginTop: 6 }}>Active user: <b>{activeUser.displayName}</b> • XP: <b>{activeUser.xp}</b></div>
                  </div>
                  <div style={{ minWidth: 220 }}>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Track Completion</div>
                    <ProgressBar value={trackPct} />
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{trackPct}%</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                  <button className="btn primary" onClick={() => start(1)}>
                    Start Interview 1 (MCQ) →
                  </button>
                  <button
                    className={pulseUnlock ? "btn neonPulse" : "btn"}
                    disabled={!passedStage1}
                    onClick={() => start(2)}
                    title={passedStage1 ? "" : "Pass Interview 1 to unlock"}
                  >
                    Start Interview 2 (Mixed)
                  </button>
                  <button className="btn" onClick={resetSession}>
                    Reset
                  </button>
                </div>

                <div style={{ marginTop: 10 }}>
                  {passedStage1 ? (
                    <span className="badge">✓ Interview 1 Passed — Interview 2 unlocked</span>
                  ) : (
                    <span className="badge">Pass requirement: finish all questions and end with 60+ health</span>
                  )}
                </div>
              </div>

              {/* Health is used during the quiz; keep the setup screen clean. */}
            </div>
          </div>
        )}

        {step === "quiz" && (
          <div className="modalBody">
            <div className="grid2" style={{ gridTemplateColumns: "1fr 110px" }}>
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div className="muted">
                    Stage {stage} • Question {idx + 1} / {sessionQuestions.length}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>{current?.tags?.slice(0, 3).join(" • ")}</div>
                </div>

                <div style={{ marginTop: 10, fontSize: 18, fontWeight: 800 }}>{current?.question}</div>

                {current?.kind === "mcq" ? (
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {(current.options ?? []).map((opt, i) => (
                      <button
                        key={i}
                        className={"btn" + (selected === i ? " primary" : "")}
                        onClick={() => setSelected(i)}
                        style={{ textAlign: "left" }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    className="luInput"
                    style={{ width: "100%", minHeight: 140, marginTop: 12 }}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Answer like you're speaking in an interview…"
                  />
                )}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  <button className="btn primary" onClick={submit}>
                    Submit
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      setSelected(null);
                      setAnswer("");
                    }}
                  >
                    Clear
                  </button>
                </div>

                {lastFeedback && (
                  <div className="card" style={{ marginTop: 12, background: "rgba(0,0,0,.25)" }}>
                    <div className="muted" style={{ fontSize: 12 }}>Feedback</div>
                    <div style={{ marginTop: 6 }}>{lastFeedback}</div>
                  </div>
                )}
              </div>

              <div className="card" style={{ display: "flex", justifyContent: "center" }}>
                <HealthBar value={health} />
              </div>
            </div>
          </div>
        )}

        {step === "summary" && <SummaryView title={title} stage={stage} track={track} health={health} totalQuestions={sessionQuestions.length} passedStage1={passedStage1} onStartStage2={() => start(2)} onRestart={() => setStep("setup")} onClose={onClose} />}
      </div>
    </div>
  );
}

function SummaryView(props: {
  title: string;
  stage: 1 | 2;
  track: Track;
  health: number;
  totalQuestions: number;
  passedStage1: boolean;
  onStartStage2: () => void;
  onRestart: () => void;
  onClose: () => void;
}) {
  const { title, stage, health, totalQuestions, passedStage1, onStartStage2, onRestart, onClose } = props;

  const rows = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("lu_mock_history") || "[]";
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [stage, health, totalQuestions]);

  const passedThisRun = health >= 60;

  return (
    <div className="modalBody">
      <div className="card">
        <div className="cardTitle">Session Summary — {title}</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Stage {stage} • Final health: <b>{health}</b> • Questions: <b>{totalQuestions}</b>
        </div>

        <div style={{ marginTop: 12 }}>
          {passedThisRun ? (
            <span className="badge">✅ Passed</span>
          ) : (
            <span className="badge">❌ Not passed (need 60+ health)</span>
          )}
        </div>

        <hr style={{ margin: "12px 0" }} />

        {rows.length === 0 ? (
          <div className="muted">No answers recorded yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((r: any, i: number) => (
              <div key={i} className="card" style={{ background: "rgba(0,0,0,.25)" }}>
                <div style={{ fontWeight: 800 }}>Q{i + 1}: {r.q}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Your answer</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{r.a}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Feedback</div>
                <div>{r.feedback}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <button className="btn" onClick={onRestart}>Back</button>
          {stage === 1 && (passedThisRun || passedStage1) && (
            <button className="btn primary" onClick={onStartStage2}>Start Stage 2</button>
          )}
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
