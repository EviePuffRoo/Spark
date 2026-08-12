-- AlterTable
ALTER TABLE "PublishedEntry" ADD COLUMN "removedAt" DATETIME;
ALTER TABLE "PublishedEntry" ADD COLUMN "removedByUserId" TEXT;
ALTER TABLE "PublishedEntry" ADD COLUMN "removedReason" TEXT;

-- CreateTable
CREATE TABLE "GalleryReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "resolvedByUserId" TEXT,
    CONSTRAINT "GalleryReport_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "PublishedEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GalleryReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "recoveryCodeHash" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'free',
    "stripeCustomerId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "canPublish" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "id", "passwordHash", "recoveryCodeHash", "stripeCustomerId", "tier", "username") SELECT "createdAt", "id", "passwordHash", "recoveryCodeHash", "stripeCustomerId", "tier", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "GalleryReport_status_idx" ON "GalleryReport"("status");

-- CreateIndex
CREATE INDEX "GalleryReport_entryId_idx" ON "GalleryReport"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "GalleryReport_entryId_reporterId_key" ON "GalleryReport"("entryId", "reporterId");

