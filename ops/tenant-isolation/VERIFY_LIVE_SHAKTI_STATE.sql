-- Read-only Shakti production drift audit. No DDL, DML, role, policy or ledger changes.
BEGIN READ ONLY;

SELECT current_database() AS database_name,
       current_user AS current_user,
       session_user AS session_user,
       current_setting('server_version_num') AS server_version_num;

WITH protected(table_name) AS (
  VALUES
    ('organizations'),('roles'),('activities'),('obligations'),('credentials'),
    ('settlements'),('audit_events'),('resource_flows'),('field_devices'),
    ('organization_memberships'),('measurements'),('evidence'),('verifications'),
    ('carbon_calculations'),('mrv_observations'),
    ('evidence_verification_requirements'),('chain_of_custody_links'),
    ('mrv_provenance_events')
)
SELECT p.table_name,
       c.oid IS NOT NULL AS present,
       COALESCE(c.relrowsecurity, false) AS rls_enabled,
       COALESCE(c.relforcerowsecurity, false) AS force_rls,
       pg_get_userbyid(c.relowner) AS table_owner
FROM protected p
LEFT JOIN pg_namespace n ON n.nspname = 'public'
LEFT JOIN pg_class c
  ON c.relnamespace = n.oid
 AND c.relname = p.table_name
 AND c.relkind = 'r'
ORDER BY p.table_name;

SELECT version, filename, applied_at
FROM public.schema_migrations
WHERE version IN ('097','098','099','100','101')
ORDER BY version;

SELECT rolname, rolsuper, rolbypassrls, rolcanlogin, rolinherit, rolcreaterole
FROM pg_roles
WHERE rolname IN ('rupaykg','rupaykg_runtime_login','rupaykg_app_runtime',
                  'rupaykg_ddl','rupaykg_ddl_migration')
ORDER BY rolname;

SELECT parent.rolname AS granted_role,
       member.rolname AS member_role,
       m.admin_option, m.inherit_option, m.set_option
FROM pg_auth_members m
JOIN pg_roles parent ON parent.oid = m.roleid
JOIN pg_roles member ON member.oid = m.member
WHERE member.rolname IN ('rupaykg','rupaykg_runtime_login')
  AND parent.rolname IN ('rupaykg_ddl','rupaykg_app_runtime','neon_superuser')
ORDER BY member.rolname, parent.rolname;

SELECT
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') AS public_policy_count,
  pg_has_role('rupaykg','rupaykg_ddl','SET') AS migration_owner_can_set_ddl,
  has_table_privilege('rupaykg','public.schema_migrations','SELECT') AS ledger_select,
  has_table_privilege('rupaykg','public.schema_migrations','INSERT') AS ledger_insert,
  has_table_privilege('rupaykg','public.schema_migrations','UPDATE') AS ledger_update,
  (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='public.schema_migrations'::regclass) AS ledger_owner,
  (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=to_regclass('public.mrv_provenance_events')) AS provenance_owner;

COMMIT;
