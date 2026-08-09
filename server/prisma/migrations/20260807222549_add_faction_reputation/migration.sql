-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "reputation" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Faction_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Faction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Faction" ("agenda", "createdAt", "factionType", "hiddenFromParty", "hook", "id", "methods", "name", "notes", "publicFace", "tags", "updatedAt", "userId", "worldId") SELECT "agenda", "createdAt", "factionType", "hiddenFromParty", "hook", "id", "methods", "name", "notes", "publicFace", "tags", "updatedAt", "userId", "worldId" FROM "Faction";
DROP TABLE "Faction";
ALTER TABLE "new_Faction" RENAME TO "Faction";
CREATE INDEX "Faction_worldId_idx" ON "Faction"("worldId");
CREATE INDEX "Faction_userId_idx" ON "Faction"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
