-- AlterTable
ALTER TABLE "DispositionLogEntry" ADD COLUMN "playerCharacterId" TEXT;

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
    "disposition" INTEGER NOT NULL DEFAULT 0,
    "perPcDisposition" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "factionId" TEXT,
    "settlementId" TEXT,
    "worldId" TEXT,
    "hiddenFromParty" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Character_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Character_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Character_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Character" ("alignment", "attunedItems", "background", "backstory", "createdAt", "disposition", "equippedItems", "factionId", "hiddenFromParty", "id", "kind", "name", "notes", "race", "settlementId", "statBlock", "status", "tags", "templateId", "templateName", "updatedAt", "userId", "worldId") SELECT "alignment", "attunedItems", "background", "backstory", "createdAt", "disposition", "equippedItems", "factionId", "hiddenFromParty", "id", "kind", "name", "notes", "race", "settlementId", "statBlock", "status", "tags", "templateId", "templateName", "updatedAt", "userId", "worldId" FROM "Character";
DROP TABLE "Character";
ALTER TABLE "new_Character" RENAME TO "Character";
CREATE INDEX "Character_worldId_idx" ON "Character"("worldId");
CREATE INDEX "Character_userId_idx" ON "Character"("userId");
CREATE INDEX "Character_factionId_idx" ON "Character"("factionId");
CREATE INDEX "Character_settlementId_idx" ON "Character"("settlementId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
