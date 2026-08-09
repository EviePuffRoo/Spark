-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "race" TEXT,
    "background" TEXT,
    "alignment" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "statBlock" TEXT NOT NULL,
    "backstory" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "equippedItems" TEXT NOT NULL DEFAULT '[]',
    "attunedItems" TEXT NOT NULL DEFAULT '[]',
    "worldId" TEXT,
    "hiddenFromParty" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Character_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Character" ("alignment", "background", "backstory", "createdAt", "hiddenFromParty", "id", "kind", "name", "notes", "race", "statBlock", "tags", "templateId", "templateName", "updatedAt", "userId", "worldId") SELECT "alignment", "background", "backstory", "createdAt", "hiddenFromParty", "id", "kind", "name", "notes", "race", "statBlock", "tags", "templateId", "templateName", "updatedAt", "userId", "worldId" FROM "Character";
DROP TABLE "Character";
ALTER TABLE "new_Character" RENAME TO "Character";
CREATE INDEX "Character_worldId_idx" ON "Character"("worldId");
CREATE INDEX "Character_userId_idx" ON "Character"("userId");
CREATE TABLE "new_PlayerCharacter" (
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
    "equippedItems" TEXT NOT NULL DEFAULT '[]',
    "attunedItems" TEXT NOT NULL DEFAULT '[]',
    "worldId" TEXT,
    "hiddenFromParty" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayerCharacter_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlayerCharacter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlayerCharacter" ("abilityScores", "armorClass", "className", "createdAt", "hiddenFromParty", "id", "level", "maxHp", "name", "notes", "playerName", "race", "tags", "updatedAt", "userId", "worldId") SELECT "abilityScores", "armorClass", "className", "createdAt", "hiddenFromParty", "id", "level", "maxHp", "name", "notes", "playerName", "race", "tags", "updatedAt", "userId", "worldId" FROM "PlayerCharacter";
DROP TABLE "PlayerCharacter";
ALTER TABLE "new_PlayerCharacter" RENAME TO "PlayerCharacter";
CREATE INDEX "PlayerCharacter_worldId_idx" ON "PlayerCharacter"("worldId");
CREATE INDEX "PlayerCharacter_userId_idx" ON "PlayerCharacter"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
