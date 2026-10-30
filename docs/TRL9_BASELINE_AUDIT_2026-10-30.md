# RupayKg TRL 9 Baseline and Dependency Audit

**Audit timestamp:** 2026-10-30  
**Canonical repository:** `vishaltradewinds/rupaykg`  
**Baseline branch:** `main`  
**Baseline commit:** `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`  
**Purpose:** Batch A under `docs/TRL9_EXECUTION_PLAN.md`  
**Status:** Evidence-backed initial snapshot; not a production inspection or certification.

## 1. Current decision

**HOLD / NO-GO for overall TRL 9 and production certification.**

The existing assessment remains provisional software TRL 4; integrated-platform TRL is unverified. Physical hardware qualification, intended-site operation, external authority acceptance, and sustained live-operation evidence are not established by the repository records reviewed for this baseline.

## 2. Source-of-truth and branch governance

- Canonical source of truth: `vishaltradewinds/rupaykg`.
- Legacy `rupaykg-aistudio` is reference-only.
- GitHub API reported `main` at `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`, commit dated 2026-10-27.
- GitHub API reported `main` as **unprotected**, required status checks disabled, and repository rulesets empty at audit time.
- The TRL plan PR #90 and several engineering PRs were opened against older base snapshots. Re-check current base/head divergence and mergeability immediately before every integration decision.
- No branch protection, repository settings, live database or deployment was changed as part of this baseline.

**Governance risk:** A successful PR CI run is not an enforced merge gate while branch protection and required checks are disabled. The repository owner should approve and configure a safe branch-governance policy after confirming required CI contexts; do not guess check names.

## 3. PR coordination snapshot

The following are open/unmerged at the time checked. Current status and exact-head CI must be rechecked before action.

| PR | Workstream | Current observed status | Dependency / constraint |
|---|---|---|---|
| #90 | TRL 4→9 plan | Draft, open; head `b361e75dfbc4a110626afeba0098f7822c8ba3d2`; CI in progress at run #3361 / ID `41057840083` | Documentation-only plan; do not claim merged or gate passed. |
| #93 | TRL evidence ledger | Draft, open; head `e80690484b086d43c0a523024b99ef947e583202` | Align evidence states and identifiers with master plan; avoid duplicate/conflicting registers. |
| #91 | Production DB target/config safety | Draft, open; head `b8632ceacd18a0db2d635f23904e17c19664f48b` | Must be reviewed against production startup and migration behavior; do not infer live DB safety from tests alone. |
| #126 | Migration history fail-closed preflight | Draft, open; head `61191f5b7252c5d89d5157cefb01c27f464a9aef` | Reconcile source migration catalogue, schema and authorised environment ledger; never rewrite live ledger to force green. |
| #127 | Official India regulatory source register | Draft, open; head `269c953104c1dfe0f230fc814c78f9a1378b73ad` | Sources remain research-only until artifacts, hashes, effective dates and applicability are verified. |
| #128 | Hardware-edge observation contract | Draft, open; head `b561c941c3658197e3d469b92163b5a73c1e3566`; CI in progress at run #3362 / ID `41057869797` | Adapter contract is not physical instrument qualification; avoid duplicate device/evidence/persistence paths. |
| #129 | Strict timezone-aware field-sync timestamps | Draft, open; head `e51a7fa719abcd082c6d099652c74d6a04193b99` | Exact-head tests and review required; integrate with offline-sync work without weakening fail-closed behavior. |
| #49 | Hardware instrument approval | Draft, open; head `4d606e188b31b890eb894aa8dfdd275f7c8ee4c4` | Overlaps #51 on approval routes/schema. Site and methodology eligibility remain separate gates. |
| #51 | Evidence-bound instrument approval and parameter specifications | Draft, open; head `e5388fd1db1533db1d5abcf7bd5f52fc5f09ad2b` | Overlaps #49; prior exact-head CI is engineering evidence, not physical qualification. Resolve canonical migration/route ownership before merge. |
| #47 | Hardware/instrumentation approval register documentation | Draft, open; head `7812f6f98f1d136604f7100493a3e7749aa85454` | Align with the selected implementation in #49/#51. |
| #59 | Open-source hardware stack evaluation | Draft, open; head `22904460e48fdbaada958a6b0a79bd6db8723ce0` | Planning/evaluation only until exact hardware requirements and evidence are approved. |
| #108 | Dual-ledger migration compatibility acceptance | Open, not merged; head `0fc473ee69e21b05e8af5f1e476fd51835261152` | Coordinate with #126 and database-safety work; validate exact candidate and migration history. |
| #120 | Production startup, EPR quantities and ESG verification | Draft, open; head `1720df5eac80aa35d97f4b16b998ff70a2d45daa` | High-risk business and production guardrails; coordinate with EPR/ESG work. |
| #121 | GRI cross-mapping schema extension | Draft, open; head `b353d41ad71fa0f05149c046d75b2dba07c10f45` | Coordinate schema and reporting lineage with ESG work; do not imply assurance from schema alone. |

Additional parallel work, including ICVCM, Guardian/Hedera, waste custody, facility/resource-flow and agentic AI, must be included in the dependency map before any broad merge batch. This list is a snapshot, not an exhaustive claim that no other PRs exist.

## 4. Immediate dependency decisions

1. **Do not merge #49 and #51 independently** until a reviewed integration order selects the canonical migration and route ownership and resolves overlapping changes. Keep #47 aligned to that decision.
2. **Coordinate #126, #91 and #108** before migration or production-startup changes. The source tree, supported migration catalog, actual schema and authorised environment ledger must be reconciled; production remains untouched until an approved runbook and explicit authorization exist.
3. **Coordinate #128 and #129** with existing field-sync and evidence ingestion. Preserve strict timestamps, replay protection, quarantine, idempotency and canonical ingestion; no parallel persistence registry.
4. **Keep #127 source records research-only** until official source artifacts and applicability have been verified and reviewed.
5. **Align #90 and #93** so the execution plan is the master route and the evidence ledger records gate evidence without inventing readiness.
6. **Coordinate #120 and #121** with active EPR/ESG/GRI work. No statutory submission, verification or assurance claim without corresponding evidence.
7. Recheck the full current open-PR inventory and head/base SHAs before any merge batch. This baseline is not a merge authorization.

## 5. Migration and deployment evidence status

- `main` commit message on 2026-10-27 records removal of `migrations/096_verification_authorization_provenance.sql` from `main` after it was identified as an unreviewed migration.
- PR #126 explicitly addresses fail-closed handling of unresolved migration history.
- No authorised production migration-ledger export, production schema inspection, backup/restore proof or live deployment identity was established by this GitHub metadata check.
- The repository contains `docs/CLOUD_RUN_PRODUCTION_CONTRACT.md`, but that contract is a deployment specification, not proof of a live Cloud Run release.
- Do not infer that a migration is applied, absent, safe, or recoverable solely from branch contents or a CI run.

## 6. TRL evidence gaps

The following remain unproven until evidence is added to the controlled ledger:

- Independent review and exact-head validation for each candidate release.
- Authorised production/staging migration and schema reconciliation.
- Actual deployment identity and production operational monitoring.
- Complete security assessment and recovery exercise.
- Verified official regulatory artifacts and applicability.
- Independent reproduction of representative carbon/MRV calculations.
- Actual device inventory, model-specific approvals where required, calibration and metrology evidence.
- Hardware-in-the-loop and complete physical-to-cloud observation-chain tests.
- Intended-site permission, acceptance, actual operator workflows and independent reference comparisons.
- Real external Guardian/Hedera/Mirror Node integration evidence, if in scope.
- Sustained operational metrics, incident history and independent TRL assessment.

## 7. Batch A exit status

**Status: PARTIALLY COMPLETE — repository/PR snapshot recorded; production and schema evidence blocked/not yet available.**

Completed:
- Confirmed canonical repository and current `main` SHA from GitHub API.
- Confirmed branch protection is disabled and no rulesets were returned.
- Captured exact heads and observed statuses for key open PRs.
- Identified material overlap in hardware approval and migration/database work.
- Identified two exact-head CI runs still in progress at the time of query.

Not completed:
- Full paginated inventory of every open PR and all changed-file overlaps.
- Inspection of every current workflow/check and exact-head independent review.
- Authorised read-only inspection of actual production/staging migration ledger and schema.
- Confirmation of actual live deployment, site or hardware state.
- Assignment of accountable human owners and signed gate decisions.

**Next action:** complete the paginated PR/dependency map and review the relevant diffs; obtain an authorised, read-only environment evidence package for schema/ledger/deployment; then prioritise the database-safety and hardware-approval integration order. Do not make production mutations or declare Batch A passed until those blockers are resolved.

## 8. Source links

- [Canonical repository](https://github.com/vishaltradewinds/rupaykg)
- [TRL 9 execution plan PR #90](https://github.com/vishaltradewinds/rupaykg/pull/90)
- [TRL evidence ledger PR #93](https://github.com/vishaltradewinds/rupaykg/pull/93)
- [Database target safety PR #91](https://github.com/vishaltradewinds/rupaykg/pull/91)
- [Migration history preflight PR #126](https://github.com/vishaltradewinds/rupaykg/pull/126)
- [Regulatory source register PR #127](https://github.com/vishaltradewinds/rupaykg/pull/127)
- [Hardware-edge contract PR #128](https://github.com/vishaltradewinds/rupaykg/pull/128)
- [Timestamp validation PR #129](https://github.com/vishaltradewinds/rupaykg/pull/129)
- [Hardware approval PR #49](https://github.com/vishaltradewinds/rupaykg/pull/49)
- [Evidence-bound instrument PR #51](https://github.com/vishaltradewinds/rupaykg/pull/51)
- [Dual-ledger acceptance PR #108](https://github.com/vishaltradewinds/rupaykg/pull/108)
- [Production safety/EPR/ESG PR #120](https://github.com/vishaltradewinds/rupaykg/pull/120)
- [GRI schema PR #121](https://github.com/vishaltradewinds/rupaykg/pull/121)
