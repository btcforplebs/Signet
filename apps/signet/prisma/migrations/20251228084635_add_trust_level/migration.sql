-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_KeyUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keyName" TEXT NOT NULL,
    "userPubkey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "lastUsedAt" DATETIME,
    "description" TEXT,
    "trustLevel" TEXT NOT NULL DEFAULT 'reasonable'
);
INSERT INTO "new_KeyUser" ("createdAt", "description", "id", "keyName", "lastUsedAt", "revokedAt", "updatedAt", "userPubkey") SELECT "createdAt", "description", "id", "keyName", "lastUsedAt", "revokedAt", "updatedAt", "userPubkey" FROM "KeyUser";
DROP TABLE "KeyUser";
ALTER TABLE "new_KeyUser" RENAME TO "KeyUser";
CREATE UNIQUE INDEX "KeyUser_keyName_userPubkey_key" ON "KeyUser"("keyName", "userPubkey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
