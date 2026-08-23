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
    "hiddenFromParty" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "prerequisiteQuestId" TEXT,
    CONSTRAINT "QuestHook_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuestHook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuestHook_prerequisiteQuestId_fkey" FOREIGN KEY ("prerequisiteQuestId") REFERENCES "QuestHook" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_QuestHook" ("complication", "createdAt", "hiddenFromParty", "hook", "id", "notes", "objective", "questType", "reward", "status", "tags", "tier", "title", "updatedAt", "userId", "worldId") SELECT "complication", "createdAt", "hiddenFromParty", "hook", "id", "notes", "objective", "questType", "reward", "status", "tags", "tier", "title", "updatedAt", "userId", "worldId" FROM "QuestHook";
DROP TABLE "QuestHook";
ALTER TABLE "new_QuestHook" RENAME TO "QuestHook";
CREATE INDEX "QuestHook_worldId_idx" ON "QuestHook"("worldId");
CREATE INDEX "QuestHook_userId_idx" ON "QuestHook"("userId");
CREATE INDEX "QuestHook_prerequisiteQuestId_idx" ON "QuestHook"("prerequisiteQuestId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
