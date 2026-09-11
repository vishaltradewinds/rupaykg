-- Prevent EPR certificate quantities from being counted toward more than one obligation.
-- Allocation is the authoritative consumption boundary; assessments must not treat
-- the full certificate quantity as reusable after it has been allocated.

DO $$
BEGIN
  IF to_regclass('public.epr_credits') IS NOT NULL
     AND to_regclass('public.epr_obligations') IS NOT NULL THEN
    CREATE TABLE IF NOT EXISTS epr_credit_allocations (
      id uuid primary key default gen_random_uuid(),
      epr_credit_id uuid not null references epr_credits(id),
      obligation_id uuid not null references epr_obligations(id),
      quantity numeric(20,6) not null check (quantity > 0),
      status text not null default 'ALLOCATED' check (status in ('ALLOCATED','RELEASED')),
      created_at timestamptz not null default now(),
      released_at timestamptz
    );

    CREATE INDEX IF NOT EXISTS epr_credit_allocations_credit_idx
      ON epr_credit_allocations(epr_credit_id, status);
    CREATE INDEX IF NOT EXISTS epr_credit_allocations_obligation_idx
      ON epr_credit_allocations(obligation_id, status);

    CREATE OR REPLACE FUNCTION enforce_epr_credit_allocation_capacity()
    RETURNS trigger LANGUAGE plpgsql AS $$fn$$
    DECLARE
      credit_quantity numeric(20,6);
      allocated_quantity numeric(20,6);
    BEGIN
      IF NEW.status <> 'ALLOCATED' THEN
        RETURN NEW;
      END IF;

      SELECT quantity INTO credit_quantity
      FROM epr_credits
      WHERE id = NEW.epr_credit_id
        AND status IN ('ELIGIBLE','ISSUED','ACTIVE');

      IF credit_quantity IS NULL THEN
        RAISE EXCEPTION 'EPR_CREDIT_NOT_ALLOCATABLE: credit must be eligible, issued or active';
      END IF;

      SELECT COALESCE(SUM(quantity), 0) INTO allocated_quantity
      FROM epr_credit_allocations
      WHERE epr_credit_id = NEW.epr_credit_id
        AND status = 'ALLOCATED'
        AND id <> NEW.id;

      IF allocated_quantity + NEW.quantity > credit_quantity THEN
        RAISE EXCEPTION 'EPR_CREDIT_CAPACITY_EXCEEDED: allocation exceeds available certificate quantity';
      END IF;

      RETURN NEW;
    END;
    $$fn$$;

    DROP TRIGGER IF EXISTS epr_credit_allocation_capacity
      ON epr_credit_allocations;
    CREATE TRIGGER epr_credit_allocation_capacity
      BEFORE INSERT OR UPDATE ON epr_credit_allocations
      FOR EACH ROW EXECUTE FUNCTION enforce_epr_credit_allocation_capacity();
  END IF;
END $$;
