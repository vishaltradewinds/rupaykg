# RupayKg — Least-Privilege Database Role Provisioning and Rehearsal Specification

**Status:** Engineering specification for independent DBA/security review  
**Date:** 2026-11-03  
**Applies to:** Neon project `steep-mud-79906940`, production-derived rehearsal branch only  
**Production posture:** HOLD — no production role, grant, ownership, RLS, migration, or deployment changes are authorized by this document.

## 1. Purpose and evidence baseline

A fresh child branch, `verification-authz-rehearsal-2026-11-03` (`br-twilight-base-b4eec0j6`), was inspected using catalog SELECTs only. The child was created from production branch `br-restless-base-b44cip2h`.

Observed facts:

- The production-derived child has the 92-row migration ledger through `20261021`.
- The relevant existing login role is `rupaykg`. It has `BYPASSRLS`, `CREATEDB`, `CREATEROLE`, `INHERIT`, and `REPLICATION` attributes.
- `rupaykg` is a member of `neon_superuser`; the membership has `INHERIT TRUE`, `SET TRUE`, and `ADMIN OPTION FALSE`.
- The following proposed roles are absent: `rupaykg_app_runtime`, `rupaykg_security_definer`, `rupaykg_auth_owner`, `rupaykg_bootstrap_owner`, `rupaykg_bootstrap_custodian`, `rupaykg_bootstrap_custodian_a`, and `rupaykg_bootstrap_custodian_b`.
- RLS and FORCE RLS are disabled on the inspected `verifications`, `epr_returns`, `organization_memberships`, and `roles` tables on this child.

These findings are a baseline, not a permission to modify the child. No DDL/DML, role or grant changes, or migrations were performed.

## 2. Non-negotiable design rules

1. The application must never connect as `rupaykg`, `neon_superuser`, a table owner, or a migration owner.
2. No application-facing role may have `SUPERUSER`, `BYPASSRLS`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, `INHERIT`, ownership of protected objects, or membership in a privileged role.
3. Security-definer function owners must be dedicated `NOLOGIN`, `NOBYPASSRLS`, `NOINHERIT` roles with no memberships and no elevated attributes.
4. All SECURITY DEFINER functions must use a fixed, safe `search_path`, schema-qualified object references, narrowly granted EXECUTE, and reviewed function bodies.
5. FORCE RLS must be enabled for tenant-owned tables after policies and grants have been tested using the exact application principal.
6. No migration may grant broad table access merely to make an application route work.
7. Migration/DBA elevation must be time-bounded, documented, reviewed, and revoked after the rehearsal. No persistent application membership in an elevated role.
8. A missing role, missing policy, missing grant, unknown migration, or failed acceptance test must stop the rehearsal. Do not skip or weaken preflight checks.
9. The single authoritative production database remains the Neon production branch. Rehearsal children are disposable and never production authority.
10. This specification does not authorize provisioning or execution. Obtain independent DBA approval before applying even on a rehearsal child.

## 3. Proposed role inventory and purpose

| Role | LOGIN | Purpose | Ownership / privilege boundary |
|---|---:|---|---|
| `rupaykg_app_runtime` | Yes | API runtime connection identity | NOBYPASSRLS, NOINHERIT, no role memberships; only explicitly enumerated runtime grants |
| `rupaykg_security_definer` | No | Owner of narrowly scoped security helper functions and, only if justified, signing-key verifier objects | NOBYPASSRLS, NOINHERIT, no memberships; no broad schema/database privileges |
| `rupaykg_auth_owner` | No | Optional owner for authentication schema objects if separated from security helper ownership | NOBYPASSRLS, NOINHERIT, no memberships |
| `rupaykg_bootstrap_owner` | No | Optional owner of bootstrap ceremony objects/functions | NOBYPASSRLS, NOINHERIT, no memberships |
| `rupaykg_bootstrap_custodian_a` | Yes, controlled | First independent bootstrap custodian | No application/table ownership; narrowly scoped one-time ceremony EXECUTE only |
| `rupaykg_bootstrap_custodian_b` | Yes, controlled | Second independent bootstrap custodian | Must be a distinct natural-person-controlled identity from custodian A; narrowly scoped one-time ceremony EXECUTE only |
| `rupaykg` | Existing | DBA/migration connection identity | Treat as elevated; never app runtime or SECURITY DEFINER owner |

Role names above are proposed names already referenced by candidate code; their exact necessity, separation, and Neon support must be confirmed by the DBA before provisioning. Do not create redundant owner roles if a documented ownership model shows one is unnecessary.

## 4. Privilege design

### 4.1 Application runtime

The runtime principal must:

- Have LOGIN, NOBYPASSRLS, NOINHERIT.
- Have no memberships in any other role (including owner, bootstrap, migration, or Neon administrative roles).
- Have USAGE only on schemas needed for its API queries.
- Have explicit SELECT/INSERT/UPDATE/DELETE grants per route/table contract; never blanket grants on `public`.
- Have no CREATE on database, public schema, or security schema.
- Have no access to signing secrets/key material, bootstrap tokens, migration ledgers, or administrative tables.
- Not own protected tables, sequences, schemas, or functions.
- Be tested using the actual login role, not `SET ROLE` from the elevated owner as a substitute.

### 4.2 Security-definer owner

The security-definer owner must:

- Be NOLOGIN, NOBYPASSRLS, NOINHERIT and have no role memberships.
- Own only reviewed SECURITY DEFINER functions and the minimum supporting security objects explicitly approved.
- Have only the table/schema privileges required by those functions.
- Not own tenant business tables merely to bypass RLS.
- Not be granted database CREATE, CREATEROLE, CREATEDB, REPLICATION, or BYPASSRLS.
- Use `SET search_path = pg_catalog, app_security` (or another exact, reviewed fixed path) and schema-qualified references for every non-catalog object.
- Expose no generic SQL execution, arbitrary row-returning interface, or caller-controlled dynamic SQL.

**Important design decision:** the current EPR route calls `hasOrganizationPermission()`, which directly queries `organization_memberships` and `roles`. The EPR startup contract currently checks EPR table privileges and the signed-context verifier, but does not fully attest the runtime's ability to perform this authorization query safely. Before provisioning, decide and test one of these patterns:

A. A narrowly scoped SECURITY DEFINER boolean permission-check function that validates the signed request-context actor and organization itself, enforces verified membership and explicit permission keys, and returns only a boolean; or

B. Direct runtime SELECT with carefully designed RLS policies on both membership and role/permission data, proving that no cross-tenant membership or role data is exposed.

Do not simply grant broad SELECT on membership/role tables. The function approach must not trust caller-supplied actor/org identifiers without independently binding them to the signed context. It must be reviewed for SECURITY DEFINER search-path, owner, grants, RLS interaction, and negative tests.

### 4.3 Bootstrap custodians

- Custodians must be distinct and independently authenticated outside the application database.
- A non-empty `external_subject` plus a VERIFIED database row is not, by itself, proof of authentication by the intended external identity provider or required assurance level.
- Define external IdP issuer/audience, immutable subject binding, authentication assurance, recovery, revocation, audit, and custody separation before a real ceremony.
- Any one-time claim/nonce must be single-use, expiry-bound, replay-resistant and concurrency-safe.
- Do not execute a live bootstrap ceremony in the rehearsal without explicit authorization and the independent identity proof procedure.

### 4.4 Migration principal

- Document which DBA-controlled principal executes migrations on Neon and how it receives temporary authority.
- Do not assume a SQL migration can safely create/grant roles on Neon merely because the current `rupaykg` login can inherit or SET ROLE to `neon_superuser`.
- Record exact pre-state, requested privilege delta, approver, execution operator, time, and post-state.
- Revoke temporary membership/grants after the rehearsal and verify no inherited or SET ROLE path remains.
- The migration runner must verify the exact source catalogue and checksums before any schema change.

## 5. Required preflight assertions

The rehearsal must stop unless all assertions pass:

1. Each role exists with the exact approved LOGIN/NOLOGIN, SUPERUSER, BYPASSRLS, CREATEDB, CREATEROLE, INHERIT, REPLICATION attributes.
2. Application and function-owner roles have zero unexpected inbound/outbound memberships; inspect both membership graph and effective privileges.
3. The runtime cannot SET ROLE to any privileged role and cannot inherit any elevated privilege.
4. The security-definer owner cannot login and cannot bypass RLS.
5. Every security-definer function has the expected owner, `prosecdef`, fixed `proconfig/search_path`, schema-qualified body, and exact EXECUTE grants.
6. Signing-key tables are not readable or writable by the runtime; only the reviewed verifier can access them.
7. Protected table owners are not application roles. FORCE RLS is set where required.
8. RLS policies are enumerated with exact roles, commands, USING and WITH CHECK expressions. Policy count alone is not sufficient.
9. Runtime grants are enumerated table-by-table and column-by-column where possible; include sequences, functions, schemas, database privileges, default privileges, PUBLIC grants, and inherited privileges.
10. The route authorization source (membership/role) is available only through the reviewed RLS or boolean helper design.
11. No function owned by an elevated login can be invoked by runtime unless explicitly approved and proven safe.
12. The migration ledger and source checksums match the reviewed release catalogue exactly.

## 6. Rehearsal sequence — serialized changes, parallel evidence

**Gate 0 — Independent approval**
- DBA/security reviewer approves role inventory, ownership model, Neon execution path, temporary migration elevation and rollback.
- No DDL before this approval.

**Gate 1 — Disposable baseline capture**
- Create a new disposable child from the authoritative production branch.
- Capture role attributes, membership graph, object owners, schema/database/table/sequence/function grants, RLS flags/policies, triggers, functions, and migration ledger.
- Hash the exact source SQL bytes and record commit/blob provenance.

**Gate 2 — Role provisioning**
- DBA provisions only approved roles on that child using the supported Neon control plane or approved DBA path.
- Verify all preflight assertions before any application migration.
- Record exact before/after catalog diff.

**Gate 3 — Canonical security foundation**
- Apply the reviewed signed request-context and verifier foundation in dependency order.
- Apply the unified verification-decision authorization function and immutable snapshot trigger only after the contract and negative tests are approved.
- Apply the EPR read policy only after the runtime authorization-source design is proven.
- Keep EPR feature flag OFF.

**Gate 4 — Acceptance**
- Execute tests as the actual `rupaykg_app_runtime` login principal.
- Test both permitted and denied paths, cross-tenant reads, forged/expired/missing context, revoked membership, permission revocation, role-name-only membership, pending/unverified identity, self-verification, evidence/activity mismatch, geography failure, snapshot mutation, UPDATE/DELETE and concurrent revocation.
- Exercise the real Fastify route, not only direct SQL.
- Confirm RLS policies and table/function privileges after tests.

**Gate 5 — Reconciliation and cleanup**
- Compare exact migration ledger, source hashes, objects, owners, grants, policies, triggers, functions and sequence state against the approved expected state.
- Revoke temporary migration memberships and verify no effective privilege remains.
- Destroy the disposable branch only after evidence is exported and retention approval is recorded; do not delete it autonomously.

**Gate 6 — Independent release decision**
- Separate reviewer signs off code, migration provenance, database security, route tests, rollback, monitoring and pilot readiness.
- Only then may a separate explicit production change request be considered. This document is not that request.

## 7. Required test matrix

| Area | Positive test | Negative test |
|---|---|---|
| Runtime role | Login and required route works | Cannot SET ROLE, CREATE, BYPASSRLS or access secrets |
| Tenant RLS | Tenant A sees A rows | Tenant A cannot see B rows or any rows without valid signed context |
| Membership authority | Verified active same-org membership with explicit permission succeeds | Pending/revoked/cross-org membership or role-name-only authority denied |
| Geography | Verified scope contains activity geography | Missing, pending, unverified or non-containing scope denied |
| Verifier | Independent verified verifier records decision with complete snapshot | Self-review, suspended identity, unverified identity, missing permission denied for APPROVED and REJECTED |
| Evidence binding | Evidence maps to exact activity/organization | Missing or mismatched evidence/activity/organization rejected |
| Immutability | Insert stores complete decision snapshot | UPDATE/DELETE/tampering rejected outside governed correction process |
| Bootstrap | Two distinct externally authenticated custodians complete controlled ceremony | Same custodian, forged IdP subject, expired/replayed token or revoked custodian denied |
| EPR route | Real route returns 200 and only tenant-owned returns | 401/403/503 fail-closed; no cross-tenant rows; runtime permission query is proven safe |
| Migration provenance | Exact ordered source catalogue matches checksums and ledger | Missing, duplicate, altered or divergent migration source blocks execution |

## 8. Rollback and operational controls

- Rehearsal rollback means discard/recreate the disposable child from the same approved parent; do not attempt ad-hoc destructive cleanup that obscures evidence.
- Any partial migration failure stops the sequence. Capture transaction status and catalog diff before deciding whether to retry.
- Production rollback requires a separately reviewed forward-fix or tested restore plan; never assume DDL is trivially reversible.
- Keep workers, schedulers, EPR writes, registry issuance, settlement and certification disabled throughout this rehearsal.
- Record monitoring for permission-denied spikes, signed-context verification failures, RLS policy violations, database connection identity drift and unexpected role memberships.

## 9. Exit criteria

The rehearsal is complete only when:

- An independent DBA approves the role model and confirms exact Neon execution semantics.
- All preflight checks pass using catalog evidence.
- Exact runtime login and exact SECURITY DEFINER owner have the intended effective privileges.
- Verifier and EPR negative-test matrices pass on a disposable branch.
- The migration catalogue, production ledger and staging/rehearsal divergence are reconciled with exact source hashes and deployment provenance.
- No application path uses the elevated `rupaykg` login.
- All temporary grants/memberships are revoked and verified.
- Independent code, security and operations reviews are recorded.

**Current disposition: NOT READY.** This specification is a reviewable engineering artifact, not proof that the roles have been provisioned, migrations applied, tenant isolation enabled, or TRL 9 achieved.
