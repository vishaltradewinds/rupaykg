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

-- Emit the full classification and FK boundary map for CI evidence.
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
WHERE i.classification IN ('tenant_owned_direct','tenant_owned_indirect')
ORDER BY table_name;

ROLLBACK;
