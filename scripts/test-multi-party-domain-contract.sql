-- Shakti Batch C: multi-party domain authorization schema reconciliation.
-- VALIDATION ONLY. Never execute against production.
\set ON_ERROR_STOP on

CREATE TEMP TABLE shakti_domain_contract(
  table_name text PRIMARY KEY,
  required_columns text[] NOT NULL,
  nullable_authorization_columns text[] NOT NULL
);

INSERT INTO shakti_domain_contract VALUES
('bwg_waste_reports',ARRAY['reporting_period_id','processor_organization_id','evidence_id','verification_id'],ARRAY['processor_organization_id','evidence_id','verification_id']),
('chain_of_custody_links',ARRAY['resource_flow_id','actor_organization_id','activity_id','from_geography_id','to_geography_id','evidence_id'],ARRAY['actor_organization_id','activity_id','from_geography_id','to_geography_id','evidence_id']),
('credentials',ARRAY['issuer_organization_id','activity_id','verification_id','methodology_version_id'],ARRAY['activity_id','verification_id']),
('epr_credit_allocations',ARRAY['epr_credit_id','obligation_id'],ARRAY[]::text[]),
('epr_credit_transfers',ARRAY['credit_id','from_organization_id','to_organization_id','evidence_id','verification_id'],ARRAY['evidence_id','verification_id']),
('epr_credits',ARRAY['issuer_organization_id','recycler_organization_id','activity_id','evidence_id','verification_id'],ARRAY['activity_id','evidence_id','verification_id']),
('registry_events',ARRAY['credential_id','from_owner_id','to_owner_id','verification_id','recorded_by_identity_id'],ARRAY['from_owner_id','to_owner_id','verification_id','recorded_by_identity_id']),
('settlements',ARRAY['obligation_id','credential_id','payer_id','payee_id'],ARRAY['obligation_id','credential_id','payer_id','payee_id']),
('settlement_events',ARRAY['settlement_id','actor_identity_id'],ARRAY['actor_identity_id']);

DO $assert$
DECLARE r record; c text; actual_nullable boolean;
BEGIN
  FOR r IN SELECT * FROM shakti_domain_contract ORDER BY table_name LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=r.table_name) THEN
      RAISE EXCEPTION 'Missing multi-party surface: %',r.table_name;
    END IF;
    FOREACH c IN ARRAY r.required_columns LOOP
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=r.table_name AND column_name=c
      ) THEN
        RAISE EXCEPTION 'Missing required authorization column %.%',r.table_name,c;
      END IF;
    END LOOP;
    FOREACH c IN ARRAY r.nullable_authorization_columns LOOP
      SELECT is_nullable='YES' INTO actual_nullable
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=r.table_name AND column_name=c;
      IF actual_nullable IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Expected explicit-null deny boundary not represented by nullable column %.%',r.table_name,c;
      END IF;
    END LOOP;
  END LOOP;
END
$assert$;

-- No blanket tenant policy is permitted on these surfaces in this rehearsal.
DO $policy$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN (SELECT table_name FROM shakti_domain_contract)
      AND (
        lower(coalesce(qual,'')) LIKE '%current_user%'
        OR lower(coalesce(with_check,'')) LIKE '%current_user%'
        OR lower(coalesce(qual,'')) LIKE '%role_name%'
        OR lower(coalesce(with_check,'')) LIKE '%role_name%'
      )
  ) THEN
    RAISE EXCEPTION 'Role/session-name authorization mechanism detected on multi-party surface';
  END IF;
END
$policy$;

SELECT table_name,required_columns,nullable_authorization_columns
FROM shakti_domain_contract
ORDER BY table_name;
