-- CreateTable
CREATE TABLE "ShopCommission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "worldId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "daysRequired" INTEGER NOT NULL,
    "characterName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopCommission_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShopCommission_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShopCommission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ShopCommission_worldId_idx" ON "ShopCommission"("worldId");

-- CreateIndex
CREATE INDEX "ShopCommission_shopId_idx" ON "ShopCommission"("shopId");

-- CreateIndex
CREATE INDEX "ShopCommission_userId_idx" ON "ShopCommission"("userId");
