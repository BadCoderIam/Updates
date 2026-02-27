import { prisma } from "../_lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || "";
  if (!userId) return Response.json({ error: "Missing userId" }, { status: 400 });

  const resume = await prisma.resumeFile.findFirst({
    where: { userId },
    orderBy: { uploadedAt: "desc" },
  });

  const drafts = await prisma.resumeDraft.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return Response.json({
    ok: true,
    resume,
    drafts,
  });
}
