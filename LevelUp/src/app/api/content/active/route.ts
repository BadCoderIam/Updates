import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Public: fetch the active question set + questions for a lane.
 * Query:
 *  - lane=TEST_NOW|TRAINING|CERTIFICATIONS (required)
 *  - startingPosition=HELPDESK_SUPPORT|DESKTOP_TECHNICIAN|CLOUD_ENGINEER (for TRAINING)
 *  - certExam=A_PLUS|SECURITY_PLUS|AZ_900 (for CERTIFICATIONS)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lane = (url.searchParams.get("lane") || "").toUpperCase() as any;
  const startingPosition = url.searchParams.get("startingPosition");
  const certExam = url.searchParams.get("certExam");

  if (!lane) {
    return NextResponse.json({ error: "lane is required" }, { status: 400 });
  }

  const where: any = { lane, isActive: true };
  if (lane === "TRAINING") where.startingPosition = startingPosition;
  if (lane === "CERTIFICATIONS") where.certExam = certExam;

  const placement = await prisma.questionSetPlacement.findFirst({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      set: {
        include: {
          questions: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!placement?.set) {
    return NextResponse.json({ ok: true, placement: null, set: null, questions: [] });
  }

  return NextResponse.json({
    ok: true,
    placement: {
      id: placement.id,
      lane: placement.lane,
      startingPosition: placement.startingPosition,
      certExam: placement.certExam,
      createdAt: placement.createdAt,
    },
    set: {
      id: placement.set.id,
      name: placement.set.name,
      domain: placement.set.domain,
      status: placement.set.status,
    },
    questions: placement.set.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      choices: q.choices,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      difficulty: q.difficulty,
      tags: q.tags,
      sortOrder: q.sortOrder,
    })),
  });
}
