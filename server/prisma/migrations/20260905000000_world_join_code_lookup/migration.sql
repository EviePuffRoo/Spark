-- AlterTable
ALTER TABLE "World" ADD COLUMN "joinCodeLookup" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "World_joinCodeLookup_key" ON "World"("joinCodeLookup");
