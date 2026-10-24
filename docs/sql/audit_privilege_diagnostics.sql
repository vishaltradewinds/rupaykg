-- Read-only diagnostic for the RupayKg canonical audit append privilege boundary.
-- Run against a non-production clone first, then production with an authorized
-- read-only operator. This script performs no writes and makes no privilege changes.
-- Capture output securely; role and grant topology can be security-sensitive.

\echo '1. Connection identity (the effective runtime identity of this session)'
select current_database() as database_name,
       session_user as session_user,
       current_user as effective_user,
       current_setting('server_version') as server_version;

\echo '2. Audit objects, owners, and effective relation privileges'
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

\echo '3. Effective relation privileges for every login role and the current session roles'
select r.rolname as candidate_role,
       r.rolcanlogin,
       n.nspname as schema_name,
       c.relname as object_name,
       pg_get_userbyid(c.relowner) as object_owner,
       has_table_privilege(r.rolname, c.oid, 'SELECT') as can_select,
       has_table_privilege(r.rolname, c.oid, 'INSERT') as can_insert,
       has_table_privilege(r.rolname, c.oid, 'UPDATE') as can_update,
       has_table_privilege(r.rolname, c.oid, 'DELETE') as can_delete,
       has_table_privilege(r.rolname, c.oid, 'TRUNCATE') as can_truncate
  from pg_roles r
 cross join pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where c.relname in ('audit_events', 'platform_audit_chain_head')
   and n.nspname not in ('pg_catalog', 'information_schema')
   and (r.rolcanlogin or r.rolname in (current_user, session_user))
 order by r.rolname, n.nspname, c.relname;

\echo '4. Catalog-level relation ACLs, including PUBLIC and default ACLs'
select n.nspname as schema_name,
       c.relname as object_name,
       pg_get_userbyid(c.relowner) as object_owner,
       case when acl.grantee = 0 then 'PUBLIC'
            else pg_get_userbyid(acl.grantee) end as grantee,
       acl.privilege_type,
       acl.is_grantable
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
 where c.relname in ('audit_events', 'platform_audit_chain_head')
   and n.nspname not in ('pg_catalog', 'information_schema')
 order by n.nspname, c.relname, grantee, acl.privilege_type;

\echo '5. Canonical append function owner, security mode, ACLs, and fixed search_path'
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

select n.nspname as schema_name,
       p.oid::regprocedure as function_signature,
       pg_get_userbyid(p.proowner) as function_owner,
       case when acl.grantee = 0 then 'PUBLIC'
            else pg_get_userbyid(acl.grantee) end as grantee,
       acl.privilege_type,
       acl.is_grantable
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
 where p.proname = 'append_platform_audit_event'
 order by n.nspname, p.oid::regprocedure::text, grantee;

\echo '6. Effective function EXECUTE privilege for every login role'
select r.rolname as candidate_role,
       r.rolcanlogin,
       n.nspname as schema_name,
       p.oid::regprocedure as function_signature,
       pg_get_userbyid(p.proowner) as function_owner,
       p.prosecdef as security_definer,
       has_function_privilege(r.rolname, p.oid, 'EXECUTE') as can_execute
  from pg_roles r
 cross join pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where p.proname = 'append_platform_audit_event'
   and (r.rolcanlogin or r.rolname in (current_user, session_user))
 order by r.rolname, n.nspname, p.oid::regprocedure::text;

\echo '7. Recursive role memberships and role attributes for all login identities'
with recursive relevant_roles(role_oid, origin, role_path_names) as (
  select r.oid, r.rolname, array[r.rolname]::text[]
    from pg_roles r
   where r.rolcanlogin or r.rolname in (current_user, session_user)
      or r.oid in (
        select c.relowner
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where c.relname in ('audit_events', 'platform_audit_chain_head')
           and n.nspname not in ('pg_catalog', 'information_schema')
      )
      or r.oid in (
        select p.proowner
          from pg_proc p
         where p.proname = 'append_platform_audit_event'
      )
  union all
  select m.roleid, rr.origin, rr.role_path_names || granted.rolname
    from relevant_roles rr
    join pg_auth_members m on m.member = rr.role_oid
    join pg_roles granted on granted.oid = m.roleid
   where not (granted.rolname = any(rr.role_path_names))
)
select distinct rr.origin as starting_identity,
       array_to_string(rr.role_path_names, ' -> ') as membership_path,
       r.rolname as role_name,
       r.rolcanlogin,
       r.rolsuper,
       r.rolcreatedb,
       r.rolcreaterole,
       r.rolinherit,
       r.rolbypassrls
  from relevant_roles rr
  join pg_roles r on r.oid = rr.role_oid
 order by starting_identity, membership_path;

\echo '8. Role membership edges and PostgreSQL SET/INHERIT options'
select member_role.rolname as member_role,
       granted_role.rolname as granted_role,
       m.admin_option,
       m.inherit_option,
       m.set_option
  from pg_auth_members m
  join pg_roles member_role on member_role.oid = m.member
  join pg_roles granted_role on granted_role.oid = m.roleid
 where member_role.rolcanlogin
    or member_role.rolname in (current_user, session_user)
    or granted_role.rolname in (current_user, session_user)
    or granted_role.oid in (
      select c.relowner from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relname in ('audit_events', 'platform_audit_chain_head')
        and n.nspname not in ('pg_catalog', 'information_schema')
    )
    or granted_role.oid in (select p.proowner from pg_proc p where p.proname = 'append_platform_audit_event')
 order by member_role.rolname, granted_role.rolname;

\echo '9. Audit mutation triggers and their enabled state'
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
\echo '- EXECUTE should be granted only to intended runtime role(s); PUBLIC should not have EXECUTE.'
\echo '- Review effective privilege rows and recursive membership paths for all login roles, including CREATEROLE, BYPASSRLS, and SUPERUSER.'
\echo '- Superusers and database owners remain privileged trust boundaries; this report alone is not a security certification.'
