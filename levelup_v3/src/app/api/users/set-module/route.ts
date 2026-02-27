import { z } from "zod";
import { prisma } from "../../_lib/prisma";

const Body = z.object({
  userId: z.string().min(1),
  moduleChoice: z.enum(["INTERVIEW", "CERTIFICATIONS", "PRO_DEV"]),
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());

    const user = await prisma.user.upsert({
      where: { id: body.userId },
      update: { moduleChoice: body.moduleChoice },
      create: { id: body.userId, email: "demo@local", displayName: "Demo User", moduleChoice: body.moduleChoice },
    });

    return Response.json({ ok: true, user: { id: user.id, moduleChoice: user.moduleChoice } });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "Bad request" }, { status: 400 });
  }
}
