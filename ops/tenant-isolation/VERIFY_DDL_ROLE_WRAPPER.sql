-- Run with the dedicated NOBYPASSRLS DDL login connection URL. The login
-- must have SET ROLE membership to both rupaykg_ddl and rupaykg_app_runtime.
-- The elevated postgres login is accepted only by disposable CI.
\set ON_ERROR_STOP on
select 1 / case
  when session_user = 'postgres' then 1
  when exists (select 1 from pg_roles where rolname=session_user and rolcanlogin and not rolsuper and not rolbypassrls)
   and pg_has_role(session_user,'rupaykg_ddl','member')
   and pg_has_role(session_user,'rupaykg_app_runtime','member')
  then 1 else 0
end as controlled_ddl_login_assertion;
set role rupaykg_ddl;
\i ops/tenant-isolation/VERIFY_DDL_ROLE_PRE_RLS.sql
reset role;
