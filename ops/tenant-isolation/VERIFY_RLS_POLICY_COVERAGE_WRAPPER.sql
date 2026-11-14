-- Run with the dedicated DDL acceptance login after RLS activation.
-- Policy coverage is evaluated as the intended application runtime role.
\set ON_ERROR_STOP on
select 1 / case when pg_has_role(session_user, 'rupaykg_app_runtime', 'member') then 1 else 0 end
  as runtime_set_role_membership_assertion;
set role rupaykg_app_runtime;
\i ops/tenant-isolation/VERIFY_RLS_POLICY_COVERAGE.sql
reset role;
