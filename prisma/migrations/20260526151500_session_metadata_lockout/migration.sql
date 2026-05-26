ALTER TABLE "User"
ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastFailedLoginAt" TIMESTAMP(3),
ADD COLUMN "lockedUntil" TIMESTAMP(3),
ADD COLUMN "lastLoginAt" TIMESTAMP(3);

ALTER TABLE "UserSession"
ADD COLUMN "ipAddress" TEXT NOT NULL DEFAULT '',
ADD COLUMN "userAgent" TEXT NOT NULL DEFAULT '',
ADD COLUMN "createdBy" TEXT NOT NULL DEFAULT 'LOGIN',
ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "revokedAt" TIMESTAMP(3),
ADD COLUMN "revokedByUserId" TEXT,
ADD COLUMN "revokeReason" TEXT NOT NULL DEFAULT '';

CREATE INDEX "UserSession_userId_revokedAt_idx" ON "UserSession"("userId", "revokedAt");
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");
