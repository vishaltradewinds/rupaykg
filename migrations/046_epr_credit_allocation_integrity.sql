-- Prevent EPR certificate quantities from being counted toward more than one obligation.
-- Allocation is the authoritative consumption boundary; eligibility alone is never fulfilment.

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
    RETURNS trigger LANGUAGE plpgsql AS $fn$
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
        AND status IN ('ELIGIBLE','ISSUED','ACTIVE')
      FOR UPDATE;

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
    $fn$;

    DROP TRIGGER IF EXISTS epr_credit_allocation_capacity
      ON epr_credit_allocations;
    CREATE TRIGGER epr_credit_allocation_capacity
      BEFORE INSERT OR UPDATE ON epr_credit_allocations
      FOR EACH ROW EXECUTE FUNCTION enforce_epr_credit_allocation_capacity();

    CREATE OR REPLACE FUNCTION allocate_epr_credit(
      p_credit_id uuid,
      p_obligation_id uuid,
      p_quantity numeric
    ) RETURNS uuid LANGUAGE plpgsql AS $fn$
    DECLARE
      credit epr_credits%ROWTYPE;
      obligation epr_obligations%ROWTYPE;
      allocation_id uuid;
    BEGIN
      IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'EPR_ALLOCATION_INVALID_QUANTITY: quantity must be positive';
      END IF;

      SELECT * INTO credit
      FROM epr_credits
      WHERE id = p_credit_id
      FOR UPDATE;
      IF NOT FOUND OR credit.status NOT IN ('ELIGIBLE','ISSUED','ACTIVE') THEN
        RAISE EXCEPTION 'EPR_CREDIT_NOT_ALLOCATABLE: credit must be eligible, issued or active';
      END IF;

      SELECT * INTO obligation
      FROM epr_obligations
      WHERE id = p_obligation_id
      FOR UPDATE;
      IF NOT FOUND OR obligation.status NOT IN ('OPEN','ACTIVE') THEN
        RAISE EXCEPTION 'EPR_OBLIGATION_NOT_ALLOCATABLE: obligation is not open or active';
      END IF;
      IF credit.scheme_id <> obligation.scheme_id THEN
        RAISE EXCEPTION 'EPR_SCHEME_MISMATCH: credit and obligation schemes must match';
      END IF;
      IF obligation.fulfilled_quantity + p_quantity > obligation.target_quantity THEN
        RAISE EXCEPTION 'EPR_OBLIGATION_CAPACITY_EXCEEDED: allocation exceeds remaining obligation';
      END IF;

      INSERT INTO epr_credit_allocations (epr_credit_id, obligation_id, quantity, status)
      VALUES (p_credit_id, p_obligation_id, p_quantity, 'ALLOCATED')
      RETURNING id INTO allocation_id;

      UPDATE epr_obligations
      SET fulfilled_quantity = fulfilled_quantity + p_quantity,
          status = CASE WHEN fulfilled_quantity + p_quantity >= target_quantity THEN 'COMPLETED' ELSE status END
      WHERE id = p_obligation_id;

      RETURN allocation_id;
    END;
    $fn$;

    CREATE OR REPLACE FUNCTION release_epr_credit_allocation(p_allocation_id uuid)
    RETURNS void LANGUAGE plpgsql AS $fn$
    DECLARE
      allocation epr_credit_allocations%ROWTYPE;
    BEGIN
      SELECT * INTO allocation
      FROM epr_credit_allocations
      WHERE id = p_allocation_id
      FOR UPDATE;
      IF NOT FOUND OR allocation.status <> 'ALLOCATED' THEN
        RETURN;
      END IF;

      UPDATE epr_credit_allocations
      SET status = 'RELEASED', released_at = now()
      WHERE id = p_allocation_id;

      UPDATE epr_obligations
      SET fulfilled_quantity = GREATEST(0, fulfilled_quantity - allocation.quantity),
          status = CASE WHEN fulfilled_quantity - allocation.quantity < target_quantity THEN 'OPEN' ELSE status END
      WHERE id = allocation.obligation_id;
    END;
    $fn$;
  END IF;
END $$;
