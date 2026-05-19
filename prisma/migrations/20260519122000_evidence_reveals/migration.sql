-- CreateTable
CREATE TABLE "GameEvidence" (
    "id" TEXT NOT NULL,
    "gameVersionId" TEXT NOT NULL,
    "gameRoundId" TEXT,
    "characterId" TEXT,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL DEFAULT 'TEXT',
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyEvidenceReveal" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "revealedByUserId" TEXT,
    "revealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyEvidenceReveal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameEvidence_gameVersionId_visibility_idx" ON "GameEvidence"("gameVersionId", "visibility");

-- CreateIndex
CREATE INDEX "GameEvidence_gameRoundId_idx" ON "GameEvidence"("gameRoundId");

-- CreateIndex
CREATE UNIQUE INDEX "GameEvidence_gameVersionId_key_key" ON "GameEvidence"("gameVersionId", "key");

-- CreateIndex
CREATE INDEX "PartyEvidenceReveal_partyId_revealedAt_idx" ON "PartyEvidenceReveal"("partyId", "revealedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartyEvidenceReveal_partyId_evidenceId_key" ON "PartyEvidenceReveal"("partyId", "evidenceId");

-- AddForeignKey
ALTER TABLE "GameEvidence" ADD CONSTRAINT "GameEvidence_gameVersionId_fkey" FOREIGN KEY ("gameVersionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvidence" ADD CONSTRAINT "GameEvidence_gameRoundId_fkey" FOREIGN KEY ("gameRoundId") REFERENCES "GameRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvidence" ADD CONSTRAINT "GameEvidence_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "GameCharacter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyEvidenceReveal" ADD CONSTRAINT "PartyEvidenceReveal_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyEvidenceReveal" ADD CONSTRAINT "PartyEvidenceReveal_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "GameEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyEvidenceReveal" ADD CONSTRAINT "PartyEvidenceReveal_revealedByUserId_fkey" FOREIGN KEY ("revealedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
