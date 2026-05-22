ALTER TABLE "Guest"
ADD COLUMN "invitationStatus" TEXT NOT NULL DEFAULT 'NOT_SENT',
ADD COLUMN "invitationLastQueuedAt" TIMESTAMP(3),
ADD COLUMN "invitationLastSentAt" TIMESTAMP(3),
ADD COLUMN "invitationResendCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "invitationFailedAt" TIMESTAMP(3),
ADD COLUMN "invitationFailureDetail" TEXT NOT NULL DEFAULT '';

CREATE INDEX "Guest_partyId_invitationStatus_idx" ON "Guest"("partyId", "invitationStatus");
