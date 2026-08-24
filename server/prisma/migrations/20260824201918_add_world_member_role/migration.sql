-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_World" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "joinCodeHash" TEXT,
    "joinCodeRole" TEXT NOT NULL DEFAULT 'player',
    "nextSessionAt" DATETIME,
    "currentDay" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "World_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_World" ("createdAt", "currentDay", "description", "id", "joinCodeHash", "name", "nextSessionAt", "updatedAt", "userId") SELECT "createdAt", "currentDay", "description", "id", "joinCodeHash", "name", "nextSessionAt", "updatedAt", "userId" FROM "World";
DROP TABLE "World";
ALTER TABLE "new_World" RENAME TO "World";
CREATE INDEX "World_userId_idx" ON "World"("userId");
CREATE TABLE "new_WorldMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "worldId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'player',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorldMember_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorldMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WorldMember" ("createdAt", "id", "userId", "worldId") SELECT "createdAt", "id", "userId", "worldId" FROM "WorldMember";
DROP TABLE "WorldMember";
ALTER TABLE "new_WorldMember" RENAME TO "WorldMember";
CREATE INDEX "WorldMember_userId_idx" ON "WorldMember"("userId");
CREATE UNIQUE INDEX "WorldMember_worldId_userId_key" ON "WorldMember"("worldId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
