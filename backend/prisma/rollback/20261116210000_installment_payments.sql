-- Rollback is permitted only before any payment has been recorded.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "LoanInstallmentPayment" LIMIT 1) THEN
    RAISE EXCEPTION 'Payment history must be retained; rollback refused';
  END IF;
  DROP TABLE "LoanInstallmentPayment";
END $$;
