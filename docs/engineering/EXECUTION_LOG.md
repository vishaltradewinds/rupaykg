# RupayKg engineering execution log

This file is the durable, append-only session handoff for repository work. New sessions must read this log and the active migration reconciliation audit before changing code or infrastructure.

## 2026-10-31 — Resume and P0 migration audit

### Repository setup
- Canonical repository: `vishaltradewinds/rupaykg`
- Base commit: `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`
- Created working branch: `engineering/rupaykg-resume-2026-10-31`
- No changes made to `main`.

### Actions completed
1. Reconnected to GitHub and Neon project `steep-mud-79906940`.
2. Re-read canonical package scripts, migration validator and ecosystem-state reconciler.
3. Read exact production and staging `schema_migrations` rows.
4. Queried relevant table existence, verification columns, trigger names/definitions, constraints and row counts.
5. Recovered migration 096 source and exact blob SHA from historical commit `ca8f4100782e13f8d72106187fafc8e1e446214f`.
6. Recovered migration source names and exact blob SHAs for versions 20261022–20261025 from branch `shakti/restore-async-migration-source-2026-10-31`.
7. Confirmed staging has 12 inbox rows and 29 append-only event rows; production lacks the inbox/AI intake relations.
8. Confirmed production has migration 096 provenance columns while staging does not; production verification table had zero rows at audit time.
9. Created this durable log and the companion migration reconciliation audit.

### Actions explicitly NOT performed
- No SQL writes, DDL, migration execution, migration-ledger edits, data copy, row deletion, or queue mutation.
- No deployment, scheduler activation, external Guardian/Hedera submission, certification, or credit issuance.
- No source migration was restored to the working branch in this batch; that requires the full schema/function and source-chain review described in the audit.

### Current gate
- P0 migration/schema reconciliation: IN_PROGRESS / BLOCKED pending exact DDL/function and rehearsal evidence.
- Production migration/deployment: HOLD.
- Scheduler: OFF.
- Certification: HOLD.

### Next action
Continue with exact source-manifest comparison and function/trigger DDL comparison. Then inspect data distributions and worker lease/event integrity read-only. Only after these checks should a candidate migration source restoration be proposed and rehearsed on disposable PostgreSQL.

## Required logging format for every subsequent batch

Append a dated entry recording:
- exact repository branch and base/head commit;
- files added/changed/deleted with reason;
- tools/actions and whether read-only or mutating;
- databases/branches touched and exact SQL or migration identifiers;
- test names, exact commit tested, results and artifacts;
- security/compliance implications;
- unresolved blockers and next single action;
- approval status before any production-affecting action.

Never mark a gate complete without durable evidence. Never replace historical entries; append corrections with timestamps.


### Follow-up actions — 2026-10-31 (same audit batch)
10. Compared `prevent_invalid_verification()` function definitions by live catalog hash and fetched both bodies. Confirmed a material security difference: production has decision-time organization membership/role/permission snapshot enforcement; staging retains the older generic permission check.
11. Captured staging worker queue status distribution: 8 PROCESSING, 1 QUARANTINED, 1 RECEIVED, 1 RETRY, 1 VALIDATED.
12. Confirmed all 8 PROCESSING leases are expired (expiry timestamps 2026-10-20); all have non-null lease token and lease_until. No rows were altered.
13. Confirmed `ai_intake_rate_limits` and `ai_evidence_intake_jobs` are present in staging and currently empty.
14. Updated the audit with these findings and a stricter security/worker recovery gate.

### New critical blocker
The `verifications_integrity_guard` trigger name is the same in both databases, but its function body is not. Production enforces decision-time organization-specific verifier authority and records the authorization snapshot; staging does not. Treat this as a security-control divergence, not a cosmetic schema mismatch.

The 8 expired PROCESSING inbox rows are preserved and must not be automatically replayed or reset. Worker recovery is a separate reviewed workstream.


### Disposable migration rehearsals — 2026-10-31
15. Inspected existing rehearsal branch ancestry and confirmed it is a staging-derived branch; no production/staging parent was modified.
16. Applied the exact historical migration 096 SQL transactionally to the staging-derived rehearsal branch `br-broad-glade-b46npw8o`. Verified all four provenance columns, one integrity trigger, and function fingerprint equal to production. Verification rows remained zero and ledger remained unchanged. Schema/function rehearsal PASS.
17. Created a dedicated production-derived Neon rehearsal branch `br-frosty-term-b47k7ayc` from production branch `br-restless-base-b44cip2h`. An initial branch-create request using a custom suspend timeout was rejected by account policy; retried with account defaults and branch creation succeeded. No production changes.
18. Applied exact migration SQL 20261022–20261025 in filename order inside one transaction on the production-derived rehearsal branch only.
19. Compared schema fingerprints against staging: columns, constraints, indexes and triggers matched; normalized function fingerprints matched.
20. Ran a rollback-contained synthetic trigger test: inbox insert created one event, status transition created a second, append-only event mutation was rejected, and all synthetic rows were rolled back. Post-test inbox/event row counts were zero.
21. Confirmed source migration filenames match live ledger filenames in the environments where they are already applied. Reviewed `apps/src/migrate.ts`: lexical ordering, version+filename identity, transactional per-migration application, stop on first failure.
22. Documented that the migration runner does not verify source-content checksums; this is a follow-up integrity gap, not changed in this batch.

### Current state after rehearsals
- 096 staging-shaped schema/function rehearsal: PASS.
- 20261022–20261025 production-shaped DDL and worker-trigger rehearsal: PASS.
- Full migration-runner rehearsal: NOT YET RUN.
- API-level verifier authorization acceptance: NOT YET RUN.
- Production/staging migration ledgers: UNCHANGED.
- Worker queue records: UNCHANGED; eight expired PROCESSING leases remain preserved.
- Production deployment and scheduler: HOLD/OFF.


### Coordination and cost-control update — 2026-10-31
23. Searched existing open migration PRs before creating any source-restoration PR. Found PR #157 already contains the exact source migrations 096 and 20261022–20261025, plus the broader migration chain, migration-order logic, worker and production-shaped CI acceptance. Verified exact blob SHAs for the five recovered source files match the independent historical source evidence. No duplicate migration PR was created.
24. Verified PR #157 exact head `b3655259ce0f9d650477c34fa07a2a61d4a72f75` CI run #41190853951 passed every listed workflow step, including exact 92-row production baseline reconstruction, upgrade, idempotency, PostgreSQL acceptance and production container build.
25. Created production-derived Neon rehearsal branch `br-frosty-term-b47k7ayc` from production, applied only 20261022–20261025 DDL in one transaction, ran schema and rollback-contained worker trigger tests, then suspended its compute endpoint `ep-polished-hat-b4y8wpnp`.
26. Suspended the existing staging-derived rehearsal compute endpoint `ep-red-bar-b4ywq6ug` after the 096 rehearsal. Both endpoints were verified IDLE. The new production-derived branch remains present; deletion requires explicit user approval. No guarantee of zero storage/branch cost is inferred.
27. Updated the audit to designate PR #157 as the canonical implementation path and PR #159 as documentation-only.

### Current next action
Review PR #157's exact-head migration ordering, baseline manifest, worker/security acceptance and open review blockers against the newly recorded live evidence. Do not duplicate migration sources, merge, deploy, or reactivate the worker.


### Verification provenance security review — 2026-10-31
28. Inspected existing PR #140 and its disposable PostgreSQL test. Confirmed the production migration-096 trigger refreshes authorization snapshots on any UPDATE of an approved row; a no-op update after role-permission change rewrites the decision-time snapshot.
29. Confirmed PR #157's production-shaped upgrade test preserves the existing verifier function hash; this is not a fix for the snapshot mutation defect.
30. Hardened PR #140's unnumbered proposed fixture so linkage is immutable for every update of an already-approved row, including transitions away from APPROVED. Added regression assertions for decision-away + evidence/activity mutation and verifier identity mutation. Plain transition away preserves the original snapshot.
31. Latest PR #140 head: `5229e8299ba5a49af86748730e3fea42374e9d22`; exact-head CI #41191863577 is in progress. No pass claim until it completes.
32. Commented on PR #157 to block security-complete/merge claims until a separately reviewed forward-only migration, API/DB acceptance and independent review address snapshot immutability.

### Updated release gate
Verification provenance integrity is NOT COMPLETE. Do not edit/replay migration 096, do not change live Neon, and do not merge PR #157 until the forward-only correction has exact-head acceptance and independent security/database review.
