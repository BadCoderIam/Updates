import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/questions?setId=...
 * Returns questions ordered by sortOrder.
 */
export async function GET(req: Request) {
  try{
    const { searchParams } = new URL(req.url);
    const setId = searchParams.get("setId");
    if (!setId) return NextResponse.json({ error: "setId is required" }, { status: 400 });

    const questions = await prisma.mCQQuestion.findMany({
      where: { setId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 500,
    });
    return NextResponse.json({ questions });
  }catch(e:any){
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

/**
 * POST /api/admin/questions
 * Supports:
 *  - single insert: { setId, prompt, choices[], correctIndex, explanation?, difficulty?, tags? }
 *  - bulk insert:   { setId, questions: [ {prompt, choices, correctIndex, ...} ] }
 */
export async function POST(req: Request) {
  try{
    const body = await req.json();
    const setId = body.setId;
    if (!setId) return NextResponse.json({ error: "setId is required" }, { status: 400 });

    // Determine next sortOrder
    const max = await prisma.mCQQuestion.aggregate({
      where: { setId },
      _max: { sortOrder: true },
    });
    let nextOrder = (max._max.sortOrder ?? -1) + 1;

    // Bulk insert
    if (Array.isArray(body.questions)){
      const incoming = body.questions;
      if (incoming.length === 0) return NextResponse.json({ inserted: 0 });

      const data = incoming.map((q: any) => {
        if (!q?.prompt || !Array.isArray(q?.choices) || q.choices.length < 2 || typeof q.correctIndex !== "number"){
          throw new Error("Each question requires prompt, choices[], correctIndex");
        }
        const row = {
          setId,
          prompt: q.prompt,
          choices: q.choices,
          correctIndex: q.correctIndex,
          explanation: q.explanation ?? null,
          difficulty: q.difficulty ?? 1,
          tags: q.tags ?? [],
          sortOrder: typeof q.sortOrder === "number" ? q.sortOrder : nextOrder++,
        };
        return row;
      });

      // createMany does not return rows; that's fine
      const res = await prisma.mCQQuestion.createMany({ data });
      return NextResponse.json({ inserted: res.count });
    }

    // Single insert
    const prompt = body.prompt;
    const choices = body.choices;
    const correctIndex = body.correctIndex;
    if (!prompt || !Array.isArray(choices) || choices.length < 2 || typeof correctIndex !== "number"){
      return NextResponse.json({ error: "prompt, choices[], correctIndex are required" }, { status: 400 });
    }

    const q = await prisma.mCQQuestion.create({
      data: {
        setId,
        prompt,
        choices,
        correctIndex,
        explanation: body.explanation ?? null,
        difficulty: body.difficulty ?? 1,
        tags: body.tags ?? [],
        sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : nextOrder,
      },
    });

    return NextResponse.json({ question: q });
  }catch(e:any){
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/questions
 * Body:
 *  - { setId, order: [questionId1, questionId2, ...] } // reorders
 *  - { id, patch: { ... } } // (future)
 */
export async function PATCH(req: Request) {
  try{
    const body = await req.json();

    if (body?.setId && Array.isArray(body?.order)){
      const setId = body.setId as string;
      const order = body.order as string[];
      // Update sortOrder in a transaction
      await prisma.$transaction(order.map((id, idx) =>
        prisma.mCQQuestion.update({
          where: { id },
          data: { sortOrder: idx },
        })
      ));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported PATCH body" }, { status: 400 });
  }catch(e:any){
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
