-- CreateTable
CREATE TABLE "FactionLogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "factionId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FactionLogEntry_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FactionLogEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FactionRelationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "worldId" TEXT NOT NULL,
    "factionAId" TEXT NOT NULL,
    "factionBId" TEXT NOT NULL,
    "stance" TEXT NOT NULL,
    "notes" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FactionRelationship_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FactionRelationship_factionAId_fkey" FOREIGN KEY ("factionAId") REFERENCES "Faction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FactionRelationship_factionBId_fkey" FOREIGN KEY ("factionBId") REFERENCES "Faction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FactionRelationship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FactionLogEntry_factionId_idx" ON "FactionLogEntry"("factionId");

-- CreateIndex
CREATE INDEX "FactionRelationship_worldId_idx" ON "FactionRelationship"("worldId");

-- CreateIndex
CREATE INDEX "FactionRelationship_factionBId_idx" ON "FactionRelationship"("factionBId");

-- CreateIndex
CREATE UNIQUE INDEX "FactionRelationship_factionAId_factionBId_key" ON "FactionRelationship"("factionAId", "factionBId");
