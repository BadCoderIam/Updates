import { NextResponse } from "next/server";
import { prisma } from "../../_lib/prisma";
import { ensureUser } from "../../_lib/ensureUser";

// Creates pending loot boxes (typically on level-up) and a notification.
// Server-side verification: grants ONLY when XP crosses a level threshold.
// Level is derived from XP: level = floor(xp / 500) + 1
const XP_PER_LEVEL = 500;

function levelFromXp(xp: number) {
  const safe = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  return Math.floor(safe / XP_PER_LEVEL) + 1;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = String(body?.userId ?? "");
    const source = body?.source ? String(body.source) : "level_up";

    // Caller can pass xpAfter (preferred). If missing, we won't mint.
    const xpAfterRaw = body?.xpAfter;
    const xpAfter = xpAfterRaw == null ? null : Number(xpAfterRaw);

    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    await ensureUser(userId);

    if (!(prisma as any).lootBox) {
      return NextResponse.json(
        { error: "Prisma client is missing LootBox model. Run: npx prisma generate && npx prisma migrate dev" },
        { status: 500 }
      );
    }

    // Ensure wallet exists
    await prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, tokenBalance: 0 },
    });

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      const grantedUpTo = (user as any)?.lootGrantedUpToLevel ?? 0;
      const currentXp = (user as any)?.xp ?? 0;

      // If caller doesn't provide xpAfter, do nothing (prevents refresh/clients minting blindly).
      if (xpAfter == null || !Number.isFinite(xpAfter)) {
        const pendingCount = await tx.lootBox.count({ where: { userId, status: "PENDING" } });
        return { created: 0, pendingCount, skipped: true, reason: "xpAfter_required" };
      }

      // Optionally sync XP upward (never decrease from client).
      if (xpAfter > currentXp) {
        await tx.user.update({ where: { id: userId }, data: { xp: Math.floor(xpAfter) } });
      }

      const effectiveXp = Math.max(currentXp, xpAfter);
      const levelNow = levelFromXp(effectiveXp);

      // Already granted for this level (or beyond)
      if (levelNow <= grantedUpTo) {
        const pendingCount = await tx.lootBox.count({ where: { userId, status: "PENDING" } });
        return { created: 0, pendingCount, skipped: true, levelNow, grantedUpTo };
      }

      const levelsToGrant = Math.max(0, levelNow - grantedUpTo);

      // Create one box per new level
      await tx.lootBox.createMany({
        data: Array.from({ length: levelsToGrant }).map(() => ({
          userId,
          type: "BRONZE",
          status: "PENDING",
          source,
        })),
      });

      // Mark granted up to this level
      await tx.user.update({
        where: { id: userId },
        data: { lootGrantedUpToLevel: levelNow },
      });

      const pendingCount = await tx.lootBox.count({ where: { userId, status: "PENDING" } });

      // Create a persistent notification only when we actually granted something
      await tx.notification.create({
        data: {
          userId,
          type: "LOOT_BOX_EARNED",
          title: "Reward unlocked!",
          body: `You reached Level ${levelNow}. You now have ${pendingCount} loot box${pendingCount === 1 ? "" : "es"} ready to open.`,
        },
      });

      return { created: levelsToGrant, pendingCount, skipped: false, levelNow };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
