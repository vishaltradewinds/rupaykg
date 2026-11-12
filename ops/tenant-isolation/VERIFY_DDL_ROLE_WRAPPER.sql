-- Run with the controlled DDL connection URL. The login must be allowed
-- to SET ROLE to rupaykg_ddl; all assertions execute as the non-BYPASSRLS
-- owner role rather than the connection login.
\set ON_ERROR_STOP on
set role rupaykg_ddl;
\i ops/tenant-isolation/VERIFY_DDL_ROLE_PRE_RLS.sql
reset role;
