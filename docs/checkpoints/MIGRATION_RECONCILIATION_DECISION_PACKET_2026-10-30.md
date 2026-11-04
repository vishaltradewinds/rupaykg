# Migration Reconciliation Decision Packet — 2026-10-30

**Repository:** `vishaltradewinds/rupaykg`  
**Working branch:** `shakti/dual-ledger-compatibility-tests`  
**Purpose:** Single reviewer-facing disposition for the known production/staging migration-history divergence.  
**Authority:** Engineering proposal only. This document authorizes no live database writes, migration replay, scheduler activation, or production release.

## 1. Decision

**Do not merge or apply any migration-history candidate independently.** Keep the release migration runner fail-closed until the independent database/security reviewers approve a single canonical forward-only reconciliation plan and the integrated disposable-PostgreSQL acceptance gate passes.

No current evidence justifies replaying a historical migration against a database where its effects are already recorded. Do not fabricate ledger entries, edit applied migration SQL in place, drop/recreate data, bypass orphan detection, or copy staging schema wholesale into production.

## 2. Evidence status and exact known records

| Environment / record | Source evidence currently available | What it proves | What remains open |
|---|---|---|---|
| Production: `096_verification_authorization_provenance.sql` | Historical commit `ca8f4100782e13f8d72106187fafc8e1e446214f`; Git blob SHA-1 `258b1f4534efbf915688f78aa84d4ec24a47cbc0`; Render deployment chronology correlates with ledger timestamp | Strong time-correlated reconstruction of the source deployed in that window | No retained signed image digest or artifact-level SQL checksum; independent semantic/security review; approved treatment of legacy rows |
| Staging: `20261022_async_mirror_inbox.sql` | Recovered source blob SHA-1 `4d08607e03561b9fbb4ce502b4c4211127237050` | Exact Git source recovered from historical feature branch | Artifact-level deployment attestation, semantic review, dependencies |
| Staging: `20261023_async_mirror_worker_leases.sql` | Recovered source blob SHA-1 `33cb4d5d2e29a4a111340e5a0ac34170a0081895` | Exact Git source recovered | Artifact-level deployment attestation; worker status CHECK mismatch review/fix |
| Staging: `20261024_ai_intake_rate_limits.sql` | Recovered source blob SHA-1 `87b51fe60a96a4e0752c8b0a9a170c81f9936dbb` | Exact Git source recovered | Artifact-level deployment attestation, rate-limit semantics and dependencies |
| Staging: `20261025_ai_evidence_intake_jobs.sql` | Recovered source blob SHA-1 `6a0ae54530b7b756dac33589eaf18df3b071d8f2` | Exact Git source recovered | Artifact-level deployment attestation, job lifecycle/idempotency and dependencies |

These are Git SHA-1 blob identifiers, not SHA-256 attestations of the deployed SQL artifact. Preserve this distinction in audit outputs.

## 3. Canonical catalog decision matrix

| Record / candidate | Current disposition | Required next action |
|---|---|---|
| Shared migrations `20261018`–`20261021` | Shared historical records; not orphans | Keep exact filenames/order; do not relabel as missing |
| Production `096_verification_authorization_provenance.sql` | Historical source recovered; excluded from current release catalog; not safe to replay | Independent review of trigger/function semantics, permissions, role/membership revocation, search path, concurrency, and legacy-row treatment; determine an approved auditable reconciliation record and any genuinely needed new forward migration |
| Staging `20261022`–`20261025` | Sources recovered but not canonical release migrations | Reconstruct dependency graph from SQL and deployed object definitions; compare grants, ownership, RLS, triggers/functions, constraints, indexes, extensions and data dependencies; approve a forward-only plan |
| `20261101_async_mirror_unresolved_crosswalk.sql` | Candidate corrective SQL only; not an approved release migration or proof of a live fix | Review intended status lifecycle, lock/transaction behavior and constraint validation; assign a valid migration version only after the canonical catalog and dependency order are approved |
| PR #120 migrations `088`–`091` | Deferred from migration reconciliation | Integrate only after the canonical catalog decision; test against both ledger shapes |
| PR #121 GRI persistence | Deferred | Add no migration until canonical ordering is approved; GRI remains advisory cross-mapping, not statutory compliance determination |

## 4. Required canonical reconciliation sequence

1. **Freeze evidence.** Export both ledgers and complete schema definitions read-only. Record capture time, environment/branch identity, source reference, SHA-256 of each exported artifact, and reviewer.
2. **Reconcile inventory.** Compare every ledger filename/version with the release catalog. Record exact source mapping, historical Git commit/blob, observed deployment correlation, and confidence. Do not claim artifact attestation where none exists.
3. **Build dependency graph.** For the five divergent sources and all related current migrations, inspect SQL plus live object definitions and dependencies. Include columns, types/defaults/nullability, constraints, indexes, triggers/functions, grants, ownership, RLS, extensions, data invariants and application/worker assumptions.
4. **Approve semantic decisions.** Security reviewer signs the verification authorization behavior; database owner signs ordering, data preservation and restore plan; worker/domain owner signs lifecycle/idempotency; compliance owner confirms evidence-retention obligations. If evidence is insufficient, record an explicit exception or keep the gate blocked.
5. **Author forward-only changes.** Never replay the historical 096 or staging migrations to a database that already records them. Use new uniquely versioned migrations only for approved changes that are actually needed. Do not create a synthetic migration merely to make ledgers look equal.
6. **Integrated disposable PostgreSQL rehearsal.** Use isolated disposable schemas/database and the actual migration runner. Test production-shaped and staging-shaped histories, missing source and version/filename mismatch fail-closed cases, the complete approved migration bundle, all relevant constraints and worker transitions, inbox/event row hashes before/after, repeated run no-op, transaction rollback on injected failure, and documented restore/recovery.
7. **Review final exact head.** Run combined CI and all DB acceptance on the exact proposed integration commit. Independent reviewers inspect the complete diff and evidence. No merge/release approval is inferred from separate PR green runs.
8. **Release gate.** Only after signed Shakti Standards evidence, TRL assessment, verified backup/restore, change window and explicit authorized approval may a separately controlled staging rehearsal or production change be considered.

## 5. Minimum integrated acceptance assertions

- The actual runner rejects unresolved recorded sources before executing any pending SQL.
- Version prefix and recorded filename agree; duplicate/conflicting versions fail closed.
- Every record in the proposed canonical catalog has one reviewed disposition and explicit dependency order.
- Existing inbox rows and append-only event history remain unchanged during reconciliation; compare stable row hashes, not only counts.
- Worker transitions include `UNRESOLVED`, retries, lease expiry, duplicate delivery, quarantine and invalid transitions against real PostgreSQL constraints.
- Verification tests cover organization/evidence/activity binding, active membership, identity suspension, self-verification, role/permission semantics and approval-to-rejection/reapproval behavior.
- First rehearsal run reaches the expected state; second run is a no-op.
- An injected failure rolls back the active migration transaction and does not leave a falsely recorded version.
- Schema/object diff explains every remaining production/staging difference.
- CI and DB acceptance evidence is attached to the exact final commit.

## 6. Explicit non-authorizations and release state

- Production and staging database writes: **NOT AUTHORIZED**.
- Migration-ledger repair or direct DDL/DML: **NOT AUTHORIZED**.
- Historical SQL replay: **NOT AUTHORIZED**.
- Async worker scheduler activation: **HOLD / OFF**.
- EPR, ESG/BRSR, GRI, CCTS/CCC compliance assertions or statutory submissions based solely on this engineering work: **NOT AUTHORIZED**.
- Production certification: **HOLD**.

## 7. Shakti Standards / TRL

Current assessment: **TRL 3 (analytical/experimental proof-of-concept evidence for migration preflight and isolated acceptance harness only)**, pending review of the evidence packet. This is not a TRL assessment of the full RupayKg platform, the live production deployment, or statutory compliance.

The gate is not passed until evidence, independent reviews, integrated test results, recovery readiness, operations controls and an authorized release decision are all recorded. Golden rule remains: **ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.**


## 8. Follow-up integration review — PR #120 runner guard (2026-10-30)

**Finding: the current #108 runner guard and the #120 proposed guard are complementary, not interchangeable.**

- The #108 implementation calls `assertNoOrphanedMigrationRecords`, which catches ledger filenames absent from the current catalog. Its per-file loop also catches a filename mismatch when the same version already exists.
- The #120 implementation in `apps/src/migration-history.ts` adds a preflight check that the recorded `version` equals the version prefix parsed from the recorded `filename`, before any pending migration SQL runs.
- The second check closes a distinct malformed-ledger case: a catalog filename can exist in the release directory while a ledger row records that filename under a different version. Filename-only orphan detection would not reject that row; the runner could then consider the catalog's correct version unapplied and attempt to execute the SQL again.

**Disposition:** carry the #120 version/filename preflight semantics into the coordinated final runner, retaining the #108 orphan-source guard and its actual-runner acceptance tests. Do not merge PR #120 independently to obtain this safeguard. Add an actual-runner negative fixture with an available filename recorded under the wrong version, and assert the runner fails before any pending SQL is executed. Also assert a normal existing version/filename match remains a no-op.

**Evidence boundary:** this is a code-review finding from the PR #120 patch compared with the #108 working branch, not proof that any live ledger contains this malformed state. No database was queried or changed for this review. The latest exact-head CI success for #108 remains evidence for that head only; it does not test the combined #108 + #120 code.

**Required integration gate:** one combined candidate must pass the existing dual-ledger actual-runner suite plus the malformed version/filename negative case, all migration 088–091 tests, GRI package tests, and schema/data-preservation assertions against both disposable ledger shapes. Keep production and scheduler HOLD/OFF until independent review and the full release gate pass.


## Follow-up integration disposition — PR #108 versus PR #126 (2026-10-30)

A direct file-level comparison of the current branch heads establishes that the substantive PR #126 preflight implementation is already present on PR #108's branch:

- `apps/src/migrate.ts` imports and executes `migrationHistoryConflicts` before pending migration SQL.
- `apps/src/migration-history.ts` detects missing source files and version/filename-prefix mismatch; PR #108 additionally rejects duplicate migration-catalog version prefixes before any ledger query or pending migration SQL.
- `.github/workflows/ci.yml` on PR #108 already enables the dedicated disposable-PostgreSQL migration-history preflight test.
- `scripts/test-actual-migration-runner.mjs` on PR #108 includes the available filename recorded under the wrong version case and asserts failure before pending SQL, preserving the original ledger row.
- PR #108 also contains the broader dual-ledger and actual-runner acceptance cases, so no blind cherry-pick or manual file merge from #126 is required.

**Disposition:** treat PR #108 as the single integration candidate for this code path. PR #126 is redundant as an independent merge candidate and should not be merged separately. Keep the candidate draft/unmerged until exact-head CI and independent review are verified. After the candidate passes those gates, close #126 as superseded rather than merge it.

**Evidence limitation:** this is a repository code comparison. The workflow lookup available during this review returned a successful historical run but did not establish a successful CI run for current head `0fc473ee69a21b05e8af5f1e476fd51835261152`. The combined branch still needs a clearly attributable exact-head CI result. No production or staging database was queried or changed in this follow-up.

**Release gate remains unchanged:** production/staging migration writes, historical SQL replay, worker scheduler activation, production release and certification remain HOLD/OFF pending authorized live-ledger evidence, object-level reconciliation, independent database/security review and approved forward-only plan.
