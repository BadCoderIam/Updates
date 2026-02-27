-- CreateEnum
CREATE TYPE "UserRank" AS ENUM ('STUDENT', 'PROFESSIONAL');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "drawingEligibleUntil" TIMESTAMP(3),
ADD COLUMN     "rank" "UserRank" NOT NULL DEFAULT 'STUDENT',
ADD COLUMN     "rankUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ResumeFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parsedAt" TIMESTAMP(3),
    "parsedJson" JSONB,

    CONSTRAINT "ResumeFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "atsFirst" BOOLEAN NOT NULL DEFAULT true,
    "contentJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResumeFile_userId_uploadedAt_idx" ON "ResumeFile"("userId", "uploadedAt");

-- CreateIndex
CREATE INDEX "ResumeDraft_userId_createdAt_idx" ON "ResumeDraft"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ResumeFile" ADD CONSTRAINT "ResumeFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeDraft" ADD CONSTRAINT "ResumeDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
