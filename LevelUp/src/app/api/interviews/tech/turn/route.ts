import { z } from "zod";
import { prisma } from "../../../_lib/prisma";
import { gradeAnswer } from "../../../_lib/scoring";
import { nextTechQuestion } from "../../../_lib/questions";

const Body = z.object({
  sessionId: z.string().min(1),
  answer: z.string().min(20),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const session = await prisma.interviewSession.findUnique({ where: { id: body.sessionId } });
    if (!session) return Response.json({ error: "Session not found" }, { status: 404 });
    if (session.status !== "IN_PROGRESS") return Response.json({ error: "Session not active" }, { status: 400 });

    const turnIndex = await prisma.interviewTurn.count({ where: { sessionId: session.id } });
    const score = gradeAnswer({ tier: 3, answerText: body.answer }); // Tech uses higher tier scoring heuristics.

    await prisma.interviewTurn.create({
      data: {
        sessionId: session.id,
        speaker: "CANDIDATE",
        content: body.answer,
        scoreTotal: score.total,
        breakdownJson: score,
        turnIndex,
      },
    });

    const nextQ = nextTechQuestion(turnIndex + 1);
    return Response.json({ ok: true, nextQuestion: nextQ });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Bad request" }, { status: 400 });
  }
}
