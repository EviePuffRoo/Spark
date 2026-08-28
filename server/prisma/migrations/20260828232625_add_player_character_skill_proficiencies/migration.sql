-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlayerCharacter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "race" TEXT NOT NULL,
    "armorClass" INTEGER NOT NULL,
    "maxHp" INTEGER NOT NULL,
    "currentHp" INTEGER NOT NULL DEFAULT 0,
    "abilityScores" TEXT NOT NULL DEFAULT '{}',
    "playerName" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "equippedItems" TEXT NOT NULL DEFAULT '[]',
    "attunedItems" TEXT NOT NULL DEFAULT '[]',
    "deathSaves" TEXT NOT NULL DEFAULT '{"successes":0,"failures":0}',
    "spellSlots" TEXT NOT NULL DEFAULT '[]',
    "preparedSpells" TEXT NOT NULL DEFAULT '[]',
    "skillProficiencies" TEXT NOT NULL DEFAULT '[]',
    "classResources" TEXT NOT NULL DEFAULT '[]',
    "conditions" TEXT NOT NULL DEFAULT '[]',
    "xp" INTEGER NOT NULL DEFAULT 0,
    "proficiencyBonus" INTEGER NOT NULL DEFAULT 2,
    "worldId" TEXT,
    "hiddenFromParty" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayerCharacter_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PlayerCharacter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlayerCharacter" ("abilityScores", "armorClass", "attunedItems", "className", "classResources", "conditions", "createdAt", "currentHp", "deathSaves", "equippedItems", "hiddenFromParty", "id", "level", "maxHp", "name", "notes", "playerName", "preparedSpells", "proficiencyBonus", "race", "spellSlots", "tags", "updatedAt", "userId", "worldId", "xp") SELECT "abilityScores", "armorClass", "attunedItems", "className", "classResources", "conditions", "createdAt", "currentHp", "deathSaves", "equippedItems", "hiddenFromParty", "id", "level", "maxHp", "name", "notes", "playerName", "preparedSpells", "proficiencyBonus", "race", "spellSlots", "tags", "updatedAt", "userId", "worldId", "xp" FROM "PlayerCharacter";
DROP TABLE "PlayerCharacter";
ALTER TABLE "new_PlayerCharacter" RENAME TO "PlayerCharacter";
CREATE INDEX "PlayerCharacter_worldId_idx" ON "PlayerCharacter"("worldId");
CREATE INDEX "PlayerCharacter_userId_idx" ON "PlayerCharacter"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
