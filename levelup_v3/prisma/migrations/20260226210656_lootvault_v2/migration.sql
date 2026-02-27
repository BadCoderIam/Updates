-- CreateEnum
CREATE TYPE "LootBoxType" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND');

-- CreateEnum
CREATE TYPE "LootBoxStatus" AS ENUM ('PENDING', 'OPENED', 'CLAIMED');

-- CreateEnum
CREATE TYPE "LootRewardType" AS ENUM ('TOKENS', 'XP_BOOST', 'BADGE', 'RAFFLE_ENTRY', 'COUPON', 'PRIZE');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'LOOT_BOX_EARNED';

-- CreateTable
CREATE TABLE "LootBox" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LootBoxType" NOT NULL DEFAULT 'BRONZE',
    "status" "LootBoxStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "LootBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LootDrop" (
    "id" TEXT NOT NULL,
    "lootBoxId" TEXT NOT NULL,
    "rewardType" "LootRewardType" NOT NULL,
    "rewardRef" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "rarity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LootDrop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "userId" TEXT NOT NULL,
    "tokenBalance" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemRef" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LootBox_userId_status_createdAt_idx" ON "LootBox"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "LootDrop_lootBoxId_createdAt_idx" ON "LootDrop"("lootBoxId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryItem_userId_createdAt_idx" ON "InventoryItem"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "LootBox" ADD CONSTRAINT "LootBox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LootDrop" ADD CONSTRAINT "LootDrop_lootBoxId_fkey" FOREIGN KEY ("lootBoxId") REFERENCES "LootBox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
