-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "settlementType" TEXT NOT NULL,
    "population" TEXT,
    "government" TEXT,
    "prosperity" TEXT,
    "dangerLevel" TEXT,
    "controllingFactionId" TEXT,
    "description" TEXT NOT NULL,
    "regionId" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "worldId" TEXT,
    "hiddenFromParty" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Settlement_controllingFactionId_fkey" FOREIGN KEY ("controllingFactionId") REFERENCES "Faction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Settlement_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Settlement_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Settlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Settlement" ("createdAt", "description", "government", "hiddenFromParty", "id", "name", "notes", "population", "regionId", "settlementType", "tags", "updatedAt", "userId", "worldId") SELECT "createdAt", "description", "government", "hiddenFromParty", "id", "name", "notes", "population", "regionId", "settlementType", "tags", "updatedAt", "userId", "worldId" FROM "Settlement";
DROP TABLE "Settlement";
ALTER TABLE "new_Settlement" RENAME TO "Settlement";
CREATE INDEX "Settlement_worldId_idx" ON "Settlement"("worldId");
CREATE INDEX "Settlement_userId_idx" ON "Settlement"("userId");
CREATE INDEX "Settlement_controllingFactionId_idx" ON "Settlement"("controllingFactionId");
CREATE INDEX "Settlement_regionId_idx" ON "Settlement"("regionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
