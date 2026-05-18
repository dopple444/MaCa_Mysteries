-- AlterTable
ALTER TABLE "Party" ADD COLUMN     "gameId" TEXT,
ADD COLUMN     "gameVersionId" TEXT;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_gameVersionId_fkey" FOREIGN KEY ("gameVersionId") REFERENCES "GameVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
