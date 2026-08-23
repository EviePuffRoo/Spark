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
INSERT INTO "new_Character" ("alignment", "attunedItems", "background", "backstory", "createdAt", "disposition", "equippedItems", "factionId", "hiddenFromParty", "id", "kind", "name", "notes", "race", "statBlock", "tags", "templateId", "templateName", "updatedAt", "userId", "worldId") SELECT "alignment", "attunedItems", "background", "backstory", "createdAt", "disposition", "equippedItems", "factionId", "hiddenFromParty", "id", "kind", "name", "notes", "race", "statBlock", "tags", "templateId", "templateName", "updatedAt", "userId", "worldId" FROM "Character";
DROP TABLE "Character";
ALTER TABLE "new_Character" RENAME TO "Character";
CREATE INDEX "Character_worldId_idx" ON "Character"("worldId");
CREATE INDEX "Character_userId_idx" ON "Character"("userId");
CREATE INDEX "Character_factionId_idx" ON "Character"("factionId");
CREATE INDEX "Character_settlementId_idx" ON "Character"("settlementId");
CREATE TABLE "new_Shop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stock" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "settlementId" TEXT,
    "worldId" TEXT,
    "hiddenFromParty" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Shop_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Shop_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Shop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Shop" ("createdAt", "description", "hiddenFromParty", "id", "name", "notes", "stock", "tags", "updatedAt", "userId", "worldId") SELECT "createdAt", "description", "hiddenFromParty", "id", "name", "notes", "stock", "tags", "updatedAt", "userId", "worldId" FROM "Shop";
DROP TABLE "Shop";
ALTER TABLE "new_Shop" RENAME TO "Shop";
CREATE INDEX "Shop_worldId_idx" ON "Shop"("worldId");
CREATE INDEX "Shop_userId_idx" ON "Shop"("userId");
CREATE INDEX "Shop_settlementId_idx" ON "Shop"("settlementId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
