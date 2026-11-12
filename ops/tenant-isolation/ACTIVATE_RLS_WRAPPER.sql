-- Controlled production activation wrapper.
-- Run only after migration 101 is applied and all pre-activation gates pass.
-- The dedicated acceptance login must be NOBYPASSRLS and have SET ROLE
-- membership to rupaykg_ddl. The actual DDL runs as the table-owner role.
\set ON_ERROR_STOP on

select 1 / case
  when session_user = 'postgres' then 1 -- disposable CI only
  when exists (
    select 1 from pg_roles
     where rolname = session_user
       and rolcanlogin
       and not rolsuper
       and not rolbypassrls
  )
   and pg_has_role(session_user, 'rupaykg_ddl', 'member')
  then 1
  else 0
end as controlled_ddl_login_assertion;

set role rupaykg_ddl;
\i ops/tenant-isolation/ACTIVATE_RLS.sql
reset role;
