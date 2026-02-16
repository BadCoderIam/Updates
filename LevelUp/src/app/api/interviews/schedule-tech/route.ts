import { z } from "zod";
import { prisma } from "../../_lib/prisma";

const Body = z.object({
  userId: z.string().min(1),
  afterMinutesMin: z.number().min(15).max(30).optional(),
  afterMinutesMax: z.number().min(15).max(30).optional(),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) return Response.json({ error: "User not found" }, { status: 404 });

    const min = body.afterMinutesMin ?? 15;
    const max = body.afterMinutesMax ?? 30;
    const delay = Math.floor(min + Math.random() * (max - min + 1));

    const scheduledAt = new Date(Date.now() + delay * 60 * 1000);

    // Stub: store a "notification intent". A worker would deliver at scheduledAt.
    const notif = await prisma.notification.create({
      data: {
        userId: user.id,
        type: "TECH_INTERVIEW_READY",
        title: "Tech interview is ready",
        body: `Your tech interview is ready. Join in ~${delay} minutes.`,
        scheduledAt,
      },
    });

    return Response.json({ ok: true, scheduledAt, delayMinutes: delay, notificationId: notif.id });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Bad request" }, { status: 400 });
  }
}
