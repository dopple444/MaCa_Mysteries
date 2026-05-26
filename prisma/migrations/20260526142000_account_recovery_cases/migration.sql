CREATE TABLE "AccountRecoveryCase" (
    "id" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "reviewedByUserId" TEXT,
    "supportTicketId" TEXT,
    "email" TEXT NOT NULL,
    "requestType" TEXT NOT NULL DEFAULT 'ACCOUNT_ACCESS',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT NOT NULL DEFAULT '',
    "resolutionNote" TEXT NOT NULL DEFAULT '',
    "passwordResetQueuedAt" TIMESTAMP(3),
    "emailVerificationQueuedAt" TIMESTAMP(3),
    "sessionsRevokedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountRecoveryCase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccountRecoveryCase_status_createdAt_idx" ON "AccountRecoveryCase"("status", "createdAt");
CREATE INDEX "AccountRecoveryCase_verificationStatus_createdAt_idx" ON "AccountRecoveryCase"("verificationStatus", "createdAt");
CREATE INDEX "AccountRecoveryCase_email_createdAt_idx" ON "AccountRecoveryCase"("email", "createdAt");
CREATE INDEX "AccountRecoveryCase_targetUserId_status_idx" ON "AccountRecoveryCase"("targetUserId", "status");
CREATE INDEX "AccountRecoveryCase_requestedByUserId_createdAt_idx" ON "AccountRecoveryCase"("requestedByUserId", "createdAt");
CREATE INDEX "AccountRecoveryCase_reviewedByUserId_reviewedAt_idx" ON "AccountRecoveryCase"("reviewedByUserId", "reviewedAt");
CREATE INDEX "AccountRecoveryCase_supportTicketId_idx" ON "AccountRecoveryCase"("supportTicketId");

ALTER TABLE "AccountRecoveryCase" ADD CONSTRAINT "AccountRecoveryCase_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountRecoveryCase" ADD CONSTRAINT "AccountRecoveryCase_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountRecoveryCase" ADD CONSTRAINT "AccountRecoveryCase_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountRecoveryCase" ADD CONSTRAINT "AccountRecoveryCase_supportTicketId_fkey" FOREIGN KEY ("supportTicketId") REFERENCES "SupportTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
