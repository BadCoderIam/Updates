import { z } from "zod";
import { prisma } from "../../_lib/prisma";
import { qualifiesForHR, readinessFromXP } from "../../_lib/scoring";

const Body = z.object({
  userId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const { userId } = Body.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return Response.json({ error: "User not found" }, { status: 404 });

    const readiness = readinessFromXP(user.xp);
    const masteredDomains = await prisma.userDomain.count({ where: { userId, xp: { gte: 120 } } });
    const eligible = qualifiesForHR({ userXP: user.xp, readiness, domainMasteryCount: masteredDomains });

    return Response.json({
      ok: true,
      eligible,
      readiness,
      xp: user.xp,
      reason: eligible ? "Eligible for HR ping" : `Need more readiness and breadth (mastered domains: ${masteredDomains}/3)`,
    });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Bad request" }, { status: 400 });
  }
}
