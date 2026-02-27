import { NextResponse } from "next/server";
import { prisma } from "../../_lib/prisma";
import { ensureUser } from "../../_lib/ensureUser";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = String(body?.userId ?? "");
    const lootBoxIds = Array.isArray(body?.lootBoxIds) ? (body.lootBoxIds as string[]) : [];

    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    await ensureUser(userId);

    if (!(prisma as any).lootBox) {
      return NextResponse.json(
        { error: "Prisma client is missing LootBox model. Run: npx prisma generate && npx prisma migrate dev" },
        { status: 500 }
      );
    }
    if (!lootBoxIds.length) return NextResponse.json({ error: "Missing lootBoxIds" }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      // Ensure wallet exists
      const wallet = await tx.wallet.upsert({
        where: { userId },
        update: {},
        create: { userId, tokenBalance: 0 },
      });

      const boxes = await tx.lootBox.findMany({
        where: { id: { in: lootBoxIds }, userId },
        include: { drops: true },
      });

      const claimable = boxes.filter((b) => b.status === "OPENED");
      if (!claimable.length) return { claimed: 0, tokenBalance: wallet.tokenBalance, xpAdded: 0 };

      let tokensToAdd = 0;
      let xpToAdd = 0;

      for (const box of claimable) {
        for (const d of box.drops) {
          if (d.rewardType === "TOKENS") {
            tokensToAdd += d.quantity;
            continue;
          }
          if (d.rewardType === "XP_BOOST") {
            // XP rewards apply directly to the user's profile XP
            xpToAdd += d.quantity;
            // Also store in inventory history
            await tx.inventoryItem.create({
              data: { userId, itemType: "XP_BOOST", itemRef: d.rewardRef, quantity: d.quantity },
            });
            continue;
          }

          // Everything else goes to inventory
          await tx.inventoryItem.create({
            data: {
              userId,
              itemType: d.rewardType,
              itemRef: d.rewardRef,
              quantity: d.quantity,
            },
          });
        }
      }

      const updatedWallet = await tx.wallet.update({
        where: { userId },
        data: { tokenBalance: { increment: tokensToAdd } },
      });

      if (xpToAdd > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { xp: { increment: xpToAdd } },
        });
      }

      await tx.lootBox.updateMany({
        where: { id: { in: claimable.map((b) => b.id) }, userId },
        data: { status: "CLAIMED", claimedAt: new Date() },
      });

      // Clear LOOT notifications after claiming (server-side)
      await tx.notification.updateMany({
        where: { userId, type: "LOOT_BOX_EARNED", readAt: null },
        data: { readAt: new Date() },
      });

      return { claimed: claimable.length, tokenBalance: updatedWallet.tokenBalance, tokensAdded: tokensToAdd, xpAdded: xpToAdd };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 500 });
  }
}
