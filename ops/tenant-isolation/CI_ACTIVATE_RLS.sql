-- CI-only wrapper. Runs only against the disposable PostgreSQL service.
-- Rehearses the DDL-owner and runtime preflights, controlled activation, and
-- post-activation policy coverage under their intended non-BYPASSRLS roles.
\set ON_ERROR_STOP on

set role rupaykg_ddl;
\i ops/tenant-isolation/VERIFY_DDL_ROLE_PRE_RLS.sql
reset role;

set role rupaykg_app_runtime;
\i ops/tenant-isolation/VERIFY_PRE_RLS.sql
reset role;

set role rupaykg_ddl;
\i ops/tenant-isolation/ACTIVATE_RLS.sql
reset role;

set role rupaykg_app_runtime;
\i ops/tenant-isolation/VERIFY_RLS_POLICY_COVERAGE.sql
reset role;
