-- CI-only wrapper. Runs only against the disposable PostgreSQL service.
-- The workflow connects as postgres and temporarily assumes the non-BYPASSRLS
-- DDL owner to exercise the same fail-closed activation script used in release.
\set ON_ERROR_STOP on
set role rupaykg_ddl;
\i ops/tenant-isolation/ACTIVATE_RLS.sql
reset role;
