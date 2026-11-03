# RupayKg — Verification Decision Authorization Contract

**Status:** Security contract for implementation and independent review; not a migration  
**Date:** 2026-11-03  
**Baseline:** Production-derived Neon rehearsal child `br-twilight-base-b4eec0j6`, inspected read-only  
**Related:** PR #192, Issue #215, PR #222  
**Release state:** HOLD. This document authorizes no DDL, DML, role changes, RLS activation, merge or deployment.

## 1. Objective

Define one database-enforced authorization contract for both `APPROVED` and `REJECTED` verification decisions. A verification row is a legally and operationally significant decision record. Its subject, decision-maker authority, organization boundary, geography boundary, and authorization snapshot must be resolved from database records at insert time, not inferred from role names or trusted from client input.

The database must reject an invalid decision before persistence. The API must not be able to bypass the contract by choosing another route or direct insert path.

## 2. Observed baseline facts

Read-only inspection of the production-derived rehearsal child confirmed:

### 2.1 Existing triggers

- `verification_independence_guard`: BEFORE INSERT, calls `public.enforce_verification_independence()`.
- `verifications_integrity_guard`: BEFORE INSERT OR UPDATE, calls `public.prevent_invalid_verification()`.

Both trigger functions are owned by `rupaykg`, are not SECURITY DEFINER, have no fixed `search_path`, and run as invoker.

### 2.2 Existing global independence function

`enforce_verification_independence()`:
- Resolves activity actor through `evidence` only.
- Rejects self-verification only when that evidence lookup resolves an actor.
- Searches all organizations for a VERIFIED membership belonging to the verifier.
- Accepts either JSON permission `VERIFY_EVIDENCE` or role-name fallback `VERIFIER` / `AUDITOR`.
- Does not bind that membership to the subject activity organization.
- Does not check identity status or suspension.

### 2.3 Existing integrity function

`prevent_invalid_verification()`:
- Resolves activity from `evidence_id` when present and rejects a missing/unbound evidence row.
- Rejects an explicit `activity_id` that differs from the evidence activity.
- For `APPROVED` only, requires activity organization, no self-review, verified active identity, verified membership in the activity organization, and one of three permission spellings.
- Populates authorization membership, role, permissions and checked-at snapshots only for `APPROVED`.
- Does not apply equivalent authority checks to `REJECTED`.
- Does not require the subject organization itself to be VERIFIED.
- Does not enforce decision/snapshot immutability on UPDATE or DELETE.

### 2.4 Geography helper is currently fail-open

The current `public.organization_has_geography_scope(organization_id, geography_id)` returns TRUE when the organization has **no VERIFIED geography-scope rows**. This is fail-open behavior. A later candidate migration may replace this helper, but the production-derived baseline still has this behavior. A new verifier function must not rely on the helper unless its exact deployed definition is changed and independently tested to fail closed.

### 2.5 Relevant schema

- `verifications`: `id`, nullable `evidence_id`, nullable `activity_id`, non-null `verifier_identity_id`, enum `decision` (`APPROVED`, `REJECTED`), non-null `scope`, optional rationale, `decided_at`, plus four nullable authorization snapshot fields.
- `evidence`: `id`, nullable `activity_id`, evidence status, capture metadata and identity.
- `activities`: `id`, non-null `organization_id`, optional `actor_identity_id`, nullable `geography_id`.
- `identities`: `id`, `status`, `suspended_at`.
- `organization_memberships`: `id`, `identity_id`, `organization_id`, `role_id`, `status`, revocation metadata.
- `roles`: `id`, `organization_id`, `permissions` JSONB, `name`.
- `organizations`: `status` enum and `verification_status` text; the latter is constrained to `PENDING`, `UNDER_REVIEW`, `VERIFIED`, or `REJECTED`.
- `organization_geography_scopes`: `organization_id`, `geography_id`, `status`.
- `geography`: `id`, `parent_id`, `kind`, `valid_from`, `valid_to`; the inspected table has **no status column**.

Enum values observed: `record_status = VERIFIED | PENDING | REJECTED | UNAVAILABLE | DEMO | SIMULATED`; `verification_decision = APPROVED | REJECTED`.

The inspected child has zero rows in `verifications`; no data backfill was indicated by this check. The inspected schema confirms `geography` has no status field, `roles` are organization-owned, and memberships can have multiple roles per identity/organization.

## 3. Canonical subject-resolution contract

A decision must have a resolvable subject activity and organization.

1. Require either a valid `evidence_id` or an `activity_id` according to the product contract; do not silently accept a decision with neither.
2. If `evidence_id` is supplied, the evidence row must exist and have a non-null `activity_id`.
3. If both `evidence_id` and `activity_id` are supplied, they must resolve to the same activity.
4. Resolve the activity row. It must exist and have a non-null `organization_id`.
5. Resolve the activity actor and geography from the activity row, not client-supplied fields.
6. The subject organization must exist. For APPROVED, require both `organizations.status = 'VERIFIED'` and `organizations.verification_status = 'VERIFIED'`; the inspected schema has both fields and `verification_status` is constrained. Do not accept DEMO/SIMULATED/PENDING as a real verified subject.
7. If product semantics require evidence for every verification, make `evidence_id` NOT NULL in a separately reviewed schema change after auditing existing callers. Until then, enforce the agreed decision contract consistently for both decisions.

No decision may be persisted when subject resolution is incomplete or contradictory.

## 4. Canonical verifier authority contract — applies to BOTH decisions

For `APPROVED` and `REJECTED`, require all of the following at decision insert time:

1. `verifier_identity_id` resolves to exactly one identity.
2. Identity `status = 'VERIFIED'` and `suspended_at IS NULL`.
3. A membership exists for that identity in the exact organization resolved from the subject activity.
4. Membership `status = 'VERIFIED'`, `last_revoked_at IS NULL`, and revocation metadata does not indicate revocation.
5. The membership's role exists, `roles.organization_id` equals the subject activity organization, and its JSON permissions contain the canonical explicit permission key `VERIFY_EVIDENCE`.
6. Do not authorize based on role name (including `VERIFIER`, `AUDITOR`, `VALIDATOR`, or `VERIFICATION_OFFICER`).
7. Do not authorize based on legacy aliases `verification:approve` or `verification.approve` as independent grants. If compatibility is required, normalize legacy role permission data through a separately reviewed migration and record that normalization. The canonical database authority is one exact permission key.
8. The activity actor must not equal `verifier_identity_id`.
9. The membership and role snapshot selected must be deterministic. If multiple valid memberships are possible, reject ambiguity or define a stable, approved selection rule; do not rely on an unordered LIMIT.
10. Capture the exact membership id, role id, full permission JSON snapshot and authorization timestamp for every decision, including REJECTED.

The authorization function must lock or otherwise serialize the relevant identity/membership rows sufficiently to make revocation concurrency semantics explicit. The inspected membership uniqueness constraint is `(identity_id, organization_id, role_id)`, so one identity may have multiple role memberships in the same organization; the function must reject ambiguous authority or define a deterministic rule, and each selected role must belong to that same organization. Define whether the decision is authorized at transaction snapshot time or must serialize against concurrent membership revocation; add a deterministic concurrent test. A stale application AuthContext must never be the source of database authority.

## 5. Additional APPROVED-only conditions

For `APPROVED`, additionally require:

1. Subject organization is VERIFIED under the approved canonical organization verification fields.
2. Activity has a non-null geography id.
3. The geography row must exist. The inspected `geography` table has no status column; do not invent or query one. If validity windows are relevant, explicitly define whether `valid_from` / `valid_to` are enforced at decision time.
4. At least one matching VERIFIED organization geography scope must contain the activity geography under the approved ancestor/descendant semantics. The role's `organization_id` must also equal the subject activity organization.
5. No VERIFIED scope, missing geography, unknown geography or non-containing scope means DENY. **Never treat absence of a scope as global permission.**
6. Scope containment must be implemented and tested with parent/child, exact match, sibling and unrelated geography fixtures. The current helper walks from the activity geography up its parent chain, so a scope on an ancestor grants descendant coverage; verify this explicitly in the replacement tests.

For `REJECTED`, organization/geography validation may differ if product/legal policy explicitly says so, but verifier identity, exact subject-organization membership, canonical permission, no self-review, subject binding and immutable authorization snapshot remain mandatory. If the business decision is that rejection requires the same geographic authority as approval, make that requirement explicit and test it; do not accidentally inherit approval-only code paths.

## 6. Snapshot and immutability contract

At insert, persist:
- `authorization_membership_id`
- `authorization_role_id`
- `authorization_permissions_snapshot`
- `authorization_checked_at`

For both decisions these values must be non-null and internally consistent with the membership and role used for authorization.

After insert:
- Reject UPDATE to `decision`, subject identifiers, verifier identity, scope, decision timestamp, and all authorization snapshot fields.
- Reject DELETE for ordinary application roles.
- Corrections must use a separately designed append-only correction/supersession protocol with actor, reason, source decision, timestamp and audit trail. No silent UPDATE/DELETE override.
- Test direct SQL attempts as runtime, ordinary admin and function owner. A privileged emergency correction must be separately authorized and leave immutable audit evidence.

## 7. Trigger/function architecture

Implement one canonical trigger function that performs subject resolution, verifier authority, approval-specific geography/organization checks, and snapshot population for both decisions. Avoid two independent BEFORE INSERT triggers with partially overlapping rules.

Recommended shape, subject to DBA/security review:
- One BEFORE INSERT trigger calls one unified authorization function.
- A separate BEFORE UPDATE OR DELETE trigger enforces immutable decision/snapshot semantics.
- Retire `verification_independence_guard` only in the same reviewed migration that installs and tests the unified function. Never leave a gap between old and new enforcement.
- Avoid duplicate checks that can disagree or produce ordering-dependent behavior.
- Use explicit column references and stable error codes/messages suitable for API mapping.
- Function owner must be a dedicated NOLOGIN/NOBYPASSRLS role with no privileged memberships. Never use `rupaykg` / `neon_superuser`.
- Fixed safe `search_path`, schema-qualified relations/functions, exact grants, and review of RLS behavior are mandatory.
- Decide whether SECURITY DEFINER is actually necessary. Prefer invoker execution when the trigger can safely read required rows under the real runtime role and RLS design. If SECURITY DEFINER is necessary, document why and constrain owner/function privileges.

## 8. Required acceptance matrix

All tests run on disposable PostgreSQL using the actual runtime principal and reviewed function owner. Every negative test must assert both SQL failure/denial and absence of a persisted decision.

| Scenario | APPROVED | REJECTED |
|---|---|---|
| Verified identity, active exact-org membership, canonical permission, independent reviewer | Allow (if org/geography valid) | Allow |
| Role-name-only VERIFIER/AUDITOR | Deny | Deny |
| Legacy alias only | Deny until normalized | Deny until normalized |
| No membership / cross-org membership | Deny | Deny |
| Pending/revoked membership | Deny | Deny |
| Unverified identity / suspended identity | Deny | Deny |
| Self-verification | Deny | Deny |
| Missing activity / missing evidence binding / mismatched activity and evidence | Deny | Deny |
| Missing canonical permission | Deny | Deny |
| Pending/unverified subject organization | Deny | Apply explicit policy; never silently allow |
| Missing/unverified/non-containing geography scope | Deny | Apply explicit policy; never bypass verifier authority |
| Snapshot fields omitted or forged by caller | Database populates trusted values | Database populates trusted values |
| Snapshot UPDATE / decision UPDATE | Deny | Deny |
| DELETE by runtime | Deny | Deny |
| Concurrent membership revocation | Deterministic documented outcome | Deterministic documented outcome |
| Multiple candidate memberships | Deterministic documented outcome or deny ambiguity | Same |
| Insert through alternate route/direct SQL | Same enforcement | Same enforcement |

Additional tests:
- Verify BEFORE INSERT trigger ordering is irrelevant because only one canonical authorization trigger is active.
- Verify legacy global-membership trigger cannot re-authorize after unified migration.
- Verify helper `organization_has_geography_scope` returns FALSE for no scope and for no containing scope after its separately reviewed correction.
- Verify scope ancestor/descendant semantics.
- Verify all snapshots reflect the exact membership/role/permission at decision time.
- Verify function ownership, SECURITY DEFINER flag, search_path, grants, and RLS interaction from catalogs.
- Run tests after revoking any temporary migration elevation.

## 9. Migration and rollout constraints

1. Do not implement against PR #192's divergent branch without first reconciling it with canonical main and the applied production migration 096.
2. Do not replay historical migration 096. It is provenance for the currently deployed snapshot columns/function and is not a safe corrective migration.
3. Add a new forward-only migration only after the owner role, grants, trigger architecture, RLS interaction and full negative tests are reviewed.
4. Add a migration preflight that fails if required columns, triggers, functions, owner role, source ledger or exact migration checksums do not match expectations.
5. Use disposable child from production baseline; do not mutate the current evidence child until the approved rehearsal is explicitly authorized.
6. No production backfill is expected based on the inspected zero-row `verifications` table, but recheck immediately before any approved rollout.
7. Keep verifier workflows, workers, EPR, registry issuance, settlement and certification disabled until independent review and explicit release approval.

## 10. Exit criteria

The contract is implementation-ready only when:
- DBA approves role ownership and exact Neon migration execution.
- Canonical permission vocabulary and legacy role-data normalization are resolved.
- Organization verification field semantics and geography hierarchy semantics are confirmed.
- Unified insert authorization and immutable update/delete enforcement are implemented.
- All positive/negative/concurrency tests pass on a disposable PostgreSQL database under exact principals.
- Migration chronology and source hashes are reconciled.
- Independent security/code/DBA reviewers approve the exact commit and rehearsal evidence.

**Current status: NOT IMPLEMENTED / NOT APPROVED.** This document is a precise implementation contract based on catalog evidence. It is not a production change or TRL 9 certification.
