-- Read-only runtime identity diagnostic for RupayKg.
-- Run ONLY against a non-production rehearsal first. This script performs SELECTs only.
-- It deliberately does not inspect connection strings, passwords, secrets, or environment variables.

BEGIN READ ONLY;

SELECT
  current_database()                         AS database_name,
  current_user                               AS effective_role,
  session_user                               AS session_login_role,
  current_schema()                           AS current_schema,
  current_setting('search_path')             AS search_path,
  current_setting('row_security')             AS row_security_setting;

SELECT
  r.rolname                                   AS role_name,
  r.rolcanlogin                               AS can_login,
  r.rolsuper                                  AS is_superuser,
  r.rolbypassrls                              AS bypasses_rls,
  r.rolcreatedb                               AS can_create_database,
  r.rolcreaterole                             AS can_create_roles,
  r.rolinherit                                AS inherits_role_privileges
FROM pg_roles AS r
WHERE r.rolname IN (current_user, session_user)
ORDER BY r.rolname;

SELECT
  granted.rolname                             AS granted_role,
  member.rolname                              AS member_role,
  am.admin_option                             AS has_admin_option
FROM pg_auth_members AS am
JOIN pg_roles AS granted ON granted.oid = am.roleid
JOIN pg_roles AS member ON member.oid = am.member
WHERE member.rolname IN (current_user, session_user)
ORDER BY member.rolname, granted.rolname;

SELECT
  has_table_privilege(current_user, 'public.verifications', 'SELECT')    AS can_select_verifications,
  has_table_privilege(current_user, 'public.verifications', 'INSERT')    AS can_insert_verifications,
  has_table_privilege(current_user, 'public.verifications', 'UPDATE')    AS can_update_verifications,
  has_table_privilege(current_user, 'public.verifications', 'DELETE')    AS can_delete_verifications,
  has_table_privilege(current_user, 'public.verifications', 'TRUNCATE')  AS can_truncate_verifications,
  has_table_privilege(current_user, 'public.verifications', 'TRIGGER')   AS can_create_verification_triggers,
  has_schema_privilege(current_user, 'public', 'CREATE')                 AS can_create_in_public_schema;

ROLLBACK;
