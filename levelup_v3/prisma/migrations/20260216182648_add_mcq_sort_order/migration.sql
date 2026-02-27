/*
  Warnings:

  - Added the required column `updatedAt` to the `MCQQuestion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PracticeAnswer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MCQQuestion" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "PracticeAnswer" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "MCQQuestion_setId_sortOrder_idx" ON "MCQQuestion"("setId", "sortOrder");
