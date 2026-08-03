-- CreateTable
CREATE TABLE "PlayerCharacter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "race" TEXT NOT NULL,
    "armorClass" INTEGER NOT NULL,
    "maxHp" INTEGER NOT NULL,
    "abilityScores" TEXT NOT NULL DEFAULT '{}',
    "playerName" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "worldId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayerCharacter_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlayerCharacter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PlayerCharacter_worldId_idx" ON "PlayerCharacter"("worldId");

-- CreateIndex
CREATE INDEX "PlayerCharacter_userId_idx" ON "PlayerCharacter"("userId");
