-- CreateTable
CREATE TABLE "RollLogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "worldId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rollerName" TEXT NOT NULL,
    "notation" TEXT NOT NULL,
    "results" TEXT NOT NULL,
    "modifier" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "mode" TEXT,
    "label" TEXT,
    "hiddenFromParty" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RollLogEntry_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RollLogEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RollLogEntry_worldId_idx" ON "RollLogEntry"("worldId");

-- CreateIndex
CREATE INDEX "RollLogEntry_userId_idx" ON "RollLogEntry"("userId");
