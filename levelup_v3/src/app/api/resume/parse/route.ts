import { z } from "zod";
import { prisma } from "../../_lib/prisma";
import { readFile } from "fs/promises";

const Body = z.object({
  userId: z.string().min(1),
});

function fallbackParse(textHint: string) {
  return {
    basics: { name: "", email: "", phone: "" },
    headline: "",
    skills: [],
    experience: [],
    education: [],
    certifications: [],
    keywords: [],
    note: textHint,
  };
}

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());

    const resume = await prisma.resumeFile.findFirst({
      where: { userId: body.userId },
      orderBy: { uploadedAt: "desc" },
    });
    if (!resume) return Response.json({ error: "No resume uploaded" }, { status: 400 });

    const serviceUrl = process.env.RESUME_SERVICE_URL || "http://localhost:8000";

    let parsedJson: any = null;
    try {
      const fileBuf = await readFile(resume.storageKey);
      const fd = new FormData();
      fd.append("file", new Blob([fileBuf], { type: resume.mimeType }), resume.fileName);
      const r = await fetch(`${serviceUrl}/parse_resume`, { method: "POST", body: fd as any });
      if (!r.ok) throw new Error(await r.text());
      parsedJson = await r.json();
    } catch {
      // Python service may not be running yet. Keep a safe fallback.
      parsedJson = fallbackParse("Resume service not running. Start it with: docker compose up -d resume");
    }

    const updated = await prisma.resumeFile.update({
      where: { id: resume.id },
      data: {
        parsedAt: new Date(),
        parsedJson,
      },
    });

    return Response.json({ ok: true, resume: updated });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Parse failed" }, { status: 400 });
  }
}
