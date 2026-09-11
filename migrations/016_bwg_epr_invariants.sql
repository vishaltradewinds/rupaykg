-- Enforce BWG EPR quantity invariants at the database boundary.
-- A report cannot claim more fulfilled quantity than the obligation quantity.

DO $$
BEGIN
  IF to_regclass('public.bwg_epr_reports') IS NOT NULL THEN
    ALTER TABLE bwg_epr_reports
      DROP CONSTRAINT IF EXISTS bwg_epr_reports_fulfilled_le_obligated;

    ALTER TABLE bwg_epr_reports
      ADD CONSTRAINT bwg_epr_reports_fulfilled_le_obligated
      CHECK (fulfilled_quantity <= obligated_quantity);
  END IF;
END $$;
