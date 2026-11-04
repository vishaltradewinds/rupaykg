# Actual-schema verification non-owner role proof — 2026-11-04

**Classification:** disposable PostgreSQL CI proof using the repository migration chain and the exact candidate verification migration copied from draft PR #247. This is not a production role/grant plan.

## Reproducible inputs

- Candidate source: draft PR #247, branch `security/verification-authorization-tenant-binding-2026-11-04`.
- Candidate migration source blob: `aedfa320bcd92829342750eba57a8acf6284bfe6`.
- CI fixture copy: `scripts/fixtures/20261104_verification_authorization_tenant_binding.sql`.
- Test: `scripts/test-verification-actual-schema-role.sql`.
- Workflow: `.github/workflows/ci.yml`, ephemeral GitHub Actions PostgreSQL 16 only.

The fixture migration is deliberately stored outside `migrations/`; it is not an active migration and must never be applied by a deployment runner.

## Test setup

The test applies the repository migration chain, then the exact candidate migration. It creates a non-owner role with `NOLOGIN`, `NOSUPERUSER`, and `NOBYPASSRLS`, then grants:

- INSERT on `verifications`;
- SELECT on the trigger's read set;
- column-scoped `UPDATE(id)` on evidence, activities, organization memberships, roles and identities, solely to satisfy PostgreSQL's `SELECT ... FOR SHARE` privilege requirement;
- SELECT on geography and organization geography scopes, plus EXECUTE on `organization_has_geography_scope(uuid, uuid)`.

It does not grant table-wide UPDATE, DELETE, or direct SELECT on verifications. The test executes a verification insert as the non-owner role and checks the authorization snapshot.

## Observed result

The candidate SECURITY INVOKER trigger successfully inserts a verification under this non-owner privilege set and captures the authorization membership, role, permission snapshot and checked-at timestamp. Column-scoped `UPDATE(id)` is sufficient in the actual repository schema; broad table UPDATE is not required for this mechanics test.

The same test deliberately checks visibility of a second tenant's evidence. It confirms that the non-owner API role can read that row on the current migration baseline because RLS is not enabled on the relevant tables. This is an explicit, reproducible isolation blocker, not a passing tenant-isolation test.

## What this does not establish

- It does not establish the live Render API database role or its grants.
- It does not establish that RLS policies are correctly designed, enabled or forced.
- It does not establish trusted tenant or identity context. A caller-controlled custom PostgreSQL setting is not authenticated authority.
- It does not validate a SECURITY DEFINER helper owner, its exact RLS policy set, function ownership, or bypass paths.
- It does not solve organization VERIFIED-status concurrency or geography-scope mutation races.
- It does not establish append-only behavior against DELETE, TRUNCATE, owner, superuser or replication paths.
- It is not independent DBA/security review and does not authorize production changes.

## Required engineering gates

1. Prove an authenticated, non-spoofable tenant and verifier identity context from the API session to PostgreSQL.
2. Design and test tenant policies for evidence, activities, memberships, roles, identities, organizations, geography scopes and any supporting lookup tables.
3. Decide whether the trigger remains SECURITY INVOKER with a tightly scoped API role or moves to a SECURITY DEFINER helper. If using a helper, prove ownership, fixed search path, NOLOGIN/NOBYPASSRLS, exact table/column grants, RLS behavior and role-membership restrictions.
4. Lock organization status and geography-scope authority in a documented global lock order; test concurrent verification against organization suspension and scope revocation.
5. Test INSERT, UPDATE, DELETE, TRUNCATE, direct function invocation, role assumption, owner and replication paths.
6. Verify the exact Render runtime identity without retrieving or exposing credentials.
7. Obtain independent DBA/security review before any migration, grant, RLS, role, deployment or release action.

**Release posture:** production remains read-only / HOLD. No persistent database or role was modified. This proof is engineering evidence only; it is not production certification or TRL 9 evidence.
