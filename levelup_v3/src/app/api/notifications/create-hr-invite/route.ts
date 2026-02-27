import { z } from "zod";
import { prisma } from "../../_lib/prisma";

const Body = z.object({ userId: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const { userId } = Body.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return Response.json({ error: "User not found" }, { status: 404 });

    const recent = await prisma.notification.findFirst({
      where: { userId, type: "HR_INVITE", createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
    });
    if (recent) return Response.json({ ok: true, skipped: true, reason: "Recent HR invite already exists." });

    const n = await prisma.notification.create({
      data: {
        userId,
        type: "HR_INVITE",
        title: "Hiring Manager wants to screen you",
        body: "You qualified. Start your HR screen interview when you're ready.",
      },
    });

    return Response.json({ ok: true, notification: n });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Bad request" }, { status: 400 });
  }
}
