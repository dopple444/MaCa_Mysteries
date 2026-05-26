CREATE TABLE "AdminActionRequest" (
    "id" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "reviewedByUserId" TEXT,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "targetType" TEXT NOT NULL DEFAULT 'User',
    "targetId" TEXT NOT NULL DEFAULT '',
    "previousRole" TEXT NOT NULL DEFAULT '',
    "requestedRole" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "reviewedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminActionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminActionRequest_status_createdAt_idx" ON "AdminActionRequest"("status", "createdAt");
CREATE INDEX "AdminActionRequest_actionType_status_idx" ON "AdminActionRequest"("actionType", "status");
CREATE INDEX "AdminActionRequest_requestedByUserId_createdAt_idx" ON "AdminActionRequest"("requestedByUserId", "createdAt");
CREATE INDEX "AdminActionRequest_targetUserId_status_idx" ON "AdminActionRequest"("targetUserId", "status");
CREATE INDEX "AdminActionRequest_reviewedByUserId_reviewedAt_idx" ON "AdminActionRequest"("reviewedByUserId", "reviewedAt");

ALTER TABLE "AdminActionRequest" ADD CONSTRAINT "AdminActionRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminActionRequest" ADD CONSTRAINT "AdminActionRequest_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdminActionRequest" ADD CONSTRAINT "AdminActionRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
