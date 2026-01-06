-- CreateTable
CREATE TABLE "ConnectionToken" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keyName" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "redeemedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionToken_token_key" ON "ConnectionToken"("token");

-- CreateIndex
CREATE INDEX "ConnectionToken_keyName_idx" ON "ConnectionToken"("keyName");

-- CreateIndex
CREATE INDEX "ConnectionToken_token_idx" ON "ConnectionToken"("token");
