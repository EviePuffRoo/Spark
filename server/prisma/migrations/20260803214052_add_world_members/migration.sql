-- AlterTable
ALTER TABLE "World" ADD COLUMN "joinCodeHash" TEXT;

-- CreateTable
CREATE TABLE "WorldMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "worldId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorldMember_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorldMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WorldMember_userId_idx" ON "WorldMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorldMember_worldId_userId_key" ON "WorldMember"("worldId", "userId");
