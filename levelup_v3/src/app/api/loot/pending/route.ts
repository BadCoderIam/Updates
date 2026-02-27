import { NextResponse } from "next/server";
import { prisma } from "../../_lib/prisma";
import { ensureUser } from "../../_lib/ensureUser";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = String(searchParams.get("userId") ?? "");
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    // Ensure user exists (demo/local mode)
    await ensureUser(userId);

    // If Prisma client is stale (missing models), fail gracefully with a clear message.
    if (!(prisma as any).lootBox) {
      return NextResponse.json({ error: "Prisma client is missing LootBox model. Run: npx prisma generate && npx prisma migrate dev" }, { status: 500 });
    }

    const pending = await prisma.lootBox.findMany({
      where: { userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, createdAt: true },
      take: 50,
    });

    const wallet = await prisma.wallet.findUnique({ where: { userId } });

    return NextResponse.json({ pending, tokenBalance: wallet?.tokenBalance ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
