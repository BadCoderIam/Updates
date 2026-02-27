import { prisma } from "../../_lib/prisma";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const userId = String(form.get("userId") || "");
    const file = form.get("file") as File | null;

    if (!userId) return Response.json({ error: "Missing userId" }, { status: 400 });
    if (!file) return Response.json({ error: "Missing file" }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const safeName = (file.name || "resume").replace(/[^a-zA-Z0-9._-]+/g, "_");
    const dir = path.join(process.cwd(), "uploads", "resumes", userId);
    await mkdir(dir, { recursive: true });
    const storageKey = path.join(dir, `${Date.now()}-${safeName}`);
    await writeFile(storageKey, buf);

    const resume = await prisma.resumeFile.create({
      data: {
        userId,
        fileName: safeName,
        mimeType: file.type || "application/octet-stream",
        storageKey,
      },
    });

    return Response.json({ ok: true, resume });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Upload failed" }, { status: 400 });
  }
}
