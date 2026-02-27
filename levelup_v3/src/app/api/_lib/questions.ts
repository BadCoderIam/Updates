export function nextHRQuestion(turnIndex: number): string {
  const qs = [
    "Tell me about yourself and what kind of IT support role you're looking for.",
    "Describe a time you handled a difficult user. What was the situation and outcome?",
    "How do you prioritize multiple urgent tickets at once?",
    "Walk me through how you communicate during an outage or major incident.",
    "Why do you want this role and what makes you a strong fit?",
    "Do you have any questions for me?",
  ];
  return qs[Math.min(turnIndex, qs.length - 1)];
}

export function nextTechQuestion(turnIndex: number): string {
  const qs = [
    "A user reports they can't access the internet. Walk through your troubleshooting steps.",
    "Outlook won't send email. What do you check first and why?",
    "A network drive is mapped but access is denied. How do you troubleshoot?",
    "A printer is 'offline' for multiple users. How do you diagnose and fix it?",
    "Explain what DNS does and how you'd troubleshoot a DNS resolution issue.",
    "A user's computer is slow. What steps do you take to isolate the cause?",
    "Do you have any questions for the technical team?",
  ];
  return qs[Math.min(turnIndex, qs.length - 1)];
}
