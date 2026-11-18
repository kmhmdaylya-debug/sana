BEGIN;

CREATE TABLE "AccessTokenBlocklist" (
    "tokenId" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessTokenBlocklist_pkey" PRIMARY KEY ("tokenId")
);

CREATE INDEX "AccessTokenBlocklist_expiresAt_idx" ON "AccessTokenBlocklist"("expiresAt");

COMMIT;
