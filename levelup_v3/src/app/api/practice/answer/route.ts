import { z } from "zod";
import { prisma } from "../../_lib/prisma";
import { gradeAnswer, qualifiesForHR, rankLabelIT, readinessFromXP } from "../../_lib/scoring";

const Body = z.object({
  userId: z.string().min(1),
  track: z.enum(["IT_SUPPORT"]),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  domain: z.string().min(2),
  prompt: z.string().min(5),
  answer: z.string().min(20),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());

    // Ensure user exists (demo-friendly).
    const user = await prisma.user.upsert({
      where: { id: body.userId },
      update: {},
      create: {
        id: body.userId,
        email: "demo@local",
        displayName: "Demo User",
      },
    });

    const score = gradeAnswer({ tier: body.tier, answerText: body.answer });

    await prisma.practiceAnswer.create({
      data: {
        userId: user.id,
        track: body.track,
        tier: body.tier,
        domain: body.domain,
        prompt: body.prompt,
        answer: body.answer,
        scoreTotal: score.total,
        xpAwarded: score.xpAwarded,
        breakdownJson: score,
      },
    });

    // Update user XP
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        xp: { increment: score.xpAwarded },
        lastActiveAt: new Date(),
      },
      select: { xp: true },
    });

    // Update per-domain mastery (domain XP is a smaller slice of awarded XP)
    const domainXP = Math.round(score.xpAwarded * 0.6);
    await prisma.userDomain.upsert({
      where: { userId_domain: { userId: user.id, domain: body.domain } },
      update: { xp: { increment: domainXP }, lastPracticedAt: new Date() },
      create: { userId: user.id, domain: body.domain, xp: domainXP, lastPracticedAt: new Date() },
    });

    const readiness = readinessFromXP(updated.xp);

    // Count domains that have crossed a mastery threshold
    const masteredDomains = await prisma.userDomain.count({
      where: { userId: user.id, xp: { gte: 120 } }, // MVP threshold
    });

    const snapshot = {
      xp: updated.xp,
      readiness,
      rankLabel: rankLabelIT(updated.xp),
      qualifiedForHR: qualifiesForHR({ userXP: updated.xp, readiness, domainMasteryCount: masteredDomains }),
    };

    return Response.json({ ok: true, snapshot });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Bad request" }, { status: 400 });
  }
}
