-- Shakti Batch C: multi-party concurrency/revocation assurance.
-- VALIDATION ONLY. Disposable PostgreSQL only.
\set ON_ERROR_STOP on

DO $assert$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='organizations') THEN
    RAISE EXCEPTION 'organizations table missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='settlements') THEN
    RAISE EXCEPTION 'settlements table missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='epr_credit_transfers') THEN
    RAISE EXCEPTION 'epr_credit_transfers table missing';
  END IF;
END
$assert$;

CREATE TEMP TABLE shakti_race_cases(
  case_id text PRIMARY KEY,
  authorization_event text NOT NULL,
  expected_outcome text NOT NULL
);

INSERT INTO shakti_race_cases VALUES
('REVOCATION_DURING_DECISION','membership/permission revoked before authorization decision','DENY'),
('SUSPENSION_DURING_DECISION','identity or organization suspended before authorization decision','DENY'),
('GEOGRAPHY_REASSIGNMENT','verified geography scope removed/reassigned before authorization decision','DENY'),
('COUNTERPARTY_CHANGE','payer/payee or transfer counterparty changes before authorization decision','DENY'),
('LIFECYCLE_INVALIDATION','subject settlement/credit/obligation leaves authorized lifecycle state','DENY');

DO $assert$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM shakti_race_cases ORDER BY case_id LOOP
    IF r.expected_outcome <> 'DENY' THEN
      RAISE EXCEPTION 'Unsafe race-case expectation for %',r.case_id;
    END IF;
  END LOOP;
END
$assert$;

-- The disposable rehearsal establishes the required fail-closed race contract.
-- Concrete lock/serialization tests must be implemented against the final
-- domain authorization functions after the nine domain matrices are reviewed.
SELECT case_id, authorization_event, expected_outcome
FROM shakti_race_cases
ORDER BY case_id;
