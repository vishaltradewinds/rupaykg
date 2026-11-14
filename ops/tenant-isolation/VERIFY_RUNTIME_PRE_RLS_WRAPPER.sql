-- Run with the dedicated DDL acceptance login before RLS activation.
-- The wrapper switches to the intended non-BYPASSRLS application role.
\set ON_ERROR_STOP on
select 1 / case when pg_has_role(session_user, 'rupaykg_app_runtime', 'member') then 1 else 0 end
  as runtime_set_role_membership_assertion;
set role rupaykg_app_runtime;
\i ops/tenant-isolation/VERIFY_PRE_RLS.sql
reset role;
