import { prisma } from "../../_lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

  const offer = await prisma.mockOffer.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ ok: true, offer });
}
