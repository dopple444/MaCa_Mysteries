-- CreateTable
CREATE TABLE "GameRound" (
    "id" TEXT NOT NULL,
    "gameVersionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameCard" (
    "id" TEXT NOT NULL,
    "gameRoundId" TEXT NOT NULL,
    "characterId" TEXT,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PLAYER_PRIVATE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyRoundState" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "gameRoundId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOCKED',
    "unlockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyRoundState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameRound_gameVersionId_key_key" ON "GameRound"("gameVersionId", "key");

-- CreateIndex
CREATE INDEX "GameCard_gameRoundId_visibility_idx" ON "GameCard"("gameRoundId", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "GameCard_gameRoundId_key_key" ON "GameCard"("gameRoundId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PartyRoundState_partyId_gameRoundId_key" ON "PartyRoundState"("partyId", "gameRoundId");

-- AddForeignKey
ALTER TABLE "GameRound" ADD CONSTRAINT "GameRound_gameVersionId_fkey" FOREIGN KEY ("gameVersionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameCard" ADD CONSTRAINT "GameCard_gameRoundId_fkey" FOREIGN KEY ("gameRoundId") REFERENCES "GameRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameCard" ADD CONSTRAINT "GameCard_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "GameCharacter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyRoundState" ADD CONSTRAINT "PartyRoundState_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyRoundState" ADD CONSTRAINT "PartyRoundState_gameRoundId_fkey" FOREIGN KEY ("gameRoundId") REFERENCES "GameRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
