-- Backfill approvalType for existing Request records
UPDATE Request
SET approvalType = CASE
  WHEN autoApproved = 1 THEN 'auto_trust'
  WHEN allowed = 1 THEN 'manual'
  ELSE NULL
END
WHERE approvalType IS NULL AND allowed IS NOT NULL;

-- Backfill approvalType for existing Log records
UPDATE Log
SET approvalType = CASE
  WHEN autoApproved = 1 THEN 'auto_trust'
  WHEN type = 'approval' THEN 'manual'
  ELSE NULL
END
WHERE approvalType IS NULL;
