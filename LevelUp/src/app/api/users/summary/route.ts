import { prisma } from "../../_lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const badges = await prisma.badge.findMany({
    where: { userId },
    orderBy: { issuedAt: "desc" },
    take: 20,
  });

  const offers = await prisma.mockOffer.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return Response.json({
    ok: true,
    user: { id: user.id, xp: user.xp, startingPosition: user.startingPosition, moduleChoice: user.moduleChoice },
    xp: user.xp,
    notifications,
    badges,
    offers,
  });
}
