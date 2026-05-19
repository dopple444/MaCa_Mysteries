-- CreateTable
CREATE TABLE "GameMediaAsset" (
    "id" TEXT NOT NULL,
    "gameVersionId" TEXT NOT NULL,
    "gameRoundId" TEXT,
    "characterId" TEXT,
    "evidenceId" TEXT,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "assetType" TEXT NOT NULL DEFAULT 'DOCUMENT',
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameMediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameMediaAsset_gameVersionId_visibility_idx" ON "GameMediaAsset"("gameVersionId", "visibility");

-- CreateIndex
CREATE INDEX "GameMediaAsset_gameRoundId_idx" ON "GameMediaAsset"("gameRoundId");

-- CreateIndex
CREATE INDEX "GameMediaAsset_evidenceId_idx" ON "GameMediaAsset"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "GameMediaAsset_gameVersionId_key_key" ON "GameMediaAsset"("gameVersionId", "key");

-- AddForeignKey
ALTER TABLE "GameMediaAsset" ADD CONSTRAINT "GameMediaAsset_gameVersionId_fkey" FOREIGN KEY ("gameVersionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameMediaAsset" ADD CONSTRAINT "GameMediaAsset_gameRoundId_fkey" FOREIGN KEY ("gameRoundId") REFERENCES "GameRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameMediaAsset" ADD CONSTRAINT "GameMediaAsset_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "GameCharacter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameMediaAsset" ADD CONSTRAINT "GameMediaAsset_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "GameEvidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
