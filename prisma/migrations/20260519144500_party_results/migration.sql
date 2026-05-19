-- CreateTable
CREATE TABLE "PartyResult" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "completedByUserId" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartyResult_partyId_key" ON "PartyResult"("partyId");

-- CreateIndex
CREATE INDEX "PartyResult_completedByUserId_completedAt_idx" ON "PartyResult"("completedByUserId", "completedAt");

-- AddForeignKey
ALTER TABLE "PartyResult" ADD CONSTRAINT "PartyResult_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyResult" ADD CONSTRAINT "PartyResult_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
