# Verification history and reapproval design — 2026-10-31

**Status:** engineering design / disposable fixture only. No numbered migration and no live database changes.
**Branch:** security/authorization-provenance-regression-main-based-2026-10-30
**Base finding:** migration 096 rewrites the decision-time authorization snapshot on unrelated updates to an APPROVED verification.

## 1. Evidence gathered this batch

### Live production (read-only Neon inspection)

- `public.verifications` has the four nullable authorization provenance columns from migration 096 and a non-null `decided_at`.
- Current row count: **0**.
- Current decisions / NULL timestamp buckets: **none**.
- `public.evidence_artifact_reviews` row count: **0**.
- `public.audit_events` row count: **0**, including verification-related actions/targets.
- No trigger was found on `audit_events` in the inspected production catalog.
- Two triggers currently exist on `verifications`: `verification_independence_guard` and `verifications_integrity_guard`.
- `prevent_invalid_verification()` is SECURITY INVOKER (not SECURITY DEFINER), has no function-level `search_path` setting, and is owned by role `rupaykg`.
- The Neon inspection connection role reports `rolsuper=false`, `rolbypassrls=true`, `rolcreaterole=true`, `rolcreatedb=true`. This is **not proof** that Render uses the same role; the exact service runtime role remains unverified.

The zero production verification/audit counts mean there are no current production verification rows to backfill at this observation time. They do not remove the need for safe classification in a future migration, and do not establish that the API is unused or that other environments have the same state.

### Live staging (read-only)

- `public.verifications` has no migration-096 authorization columns.
- Current verification row count was previously observed as 0.
- Staging's verification trigger/function differs from production and must not be copied over production.

### API / workflow static review on PR #157's source branch

- `POST /api/v1/evidence-vault/:evidenceId/review` runs in `createTenantTransaction`.
- It locks the target evidence row with `FOR UPDATE OF e`, checks active organization, geography scope, `evidence:review`, verifier permission and self-review prohibition.
- Evidence already `VERIFIED` or `REJECTED` returns 409 with the instruction to upload a new version.
- A successful review inserts an `evidence_artifact_reviews` row and a new `verifications` row, then updates evidence status in the same transaction.
- Upload creates a **new evidence row** and a new artifact-version row in the same evidence series; it does not overwrite the old evidence row.
- Thus the existing application already favors immutable new verification records rather than in-place reapproval. The relation to the prior verification is implicit through the evidence series, however; there is no explicit `supersedes_verification_id` / correction reference in the reviewed route.
- `mrv-routes.ts` consumes APPROVED verification rows but does not provide a decision-correction API.
- Role permission changes, identity suspension and membership status changes are implemented in platform-admin routes. The approval trigger must serialize against all three.

## 2. Durable legacy lifecycle state proposal

The earlier timestamp-only guard was insufficient: legacy approvals may have NULL `authorization_checked_at`, and rejected rows may have no reliable record of whether they were previously approved.

A read-only catalog query confirmed the production `verification_decision` enum has exactly two values: `APPROVED` and `REJECTED`. The updated disposable proposal therefore uses two lifecycle states:

| State | Meaning | In-place approval allowed? |
|---|---|---|
| `APPROVED_HISTORY` | Current or historical approval exists | No; immutable history |
| `REJECTED_TERMINAL` | Rejected decision is terminal | No; create a new evidence/verification record |

Conservative classification during forward migration:
- Current `APPROVED` rows -> `APPROVED_HISTORY`, even if all authorization snapshot columns are NULL.
- Current `REJECTED` rows -> `REJECTED_TERMINAL`; this intentionally prevents in-place reapproval even where older history cannot be reconstructed.

No timestamp, membership, role, permission snapshot or prior approval event is fabricated. A rejected legacy row is not reopened merely because its earlier history is unknowable. This matches the reviewed API's terminal evidence-review behavior and its new-evidence-row correction path. There is no PENDING decision state in the current production enum; the test fixture has been corrected to use only APPROVED and REJECTED.

The trigger sets lifecycle state itself on INSERT and UPDATE, so a caller cannot choose a weaker state. It preserves provenance fields on all later updates to an approved-history row. It rejects linkage changes and decision changes on rejected-terminal rows. A new approved record is authorized against the current organization membership, identity and role.

This remains a proposal: historical data distributions and API semantics must be validated against the complete production schema before a numbered migration is authored.

## 3. Authorization/revocation serialization proposal

The unnumbered fixture now selects the matching verified membership, role and identity using `FOR SHARE OF m, r, i`. The intent is to make an approval transaction serialize against updates to:
- organization membership status / role assignment,
- role permissions,
- identity suspension / verification state.

Expected semantics:
- If revocation obtains its row lock and commits first, approval waits, re-evaluates the authorization predicate, and fails.
- If approval obtains the share locks first, revocation waits until the approval transaction commits; the approval is ordered before revocation.
- This is a database serialization point, not a claim that a revocation retroactively invalidates a decision already committed.

The fixture now includes two-session disposable PostgreSQL tests for membership revocation, role-permission changes and identity suspension racing with approval. Deadlock analysis must inspect every multi-row admin workflow and maintain a consistent lock order. The production trigger must not be approved until exact CI proves these tests and the query plans/lock behavior against the supported PostgreSQL version.

## 4. Execution context / search path gate remains OPEN

The live trigger function is SECURITY INVOKER, which is the intended safer default unless a separate privileged design is justified. It currently has no pinned function-level `search_path` and uses unqualified relation names. The unnumbered proposal now sets `search_path = pg_catalog, public` and schema-qualifies referenced tables. Its disposable regression also sets a hostile caller search_path with a shadow `organization_memberships` table and verifies the pinned function still uses its intended schema. The final migration must:
1. Schema-qualify every referenced relation.
2. Set a fixed trusted function `search_path` (including `pg_catalog`) after confirming deployed schema and extension requirements.
3. Preserve SECURITY INVOKER unless a reviewed need proves otherwise.
4. Inspect PUBLIC and runtime-role schema/table/function grants, table ownership, RLS policies and trigger execution behavior.
5. Verify the actual Render service connection role using safe role-name/privilege diagnostics; do not infer it from the Neon inspection role.
6. Run tests as the actual least-privilege application role, including provenance-column write attempts, trigger-disable/bypass attempts and RLS behavior. The current disposable search-path test is not a substitute for production role/grant validation.

The currently observed `rupaykg` role is privileged (`BYPASSRLS`, `CREATEROLE`, `CREATEDB` true); that alone is a production tenant-isolation blocker but does not establish which credential the API uses.

## 5. Correction / reapproval workflow

The reviewed evidence-vault route already requires a new evidence row for a new version and creates a new verification row, so the preferred model is:

1. Preserve the old evidence, artifact version, review and verification records.
2. Upload a new artifact version as a new evidence row in the same evidence series.
3. Capture a correction reason and an explicit link to the prior evidence/verification (proposed `supersedes_verification_id` or equivalent immutable relationship).
4. Perform a new review with a fresh authorization check and new reviewer identity.
5. Append a verifiable audit event that links old and new records; ensure the audit event is immutable through DB-enforced privileges/triggers or a verified append-only service.
6. Never change an old decision from REJECTED back to APPROVED.

Current production `audit_events` is empty and no trigger was found on it. The route writes `evidence_artifact_reviews`, not `audit_events`. A correction lineage/audit design is therefore still required; do not describe the existing route as a complete independent audit ledger.

## 6. Current implementation checkpoint

Updated in this branch:
- `scripts/fixtures/authorization-provenance/proposed-authorization-provenance-forward-fix.sql`: adds two-state lifecycle marker/backfill, share locks, schema-qualified references and a pinned search_path; remains outside `migrations/`.
- `scripts/test-authorization-provenance-forward-fix.mjs`: covers legacy approved/rejected NULL-provenance scenarios, forged provenance writes, hostile search_path shadowing, and two-session membership/role/identity revocation races.
- Existing migration 096 remains unchanged.
- No numbered migration created.
- No Neon DDL/DML executed; all live database queries this batch were read-only.
- PR #140 and PR #157 must remain unmerged/un-deployed.

## 7. Remaining gates before migration

1. Validate the updated fixture and regression under exact-head CI.
2. Add two-session tests for role permission revocation and identity suspension.
3. Verify lock ordering/deadlock behavior against every platform-admin mutation path.
4. Validate all verification decision enum values and migration backfill behavior against a production-shaped disposable clone.
5. Resolve function search_path, schema qualification, ownership, grants, runtime role and RLS.
6. Add explicit correction lineage and append-only audit event semantics; test API tenant boundaries.
7. Reconcile migration chain and the unledgered 20261101 schema effect.
8. Only after independent review, create a separately numbered forward-only migration after the authoritative chain. Never edit or replay migration 096.

**Release decision: HOLD.** No production/staging migration, scheduler/worker activation, deployment, certification or TRL 9 claim is authorized.
