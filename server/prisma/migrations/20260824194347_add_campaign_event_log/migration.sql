-- CreateTable
CREATE TABLE "CampaignEventLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "worldId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignEventLog_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CampaignEventLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CampaignEventLog_worldId_idx" ON "CampaignEventLog"("worldId");

-- CreateIndex
CREATE INDEX "CampaignEventLog_userId_idx" ON "CampaignEventLog"("userId");
