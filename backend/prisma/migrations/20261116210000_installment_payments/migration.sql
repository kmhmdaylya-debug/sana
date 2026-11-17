CREATE TABLE "LoanInstallmentPayment" (
    "id" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "installmentId" UUID NOT NULL,
    "payrollPeriodId" UUID NOT NULL,
    "amount" BIGINT NOT NULL CHECK ("amount" > 0),
    "paidAfter" BIGINT NOT NULL,
    "fullyPaid" BOOLEAN NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoanInstallmentPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LoanInstallmentPayment_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "LoanInstallment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LoanInstallmentPayment_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LoanInstallmentPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LoanInstallmentPayment_idempotencyKey_key" ON "LoanInstallmentPayment"("idempotencyKey");
CREATE INDEX "LoanInstallmentPayment_installmentId_idx" ON "LoanInstallmentPayment"("installmentId");
CREATE INDEX "LoanInstallmentPayment_payrollPeriodId_idx" ON "LoanInstallmentPayment"("payrollPeriodId");
