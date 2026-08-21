-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Encounter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "worldId" TEXT NOT NULL,
    "combatants" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "turnIndex" INTEGER NOT NULL DEFAULT 0,
    "zones" TEXT NOT NULL DEFAULT '[]',
    "zoneEffects" TEXT NOT NULL DEFAULT '[]',
    "activeDungeonId" TEXT,
    "activeDungeonRoomId" TEXT,
    "activeBattleMapId" TEXT,
    "exploredCells" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Encounter_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Encounter" ("activeBattleMapId", "activeDungeonId", "activeDungeonRoomId", "combatants", "id", "round", "turnIndex", "updatedAt", "worldId", "zoneEffects", "zones") SELECT "activeBattleMapId", "activeDungeonId", "activeDungeonRoomId", "combatants", "id", "round", "turnIndex", "updatedAt", "worldId", "zoneEffects", "zones" FROM "Encounter";
DROP TABLE "Encounter";
ALTER TABLE "new_Encounter" RENAME TO "Encounter";
CREATE UNIQUE INDEX "Encounter_worldId_key" ON "Encounter"("worldId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
