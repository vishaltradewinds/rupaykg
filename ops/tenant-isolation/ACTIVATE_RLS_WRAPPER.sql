-- Controlled production activation wrapper.
-- Run only after migration 101 is applied and all pre-activation gates pass.
-- The dedicated acceptance login must be NOBYPASSRLS and have SET ROLE
-- membership to rupaykg_ddl. The actual DDL runs as the table-owner role.
\set ON_ERROR_STOP on

select 1 / case
  when exists (
    select 1 from pg_roles login_role
     where login_role.rolname = session_user
       and login_role.rolcanlogin
       and not login_role.rolsuper
       and not login_role.rolbypassrls
       and not login_role.rolcreatedb
       and not login_role.rolcreaterole
       and not login_role.rolreplication
  )
   and pg_has_role(session_user, 'rupaykg_ddl', 'member')
   and not exists (
     select 1 from pg_roles elevated
      where elevated.rolname in ('rupaykg', 'cloud_admin', 'neon_superuser')
        and pg_has_role(session_user, elevated.rolname, 'member')
   )
  then 1
  else 0
end as controlled_ddl_login_assertion;

set role rupaykg_ddl;
\i ops/tenant-isolation/ACTIVATE_RLS.sql
reset role;
