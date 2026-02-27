import { z } from "zod";
import { prisma } from "../../_lib/prisma";

const Body = z.object({
  userId: z.string().min(1),
  templateId: z.string().min(1),
  targetRole: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());

    const resume = await prisma.resumeFile.findFirst({
      where: { userId: body.userId },
      orderBy: { uploadedAt: "desc" },
    });
    if (!resume?.parsedAt || !resume.parsedJson) {
      return Response.json({ error: "Parse your resume first." }, { status: 400 });
    }

    const contentJson = {
      ...resume.parsedJson,
      targetRole: body.targetRole,
      templateId: body.templateId,
      atsFirst: true,
      generatedAt: new Date().toISOString(),
    };

    const draft = await prisma.resumeDraft.create({
      data: {
        userId: body.userId,
        templateId: body.templateId,
        targetRole: body.targetRole,
        atsFirst: true,
        contentJson,
      },
    });

    return Response.json({ ok: true, draft });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Draft failed" }, { status: 400 });
  }
}
