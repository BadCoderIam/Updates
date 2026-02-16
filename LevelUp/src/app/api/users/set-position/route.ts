import { z } from "zod";
import { prisma } from "../../_lib/prisma";

const Body = z.object({
  userId: z.string().min(1),
  startingPosition: z.enum(["HELPDESK_SUPPORT", "DESKTOP_TECHNICIAN", "CLOUD_ENGINEER"]),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());

    const user = await prisma.user.upsert({
      where: { id: body.userId },
      update: { startingPosition: body.startingPosition },
      create: { id: body.userId, email: "demo@local", displayName: "Demo User", startingPosition: body.startingPosition },
    });

    return Response.json({ ok: true, user: { id: user.id, startingPosition: user.startingPosition } });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Bad request" }, { status: 400 });
  }
}
