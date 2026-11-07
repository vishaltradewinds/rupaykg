-- Shakti Batch C: disposable tenant-boundary inventory and RLS baseline.
-- Validation only. Never execute against production.
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE tenant_boundary_inventory (
  table_schema text NOT NULL,
  table_name text NOT NULL,
  classification text NOT NULL,
  tenant_key text,
  rationale text NOT NULL,
  PRIMARY KEY (table_schema, table_name)
) ON COMMIT DROP;

INSERT INTO tenant_boundary_inventory
SELECT n.nspname, c.relname,
  CASE
    WHEN c.relname = 'organizations'
      OR EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
          AND lower(a.attname) IN ('organization_id','tenant_id','tenantid','org_id','orgid')
      ) THEN 'tenant_owned_direct'
    WHEN c.relname IN (
      'identities','identity_sessions','organization_memberships','roles','permissions',
      'audit_logs','audit_events','security_events','sessions','schema_migrations'
    ) THEN 'security_control'
    ELSE 'global_reference'
  END,
  (
    SELECT a.attname FROM pg_attribute a
    WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
      AND lower(a.attname) IN ('organization_id','tenant_id','tenantid','org_id','orgid')
    ORDER BY a.attnum LIMIT 1
  ),
  'initial catalog classification'
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind='r' AND n.nspname='public';

-- Propagate tenant ownership from direct tenant anchors through child FKs.
DO $$
DECLARE changed integer := 1;
BEGIN
  WHILE changed > 0 LOOP
    WITH candidates AS (
      SELECT DISTINCT child_ns.nspname AS table_schema,
             child.relname AS table_name
      FROM pg_constraint fk
      JOIN pg_class child ON child.oid=fk.conrelid
      JOIN pg_namespace child_ns ON child_ns.oid=child.relnamespace
      JOIN pg_class parent ON parent.oid=fk.confrelid
      JOIN pg_namespace parent_ns ON parent_ns.oid=parent.relnamespace
      JOIN tenant_boundary_inventory p
        ON p.table_schema=parent_ns.nspname AND p.table_name=parent.relname
      LEFT JOIN tenant_boundary_inventory x
        ON x.table_schema=child_ns.nspname AND x.table_name=child.relname
      WHERE fk.contype='f'
        AND child_ns.nspname='public'
        AND parent_ns.nspname='public'
        AND p.classification IN ('tenant_owned_direct','tenant_owned_indirect')
        AND (x.classification IS NULL OR x.classification='global_reference')
        AND child.relname NOT IN (
          'identities','identity_sessions','organization_memberships','roles','permissions',
          'audit_logs','audit_events','security_events','sessions','schema_migrations'
        )
    )
    UPDATE tenant_boundary_inventory t
       SET classification='tenant_owned_indirect',
           rationale='inherits tenant boundary through FK to tenant-owned parent'
     WHERE (t.table_schema,t.table_name) IN (
       SELECT table_schema,table_name FROM candidates
     )
       AND t.classification='global_reference';
    GET DIAGNOSTICS changed = ROW_COUNT;
  END LOOP;
END $$;

-- Reviewed domain overrides. A table's organization_id is not enough to decide
-- whether it can use a generic single-tenant policy.
UPDATE tenant_boundary_inventory
   SET classification='tenant_authorization_control',
       rationale='tenant-scoped authorization control; policy must validate identity/membership lifecycle'
 WHERE table_name IN (
   'organization_memberships','roles','platform_access_change_requests',
   'stakeholder_application_approvals'
 );

UPDATE tenant_boundary_inventory
   SET classification='tenant_audit_control',
       rationale='tenant-linked audit/status history; preserve append-only and actor/workspace consistency'
 WHERE table_name IN ('audit_events','cpcb_swm_status_history');

UPDATE tenant_boundary_inventory
   SET classification='multi_party_control',
       rationale='multi-organization ownership/participation; no blanket single-tenant policy'
 WHERE table_name IN (
   'bwg_waste_reports','chain_of_custody_links','credentials',
   'epr_credit_allocations','epr_credit_transfers','epr_credits',
   'registry_events','settlements','settlement_events'
 );

UPDATE tenant_boundary_inventory
   SET classification='identity_security_control',
       rationale='identity-scoped or authentication secret/session surface; not organization-global data'
 WHERE table_name IN (
   'identities','identity_credentials','identity_password_credentials','identity_sessions'
 );

UPDATE tenant_boundary_inventory
   SET classification='platform_control',
       rationale='platform governance or migration control; service/owner-only access, not tenant data'
 WHERE table_name IN (
   'methodology_governance_evidence','platform_audit_chain_head','schema_migrations'
 );

UPDATE tenant_boundary_inventory
   SET classification='unresolved_legacy_surface',
       rationale='legacy sync envelope lacks tenant/device FK binding; hold from broad runtime access pending route and ownership reconciliation'
 WHERE table_name='operation_sync_envelopes';

-- Exact classification cardinality is part of the live-schema contract.
DO $classification$
DECLARE
  actual_count integer;
  expected record;
BEGIN
  FOR expected IN
    SELECT * FROM (VALUES
      ('tenant_owned_direct', 19),
      ('tenant_owned_indirect', 17),
      ('tenant_authorization_control', 4),
      ('tenant_audit_control', 2),
      ('multi_party_control', 9),
      ('identity_security_control', 4),
      ('global_reference', 8),
      ('platform_control', 3),
      ('unresolved_legacy_surface', 1)
    ) AS x(classification, expected_count)
  LOOP
    SELECT count(*) INTO actual_count
    FROM tenant_boundary_inventory
    WHERE classification=expected.classification;
    IF actual_count <> expected.expected_count THEN
      RAISE EXCEPTION 'classification % has % tables; expected %',
        expected.classification, actual_count, expected.expected_count;
    END IF;
  END LOOP;

  SELECT count(*) INTO actual_count FROM tenant_boundary_inventory;
  IF actual_count <> 67 THEN
    RAISE EXCEPTION 'classification manifest has % tables; expected 67', actual_count;
  END IF;
END
$classification$;

-- Known tenant-sensitive domain tables must never be silently classified global.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(table_name, ', ' ORDER BY table_name) INTO bad
  FROM tenant_boundary_inventory
  WHERE classification='global_reference'
    AND table_name IN (
      'activities','evidence','verifications','reporting_periods','reports',
      'credentials','settlements','projects','facilities','measurements',
      'weighbridge_records','chain_of_custody','carbon_projects'
    );
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'tenant-sensitive tables remain unclassified/global: %', bad;
  END IF;
END $$;

-- The current authoritative catalog baseline is 67 public ordinary tables.
DO $assert$
DECLARE total_tables integer;
BEGIN
  SELECT count(*) INTO total_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind='r' AND n.nspname='public';
  IF total_tables <> 67 THEN
    RAISE EXCEPTION 'authoritative tenant-isolation baseline drift: expected 67 public ordinary tables, found %', total_tables;
  END IF;
END $assert$;

-- Every public ordinary table must have an explicit provisional classification.
DO $$
DECLARE total_tables integer; classified integer;
BEGIN
  SELECT count(*) INTO total_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind='r' AND n.nspname='public';
  SELECT count(*) INTO classified FROM tenant_boundary_inventory;
  IF total_tables <> classified THEN
    RAISE EXCEPTION 'classification coverage mismatch: % tables, % classified', total_tables, classified;
  END IF;
END $$;

-- Emit category totals, the full classification and FK boundary map for CI evidence.
SELECT classification, count(*) AS table_count
FROM tenant_boundary_inventory
GROUP BY classification
ORDER BY classification;

SELECT table_schema,table_name,classification,tenant_key,rationale
FROM tenant_boundary_inventory
ORDER BY classification,table_name;

SELECT child_ns.nspname AS child_schema,
       child.relname AS child_table,
       parent_ns.nspname AS parent_schema,
       parent.relname AS parent_table,
       fk.conname AS constraint_name,
       pg_get_constraintdef(fk.oid) AS constraint_definition
FROM pg_constraint fk
JOIN pg_class child ON child.oid=fk.conrelid
JOIN pg_namespace child_ns ON child_ns.oid=child.relnamespace
JOIN pg_class parent ON parent.oid=fk.confrelid
JOIN pg_namespace parent_ns ON parent_ns.oid=parent.relnamespace
WHERE fk.contype='f' AND child_ns.nspname='public' AND parent_ns.nspname='public'
ORDER BY child.relname,fk.conname;

-- Baseline observation only: no production assertion is made here.
-- RLS design/rehearsal must be executed under non-owner NOBYPASSRLS roles
-- in a separate disposable branch after this inventory is reviewed.
SELECT table_name,
       classification,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls,
       pg_get_userbyid(c.relowner) AS owner
FROM tenant_boundary_inventory i
JOIN pg_class c ON c.relname=i.table_name
JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname=i.table_schema
WHERE i.classification IN (
  'tenant_owned_direct','tenant_owned_indirect','tenant_authorization_control',
  'tenant_audit_control','multi_party_control','unresolved_legacy_surface'
)
ORDER BY table_name;

ROLLBACK;
