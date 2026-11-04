# Verification guard execution under a non-owner runtime — design proposal

**Date:** 2026-11-04  
**Status:** DISPOSABLE POSTGRESQL PROTOTYPE PASSED — PRODUCTION DESIGN NOT IMPLEMENTED OR APPROVED
**Related:** PR #247, issues #196 and #215

## Problem statement

The candidate verification trigger uses `SELECT ... FOR SHARE` against evidence, activities, organization memberships, roles and identities. PostgreSQL requires the locking query to have UPDATE privilege on at least one column of each locked table. Giving the API runtime broad UPDATE rights would violate least privilege; giving it UPDATE on a primary-key column would still create an unacceptable mutation capability. The current production runtime/table-owner role is BYPASSRLS-capable, so it cannot serve as the future tenant-isolated API identity.

## Candidate architecture to prototype

Use a dedicated, non-login guard execution role that owns only the SECURITY DEFINER trigger function and is not a table owner:

- Role attributes: `NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION`.
- No membership from the API runtime role; no API `SET ROLE` path.
- Grant the guard role `SELECT` on the exact required source columns/tables and column-level `UPDATE(id)` only on the five rows that the trigger locks. Do not grant table-level UPDATE. The disposable prototype demonstrated that column privilege alone is insufficient under FORCE RLS: an exact-row UPDATE policy is also required for SELECT ... FOR SHARE visibility. The UPDATE policy must pin both USING and WITH CHECK to the transaction-local row id; the guard can lock the row but cannot change its identifier. No other column UPDATE or DELETE grant is given.
- Make the guard function `SECURITY DEFINER`, owned by this role, with fixed `search_path = pg_catalog, trusted_schema, pg_temp` (pg_temp last), schema-qualified table/function references, no dynamic SQL, and `row_security = on`.
- Revoke direct EXECUTE from PUBLIC and the API runtime. The function is invoked only by the database trigger. Confirm in PostgreSQL that trigger execution still succeeds when the caller lacks EXECUTE.
- Add SELECT RLS policies and exact-row UPDATE lock policies for the guard role on evidence, activities, identities, memberships and roles. Each UPDATE policy pins both USING and WITH CHECK to the exact row id carried in transaction-local guard context. Geography-scope rows remain read-only in this prototype; their concurrent revocation semantics remain open. The global geography reference catalog may be read-only to the guard role for ancestor traversal.
- Function sets and restores custom transaction-local GUCs (`set_config(..., true)`) before each source-row lookup. Policies return no rows when guard context is absent. The disposable test uses a real password-authenticated API LOGIN role: it can set spoofed custom GUCs but still sees zero evidence rows because policies target only the inaccessible guard role. The trigger restores caller GUC values after successful and rejected decisions.
- Keep the guard role distinct from table owners and ensure it has no BYPASSRLS. FORCE RLS must apply to it.
- Provision role ownership/grants through the dedicated migrator/DBA path, never through the web API credential. Verify the actual managed-Postgres CREATEROLE/role-membership semantics before encoding role creation into a production migration.

## Required lock contract

The proposed deterministic lock order is:

1. Evidence row.
2. Activity row.
3. Verifier identity row.
4. Exact organization membership row.
5. Exact organization role row.

The trigger must read the permission only after the corresponding row lock is held. All other transactions that touch more than one of these rows must be audited for compatible lock order. In particular, inspect platform-admin membership/role changes and evidence/activity reassignment paths. Do not infer deadlock freedom from the existing three single-resource revocation race tests.

## Disposable PostgreSQL proof required

Run on a fresh disposable database and a production-like schema with recovered 096 columns and both historical trigger names:

- Create a real non-owner API role and the NOLOGIN guard role; prove both are `rolbypassrls = false`, and guard `rolcanlogin = false`.
- Enable and FORCE RLS on the relevant tenant tables with guard-context policies. Prove guard SELECT sees exactly the evidence/activity/identity/membership/role rows needed and zero rows with missing/cleared context.
- Prove API runtime cannot `SET ROLE` to guard, cannot execute the trigger function directly, cannot UPDATE/DELETE source rows, but can perform an authorized verification INSERT that fires the trigger.
- Prove cross-organization membership and cross-organization role binding are denied; valid same-org APPROVED and REJECTED decisions remain supported.
- Repeat role-permission revocation, membership deactivation and identity suspension races under the non-owner API role with FORCE RLS enabled.
- Add evidence/activity reassignment and geography-scope mutation races; inspect lock waits, deadlocks, statement/lock timeouts and bounded retry behaviour.
- Verify UPDATE/DELETE/truncate/tamper controls and that only a separately controlled owner can alter/delete immutable verification records.
- Compare function owner, ACL, trigger definitions, policy expressions, search_path and grants before/after reapplying the candidate migration over exact historical 096 function body and trigger composition.

## Alternatives not yet accepted

A transaction-scoped advisory-lock design could avoid UPDATE privileges on tenant tables, but only if every relevant mutation path acquires the same deterministic lock and post-wait authorization reads see the newly committed state under the actual isolation level. Trigger-time snapshot freshness and complete mutation-side coverage are not yet proven. Do not replace row locks with advisory locks without those tests.

A SECURITY DEFINER function owned by the existing `rupaykg` BYPASSRLS/table-owner role is rejected: it would undermine the intended FORCE RLS boundary.

## Decision gate

This is a prototype plan, not a production migration or approval. Do not add broad UPDATE to the API role, alter production roles/grants/ownership/RLS, apply the candidate migration, deploy, merge or certify based on this proposal. Independent DBA/security review is required before any release decision.


## Run 28 — disposable PostgreSQL prototype evidence (2026-11-04)

**Prototype PR:** #263 (OPEN / DRAFT / UNMERGED)
**Exact head:** `1ce986d3e5ceab339a77fd1d64d4911b0fbabad4`
**CI:** #5407 / run `41804235750` — SUCCESS across all stages, including disposable PostgreSQL acceptance and production-container build. Earlier exact head `178e7c77bb5c848fdef27281acdf6a404894d0d4` also passed CI #5402.

The isolated-schema fixture created a NOLOGIN/NOSUPERUSER/NOBYPASSRLS guard role and a separate password-authenticated LOGIN/NOSUPERUSER/NOBYPASSRLS API role. The guard role owned only the SECURITY DEFINER trigger function, not the tenant tables. The API role had no EXECUTE privilege on the trigger function and could not SET ROLE to guard.

The prototype established an important PostgreSQL detail: SELECT ... FOR SHARE under FORCE RLS requires both the narrow column UPDATE(id) privilege and a matching UPDATE RLS policy. Exact-row USING and WITH CHECK policies tied to transaction-local row-id GUCs made the row lock succeed while preventing identifier mutation. The guard received no table-level UPDATE and no DELETE grants. The function uses a fixed search_path with pg_catalog first and pg_temp last, and row_security=on.

The actual API login could spoof the custom GUC values but still saw zero evidence rows because policies target only the inaccessible guard role. The trigger restored the API's prior GUC values after successful and failed attempts. Disposable PostgreSQL tests passed for valid same-org verification, cross-org evidence, self-verification, out-of-scope geography, suspended identity, and concurrent role-permission revocation, membership deactivation and identity suspension. The API could not UPDATE/DELETE verification rows; owner-side UPDATE was rejected by the immutable trigger.

**Boundary:** this is an isolated-schema privilege prototype, not a production migration or a rehearsal against the recovered migration-096 production schema. It does not establish Neon role-provisioning feasibility, actual production grants/RLS, geography-scope mutation race safety, evidence/activity reassignment race safety, global lock-order/deadlock/timeout/retry behavior, or independent DBA/security approval. The fixture's geography helper has configured test scope; production's no-verified-scope permissive behavior remains a separate fail-closed blocker.

Temporary validation PR #264 was closed UNMERGED after CI #5407 passed. Production remains READ-ONLY / HOLD; no production or staging writes, role/grant changes, migrations, RLS activation, deployment, merge or certification occurred.
