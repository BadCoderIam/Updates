import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Admin: Assign a QuestionSet to a "lane" (TEST_NOW / TRAINING / CERTIFICATIONS).
 * - For TRAINING: include startingPosition
 * - For CERTIFICATIONS: include certExam
 * Creates a new active placement and deactivates prior active placements for the same lane+filter.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const setId = String(body?.setId || "");
    const lane = body?.lane as "TEST_NOW" | "TRAINING" | "CERTIFICATIONS";
    const startingPosition = body?.startingPosition ?? null;
    const certExam = body?.certExam ?? null;

    if (!setId || !lane) {
      return NextResponse.json({ error: "setId and lane are required" }, { status: 400 });
    }
    if (lane === "TRAINING" && !startingPosition) {
      return NextResponse.json({ error: "startingPosition is required for TRAINING" }, { status: 400 });
    }
    if (lane === "CERTIFICATIONS" && !certExam) {
      return NextResponse.json({ error: "certExam is required for CERTIFICATIONS" }, { status: 400 });
    }

    const whereDeactivate: any = { lane, isActive: true };
    if (lane === "TRAINING") whereDeactivate.startingPosition = startingPosition;
    if (lane === "CERTIFICATIONS") whereDeactivate.certExam = certExam;
    if (lane === "TEST_NOW") {
      // nothing extra
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.questionSetPlacement.updateMany({
        where: whereDeactivate,
        data: { isActive: false },
      });
      return tx.questionSetPlacement.create({
        data: {
          setId,
          lane,
          startingPosition: lane === "TRAINING" ? startingPosition : null,
          certExam: lane === "CERTIFICATIONS" ? certExam : null,
          isActive: true,
        },
      });
    });

    return NextResponse.json({ ok: true, placement: created });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to assign placement" }, { status: 500 });
  }
}

export async function GET() {
  const placements = await prisma.questionSetPlacement.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { set: true },
  });
  return NextResponse.json({ placements });
}
