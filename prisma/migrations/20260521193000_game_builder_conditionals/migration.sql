ALTER TABLE "GameCard"
ADD COLUMN "requiredUnlockRuleId" TEXT NOT NULL DEFAULT '';

ALTER TABLE "GameEvidence"
ADD COLUMN "requiredUnlockRuleId" TEXT NOT NULL DEFAULT '';

ALTER TABLE "GameMediaAsset"
ADD COLUMN "requiredUnlockRuleId" TEXT NOT NULL DEFAULT '';

CREATE INDEX "GameCard_requiredUnlockRuleId_idx" ON "GameCard"("requiredUnlockRuleId");
CREATE INDEX "GameEvidence_requiredUnlockRuleId_idx" ON "GameEvidence"("requiredUnlockRuleId");
CREATE INDEX "GameMediaAsset_requiredUnlockRuleId_idx" ON "GameMediaAsset"("requiredUnlockRuleId");

CREATE TABLE "GameDigitalArtifact" (
    "id" TEXT NOT NULL,
    "gameVersionId" TEXT NOT NULL,
    "gameRoundId" TEXT,
    "characterId" TEXT,
    "evidenceId" TEXT,
    "mediaAssetId" TEXT,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "artifactType" TEXT NOT NULL DEFAULT 'DOCUMENT',
    "visibility" TEXT NOT NULL DEFAULT 'PLAYER_PRIVATE',
    "requiredUnlockRuleId" TEXT NOT NULL DEFAULT '',
    "content" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameDigitalArtifact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameCharacterTool" (
    "id" TEXT NOT NULL,
    "gameVersionId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "toolType" TEXT NOT NULL DEFAULT 'GENERIC',
    "visibility" TEXT NOT NULL DEFAULT 'PLAYER_PRIVATE',
    "config" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameCharacterTool_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameUnlockRule" (
    "id" TEXT NOT NULL,
    "gameVersionId" TEXT NOT NULL,
    "requiredRoundId" TEXT,
    "requiredCharacterId" TEXT,
    "sourceToolId" TEXT,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "ruleType" TEXT NOT NULL DEFAULT 'MANUAL',
    "triggerType" TEXT NOT NULL DEFAULT 'HOST_APPROVAL',
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "unlockScope" TEXT NOT NULL DEFAULT 'PLAYER',
    "codeMode" TEXT NOT NULL DEFAULT '',
    "config" JSONB NOT NULL DEFAULT '{}',
    "effect" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameUnlockRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartyToolInstance" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "characterToolId" TEXT NOT NULL,
    "unlockRuleId" TEXT,
    "guestId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "codeHash" TEXT NOT NULL DEFAULT '',
    "codeSalt" TEXT NOT NULL DEFAULT '',
    "usesRemaining" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyToolInstance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartyUnlockEvent" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "unlockRuleId" TEXT,
    "actorGuestId" TEXT,
    "targetGuestId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "unlockScope" TEXT NOT NULL DEFAULT 'PLAYER',
    "status" TEXT NOT NULL DEFAULT 'UNLOCKED',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyUnlockEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartyCodeAttempt" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "unlockRuleId" TEXT,
    "toolInstanceId" TEXT,
    "actorGuestId" TEXT,
    "codeHash" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyCodeAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartyAssetView" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "guestId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyAssetView_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartyPlayerInteraction" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "actorGuestId" TEXT,
    "targetGuestId" TEXT,
    "interactionType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT '',
    "sourceId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyPlayerInteraction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartyPlayerInventory" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT '',
    "sourceId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartyPlayerInventory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GameDigitalArtifact_gameVersionId_key_key" ON "GameDigitalArtifact"("gameVersionId", "key");
CREATE INDEX "GameDigitalArtifact_gameVersionId_visibility_idx" ON "GameDigitalArtifact"("gameVersionId", "visibility");
CREATE INDEX "GameDigitalArtifact_gameRoundId_idx" ON "GameDigitalArtifact"("gameRoundId");
CREATE INDEX "GameDigitalArtifact_characterId_idx" ON "GameDigitalArtifact"("characterId");
CREATE INDEX "GameDigitalArtifact_requiredUnlockRuleId_idx" ON "GameDigitalArtifact"("requiredUnlockRuleId");

CREATE UNIQUE INDEX "GameCharacterTool_gameVersionId_key_key" ON "GameCharacterTool"("gameVersionId", "key");
CREATE INDEX "GameCharacterTool_characterId_idx" ON "GameCharacterTool"("characterId");
CREATE INDEX "GameCharacterTool_gameVersionId_visibility_idx" ON "GameCharacterTool"("gameVersionId", "visibility");

CREATE UNIQUE INDEX "GameUnlockRule_gameVersionId_key_key" ON "GameUnlockRule"("gameVersionId", "key");
CREATE INDEX "GameUnlockRule_gameVersionId_status_idx" ON "GameUnlockRule"("gameVersionId", "status");
CREATE INDEX "GameUnlockRule_targetType_targetId_idx" ON "GameUnlockRule"("targetType", "targetId");
CREATE INDEX "GameUnlockRule_sourceToolId_idx" ON "GameUnlockRule"("sourceToolId");

CREATE INDEX "PartyToolInstance_partyId_status_idx" ON "PartyToolInstance"("partyId", "status");
CREATE INDEX "PartyToolInstance_characterToolId_idx" ON "PartyToolInstance"("characterToolId");
CREATE INDEX "PartyToolInstance_unlockRuleId_idx" ON "PartyToolInstance"("unlockRuleId");
CREATE INDEX "PartyToolInstance_guestId_idx" ON "PartyToolInstance"("guestId");

CREATE INDEX "PartyUnlockEvent_partyId_createdAt_idx" ON "PartyUnlockEvent"("partyId", "createdAt");
CREATE INDEX "PartyUnlockEvent_unlockRuleId_idx" ON "PartyUnlockEvent"("unlockRuleId");
CREATE INDEX "PartyUnlockEvent_targetType_targetId_idx" ON "PartyUnlockEvent"("targetType", "targetId");
CREATE INDEX "PartyUnlockEvent_actorGuestId_createdAt_idx" ON "PartyUnlockEvent"("actorGuestId", "createdAt");
CREATE INDEX "PartyUnlockEvent_targetGuestId_createdAt_idx" ON "PartyUnlockEvent"("targetGuestId", "createdAt");

CREATE INDEX "PartyCodeAttempt_partyId_createdAt_idx" ON "PartyCodeAttempt"("partyId", "createdAt");
CREATE INDEX "PartyCodeAttempt_unlockRuleId_idx" ON "PartyCodeAttempt"("unlockRuleId");
CREATE INDEX "PartyCodeAttempt_toolInstanceId_idx" ON "PartyCodeAttempt"("toolInstanceId");
CREATE INDEX "PartyCodeAttempt_actorGuestId_createdAt_idx" ON "PartyCodeAttempt"("actorGuestId", "createdAt");

CREATE INDEX "PartyAssetView_partyId_viewedAt_idx" ON "PartyAssetView"("partyId", "viewedAt");
CREATE INDEX "PartyAssetView_guestId_viewedAt_idx" ON "PartyAssetView"("guestId", "viewedAt");
CREATE INDEX "PartyAssetView_targetType_targetId_idx" ON "PartyAssetView"("targetType", "targetId");

CREATE INDEX "PartyPlayerInteraction_partyId_createdAt_idx" ON "PartyPlayerInteraction"("partyId", "createdAt");
CREATE INDEX "PartyPlayerInteraction_actorGuestId_createdAt_idx" ON "PartyPlayerInteraction"("actorGuestId", "createdAt");
CREATE INDEX "PartyPlayerInteraction_targetGuestId_createdAt_idx" ON "PartyPlayerInteraction"("targetGuestId", "createdAt");
CREATE INDEX "PartyPlayerInteraction_interactionType_createdAt_idx" ON "PartyPlayerInteraction"("interactionType", "createdAt");

CREATE UNIQUE INDEX "PartyPlayerInventory_partyId_guestId_itemType_itemId_key" ON "PartyPlayerInventory"("partyId", "guestId", "itemType", "itemId");
CREATE INDEX "PartyPlayerInventory_partyId_guestId_idx" ON "PartyPlayerInventory"("partyId", "guestId");
CREATE INDEX "PartyPlayerInventory_itemType_itemId_idx" ON "PartyPlayerInventory"("itemType", "itemId");

ALTER TABLE "GameDigitalArtifact" ADD CONSTRAINT "GameDigitalArtifact_gameVersionId_fkey" FOREIGN KEY ("gameVersionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameDigitalArtifact" ADD CONSTRAINT "GameDigitalArtifact_gameRoundId_fkey" FOREIGN KEY ("gameRoundId") REFERENCES "GameRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameDigitalArtifact" ADD CONSTRAINT "GameDigitalArtifact_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "GameCharacter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameDigitalArtifact" ADD CONSTRAINT "GameDigitalArtifact_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "GameEvidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameDigitalArtifact" ADD CONSTRAINT "GameDigitalArtifact_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "GameMediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GameCharacterTool" ADD CONSTRAINT "GameCharacterTool_gameVersionId_fkey" FOREIGN KEY ("gameVersionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameCharacterTool" ADD CONSTRAINT "GameCharacterTool_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "GameCharacter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GameUnlockRule" ADD CONSTRAINT "GameUnlockRule_gameVersionId_fkey" FOREIGN KEY ("gameVersionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GameUnlockRule" ADD CONSTRAINT "GameUnlockRule_requiredRoundId_fkey" FOREIGN KEY ("requiredRoundId") REFERENCES "GameRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameUnlockRule" ADD CONSTRAINT "GameUnlockRule_requiredCharacterId_fkey" FOREIGN KEY ("requiredCharacterId") REFERENCES "GameCharacter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GameUnlockRule" ADD CONSTRAINT "GameUnlockRule_sourceToolId_fkey" FOREIGN KEY ("sourceToolId") REFERENCES "GameCharacterTool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PartyToolInstance" ADD CONSTRAINT "PartyToolInstance_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyToolInstance" ADD CONSTRAINT "PartyToolInstance_characterToolId_fkey" FOREIGN KEY ("characterToolId") REFERENCES "GameCharacterTool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyToolInstance" ADD CONSTRAINT "PartyToolInstance_unlockRuleId_fkey" FOREIGN KEY ("unlockRuleId") REFERENCES "GameUnlockRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartyToolInstance" ADD CONSTRAINT "PartyToolInstance_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PartyUnlockEvent" ADD CONSTRAINT "PartyUnlockEvent_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyUnlockEvent" ADD CONSTRAINT "PartyUnlockEvent_unlockRuleId_fkey" FOREIGN KEY ("unlockRuleId") REFERENCES "GameUnlockRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartyUnlockEvent" ADD CONSTRAINT "PartyUnlockEvent_actorGuestId_fkey" FOREIGN KEY ("actorGuestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartyUnlockEvent" ADD CONSTRAINT "PartyUnlockEvent_targetGuestId_fkey" FOREIGN KEY ("targetGuestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PartyCodeAttempt" ADD CONSTRAINT "PartyCodeAttempt_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyCodeAttempt" ADD CONSTRAINT "PartyCodeAttempt_unlockRuleId_fkey" FOREIGN KEY ("unlockRuleId") REFERENCES "GameUnlockRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartyCodeAttempt" ADD CONSTRAINT "PartyCodeAttempt_toolInstanceId_fkey" FOREIGN KEY ("toolInstanceId") REFERENCES "PartyToolInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartyCodeAttempt" ADD CONSTRAINT "PartyCodeAttempt_actorGuestId_fkey" FOREIGN KEY ("actorGuestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PartyAssetView" ADD CONSTRAINT "PartyAssetView_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyAssetView" ADD CONSTRAINT "PartyAssetView_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PartyPlayerInteraction" ADD CONSTRAINT "PartyPlayerInteraction_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyPlayerInteraction" ADD CONSTRAINT "PartyPlayerInteraction_actorGuestId_fkey" FOREIGN KEY ("actorGuestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PartyPlayerInteraction" ADD CONSTRAINT "PartyPlayerInteraction_targetGuestId_fkey" FOREIGN KEY ("targetGuestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PartyPlayerInventory" ADD CONSTRAINT "PartyPlayerInventory_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyPlayerInventory" ADD CONSTRAINT "PartyPlayerInventory_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
