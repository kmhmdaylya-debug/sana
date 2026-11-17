CREATE TABLE "AuditOutbox" (
  "id" UUID NOT NULL,
  "userId" UUID,
  "action" "AuditAction" NOT NULL,
  "entity" VARCHAR(60) NOT NULL,
  "entityId" VARCHAR(64),
  "before" TEXT,
  "after" TEXT,
  "ip" VARCHAR(64),
  "userAgent" VARCHAR(255),
  "requestId" VARCHAR(64),
  "note" VARCHAR(500),
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditOutbox_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditOutbox_processedAt_idx" ON "AuditOutbox"("processedAt");
CREATE INDEX "AuditOutbox_createdAt_idx" ON "AuditOutbox"("createdAt");
