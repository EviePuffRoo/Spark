-- AlterTable
ALTER TABLE "Encounter" ADD COLUMN "activeDungeonId" TEXT;
ALTER TABLE "Encounter" ADD COLUMN "activeDungeonRoomId" TEXT;

-- CreateTable
CREATE TABLE "Dungeon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rooms" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "worldId" TEXT,
    "hiddenFromParty" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Dungeon_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Dungeon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Dungeon_worldId_idx" ON "Dungeon"("worldId");

-- CreateIndex
CREATE INDEX "Dungeon_userId_idx" ON "Dungeon"("userId");
