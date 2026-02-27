import { prisma } from "../../_lib/prisma";
import { ensureUser } from "../../_lib/ensureUser";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    if (!userId) return Response.json({ ok: false, error: "userId required" }, { status: 400 });

    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      // Create a minimal user record for local/demo flows
      user = await ensureUser(userId);
    }

    const [notifications, badges, offers] = await Promise.all([
      prisma.notification.findMany({
        where: { userId, readAt: null },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.badge.findMany({
        where: { userId },
        orderBy: { issuedAt: "desc" },
        take: 20,
      }),
      prisma.mockOffer.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    // Wallet (tokens) is optional in older DBs; ensure it exists for local/demo flows.
    const wallet = await prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, tokenBalance: 0 },
    });

    return Response.json({
      ok: true,
      user: {
        id: user.id,
        xp: user.xp,
        tokenBalance: wallet.tokenBalance,
        rank: (user as any).rank ?? "STUDENT",
        drawingEligibleUntil: (user as any).drawingEligibleUntil ?? null,
        startingPosition: user.startingPosition,
        moduleChoice: user.moduleChoice,
      },
      xp: user.xp,
      tokenBalance: wallet.tokenBalance,
      notifications,
      badges,
      offers,
    });
  } catch (err: any) {
    // Ensure the client always receives JSON (avoids res.json() parsing crashes)
    const message = err?.message ?? "Internal error";
    return Response.json(
      { ok: false, error: "Failed to load user summary", detail: message },
      { status: 500 }
    );
  }
}