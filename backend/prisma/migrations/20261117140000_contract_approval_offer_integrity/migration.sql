ALTER TABLE "ContractVersion" ADD COLUMN "approvedAt" TIMESTAMP(3), ADD COLUMN "approvedById" UUID;

-- Preserve already approved contracts; legacy RENEWED records need explicit review.
UPDATE "ContractVersion" v
SET "approvedAt" = c."updatedAt"
FROM "Contract" c
WHERE v."contractId" = c.id AND v.version = c."currentVersion"
  AND c.status IN ('ACTIVE', 'EXPIRING', 'SUSPENDED', 'TERMINATED');

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Offer" GROUP BY "applicantId", version HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate offer versions require operator review; no existing offers were removed';
  END IF;
END $$;
CREATE UNIQUE INDEX "Offer_applicantId_version_key" ON "Offer"("applicantId", "version");
