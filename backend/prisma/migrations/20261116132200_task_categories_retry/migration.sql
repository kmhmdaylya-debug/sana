CREATE TYPE "WorkCategory" AS ENUM ('DESIGN', 'DEVELOPMENT', 'CONTENT', 'SUPPORT', 'OPERATIONS', 'GENERAL');
CREATE TYPE "TaskRetryStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Task"
  ADD COLUMN "category" "WorkCategory",
  ADD COLUMN "retryStatus" "TaskRetryStatus",
  ADD COLUMN "retryRequestedAt" TIMESTAMP(3),
  ADD COLUMN "retryRequestedById" UUID;
ALTER TABLE "Project" ADD COLUMN "category" "WorkCategory";
ALTER TABLE "ProjectTask" ADD COLUMN "category" "WorkCategory";

CREATE INDEX "Task_retryRequestedById_idx" ON "Task"("retryRequestedById");
CREATE INDEX "Task_companyId_category_idx" ON "Task"("companyId", "category");
ALTER TABLE "Task" ADD CONSTRAINT "Task_retryRequestedById_fkey"
  FOREIGN KEY ("retryRequestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
