-- CreateTable
CREATE TABLE "GameCharacter" (
    "id" TEXT NOT NULL,
    "gameVersionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publicBio" TEXT NOT NULL,
    "privateBio" TEXT NOT NULL DEFAULT '',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameCharacter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyCharacterAssignment" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyCharacterAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameCharacter_gameVersionId_key_key" ON "GameCharacter"("gameVersionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PartyCharacterAssignment_partyId_guestId_key" ON "PartyCharacterAssignment"("partyId", "guestId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyCharacterAssignment_partyId_characterId_key" ON "PartyCharacterAssignment"("partyId", "characterId");

-- AddForeignKey
ALTER TABLE "GameCharacter" ADD CONSTRAINT "GameCharacter_gameVersionId_fkey" FOREIGN KEY ("gameVersionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyCharacterAssignment" ADD CONSTRAINT "PartyCharacterAssignment_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyCharacterAssignment" ADD CONSTRAINT "PartyCharacterAssignment_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyCharacterAssignment" ADD CONSTRAINT "PartyCharacterAssignment_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "GameCharacter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
