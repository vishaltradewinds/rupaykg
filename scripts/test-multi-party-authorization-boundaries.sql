-- Shakti Batch C: explicit multi-party authorization boundary specification.
-- VALIDATION ONLY. Never execute against production.
-- Purpose: prevent multi-party tables from receiving an unsafe blanket organization policy.
\set ON_ERROR_STOP on

CREATE TEMP TABLE shakti_multi_party_spec (
  table_name text PRIMARY KEY,
  authorization_mode text NOT NULL,
  required_columns text[] NOT NULL
);

INSERT INTO shakti_multi_party_spec(table_name,authorization_mode,required_columns) VALUES
('bwg_waste_reports','EXPLICIT_DOMAIN_AUTHORIZATION',ARRAY['reporting_period_id','processor_organization_id','evidence_id','verification_id']),
('chain_of_custody_links','EXPLICIT_DOMAIN_AUTHORIZATION',ARRAY['resource_flow_id','actor_organization_id','activity_id','from_geography_id','to_geography_id','evidence_id']),
('credentials','EXPLICIT_DOMAIN_AUTHORIZATION',ARRAY['issuer_organization_id','activity_id','verification_id','methodology_version_id']),
('epr_credit_allocations','EXPLICIT_DOMAIN_AUTHORIZATION',ARRAY['epr_credit_id','obligation_id']),
('epr_credit_transfers','EXPLICIT_DOMAIN_AUTHORIZATION',ARRAY['credit_id','from_organization_id','to_organization_id','evidence_id','verification_id']),
('epr_credits','EXPLICIT_DOMAIN_AUTHORIZATION',ARRAY['issuer_organization_id','recycler_organization_id','activity_id','evidence_id','verification_id']),
('registry_events','EXPLICIT_DOMAIN_AUTHORIZATION',ARRAY['credential_id','from_owner_id','to_owner_id','verification_id','recorded_by_identity_id']),
('settlements','EXPLICIT_DOMAIN_AUTHORIZATION',ARRAY['obligation_id','credential_id','payer_id','payee_id']),
('settlement_events','INHERIT_SETTLEMENT_AUTHORIZATION',ARRAY['settlement_id','actor_identity_id']);

DO $assert$
DECLARE
  r record;
  missing_count integer;
  single_org_policy_count integer;
BEGIN
  FOR r IN SELECT * FROM shakti_multi_party_spec ORDER BY table_name LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=r.table_name
    ) THEN
      RAISE EXCEPTION 'Multi-party table missing from schema: %', r.table_name;
    END IF;

    SELECT count(*) INTO missing_count
    FROM unnest(r.required_columns) c(column_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns ic
      WHERE ic.table_schema='public'
        AND ic.table_name=r.table_name
        AND ic.column_name=c.column_name
    );

    IF missing_count <> 0 THEN
      RAISE EXCEPTION 'Required authorization columns missing for %', r.table_name;
    END IF;
  END LOOP;

  SELECT count(*) INTO single_org_policy_count
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename IN (SELECT table_name FROM shakti_multi_party_spec)
    AND (
      lower(coalesce(qual,'')) LIKE '%organization_id%'
      OR lower(coalesce(with_check,'')) LIKE '%organization_id%'
    )
    AND lower(coalesce(qual,'') || ' ' || coalesce(with_check,'')) NOT LIKE '%explicit_domain_authorization%';

  IF single_org_policy_count <> 0 THEN
    RAISE EXCEPTION 'Unsafe blanket organization policy detected on a multi-party table: %', single_org_policy_count;
  END IF;
END
$assert$;

DO $fk$
DECLARE
  expected record;
BEGIN
  FOR expected IN
    SELECT * FROM (VALUES
      ('bwg_waste_reports','reporting_period_id','bwg_reporting_periods','id'),
      ('bwg_waste_reports','processor_organization_id','organizations','id'),
      ('bwg_waste_reports','evidence_id','evidence','id'),
      ('bwg_waste_reports','verification_id','verifications','id'),
      ('chain_of_custody_links','resource_flow_id','resource_flows','id'),
      ('chain_of_custody_links','actor_organization_id','organizations','id'),
      ('chain_of_custody_links','activity_id','activities','id'),
      ('chain_of_custody_links','evidence_id','evidence','id'),
      ('credentials','issuer_organization_id','organizations','id'),
      ('credentials','activity_id','activities','id'),
      ('credentials','verification_id','verifications','id'),
      ('epr_credit_allocations','epr_credit_id','epr_credits','id'),
      ('epr_credit_allocations','obligation_id','epr_obligations','id'),
      ('epr_credit_transfers','credit_id','epr_credits','id'),
      ('epr_credit_transfers','from_organization_id','organizations','id'),
      ('epr_credit_transfers','to_organization_id','organizations','id'),
      ('epr_credit_transfers','evidence_id','evidence','id'),
      ('epr_credit_transfers','verification_id','verifications','id'),
      ('epr_credits','issuer_organization_id','organizations','id'),
      ('epr_credits','recycler_organization_id','organizations','id'),
      ('epr_credits','activity_id','activities','id'),
      ('epr_credits','evidence_id','evidence','id'),
      ('epr_credits','verification_id','verifications','id'),
      ('registry_events','credential_id','credentials','id'),
      ('registry_events','from_owner_id','organizations','id'),
      ('registry_events','to_owner_id','organizations','id'),
      ('registry_events','verification_id','verifications','id'),
      ('settlements','obligation_id','obligations','id'),
      ('settlements','credential_id','credentials','id'),
      ('settlements','payer_id','organizations','id'),
      ('settlements','payee_id','organizations','id'),
      ('settlement_events','settlement_id','settlements','id')
    ) AS x(child_table,child_column,parent_table,parent_column)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name=ccu.constraint_name AND tc.table_schema=ccu.table_schema
      WHERE tc.table_schema='public'
        AND tc.constraint_type='FOREIGN KEY'
        AND tc.table_name=expected.child_table
        AND kcu.column_name=expected.child_column
        AND ccu.table_name=expected.parent_table
        AND ccu.column_name=expected.parent_column
    ) THEN
      RAISE EXCEPTION 'Expected FK topology missing: %.% -> %.%',
        expected.child_table,expected.child_column,expected.parent_table,expected.parent_column;
    END IF;
  END LOOP;
END
$fk$;

SELECT table_name,authorization_mode,required_columns
FROM shakti_multi_party_spec
ORDER BY table_name;
