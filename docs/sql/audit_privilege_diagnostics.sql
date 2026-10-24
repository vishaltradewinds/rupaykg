-- Read-only diagnostic for the RupayKg canonical audit append privilege boundary.
-- Run against a non-production clone first, then production with an authorized
-- read-only operator. This script performs no writes and makes no privilege changes.
-- Capture output securely; role and grant topology can be security-sensitive.

\echo '1. Connection identity (the effective runtime identity of this session)'
select current_database() as database_name,
       session_user as session_user,
       current_user as effective_user,
       current_setting('server_version') as server_version;

\echo '2. Audit objects, owners, and relation privileges'
select n.nspname as schema_name,
       c.relname as object_name,
       c.relkind as object_kind,
       pg_get_userbyid(c.relowner) as owner,
       has_table_privilege(current_user, c.oid, 'SELECT') as can_select,
       has_table_privilege(current_user, c.oid, 'INSERT') as can_insert,
       has_table_privilege(current_user, c.oid, 'UPDATE') as can_update,
       has_table_privilege(current_user, c.oid, 'DELETE') as can_delete,
       has_table_privilege(current_user, c.oid, 'TRUNCATE') as can_truncate
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where c.relname in ('audit_events', 'platform_audit_chain_head')
   and n.nspname not in ('pg_catalog', 'information_schema')
 order by n.nspname, c.relname;

\echo '3. Explicit and inherited grants for audit tables'
select table_schema, table_name, grantee, privilege_type, is_grantable
  from information_schema.role_table_grants
 where table_name in ('audit_events', 'platform_audit_chain_head')
 order by table_schema, table_name, grantee, privilege_type;

\echo '4. Canonical append function owner, security mode, execute grants, and fixed search_path'
select n.nspname as schema_name,
       p.oid::regprocedure as function_signature,
       pg_get_userbyid(p.proowner) as function_owner,
       p.prosecdef as security_definer,
       p.proconfig as function_settings,
       has_function_privilege(current_user, p.oid, 'EXECUTE') as current_user_can_execute,
       pg_get_functiondef(p.oid) as function_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where p.proname = 'append_platform_audit_event'
 order by n.nspname, p.oid::regprocedure::text;

\echo '5. Role attributes and role memberships (inspect escalation paths)'
select r.rolname,
       r.rolcanlogin,
       r.rolsuper,
       r.rolcreatedb,
       r.rolcreaterole,
       r.rolinherit,
       r.rolbypassrls,
       member.rolname as member_of_role
  from pg_roles r
  left join pg_auth_members m on m.member = r.oid
  left join pg_roles member on member.oid = m.roleid
 where r.rolname in (current_user, session_user)
    or r.rolname in (
      select pg_get_userbyid(c.relowner)
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where c.relname in ('audit_events', 'platform_audit_chain_head')
         and n.nspname not in ('pg_catalog', 'information_schema')
    )
    or r.rolname in (
      select pg_get_userbyid(p.proowner)
        from pg_proc p
       where p.proname = 'append_platform_audit_event'
    )
 order by r.rolname, member.rolname;

\echo '6. Audit mutation triggers and their enabled state'
select n.nspname as schema_name,
       c.relname as table_name,
       t.tgname as trigger_name,
       t.tgenabled as enabled_code,
       pg_get_triggerdef(t.oid) as trigger_definition
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
 where c.relname = 'audit_events'
   and not t.tgisinternal
 order by t.tgname;

\echo 'Interpretation checklist:'
\echo '- Runtime role should not own audit_events or platform_audit_chain_head.'
\echo '- Runtime role must not have direct INSERT on audit_events or privilege inherited from another role.'
\echo '- Runtime role must not be able to assume the dedicated function-owner role.'
\echo '- A SECURITY DEFINER function must have a distinct trusted owner and a fixed safe search_path.'
\echo '- EXECUTE should be granted only to the intended runtime role(s); PUBLIC should not have EXECUTE.'
\echo '- Superusers and database owners remain privileged trust boundaries; this report alone is not a security certification.'
