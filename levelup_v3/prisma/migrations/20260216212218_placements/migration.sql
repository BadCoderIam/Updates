-- CreateEnum
CREATE TYPE "ContentLane" AS ENUM ('TEST_NOW', 'TRAINING', 'CERTIFICATIONS');

-- CreateTable
CREATE TABLE "QuestionSetPlacement" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "lane" "ContentLane" NOT NULL,
    "startingPosition" "StartingPosition",
    "certExam" "CertExam",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionSetPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionSetPlacement_lane_isActive_createdAt_idx" ON "QuestionSetPlacement"("lane", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "QuestionSetPlacement_lane_startingPosition_idx" ON "QuestionSetPlacement"("lane", "startingPosition");

-- CreateIndex
CREATE INDEX "QuestionSetPlacement_lane_certExam_idx" ON "QuestionSetPlacement"("lane", "certExam");

-- AddForeignKey
ALTER TABLE "QuestionSetPlacement" ADD CONSTRAINT "QuestionSetPlacement_setId_fkey" FOREIGN KEY ("setId") REFERENCES "QuestionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
