import { z } from "zod";
import { prisma } from "../../../_lib/prisma";
import { nextTechQuestion } from "../../../_lib/questions";

const Body = z.object({ userId: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const { userId } = Body.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return Response.json({ error: "User not found" }, { status: 404 });

    const session = await prisma.interviewSession.create({
      data: {
        userId,
        kind: "TECH",
        status: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });

    return Response.json({ ok: true, session, nextQuestion: nextTechQuestion(0) });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Bad request" }, { status: 400 });
  }
}
