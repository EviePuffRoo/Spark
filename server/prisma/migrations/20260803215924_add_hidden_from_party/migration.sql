-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Adventure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "premise" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "complication" TEXT NOT NULL,
    "reward" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "worldId" TEXT,
    "hiddenFromParty" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Adventure_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Adventure_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Adventure" ("complication", "createdAt", "hook", "id", "notes", "objective", "premise", "reward", "tags", "tier", "title", "updatedAt", "userId", "worldId") SELECT "complication", "createdAt", "hook", "id", "notes", "objective", "premise", "reward", "tags", "tier", "title", "updatedAt", "userId", "worldId" FROM "Adventure";
DROP TABLE "Adventure";
ALTER TABLE "new_Adventure" RENAME TO "Adventure";
CREATE INDEX "Adventure_worldId_idx" ON "Adventure"("worldId");
CREATE INDEX "Adventure_userId_idx" ON "Adventure"("userId");
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
    "worldId" TEXT,
    "hiddenFromParty" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Character_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Character" ("alignment", "background", "backstory", "createdAt", "id", "kind", "name", "notes", "race", "statBlock", "tags", "templateId", "templateName", "updatedAt", "userId", "worldId") SELECT "alignment", "background", "backstory", "createdAt", "id", "kind", "name", "notes", "race", "statBlock", "tags", "templateId", "templateName", "updatedAt", "userId", "worldId" FROM "Character";
DROP TABLE "Character";
ALTER TABLE "new_Character" RENAME TO "Character";
CREATE INDEX "Character_worldId_idx" ON "Character"("worldId");
CREATE INDEX "Character_userId_idx" ON "Character"("userId");
CREATE TABLE "new_EncounterTable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "terrain" TEXT NOT NULL,
    "entries" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "worldId" TEXT,
    "hiddenFromParty" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EncounterTable_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EncounterTable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EncounterTable" ("createdAt", "entries", "id", "name", "notes", "tags", "terrain", "updatedAt", "userId", "worldId") SELECT "createdAt", "entries", "id", "name", "notes", "tags", "terrain", "updatedAt", "userId", "worldId" FROM "EncounterTable";
DROP TABLE "EncounterTable";
ALTER TABLE "new_EncounterTable" RENAME TO "EncounterTable";
CREATE INDEX "EncounterTable_worldId_idx" ON "EncounterTable"("worldId");
CREATE INDEX "EncounterTable_userId_idx" ON "EncounterTable"("userId");
CREATE TABLE "new_Faction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "factionType" TEXT NOT NULL,
    "agenda" TEXT NOT NULL,
    "methods" TEXT NOT NULL,
    "publicFace" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "worldId" TEXT,
    "hiddenFromParty" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Faction_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Faction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Faction" ("agenda", "createdAt", "factionType", "hook", "id", "methods", "name", "notes", "publicFace", "tags", "updatedAt", "userId", "worldId") SELECT "agenda", "createdAt", "factionType", "hook", "id", "methods", "name", "notes", "publicFace", "tags", "updatedAt", "userId", "worldId" FROM "Faction";
DROP TABLE "Faction";
ALTER TABLE "new_Faction" RENAME TO "Faction";
CREATE INDEX "Faction_worldId_idx" ON "Faction"("worldId");
CREATE INDEX "Faction_userId_idx" ON "Faction"("userId");
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "property" TEXT NOT NULL,
    "history" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "worldId" TEXT,
    "hiddenFromParty" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("category", "createdAt", "description", "history", "id", "itemType", "name", "notes", "property", "rarity", "tags", "updatedAt", "userId", "worldId") SELECT "category", "createdAt", "description", "history", "id", "itemType", "name", "notes", "property", "rarity", "tags", "updatedAt", "userId", "worldId" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_worldId_idx" ON "Item"("worldId");
CREATE INDEX "Item_userId_idx" ON "Item"("userId");
CREATE TABLE "new_Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "locationType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "notableFeature" TEXT NOT NULL,
    "keeper" TEXT NOT NULL,
    "rumor" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "worldId" TEXT,
    "hiddenFromParty" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Location_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Location_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Location" ("category", "createdAt", "description", "id", "keeper", "locationType", "name", "notableFeature", "notes", "rumor", "tags", "updatedAt", "userId", "worldId") SELECT "category", "createdAt", "description", "id", "keeper", "locationType", "name", "notableFeature", "notes", "rumor", "tags", "updatedAt", "userId", "worldId" FROM "Location";
DROP TABLE "Location";
ALTER TABLE "new_Location" RENAME TO "Location";
CREATE INDEX "Location_worldId_idx" ON "Location"("worldId");
CREATE INDEX "Location_userId_idx" ON "Location"("userId");
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
    "worldId" TEXT,
    "hiddenFromParty" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayerCharacter_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlayerCharacter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlayerCharacter" ("abilityScores", "armorClass", "className", "createdAt", "id", "level", "maxHp", "name", "notes", "playerName", "race", "tags", "updatedAt", "userId", "worldId") SELECT "abilityScores", "armorClass", "className", "createdAt", "id", "level", "maxHp", "name", "notes", "playerName", "race", "tags", "updatedAt", "userId", "worldId" FROM "PlayerCharacter";
DROP TABLE "PlayerCharacter";
ALTER TABLE "new_PlayerCharacter" RENAME TO "PlayerCharacter";
CREATE INDEX "PlayerCharacter_worldId_idx" ON "PlayerCharacter"("worldId");
CREATE INDEX "PlayerCharacter_userId_idx" ON "PlayerCharacter"("userId");
CREATE TABLE "new_QuestHook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "questType" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "complication" TEXT NOT NULL,
    "reward" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "worldId" TEXT,
    "hiddenFromParty" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestHook_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuestHook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_QuestHook" ("complication", "createdAt", "hook", "id", "notes", "objective", "questType", "reward", "status", "tags", "tier", "title", "updatedAt", "userId", "worldId") SELECT "complication", "createdAt", "hook", "id", "notes", "objective", "questType", "reward", "status", "tags", "tier", "title", "updatedAt", "userId", "worldId" FROM "QuestHook";
DROP TABLE "QuestHook";
ALTER TABLE "new_QuestHook" RENAME TO "QuestHook";
CREATE INDEX "QuestHook_worldId_idx" ON "QuestHook"("worldId");
CREATE INDEX "QuestHook_userId_idx" ON "QuestHook"("userId");
CREATE TABLE "new_SessionNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "sessionLabel" TEXT,
    "summary" TEXT NOT NULL,
    "looseThreads" TEXT,
    "nextSteps" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "worldId" TEXT,
    "hiddenFromParty" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SessionNote_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SessionNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SessionNote" ("createdAt", "id", "looseThreads", "nextSteps", "notes", "sessionLabel", "summary", "tags", "title", "updatedAt", "userId", "worldId") SELECT "createdAt", "id", "looseThreads", "nextSteps", "notes", "sessionLabel", "summary", "tags", "title", "updatedAt", "userId", "worldId" FROM "SessionNote";
DROP TABLE "SessionNote";
ALTER TABLE "new_SessionNote" RENAME TO "SessionNote";
CREATE INDEX "SessionNote_worldId_idx" ON "SessionNote"("worldId");
CREATE INDEX "SessionNote_userId_idx" ON "SessionNote"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
