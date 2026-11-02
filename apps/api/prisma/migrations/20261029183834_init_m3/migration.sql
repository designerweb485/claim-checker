-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'member');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ValidationRunStatus" AS ENUM ('pending', 'running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('error', 'warning', 'info');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'pending',
    "errorSummary" TEXT,
    "parserErrors" JSONB,
    "storageKey" TEXT NOT NULL,
    "transactionSet" TEXT,
    "igVersion" TEXT,
    "interchangeControlNumber" TEXT,
    "groupControlNumber" TEXT,
    "transactionControlNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "uploadId" UUID NOT NULL,
    "claimControlNumber" TEXT NOT NULL,
    "totalCharge" DECIMAL(12,2),
    "placeOfServiceCode" TEXT,
    "billingProviderNpi" TEXT,
    "billingProviderName" TEXT,
    "subscriberMemberId" TEXT,
    "subscriberLastName" TEXT,
    "subscriberFirstName" TEXT,
    "sourceLocation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimLine" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "procedureCode" TEXT,
    "procedureCodeQualifier" TEXT,
    "modifiers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "charge" DECIMAL(12,2),
    "unitCode" TEXT,
    "units" TEXT,
    "diagnosisPointers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "serviceDate" TEXT,
    "sourceLocation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Diagnosis" (
    "id" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "codeSet" TEXT NOT NULL,
    "sourceLocation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Diagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationRun" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "uploadId" UUID NOT NULL,
    "ruleSetVersion" TEXT NOT NULL,
    "status" "ValidationRunStatus" NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "summaryCounts" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValidationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationFinding" (
    "id" UUID NOT NULL,
    "validationRunId" UUID NOT NULL,
    "claimId" UUID,
    "claimLineId" UUID,
    "ruleId" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "sourceLocation" JSONB,
    "suggestedAction" TEXT,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "actorUserId" UUID,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "Upload_organizationId_createdAt_idx" ON "Upload"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Upload_organizationId_status_idx" ON "Upload"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Claim_organizationId_createdAt_idx" ON "Claim"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Claim_uploadId_idx" ON "Claim"("uploadId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_uploadId_claimControlNumber_key" ON "Claim"("uploadId", "claimControlNumber");

-- CreateIndex
CREATE INDEX "ClaimLine_claimId_idx" ON "ClaimLine"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimLine_claimId_lineNumber_key" ON "ClaimLine"("claimId", "lineNumber");

-- CreateIndex
CREATE INDEX "Diagnosis_claimId_idx" ON "Diagnosis"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "Diagnosis_claimId_sequence_key" ON "Diagnosis"("claimId", "sequence");

-- CreateIndex
CREATE INDEX "ValidationRun_organizationId_createdAt_idx" ON "ValidationRun"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ValidationRun_uploadId_idx" ON "ValidationRun"("uploadId");

-- CreateIndex
CREATE INDEX "ValidationFinding_validationRunId_severity_idx" ON "ValidationFinding"("validationRunId", "severity");

-- CreateIndex
CREATE INDEX "ValidationFinding_claimId_idx" ON "ValidationFinding"("claimId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimLine" ADD CONSTRAINT "ClaimLine_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRun" ADD CONSTRAINT "ValidationRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRun" ADD CONSTRAINT "ValidationRun_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationFinding" ADD CONSTRAINT "ValidationFinding_validationRunId_fkey" FOREIGN KEY ("validationRunId") REFERENCES "ValidationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationFinding" ADD CONSTRAINT "ValidationFinding_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationFinding" ADD CONSTRAINT "ValidationFinding_claimLineId_fkey" FOREIGN KEY ("claimLineId") REFERENCES "ClaimLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
