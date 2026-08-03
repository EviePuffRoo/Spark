-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestHook_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuestHook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_QuestHook" ("complication", "createdAt", "hook", "id", "notes", "objective", "questType", "reward", "tags", "tier", "title", "updatedAt", "userId", "worldId") SELECT "complication", "createdAt", "hook", "id", "notes", "objective", "questType", "reward", "tags", "tier", "title", "updatedAt", "userId", "worldId" FROM "QuestHook";
DROP TABLE "QuestHook";
ALTER TABLE "new_QuestHook" RENAME TO "QuestHook";
CREATE INDEX "QuestHook_worldId_idx" ON "QuestHook"("worldId");
CREATE INDEX "QuestHook_userId_idx" ON "QuestHook"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
