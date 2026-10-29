# RupayKg Release Evidence Packet — 2026-10-29

## Purpose and release posture

This packet consolidates the currently recorded engineering evidence and unresolved release gates for RupayKg Carbon OS. It is a working evidence register, not a production certification, independent audit opinion, statutory compliance determination, ICVCM approval, or authorization to issue carbon credits.

**Release decision: HOLD. Production certification: OFF. Scheduler activation: NOT APPROVED.**

## 1. Pull-request and CI evidence snapshot

Snapshot refreshed 2026-10-29 from GitHub PR metadata, reviews, and PR-triggered workflow runs. CI conclusions apply only to the exact commit shown; a documentation refresh commit may require its own CI run.

| PR | Workstream | Head SHA | Recorded CI result | Current disposition |
|---|---|---|---|---|
| #97 | ICVCM integrity controls and governed agentic foundation | `49d4da5480f32fb1bc5b4d2057d605f5ab035ad2` | CI passed (workflow `40831631892`) | Open; no independent review; migration compatibility and live external acceptance remain blockers |
| #102 | Guardian/Mirror Node response hardening | `bb9a12686e54a586aa995d77e1301ea02b1276ed` | CI passed (workflow `40829616919`) | Open; no independent review; live Guardian/Hedera/Mirror Node round trip not demonstrated |
| #108 | Dual-ledger migration compatibility acceptance and production TLS hardening | `12b3860616dfae3a080ccf93051b0ab0bbcce6e3` | Code head passed CI (workflow `40831743887`); subsequent commits on this branch only refresh this evidence packet, and the current documentation-only head still needs exact-head CI | Open; historical migration-source/ledger mismatch remains a hard blocker |
| #109 | Government inbox scheduler shutdown and worker lease safety | `3013a5fbde5567e67a23ab851f3eadddcfc37bc7` | CI passed (workflow `40831665247`) | Open; independent review and cross-PR release reconciliation required |
| #110 | Intelligence-branch CI validation | `a0d7a4cd6f57a752ff1aeac532097f12974811a4` | CI passed (workflow `40829157476`) | Open; reproducible `npm ci` install and own-branch trigger validated |
| #106 | Migration-candidate validation / diagnostic evidence | `4939debab84e66ef87674ba18f0e797b9eb309f5` | CI passed (workflow `40716535582`) | Draft/open; diagnostic only, does not reconcile live migration histories |
| #107 | Fail-closed guard for orphaned migration history | `8ef76f327cf4266d2da745f7a12c272e9b15e3e0` | CI passed (workflow `40723839400`) | Open; preventive guard only, not a substitute for per-environment migration reconciliation |

References:
- PR #97: https://github.com/vishaltradewinds/rupaykg/pull/97
- PR #102: https://github.com/vishaltradewinds/rupaykg/pull/102
- PR #108: https://github.com/vishaltradewinds/rupaykg/pull/108
- PR #109: https://github.com/vishaltradewinds/rupaykg/pull/109
- PR #110: https://github.com/vishaltradewinds/rupaykg/pull/110
- PR #106: https://github.com/vishaltradewinds/rupaykg/pull/106
- PR #107: https://github.com/vishaltradewinds/rupaykg/pull/107

This table is a point-in-time snapshot. Re-query head SHAs and workflow runs before making any merge/release decision.

## 2. Migration provenance — facts and limitations

The prior reconciliation checkpoint records:
- Production migration ledger contains version `096`, filename `096_verification_authorization_provenance.sql`, timestamp `2026-10-27T13:46:14.262Z`.
- Production and staging `public.schema_migrations` records contain `version`, `filename`, and `applied_at`, but no source checksums.
- Production deployment history temporally correlates commit `ca8f4100782e13f8d72106187fafc8e1e446214f` and a migration run reporting 92 files with the migration-ledger timestamp; a subsequent deployment at `54a7fe1ceb41b37a68720a71c10a1dd03af30dea` reported 91 files.
- Recovered migration SQL and the available review fixture were recorded as byte-identical. This is useful source evidence but is not cryptographic proof of the exact SQL executed by a deployed artifact.
- Staging migration source/fixture comparisons reportedly normalize to matching SQL for the reviewed files, but trusted deployment-artifact attestation is not available.

**Provenance classification:** production migration 096 is deployment-correlated and blob-recovered; artifact-level attestation is unavailable. Staging deployed-source provenance remains open.

Do not rewrite historical migration records, fabricate checksums, replay a historical migration, or infer exact deployed SQL solely from timestamps or filenames. Any needed correction must be a reviewed, forward-only migration with an explicit approval and recovery plan.

## 3. Dual-ledger compatibility and disposable rehearsal

The previous checkpoint records a disposable Neon rehearsal branch named `shakti-unresolved-migration-rehearsal-20261028` (branch ID `br-broad-glade-b46npw8o`) where a candidate forward migration was applied twice. The `UNRESOLVED` status was accepted and `INVALID_TEST_STATUS` rejected in that rehearsal. The rehearsal added four controlled append-only event rows; it did not change the recorded inbox count.

These are historical checkpoint notes, not a claim that live database access or current database state has been re-verified on 2026-10-29. Reconfirm the rehearsal artifacts and exact migration commit before using them as release evidence.

Recorded staging snapshot at the time of the prior checkpoint:
- `async_mirror_inbox`: 12 rows, including 8 `PROCESSING`, 1 `QUARANTINED`, 1 `RECEIVED`, 1 `RETRY`, and 1 `VALIDATED`.
- `async_mirror_inbox_events`: 29 rows before rehearsal-generated test events.
- The recorded staging CHECK constraint did not include `UNRESOLVED`; the candidate migration had not been approved/applied to staging or production.

## 4. Required gates before release

### A. Exact-head engineering validation
- Run the full CI suite against the latest head of each release candidate.
- For PR #109, run typecheck, build, scheduler/drain tests, migration validation, and disposable PostgreSQL 16 integration tests on its exact head.
- Confirm CI is triggered for the actual PR base branch; do not substitute a run from another SHA or branch.
- Preserve test logs and artifact identifiers.

### B. Worker and scheduler safety
- Resolve `UNRESOLVED` status / database CHECK constraint compatibility.
- Validate lease expiry, renewal or bounded processing time, fencing tokens, and concurrent workers with a batch size of 10 and default lease of 120 seconds.
- Test database failures during both primary persistence and retry/error persistence.
- Test process termination at each persistence boundary; establish idempotent retry and append-only event consistency.
- Test SIGTERM/SIGINT during initial tick, stalled work, telemetry callback failure, and pool-close timeout/rejection.
- Keep the scheduler disabled until these gates pass and a separate operational approval is recorded.

### C. Guardian/Hedera/Mirror Node evidence
- Demonstrate a controlled non-production round trip: Guardian response, Hedera consensus proof, Mirror Node retrieval, and RupayKg provenance verification.
- Capture request/correlation IDs, transaction/message IDs, consensus timestamps, response digests, and reproducible verification output.
- Distinguish simulated tests from live external acceptance. Do not treat a mocked provider response or a successful build as a consensus proof.

### D. Governance, regulatory and carbon-credit integrity
- Obtain independent code/security/database review and record reviewer identity, scope, findings, and disposition.
- Keep Indian statutory/regulatory applicability as the primary compliance layer. ICVCM Core Carbon Principles remain a complementary integrity benchmark and must not be represented as ICVCM certification.
- Do not issue credits, label a project independently verified, or make a statutory compliance claim without the relevant authoritative evidence and authorized decision.

## 5. Shakti Standards / TRL

The lifecycle gates remain: context and evidence discovery; legal/regulatory applicability; feasibility; design; engineering; test; independent review; authorization; deployment; operation; measurement; continuous assurance.

TRL remains **provisional TRL 4** based on the previous engineering checkpoint. TRL 5 has not been demonstrated by the evidence recorded here. Reassess only against a documented, relevant-environment validation protocol and results; repository CI alone is insufficient.

## 6. Change control and sign-off

For each gate, record:
- exact repository, branch, commit SHA and artifact digest;
- environment (disposable, staging, or production) and authorization;
- reproducible command/test and raw result;
- reviewer/approver identity and independence;
- findings, corrective action, retest evidence, and residual risk;
- explicit go/no-go decision.

**Current final decision: NO-GO for production certification or scheduler activation.** Re-open only after blockers are evidenced as resolved and independently reviewed.
