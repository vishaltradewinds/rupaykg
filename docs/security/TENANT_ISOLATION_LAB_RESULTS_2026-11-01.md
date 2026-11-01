# Tenant isolation disposable Neon lab — 2026-11-01

**Project:** `steep-mud-79906940`
**Disposable child branch:** `br-blue-tooth-b4kvuut7` (`rupaykg-tenant-isolation-lab-20261101`)
**Parent:** production branch `br-restless-base-b44cip2h`
**Database:** `rupaykg`
**Scope:** role and RLS behavior proof only. No production branch DDL/DML, grants, role changes, secrets, or deployments.

## Lab setup

Created two branch-local SQL roles on the disposable child branch:
- `rupaykg_rls_lab_owner_20261101`: NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS, NOINHERIT.
- `rupaykg_rls_lab_app_20261101`: LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS, NOINHERIT.

Created an isolated schema `tenant_isolation_lab`, one test table with a non-null `organization_id`, enabled and forced RLS, and installed a transaction-context policy using `NULLIF(current_setting('app.organization_id', true), '')::uuid`. The application role received only schema USAGE and table CRUD grants.

Two synthetic rows were inserted for two synthetic organization UUIDs. No real user or organization records were modified.

## Results

**PASS — disposable lab only**

1. Runtime role has `rolbypassrls=false`, `rolsuper=false`, `rolcreaterole=false`, `rolcreatedb=false`, and `rolreplication=false`.
2. With tenant A context, SELECT returns only tenant A's row.
3. With tenant A context, UPDATE targeting tenant B affects zero rows.
4. With tenant A context, INSERT for tenant B is rejected by RLS `WITH CHECK`.
5. With missing/empty tenant context, SELECT returns zero rows.
6. Table owner role is also constrained because FORCE ROW LEVEL SECURITY is enabled.
7. Owner role is NOLOGIN and NOBYPASSRLS.
8. Runtime role has only USAGE (not CREATE) on the public schema and no SELECT/INSERT privilege on the existing public `activities` table; an attempted read is rejected. It is not a member of the lab owner role.

All assertions ran in a Neon SQL transaction on the child branch and completed successfully.

A post-test read-only verification on the production parent confirmed branch ID `br-restless-base-b44cip2h`, 67 public tables, 0 RLS-enabled tables, 0 lab roles on production, and 0 `tenant_isolation_lab` schemas on production. This confirms the lab objects remained branch-local.

## What this proves — and what it does not

Proves the basic Postgres role attributes, policy shape, `USING`, `WITH CHECK`, missing-context fail-closed behavior, and FORCE RLS behavior can be made to work in an isolated branch.

Does not prove:
- Production role replacement or object ownership transfer.
- The application's actual pooled connection setup, transaction wrapper, or authentication-to-tenant context binding.
- All 67 production table policy semantics, especially identity-owned, inherited-child, multi-party, regulator, worker, global-reference, append-only, and platform-control tables.
- SQL-injection containment. A role able to set arbitrary custom GUCs can spoof a GUC-based tenant context; this remains defense-in-depth unless a separately threat-modelled trusted-context mechanism is implemented.
- Production performance, backup/restore, failover, or operational recovery.

## Next lab gates

1. Inspect application DB connection helper and route query paths.
2. Implement a single transaction wrapper that derives identity and active organization from verified authentication and current VERIFIED membership.
3. Prove pooled connection reuse cannot leak context and that revoked memberships fail on the next transaction.
4. Create table-by-table owner/reader/writer policy matrix, including multi-party visibility and parent-derived ownership.
5. Apply policies in disposable branch groups and run cross-tenant adversarial tests for SELECT/INSERT/UPDATE/DELETE.
6. Test runtime login using the exact connection mechanism intended for Render, without granting runtime membership in privileged roles.
7. Only after all lab gates pass, prepare a separately reviewed production role cutover. No production change is authorized by this lab.

## Current release posture

Production remains HOLD. Production RLS remains 0/67. TRL 9 is not established.
