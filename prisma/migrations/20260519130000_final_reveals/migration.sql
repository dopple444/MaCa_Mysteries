-- CreateTable
CREATE TABLE "GameFinalReveal" (
    "id" TEXT NOT NULL,
    "gameVersionId" TEXT NOT NULL,
    "victimCharacterId" TEXT,
    "killerCharacterId" TEXT,
    "title" TEXT NOT NULL,
    "victimRevealText" TEXT NOT NULL DEFAULT '',
    "killerRevealText" TEXT NOT NULL DEFAULT '',
    "solutionText" TEXT NOT NULL DEFAULT '',
    "epilogueText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameFinalReveal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyFinalRevealState" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "finalRevealId" TEXT NOT NULL,
    "victimRevealedAt" TIMESTAMP(3),
    "finalRevealedAt" TIMESTAMP(3),
    "revealedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyFinalRevealState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameFinalReveal_gameVersionId_key" ON "GameFinalReveal"("gameVersionId");

-- CreateIndex
CREATE INDEX "GameFinalReveal_victimCharacterId_idx" ON "GameFinalReveal"("victimCharacterId");

-- CreateIndex
CREATE INDEX "GameFinalReveal_killerCharacterId_idx" ON "GameFinalReveal"("killerCharacterId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyFinalRevealState_partyId_key" ON "PartyFinalRevealState"("partyId");

-- AddForeignKey
ALTER TABLE "GameFinalReveal" ADD CONSTRAINT "GameFinalReveal_gameVersionId_fkey" FOREIGN KEY ("gameVersionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameFinalReveal" ADD CONSTRAINT "GameFinalReveal_victimCharacterId_fkey" FOREIGN KEY ("victimCharacterId") REFERENCES "GameCharacter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameFinalReveal" ADD CONSTRAINT "GameFinalReveal_killerCharacterId_fkey" FOREIGN KEY ("killerCharacterId") REFERENCES "GameCharacter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyFinalRevealState" ADD CONSTRAINT "PartyFinalRevealState_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyFinalRevealState" ADD CONSTRAINT "PartyFinalRevealState_finalRevealId_fkey" FOREIGN KEY ("finalRevealId") REFERENCES "GameFinalReveal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyFinalRevealState" ADD CONSTRAINT "PartyFinalRevealState_revealedByUserId_fkey" FOREIGN KEY ("revealedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
