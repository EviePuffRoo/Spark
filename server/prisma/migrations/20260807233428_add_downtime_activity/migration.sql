-- CreateTable
CREATE TABLE "DowntimeActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "worldId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerCharacterId" TEXT,
    "characterName" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "daysSpent" INTEGER NOT NULL,
    "outcome" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DowntimeActivity_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DowntimeActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DowntimeActivity_worldId_idx" ON "DowntimeActivity"("worldId");

-- CreateIndex
CREATE INDEX "DowntimeActivity_userId_idx" ON "DowntimeActivity"("userId");
