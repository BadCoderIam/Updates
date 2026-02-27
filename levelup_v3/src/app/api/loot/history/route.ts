import { NextResponse } from "next/server";
import { prisma } from "../../_lib/prisma";
import { ensureUser } from "../../_lib/ensureUser";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = String(searchParams.get("userId") ?? "");
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    await ensureUser(userId);

    if (!(prisma as any).lootBox) {
      return NextResponse.json(
        { error: "Prisma client is missing LootBox model. Run: npx prisma generate && npx prisma migrate dev" },
        { status: 500 }
      );
    }

    const [user, wallet, boxes, inventory] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, xp: true } }),
      prisma.wallet.findUnique({ where: { userId }, select: { tokenBalance: true } }),
      prisma.lootBox.findMany({
        where: { userId, status: { in: ["OPENED", "CLAIMED"] } },
        include: { drops: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.inventoryItem.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

    const level = user ? Math.max(1, Math.floor((user.xp ?? 0) / 500) + 1) : 1;

    return NextResponse.json({
      user: user ? { ...user, level } : null,
      wallet,
      boxes,
      inventory,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}