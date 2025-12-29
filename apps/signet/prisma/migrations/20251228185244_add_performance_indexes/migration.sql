-- CreateIndex
CREATE INDEX "KeyUser_revokedAt_idx" ON "KeyUser"("revokedAt");

-- CreateIndex
CREATE INDEX "Log_timestamp_idx" ON "Log"("timestamp");

-- CreateIndex
CREATE INDEX "Log_keyUserId_idx" ON "Log"("keyUserId");

-- CreateIndex
CREATE INDEX "Request_allowed_createdAt_idx" ON "Request"("allowed", "createdAt");

-- CreateIndex
CREATE INDEX "Request_remotePubkey_idx" ON "Request"("remotePubkey");

-- CreateIndex
CREATE INDEX "SigningCondition_keyUserId_idx" ON "SigningCondition"("keyUserId");

-- CreateIndex
CREATE INDEX "Token_keyName_idx" ON "Token"("keyName");
