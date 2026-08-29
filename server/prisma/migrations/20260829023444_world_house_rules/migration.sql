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
    "houseRules" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "World_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_World" ("createdAt", "currentDay", "description", "id", "joinCodeHash", "joinCodeRole", "name", "nextSessionAt", "updatedAt", "userId") SELECT "createdAt", "currentDay", "description", "id", "joinCodeHash", "joinCodeRole", "name", "nextSessionAt", "updatedAt", "userId" FROM "World";
DROP TABLE "World";
ALTER TABLE "new_World" RENAME TO "World";
CREATE INDEX "World_userId_idx" ON "World"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
