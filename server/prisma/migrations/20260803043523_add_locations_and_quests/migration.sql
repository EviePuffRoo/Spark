-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "locationType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "notableFeature" TEXT NOT NULL,
    "keeper" TEXT NOT NULL,
    "rumor" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "worldId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Location_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuestHook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "questType" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "complication" TEXT NOT NULL,
    "reward" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "worldId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestHook_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Location_worldId_idx" ON "Location"("worldId");

-- CreateIndex
CREATE INDEX "QuestHook_worldId_idx" ON "QuestHook"("worldId");
