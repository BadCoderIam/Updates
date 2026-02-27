"use client";

export type PracticeLane = "POSITION" | "CERT" | "TEST_NOW";
export type PositionPath = "HELPDESK_SUPPORT" | "DESKTOP_TECHNICIAN" | "CLOUD_ENGINEER";
export type CertTrack = "A_PLUS" | "SECURITY_PLUS" | "AZ_900";

export type PracticeQuestion = {
  id: string;
  lane: PracticeLane;
  track: string; // e.g. HELPDESK_SUPPORT, AZ_900, MIXED
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  tags?: string[];
  difficulty?: "easy" | "medium" | "hard";
};

// Local overrides (admin can edit pools without a backend).
function readOverride(key: string): PracticeQuestion[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as PracticeQuestion[];
  } catch {
    return null;
  }
}

export function getPoolKeyForPosition(path: PositionPath) {
  return `lu_pool_position_${path}`;
}
export function getPoolKeyForCert(cert: CertTrack) {
  return `lu_pool_cert_${cert}`;
}
export const TEST_NOW_POOL_KEY = "lu_pool_test_now";

const BASE: PracticeQuestion[] = [
  // ===== POSITION: Helpdesk =====
  {
    id: "pos_hd_01",
    lane: "POSITION",
    track: "HELPDESK_SUPPORT",
    prompt: "A user says, 'I can’t access any websites.' What should you verify first?",
    choices: ["Replace the network cable", "Check if the user has an IP address / can reach the gateway", "Disable the firewall", "Reinstall the browser"],
    correctIndex: 1,
    explanation: "Start at Layer 3 basics: confirm IP config and local connectivity before changing software.",
    tags: ["Troubleshooting", "Networking"],
  },
  {
    id: "pos_hd_02",
    lane: "POSITION",
    track: "HELPDESK_SUPPORT",
    prompt: "A user is locked out of their account. What’s the best first action?",
    choices: ["Create a new account", "Reset password and verify identity per policy", "Disable MFA", "Add them to Global Admin"],
    correctIndex: 1,
    explanation: "Follow identity verification and account recovery policy; avoid over-privileging.",
    tags: ["Identity", "Policy"],
  },
  {
    id: "pos_hd_03",
    lane: "POSITION",
    track: "HELPDESK_SUPPORT",
    prompt: "A ticket says: 'Printer is offline.' What is the most common quick check?",
    choices: ["Reimage the PC", "Check power/network and clear stuck print queue", "Replace the printer", "Change DNS servers"],
    correctIndex: 1,
    explanation: "Basic physical connectivity + queue issues are the fastest wins.",
    tags: ["Printing"],
  },

  // ===== POSITION: Desktop Technician =====
  {
    id: "pos_dt_01",
    lane: "POSITION",
    track: "DESKTOP_TECHNICIAN",
    prompt: "A Windows device is blue-screening after a driver update. Best rollback step?",
    choices: ["Factory reset immediately", "Boot to Safe Mode and roll back the driver", "Disable BitLocker", "Change the hostname"],
    correctIndex: 1,
    explanation: "Safe Mode reduces driver load so you can revert the problematic driver.",
    tags: ["Windows", "Drivers"],
  },
  {
    id: "pos_dt_02",
    lane: "POSITION",
    track: "DESKTOP_TECHNICIAN",
    prompt: "A laptop is slow and disk usage is 100%. What’s a solid first check?",
    choices: ["Replace the motherboard", "Check Task Manager for top disk process + storage health", "Disable antivirus permanently", "Turn off Windows Update"],
    correctIndex: 1,
    explanation: "Identify the process and confirm the disk isn’t failing before drastic actions.",
    tags: ["Performance", "Windows"],
  },
  {
    id: "pos_dt_03",
    lane: "POSITION",
    track: "DESKTOP_TECHNICIAN",
    prompt: "A user can’t join a Wi‑Fi network but others can. What should you check first?",
    choices: ["Replace the access point", "Forget the network and verify credentials / device MAC filtering", "Reinstall Windows", "Disable DHCP on the router"],
    correctIndex: 1,
    explanation: "Isolate to the device: saved creds, profile, or access restrictions.",
    tags: ["Wi‑Fi"],
  },

  // ===== POSITION: Cloud Engineer (Azure/M365 leaning) =====
  {
    id: "pos_ce_01",
    lane: "POSITION",
    track: "CLOUD_ENGINEER",
    prompt: "A user is prompted for MFA repeatedly. What is a likely cause?",
    choices: ["Exchange Online is down", "Conditional Access sign-in frequency / session controls", "DNS misconfiguration", "Printer driver conflict"],
    correctIndex: 1,
    explanation: "CA session controls can force frequent re-auth or sign-in prompts.",
    tags: ["Conditional Access", "MFA"],
  },
  {
    id: "pos_ce_02",
    lane: "POSITION",
    track: "CLOUD_ENGINEER",
    prompt: "Best practice for privileged roles in Entra ID?",
    choices: ["Permanent Global Admin for all IT", "Use PIM with JIT activation + approval/MFA", "Disable audit logs", "Share admin accounts"],
    correctIndex: 1,
    explanation: "Least privilege + just‑in‑time privileged access reduces risk.",
    tags: ["PIM", "Security"],
  },
  {
    id: "pos_ce_03",
    lane: "POSITION",
    track: "CLOUD_ENGINEER",
    prompt: "An Intune compliance policy is used with Conditional Access to…",
    choices: ["Create mail flow rules", "Require devices meet security baseline to access apps", "Replace Defender", "Provision VMs"],
    correctIndex: 1,
    explanation: "Compliance + CA gates access based on device posture.",
    tags: ["Intune", "Compliance"],
  },

  // ===== CERT: A+ =====
  {
    id: "cert_a_01",
    lane: "CERT",
    track: "A_PLUS",
    prompt: "Which port is used for HTTPS by default?",
    choices: ["21", "80", "443", "3389"],
    correctIndex: 2,
    explanation: "HTTPS uses TCP 443 by default.",
    tags: ["Ports"],
  },
  {
    id: "cert_a_02",
    lane: "CERT",
    track: "A_PLUS",
    prompt: "What is the BEST tool to check disk SMART health quickly?",
    choices: ["Device Manager", "Event Viewer", "SMART/drive utility (vendor or OS) ", "Paint"],
    correctIndex: 2,
    explanation: "SMART data indicates impending drive failure; vendor tools/OS utilities surface it.",
  },
  {
    id: "cert_a_03",
    lane: "CERT",
    track: "A_PLUS",
    prompt: "In Windows, which utility is best for managing startup apps?",
    choices: ["Task Manager", "Notepad", "Calculator", "Windows Media Player"],
    correctIndex: 0,
    explanation: "Task Manager → Startup tab controls startup apps.",
  },

  // ===== CERT: Security+ =====
  {
    id: "cert_s_01",
    lane: "CERT",
    track: "SECURITY_PLUS",
    prompt: "What principle limits users to only the access they need?",
    choices: ["Fail-open", "Least privilege", "Defense evasion", "Non-repudiation"],
    correctIndex: 1,
    explanation: "Least privilege reduces blast radius and risk.",
  },
  {
    id: "cert_s_02",
    lane: "CERT",
    track: "SECURITY_PLUS",
    prompt: "Which control helps prevent unauthorized access if a password is stolen?",
    choices: ["MFA", "Defragmentation", "Caching", "NAT"],
    correctIndex: 0,
    explanation: "MFA requires a second factor beyond the password.",
  },
  {
    id: "cert_s_03",
    lane: "CERT",
    track: "SECURITY_PLUS",
    prompt: "A user receives a suspicious link in email. Best action?",
    choices: ["Click it to verify", "Report as phishing and don’t click", "Forward to everyone", "Disable antivirus"],
    correctIndex: 1,
    explanation: "Follow incident/reporting procedure; avoid execution.",
  },

  // ===== CERT: AZ-900 =====
  {
    id: "cert_az_01",
    lane: "CERT",
    track: "AZ_900",
    prompt: "Which is a primary benefit of cloud computing?",
    choices: ["Guaranteed zero downtime", "Elastic scaling on demand", "No shared responsibility", "No costs"],
    correctIndex: 1,
    explanation: "Cloud enables rapid, elastic scaling and pay-as-you-go.",
  },
  {
    id: "cert_az_02",
    lane: "CERT",
    track: "AZ_900",
    prompt: "In the shared responsibility model, Microsoft is responsible for…",
    choices: ["Customer data classification", "Physical security of datacenters", "User permissions", "Customer device compliance"],
    correctIndex: 1,
    explanation: "The provider handles physical infrastructure; customers handle identity/data/governance.",
  },
  {
    id: "cert_az_03",
    lane: "CERT",
    track: "AZ_900",
    prompt: "What does 'CapEx to OpEx' mean in cloud context?",
    choices: ["Buying servers upfront vs paying as you go", "More printers", "More DNS records", "Less security"],
    correctIndex: 0,
    explanation: "Cloud shifts large upfront purchases (CapEx) to operational consumption (OpEx).",
  },
];

// A small default timed pool (mixed). Can be overridden via admin.
const TEST_NOW_DEFAULT: PracticeQuestion[] = [
  ...BASE.filter((q) => q.track === "HELPDESK_SUPPORT").slice(0, 2).map((q) => ({ ...q, id: `tn_${q.id}`, lane: "TEST_NOW", track: "MIXED" })),
  ...BASE.filter((q) => q.track === "DESKTOP_TECHNICIAN").slice(0, 2).map((q) => ({ ...q, id: `tn_${q.id}`, lane: "TEST_NOW", track: "MIXED" })),
  ...BASE.filter((q) => q.track === "CLOUD_ENGINEER").slice(0, 2).map((q) => ({ ...q, id: `tn_${q.id}`, lane: "TEST_NOW", track: "MIXED" })),
  ...BASE.filter((q) => q.track === "A_PLUS").slice(0, 1).map((q) => ({ ...q, id: `tn_${q.id}`, lane: "TEST_NOW", track: "MIXED" })),
  ...BASE.filter((q) => q.track === "SECURITY_PLUS").slice(0, 1).map((q) => ({ ...q, id: `tn_${q.id}`, lane: "TEST_NOW", track: "MIXED" })),
  ...BASE.filter((q) => q.track === "AZ_900").slice(0, 2).map((q) => ({ ...q, id: `tn_${q.id}`, lane: "TEST_NOW", track: "MIXED" })),
];

export function getPositionPool(path: PositionPath): PracticeQuestion[] {
  const key = getPoolKeyForPosition(path);
  return readOverride(key) ?? BASE.filter((q) => q.lane === "POSITION" && q.track === path);
}

export function getCertPool(cert: CertTrack): PracticeQuestion[] {
  const key = getPoolKeyForCert(cert);
  return readOverride(key) ?? BASE.filter((q) => q.lane === "CERT" && q.track === cert);
}

export function getTestNowPool(): PracticeQuestion[] {
  return readOverride(TEST_NOW_POOL_KEY) ?? TEST_NOW_DEFAULT;
}

export function getAllDefaultPools() {
  return {
    position: {
      HELPDESK_SUPPORT: getPositionPool("HELPDESK_SUPPORT"),
      DESKTOP_TECHNICIAN: getPositionPool("DESKTOP_TECHNICIAN"),
      CLOUD_ENGINEER: getPositionPool("CLOUD_ENGINEER"),
    },
    cert: {
      A_PLUS: getCertPool("A_PLUS"),
      SECURITY_PLUS: getCertPool("SECURITY_PLUS"),
      AZ_900: getCertPool("AZ_900"),
    },
    testNow: getTestNowPool(),
  };
}

/**
 * Admin-friendly key format used across the UI.
 * Examples:
 *  - POSITION:HELPDESK_SUPPORT
 *  - CERT:AZ_900
 *  - TEST_NOW:MIXED
 */
export function listPoolKeys(): string[] {
  return [
    "POSITION:HELPDESK_SUPPORT",
    "POSITION:DESKTOP_TECHNICIAN",
    "POSITION:CLOUD_ENGINEER",
    "CERT:A_PLUS",
    "CERT:SECURITY_PLUS",
    "CERT:AZ_900",
    "TEST_NOW:MIXED",
  ];
}

export function getPool(poolKey: string): PracticeQuestion[] {
  const [lane, track] = poolKey.split(":");
  if (lane === "POSITION") {
    const p = track as PositionPath;
    if (p === "HELPDESK_SUPPORT" || p === "DESKTOP_TECHNICIAN" || p === "CLOUD_ENGINEER") {
      return getPositionPool(p);
    }
    return [];
  }
  if (lane === "CERT") {
    const c = track as CertTrack;
    if (c === "A_PLUS" || c === "SECURITY_PLUS" || c === "AZ_900") {
      return getCertPool(c);
    }
    return [];
  }
  if (lane === "TEST_NOW") {
    return getTestNowPool();
  }
  return [];
}
