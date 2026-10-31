# Independent security/database review — verification authorization provenance

Date: 2026-10-31
Repository: vishaltradewinds/rupaykg
Reviewed proposal head: f7e4ff12be336058b99bc19a8b729cdd3b636707
Scope: proposed forward-fix SQL fixture and disposable PostgreSQL regression test.

## Decision

**NOT APPROVED for conversion into a numbered production migration yet.** The proposed behavior materially improves the defect reproduced against migration 096, and exact-head disposable CI passed. However, the following review gates remain open. Do not merge PR #140 or PR #157, deploy, or modify production/staging on the strength of this fixture.

## Confirmed strengths

1. An already-approved verification cannot silently change verifier, evidence, or activity linkage.
2. Decision-time authorization snapshot fields are retained during unrelated updates.
3. A transition away from APPROVED retains the snapshot.
4. A previously approved row identified by OLD.decision or a non-null authorization_checked_at cannot be directly re-approved.
5. Caller-supplied authorization fields are cleared for new non-approved rows.
6. A first transition to APPROVED re-checks active organization membership and permission.
7. Disposable regression reproduces the legacy snapshot rewrite and exercises the proposed fix. Exact-head CI #41192000600 passed at the reviewed head.

## Blocking findings / required engineering

### SEC-01 — legacy approval history with NULL authorization_checked_at (HIGH)

Migration 096 adds nullable provenance columns but does not backfill existing verification rows. A row approved before migration 096 can therefore have decision='APPROVED' and authorization_checked_at IS NULL. If it later transitions to REJECTED, the proposed trigger preserves NULL. On a subsequent update, OLD.decision is no longer APPROVED and OLD.authorization_checked_at remains NULL; the function cannot identify that it was previously approved, so direct reapproval may be allowed.

Required:
- Inventory all existing verification history and audit/event sources before designing the forward migration.
- Add an explicit, unambiguous historical-approval lock/marker or equivalent durable state.
- Backfill rows currently APPROVED as historically approved, but do not fabricate a decision-time timestamp or permission snapshot.
- Define how historical REJECTED rows with unknown prior approval history are treated. Fail closed where provenance cannot be established.
- Add disposable PostgreSQL tests for pre-096 approved rows with NULL provenance, transition to REJECTED, repeated updates, and reapproval attempt.

### SEC-02 — authorization revocation concurrency / lock semantics (HIGH)

The proposed SELECT reads membership, role permissions, and identity state but does not lock them. Concurrent role-permission changes, membership revocation, identity suspension, or membership replacement can race with approval. The recorded snapshot is transaction-snapshot evidence, but the intended authorization linearization point and revocation semantics are not specified.

Required:
- Specify whether approval must serialize against revocation/suspension.
- If strict serialization is required, design deterministic row locking for membership, role, and identity records, including lock ordering and deadlock analysis. Validate PostgreSQL's supported row-lock behavior for the join and the exact updates that revoke authority.
- Add two-session concurrency tests proving the chosen semantics.
- Do not claim instantaneous revocation unless the database/API transaction model guarantees it.

### SEC-03 — function execution context and object resolution (HIGH)

The trigger function is not SECURITY DEFINER and uses unqualified relation names. This may be intentional (invoker privileges / RLS), but the migration must explicitly establish the intended execution role, grants, RLS behavior, and trusted search_path. A caller-controlled search_path or writable schema in the resolution path can create object-shadowing risk; changing to SECURITY DEFINER without a hardened owner/search_path/grant model would create a different privilege-escalation risk.

Required:
- Document trigger execution identity and whether RLS applies to each referenced table.
- Pin a trusted search_path in the function definition (with schema-qualified relations) appropriate to the deployed schema.
- Verify application roles have only the required SELECT/UPDATE rights and cannot bypass the trigger or alter provenance columns directly.
- Test under the actual least-privilege application role, not only a database owner/superuser.
- Confirm trigger/function ownership and grants in production-shaped acceptance.

### SEC-04 — reapproval and correction workflow (MEDIUM)

Direct reapproval is correctly rejected for rows identified as previously approved, but the product/API workflow for legitimate correction, reversal, appeal, or reapproval is not defined.

Required:
- Define a separate audited workflow that creates a new decision record or immutable event linked to the prior verification, rather than mutating the historical decision in place.
- Specify actor, reason, evidence, authorization check, timestamps, and audit event requirements.
- Add API-level authorization and tenant-isolation tests for the workflow before enabling it.

### SEC-05 — migration ordering and historical drift (HIGH)

The production migration chronology and the unledgered 20261101 schema effect are still under reconciliation. Do not assign a migration version by guesswork or replay migration 096. The forward-only migration must be placed after the authoritative current chain only after the PR #157 migration sequence and live drift are reconciled.

Required:
- Resolve the 20261101 schema-effect/ledger provenance without fabricating a ledger row.
- Confirm the exact latest authoritative migration identity and production/staging baseline.
- Add production-shaped reconstruction, upgrade, second-run/idempotency, rollback/forward-recovery policy, and disposable DB acceptance for the new migration.
- Preserve migration 096 as historical; remediate only with a new forward migration.

## Test gaps to close

- Legacy pre-096 approved row with NULL timestamp and subsequent transition/reapproval.
- Existing rejected row whose prior approval cannot be inferred.
- Two-session concurrent permission revocation vs approval.
- Concurrent membership deactivation / identity suspension vs approval.
- Trigger execution as the real application role with RLS and grants.
- Search-path shadow-object attempt and schema qualification.
- Attempts by application roles to write provenance columns directly or disable/bypass the trigger.
- Tenant boundary: membership in another organization must never authorize approval.
- Legitimate correction/reapproval API workflow must create new immutable evidence, not rewrite the prior record.

## Release gates

- PR #140 remains a disposable-only regression/proposal.
- PR #157 remains draft/unmerged.
- No production or staging DDL/DML, worker activation, scheduler activation, deployment, or certification is authorized by this review.
- Do not call this issue fixed or production-ready until SEC-01 through SEC-05 and the test gaps are closed and independently reviewed.

## Next bounded batch

1. Inspect current verification/audit/event schemas and API mutation paths to establish recoverable historical approval evidence.
2. Design the durable historical lock representation and fail-closed handling for unknown history.
3. Add concurrency and least-privilege disposable tests.
4. Reconcile migration chronology before assigning any migration number.
5. Only then draft a separately numbered forward-only migration and production-shaped CI acceptance.


## Supplemental review update — 2026-10-31

The follow-up schema/API inspection and revised disposable proposal narrow and address parts of the earlier findings:

- Production currently has zero verification rows, zero evidence-artifact review rows, and zero audit-event rows. Therefore no current production row needs a provenance backfill at this observation time. The migration must still classify any rows present when eventually applied.
- The evidence-vault API already treats VERIFIED/REJECTED evidence as terminal and creates a new evidence row plus a new verification record for each uploaded artifact version in the same series. It writes `evidence_artifact_reviews` but not `audit_events`. Explicit prior-verification correction lineage and independently verifiable audit-event semantics remain open.
- The disposable proposal now adds a two-state `authorization_history_state`: current legacy APPROVED rows are marked APPROVED_HISTORY and current REJECTED rows REJECTED_TERMINAL. Production's `verification_decision` enum has exactly APPROVED and REJECTED; there is no PENDING state. The proposal does not invent missing timestamps or permission snapshots and intentionally fails closed by prohibiting in-place reapproval of legacy rejected rows.
- The authorization query now requests `FOR SHARE OF m, r, i`, and disposable two-session tests cover membership revocation, role permission changes, and identity suspension racing with approval. These tests are pending exact-head CI; they are not yet proven.
- The live production function is SECURITY INVOKER, has no pinned function search_path, and remains unqualified. Search-path/schema qualification, actual runtime role, grants/RLS, and least-privilege acceptance remain release blockers.
- The inspection role named `rupaykg` reports BYPASSRLS/CREATEROLE/CREATEDB privileges, but the Render runtime role has not been identified. Do not assume they are the same.

Current proposal head at this update: `93df55631072428e1523ab2128642bc5f3bb83ce`.

This update does not approve a numbered migration. PR #140 and PR #157 remain draft/unmerged; production and staging remain untouched.


## Second supplemental review update — 2026-10-31

Further correction from direct production catalog evidence: `verification_decision` is a PostgreSQL enum with exactly two values, `APPROVED` and `REJECTED`; there is no PENDING state. The disposable fixture and regression have been aligned to those real values. The lifecycle marker now has only `APPROVED_HISTORY` and `REJECTED_TERMINAL`; legacy REJECTED rows fail closed and must be corrected by a new evidence/verification record.

The unnumbered fixture now also:
- schema-qualifies all referenced tables;
- pins function `search_path` to `pg_catalog, public`;
- locks membership, role and identity rows with `FOR SHARE` during approval;
- tests caller-supplied provenance forgery;
- tests a hostile caller search_path with a shadow membership table;
- includes two-session races for membership revocation, role permission change and identity suspension.

Latest recorded commit: `37bee6c7be93ef4ce602faf410234b97b907ec97`. The GitHub workflow lookup has not yet exposed an exact-head CI run for this commit. Earlier CI #41192563451 passed on a prior documentation-only commit and does **not** validate the new SQL/test changes.

Remaining blockers: actual Render runtime-role identification, least-privilege grants/RLS and trigger bypass review; correction lineage/audit-event design; migration chronology and 20261101 drift; independent reviewer sign-off. No production migration is approved.


## Backfill-order safety correction — 2026-10-31

A further code review caught an important migration-order hazard: if lifecycle-state backfill runs while migration 096's legacy BEFORE UPDATE trigger is still installed, that trigger rewrites authorization timestamps/snapshots on APPROVED rows during the backfill. The unnumbered fixture has been reordered to replace the trigger function first and run the backfill second. The new function recognizes OLD.decision='APPROVED' even with a NULL timestamp and preserves the existing provenance fields while setting APPROVED_HISTORY. The disposable legacy-row test asserts that the timestamp remains NULL.

This ordering is mandatory for any future migration. It remains unverified until exact-head disposable CI runs. Latest recorded branch head at this update is 3cab48c58ac17ace419bbfbc9ddb047d03021b97; no exact-head workflow run is visible. Do not promote this fixture to migrations/ or apply it to a live database.


## Concurrency-test determinism update — 2026-10-31

The two-session regression now polls pg_stat_activity for the main connection's actual Lock wait event before releasing the competing revocation transaction. This avoids a false positive from merely sleeping while a query has not yet reached PostgreSQL. It exercises membership revocation, role-permission change and identity suspension. Latest recorded commit: 330ad804840aad69569949a6916838b5af282a1d. Exact-head CI is still not visible; all new tests remain unverified until CI runs on this exact head.
