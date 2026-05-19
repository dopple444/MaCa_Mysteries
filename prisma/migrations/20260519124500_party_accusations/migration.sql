-- CreateTable
CREATE TABLE "PartyAccusation" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "suspectCharacterId" TEXT,
    "motiveNotes" TEXT NOT NULL DEFAULT '',
    "evidenceNotes" TEXT NOT NULL DEFAULT '',
    "accusationText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyAccusation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartyAccusation_partyId_createdAt_idx" ON "PartyAccusation"("partyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartyAccusation_partyId_guestId_key" ON "PartyAccusation"("partyId", "guestId");

-- AddForeignKey
ALTER TABLE "PartyAccusation" ADD CONSTRAINT "PartyAccusation_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyAccusation" ADD CONSTRAINT "PartyAccusation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyAccusation" ADD CONSTRAINT "PartyAccusation_suspectCharacterId_fkey" FOREIGN KEY ("suspectCharacterId") REFERENCES "GameCharacter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
