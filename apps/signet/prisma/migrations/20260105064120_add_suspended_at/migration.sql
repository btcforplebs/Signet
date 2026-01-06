-- AlterTable
ALTER TABLE "KeyUser" ADD COLUMN "suspendedAt" DATETIME;

-- CreateIndex
CREATE INDEX "KeyUser_suspendedAt_idx" ON "KeyUser"("suspendedAt");
