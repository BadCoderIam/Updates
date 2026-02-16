import { z } from "zod";
import { prisma } from "../../../_lib/prisma";
import { interviewPassFail } from "../../../_lib/scoring";

const Body = z.object({ sessionId: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const { sessionId } = Body.parse(await req.json());
    const session = await prisma.interviewSession.findUnique({ where: { id: sessionId } });
    if (!session) return Response.json({ error: "Session not found" }, { status: 404 });

    const turns = await prisma.interviewTurn.findMany({
      where: { sessionId },
      orderBy: { turnIndex: "asc" },
    });

    const scores = turns.map(t => Number(t.scoreTotal)).filter(n => !Number.isNaN(n));
    const avg = scores.length ? scores.reduce((a,b)=>a+b,0) / scores.length : 0;

    const result = interviewPassFail({ hrAvg: avg });

    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: "FINISHED",
        finishedAt: new Date(),
        pass: result.pass,
        scoreAvg: avg,
        summary: result.summary,
      },
    });

    if (result.pass) {
      // Create a scheduled "tech interview ready" notification 15–30 minutes later (stub delivery).
      const delay = Math.floor(15 + Math.random() * 16);
      const scheduledAt = new Date(Date.now() + delay * 60 * 1000);

      await prisma.notification.create({
        data: {
          userId: session.userId,
          type: "TECH_INTERVIEW_READY",
          title: "Tech interview is ready",
          body: `You passed HR. Tech interview will be ready in ~${delay} minutes.`,
          scheduledAt,
        },
      });
    } else {
      await prisma.notification.create({
        data: {
          userId: session.userId,
          type: "HR_INVITE",
          title: "HR screen needs improvement",
          body: "Practice a bit more and try again. Focus on STAR + clear structure.",
        },
      });
    }

    return Response.json({ ok: true, pass: result.pass, summary: result.summary, scoreAvg: avg });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Bad request" }, { status: 400 });
  }
}
