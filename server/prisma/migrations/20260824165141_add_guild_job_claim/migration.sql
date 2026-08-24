-- CreateTable
CREATE TABLE "GuildJobClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publishedEntryId" TEXT NOT NULL,
    "posterUserId" TEXT NOT NULL,
    "posterWorldId" TEXT,
    "posterQuestHookId" TEXT NOT NULL,
    "claimerUserId" TEXT NOT NULL,
    "claimerQuestHookId" TEXT NOT NULL,
    "claimedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "GuildJobClaim_claimerQuestHookId_key" ON "GuildJobClaim"("claimerQuestHookId");

-- CreateIndex
CREATE INDEX "GuildJobClaim_claimerQuestHookId_idx" ON "GuildJobClaim"("claimerQuestHookId");
