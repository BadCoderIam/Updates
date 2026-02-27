-- CreateEnum
CREATE TYPE "Track" AS ENUM ('IT_SUPPORT');

-- CreateEnum
CREATE TYPE "StartingPosition" AS ENUM ('HELPDESK_SUPPORT', 'DESKTOP_TECHNICIAN', 'CLOUD_ENGINEER');

-- CreateEnum
CREATE TYPE "ModuleChoice" AS ENUM ('INTERVIEW', 'CERTIFICATIONS', 'PRO_DEV');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('HR_INVITE', 'TECH_INTERVIEW_READY', 'BADGE_EXPIRES_SOON');

-- CreateEnum
CREATE TYPE "InterviewKind" AS ENUM ('HR', 'TECH');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('IN_PROGRESS', 'FINISHED');

-- CreateEnum
CREATE TYPE "TurnSpeaker" AS ENUM ('INTERVIEWER', 'CANDIDATE');

-- CreateEnum
CREATE TYPE "CertExam" AS ENUM ('A_PLUS', 'SECURITY_PLUS', 'AZ_900');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "startingPosition" "StartingPosition",
    "moduleChoice" "ModuleChoice",
    "xp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "track" "Track" NOT NULL,
    "tier" INTEGER NOT NULL,
    "domain" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "scoreTotal" DOUBLE PRECISION NOT NULL,
    "xpAwarded" INTEGER NOT NULL,
    "breakdownJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertPracticeAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exam" "CertExam" NOT NULL,
    "prompt" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "xpAwarded" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertPracticeAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDomain" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "lastPracticedAt" TIMESTAMP(3),

    CONSTRAINT "UserDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "InterviewKind" NOT NULL,
    "status" "InterviewStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "pass" BOOLEAN,
    "scoreAvg" DOUBLE PRECISION,
    "summary" TEXT,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewTurn" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "speaker" "TurnSpeaker" NOT NULL DEFAULT 'CANDIDATE',
    "content" TEXT NOT NULL,
    "turnIndex" INTEGER NOT NULL,
    "scoreTotal" DOUBLE PRECISION NOT NULL,
    "breakdownJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockOffer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "roleLabel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "salaryText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PracticeAnswer_userId_createdAt_idx" ON "PracticeAnswer"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PracticeAnswer_userId_domain_idx" ON "PracticeAnswer"("userId", "domain");

-- CreateIndex
CREATE INDEX "CertPracticeAnswer_userId_createdAt_idx" ON "CertPracticeAnswer"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CertPracticeAnswer_userId_exam_idx" ON "CertPracticeAnswer"("userId", "exam");

-- CreateIndex
CREATE INDEX "UserDomain_userId_xp_idx" ON "UserDomain"("userId", "xp");

-- CreateIndex
CREATE UNIQUE INDEX "UserDomain_userId_domain_key" ON "UserDomain"("userId", "domain");

-- CreateIndex
CREATE INDEX "InterviewSession_userId_kind_startedAt_idx" ON "InterviewSession"("userId", "kind", "startedAt");

-- CreateIndex
CREATE INDEX "InterviewTurn_sessionId_turnIndex_idx" ON "InterviewTurn"("sessionId", "turnIndex");

-- CreateIndex
CREATE INDEX "Badge_userId_expiresAt_idx" ON "Badge"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "MockOffer_userId_createdAt_idx" ON "MockOffer"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PracticeAnswer" ADD CONSTRAINT "PracticeAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertPracticeAnswer" ADD CONSTRAINT "CertPracticeAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDomain" ADD CONSTRAINT "UserDomain_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewTurn" ADD CONSTRAINT "InterviewTurn_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockOffer" ADD CONSTRAINT "MockOffer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
