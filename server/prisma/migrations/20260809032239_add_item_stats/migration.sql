-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "rarityTier" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "property" TEXT NOT NULL,
    "history" TEXT NOT NULL,
    "bonusType" TEXT NOT NULL DEFAULT 'none',
    "bonusValue" INTEGER NOT NULL DEFAULT 0,
    "requiresAttunement" BOOLEAN NOT NULL DEFAULT false,
    "charges" INTEGER,
    "rechargeRule" TEXT,
    "value" INTEGER NOT NULL DEFAULT 0,
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
INSERT INTO "new_Item" ("category", "createdAt", "description", "hiddenFromParty", "history", "id", "itemType", "name", "notes", "property", "rarity", "tags", "updatedAt", "userId", "worldId") SELECT "category", "createdAt", "description", "hiddenFromParty", "history", "id", "itemType", "name", "notes", "property", "rarity", "tags", "updatedAt", "userId", "worldId" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_worldId_idx" ON "Item"("worldId");
CREATE INDEX "Item_userId_idx" ON "Item"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
