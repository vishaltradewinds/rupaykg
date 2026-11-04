# Production verification-trigger and privilege inspection — 2026-11-04

**Classification:** read-only catalog inspection of authoritative Neon production branch. No SQL writes, DDL, role/grant changes, migrations, or application traffic changes were performed.

## Scope and target
- Neon project: `steep-mud-79906940`
- Branch: `br-restless-base-b44cip2h` (`main`)
- Database: `rupaykg`
- Inspection session role: `rupaykg`
- Queries used only PostgreSQL catalog and privilege introspection (`pg_roles`, `pg_class`, `pg_proc`, `pg_trigger`, `pg_auth_members`, `has_table_privilege`, and `schema_migrations`).

## Findings

### 1. Current production verification trigger is still the legacy pair
The live `public.verifications` table has:
- `verification_independence_guard` BEFORE INSERT -> `enforce_verification_independence()`
- `verifications_integrity_guard` BEFORE INSERT OR UPDATE -> `prevent_invalid_verification()`

The legacy independence function authorizes a verifier by a global membership lookup:
- it does not bind the membership to the activity's organization;
- it does not require the role to belong to the same organization as the membership;
- it accepts role-name fallback `VERIFIER` / `AUDITOR`.

The integrity function checks `m.organization_id = activity_organization_id` and explicit permission aliases for APPROVED decisions, but its role join is only `r.id = m.role_id`; it does not bind `r.organization_id = m.organization_id`. It does not lock evidence/activity/identity/membership/role rows, does not require a VERIFIED organization, and is not the candidate immutable authorization implementation.

**Consequence:** the two-trigger arrangement is contradictory and the global role-name fallback remains a live production risk until a reviewed forward-only replacement is applied with approval. PR #247 proposes dropping both old triggers and installing one authoritative guard; PR #252 adds membership-role tenant integrity; PR #253 adds VERIFIED-organization status. None has been applied to production.

### 2. Production migration ledger still records migration 096
The live `schema_migrations` row is:
- `096_verification_authorization_provenance.sql`
- `2026-10-27T13:46:14.262Z`

This agrees with issue #214's prior read-only evidence. The exact historical SQL was independently recovered from commit `ca8f4100782e13f8d72106187fafc8e1e446214f` and archived byte-for-byte in draft PR #255. This does not prove the exact deployment artifact or prove that the live function body came from that migration; deployment provenance remains unverified.

### 3. No least-privilege application database role was visible
The catalog query returned only these non-`pg_*` roles:
- `rupaykg`: login, owner of the inspected application tables, BYPASSRLS
- `neon_service`: login, BYPASSRLS, member of `neon_superuser`
- `neon_superuser`: NOLOGIN, BYPASSRLS
- `cloud_admin`: login, superuser and BYPASSRLS

The current inspection connection is `rupaykg`. No distinct least-privilege API/runtime role was visible in `pg_roles` or role membership rows. `rupaykg` is a member of `neon_superuser`.

For the inspected roles, `has_table_privilege` returned INSERT/UPDATE/DELETE access on `verifications` and UPDATE access on `evidence`, `activities`, `organization_memberships`, `roles`, `identities`, and `organizations`. The table owner is `rupaykg` for all inspected tables.

**Consequence:** a production least-privilege runtime-role test cannot be truthfully claimed from the current catalog. The current trigger's `SECURITY INVOKER` row-lock privilege concern remains unresolved. Broad UPDATE grants are not an acceptable workaround.

### 4. RLS is not active on inspected security-critical tables
All seven inspected tables (`activities`, `evidence`, `identities`, `organization_memberships`, `organizations`, `roles`, `verifications`) reported:
- `relrowsecurity = false`
- `relforcerowsecurity = false`

This is consistent with the prior production audit. It is a release blocker, not authorization to activate RLS. The policies, ownership, BYPASSRLS roles, and runtime-role behavior must be independently reviewed before any activation plan is approved.

### 5. Delete protection is not established by current privilege state
The inspected `rupaykg` role has DELETE privilege on `verifications`. The current trigger pair does not establish append-only DELETE prevention. PR #247 rejects UPDATE but does not itself reject DELETE. Database-level DELETE denial/guard coverage is therefore a required follow-up.

## Required next work (no production execution)
1. Establish the actual API runtime role from deployment configuration and verify its privileges without exposing secrets. If it is `rupaykg`, the runtime is currently table-owner/BYPASSRLS, which defeats the intended least-privilege boundary.
2. Design a NOLOGIN, NOBYPASSRLS narrowly scoped trigger owner/helper model or a different authorization approach. Specify exact table/column privileges, function ownership, fixed `search_path`, RLS/FORCE RLS semantics, and role-membership restrictions. Never grant broad UPDATE merely to make `FOR SHARE` succeed.
3. Add disposable PostgreSQL tests that run as the exact non-owner API role and the exact trigger execution identity, including INSERT/UPDATE/DELETE attempts and cross-tenant adversarial cases.
4. Define and test a consistent lock order across evidence, activity, organization, identity, membership, and role; test concurrent suspension, revocation, permission changes, and decision insertion.
5. Review immutable provenance columns against UPDATE, DELETE, TRUNCATE, owner/superuser and replication paths; document the limits of each guard.
6. Reconcile migration 096's exact deployment artifact and function/trigger definitions without changing the production ledger.
7. Keep production read-only, RLS unchanged, and release HOLD until independent DBA/security review and explicit founder approval.

## Explicit exclusions
No production DDL/DML, migrations, grants, role changes, RLS changes, trigger changes, deployment, PR merge, or certification were performed. This report is evidence only.
