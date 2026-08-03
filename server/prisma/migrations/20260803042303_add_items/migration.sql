-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "property" TEXT NOT NULL,
    "history" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "worldId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Item_worldId_idx" ON "Item"("worldId");
