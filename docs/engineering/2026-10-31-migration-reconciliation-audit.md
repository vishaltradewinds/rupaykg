# Migration reconciliation audit — 2026-10-31

## Status

**P0 / BLOCKED — source history and live schemas are not yet reconciled.** This is a read-only audit and source-provenance checkpoint. No SQL writes, DDL, migration replay, row updates, queue changes, production deploys, or certification actions were performed.

## Scope and exact environment

- Repository: `vishaltradewinds/rupaykg`
- Audited repository base: `main` at `54a7fe1ceb41b37a68720a71c10a1dd03af30dea` (2026-10-27T13:45:20Z)
- Working documentation branch: `engineering/rupaykg-resume-2026-10-31` (created from the exact base SHA above)
- Neon project: `rupaykg-production-fresh` / project ID `steep-mud-79906940`
- Production branch ID: `br-restless-base-b44cip2h`
- Staging branch ID: `br-spring-hill-b4544vz5`
- Rehearsal branch ID: `br-broad-glade-b46npw8o` (branch was found READY in the previous read-only audit; no additional rehearsal SQL was run in this batch)

## Live migration ledger

| Version family | Production | Staging |
|---|---:|---:|
| `001`–`087` | present | present |
| `096` | present | absent |
| `20261018`–`20261021` | present | present |
| `20261022`–`20261025` | absent | present |
| Total ledger rows | 92 | 95 |

These totals and the exact version rows were read directly from `public.schema_migrations`. The difference is not safely resolved by comparing counts: the environments have different migration histories and different live schema objects.

## Source provenance recovered from Git

The current `main` tip does not contain `migrations/096_verification_authorization_provenance.sql`, but the exact historical source was recovered at commit `ca8f4100782e13f8d72106187fafc8e1e446214f`:

- Path: `migrations/096_verification_authorization_provenance.sql`
- Blob SHA: `258b1f4534efbf915688f78aa84d4ec24a47cbc0`
- Source: https://github.com/vishaltradewinds/rupaykg/blob/ca8f4100782e13f8d72106187fafc8e1e446214f/migrations/096_verification_authorization_provenance.sql
- Historical mainline removal commit: `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`, message: “Remove accidentally placed unreviewed verification migration from main”.

The four staging-only migration sources are present on `shakti/restore-async-migration-source-2026-10-31` (branch head `94e1a98296351b8a69631a5479d6c309c7562d48`):

| Version | Source file | Blob SHA |
|---|---|---|
| 20261022 | `20261022_async_mirror_inbox.sql` | `4d08607e03561b9fbb4ce502b4c4211127237050` |
| 20261023 | `20261023_async_mirror_worker_leases.sql` | `33cb4d5d2e29a4a111340e5a0ac34170a0081895` |
| 20261024 | `20261024_ai_intake_rate_limits.sql` | `87b51fe60a96a4e0752c8b0a9a170c81f9936dbb` |
| 20261025 | `20261025_ai_evidence_intake_jobs.sql` | `6a0ae54530b7b756dac33589eaf18df3b071d8f2` |

Source branch: https://github.com/vishaltradewinds/rupaykg/tree/shakti/restore-async-migration-source-2026-10-31

Important: these are not four migrations all belonging to the mirror inbox. Version 20261023 adds worker leases and append-only inbox events; 20261024 creates AI intake rate limits; 20261025 creates AI evidence-intake idempotency jobs. Do not rename, reorder, or conflate them.

## Live schema observations

### Verification authorization provenance (migration 096)

- Production `verifications` has all four provenance columns: `authorization_membership_id`, `authorization_role_id`, `authorization_permissions_snapshot`, `authorization_checked_at`.
- Staging `verifications` does not have those four columns.
- Both environments report a `verifications_integrity_guard` trigger, but trigger name equality does not prove function-body equality. The exact function definitions and trigger semantics still require comparison before replay.
- Production currently has zero verification rows, including zero approved rows. This means there is no observed existing verification row requiring a provenance backfill in this snapshot; it does not remove the need for a rehearsed, reviewed migration.

### Staging-only worker and AI intake objects

Production does not have these relations:
- `async_mirror_inbox`
- `async_mirror_inbox_events`
- `ai_intake_rate_limits`
- `ai_evidence_intake_jobs`

Staging has all four. Staging currently contains 12 rows in `async_mirror_inbox` and 29 rows in `async_mirror_inbox_events`. These rows must be preserved; no production backfill or data copy is authorized by this audit.

The staging inbox schema includes the worker lease and retry/quarantine columns from migration 20261023. Its status constraint includes `VALIDATED` and `QUARANTINED`, beyond the initial 20261022 source definition. This is consistent with the 20261023 worker-lease migration and must be validated against the exact source, triggers, indexes and data before any reconciliation.

## Important validator limitation

Current `scripts/validate-migrations.mjs` checks duplicate numeric prefixes and duplicate CREATE TYPE/TABLE declarations. It does not compare:
- the complete migration source manifest to every live ledger;
- applied migration source hashes to stored hashes;
- the live schema to the ordered result of replaying migrations;
- trigger/function/index/RLS/policy parity across environments.

The repository `package.json` exposes `validate:migrations` and `ecosystem:reconcile`; these are useful checks but do not by themselves prove production/staging schema parity.

## Required next sequence — no skipping

1. Recover all source migrations and their exact blob hashes from immutable commits/branches; review branch ancestry and whether any candidate is already represented in an open PR.
2. Compare full migration manifests and hashes for `main`, source-recovery branches, production and staging.
3. Compare relevant live DDL in both environments: tables, columns, constraints, indexes, triggers, trigger-function bodies, foreign keys, policies and grants. Specifically compare `prevent_invalid_verification()`, `record_async_mirror_inbox_event()`, `prevent_async_mirror_inbox_event_mutation()` and the inbox status/lease structures.
4. Check data counts, status distributions, orphan references, duplicate keys and event-chain continuity without reading or exporting sensitive payloads.
5. Restore canonical migration source files on a dedicated branch only after exact source and ordering review. Do not synthesize or renumber migration files.
6. Rehearse the exact candidate migration chain on a disposable production-shaped PostgreSQL database. Capture pre/post schema, data counts, migration ledger, rollback/recovery procedure, lock duration and failure behavior.
7. Obtain independent review and exact-head CI. Only then prepare a separate production change request with explicit approval and recovery window.

## Release gates

- Production migrations: HOLD
- Production deployment: HOLD
- Worker scheduler activation: OFF
- Guardian/Hedera/Mirror Node live acceptance: NOT PROVEN by this audit
- Carbon-credit issuance/certification: HOLD
- No claims of TRL 9

## Audit integrity

All database operations in this batch were read-only SELECT/catalog queries. This document is evidence of observations at the stated branch IDs and time; it is not an approval to mutate production or staging. Re-run the read-only inventory immediately before any later change because live environments can change.


## Follow-up read-only findings — 2026-10-31

### Trigger function parity is definitively FAIL

Catalog hashes of `public.prevent_invalid_verification()`:
- Production: `934a7be13f08c034bbd15e96285eb1be`
- Staging: `43e9af83f5031460689f7943d697a50a`

The function bodies were fetched and compared. Production implements the migration-096 decision-time authorization snapshot: it binds evidence to the activity, verifies active membership in the activity organization, checks verifier permission, prevents self-review, and writes the four authorization snapshot fields. Staging still uses the older `has_verification_permission(verifier_identity_id)` check and does not set the four snapshot fields. Thus the same trigger name in both environments masks materially different authorization behavior. Migration 096 is not just a ledger discrepancy; it represents a real security-control divergence.

Staging-only function hashes:
- `record_async_mirror_inbox_event()`: `4cb57a43e325f4aa536eb7ad37e54c8f`
- `prevent_async_mirror_inbox_event_mutation()`: `25e5a58589b7f3075b6dd71e81919a55`

Production does not have these functions because the corresponding inbox/event relations do not exist.

### Staging worker queue requires explicit recovery analysis

Staging `async_mirror_inbox` status distribution at audit time:
| Status | Rows |
|---|---:|
| PROCESSING | 8 |
| QUARANTINED | 1 |
| RECEIVED | 1 |
| RETRY | 1 |
| VALIDATED | 1 |
| Total | 12 |

All eight `PROCESSING` rows had a non-null lease token and lease expiry, but all eight leases were expired at query time. Earliest recorded expiry: `2026-10-20T10:17:01.399Z`; latest: `2026-10-20T10:17:32.753Z`. These rows must not be reset, replayed, or deleted as part of a migration-ledger fix. A separate idempotent recovery protocol and payload-free forensic review are required before worker activation.

The two AI intake tables created by 20261024 and 20261025 are present in staging and both currently contain zero rows. This is evidence for this snapshot only.

### Updated next gate

Before migration source restoration:
1. Build an exact schema/function diff for 096 and 20261022–20261025.
2. Reconcile why production has the 096 security enhancement while staging retains the older trigger body.
3. Preserve the eight expired PROCESSING rows and define a separately tested, auditable worker-lease recovery procedure.
4. Test the ordered migration source on a disposable production-shaped database and a staging-shaped database; do not run it against either live branch.


## Disposable rehearsal evidence — 2026-10-31

### Rehearsal A: restore migration 096 on staging-shaped branch

- Branch: `shakti-unresolved-migration-rehearsal-20261028`
- Neon branch ID: `br-broad-glade-b46npw8o`
- Parent: staging branch `br-spring-hill-b4544vz5`
- Before: 95 ledger rows; four authorization columns absent; `prevent_invalid_verification()` fingerprint `43e9af83f5031460689f7943d697a50a`; zero verification rows.
- Applied the exact historical migration-096 SQL in one transaction on this rehearsal branch only.
- After: all four authorization columns present; exactly one integrity trigger; function fingerprint `934a7be13f08c034bbd15e96285eb1be`, matching production; zero verification rows; ledger unchanged at 95.
- Result: **schema/function rehearsal PASS**. This did not test the full API workflow or authorization behavior using representative actors and records.

### Rehearsal B: apply migrations 20261022–20261025 on production-shaped branch

- Created Neon branch: `rupaykg-migration-rehearsal-prod-2026-10-31`
- Neon branch ID: `br-frosty-term-b47k7ayc`
- Parent: production branch `br-restless-base-b44cip2h`; created from production at 2026-10-31T10:07:49Z.
- Applied the exact SQL from the four recovered migration files, in filename order, inside one transaction on this rehearsal branch only.
- Result: all four relations exist; columns, constraints and indexes match staging fingerprints; trigger definitions match; normalized worker-function fingerprints match staging:
  - `record_async_mirror_inbox_event()`: `27d1cd516b798e678c808db7f1e95b82`
  - `prevent_async_mirror_inbox_event_mutation()`: `dd40421c9482dac007f52bd2e20380bb`
- Trigger behavior test: a synthetic inbox insert generated one event; transition to VALIDATED generated a second event; an attempted event mutation was rejected by the append-only trigger. The test was wrapped in a subtransaction and deliberately rolled back. Post-test counts remained zero for inbox and event tables.
- AI rate-limit and AI intake-job tables were created successfully and remain empty in this rehearsal.
- Rehearsal ledger remains at 92 because this was a DDL rehearsal, not execution through the migration runner. No ledger rows were fabricated.

### Migration runner compatibility review

Current `apps/src/migrate.ts`:
- sorts migration filenames lexically;
- checks existing version and filename identity;
- skips a migration only when the recorded filename matches;
- runs each new migration and its ledger insert in a transaction;
- stops on the first failure.

The live ledger filenames exactly match the recovered source filenames for migration 096 in production and 20261022–20261025 in staging. Therefore, once the exact files are restored to the canonical migration directory, the runner should skip those already-recorded migrations and apply only the missing set in each environment. This conclusion is conditional on exact source restoration and runner execution; it is not a production approval.

The runner does not persist or compare a source-content checksum. Same-version/same-filename source edits are therefore not detected by the current ledger. Record this as a migration-integrity improvement requirement; do not change the ledger format in this batch.

### Rehearsal limitations and remaining gates

- The production-derived rehearsal is a branch clone and must remain isolated; it has not been promoted or merged into production.
- The staging-derived rehearsal has not been promoted or merged into staging.
- No production/staging migration ledger was changed.
- No application API-level authorization acceptance test was executed against representative verifier memberships.
- No worker queue rows were replayed or reset.
- Independent review and exact-head CI remain required before source restoration is merged or any live migration runs.


## Coordination with the existing canonical implementation PR — 2026-10-31

A repository-wide open-PR search found that **PR #157 is already the canonical implementation/reconciliation path**. Do not create a duplicate migration-source restoration PR.

- PR: https://github.com/vishaltradewinds/rupaykg/pull/157
- Branch: `shakti/integrate-government-inbox-worker-2026-10-31`
- Exact head inspected: `b3655259ce0f9d650477c34fa07a2a61d4a72f75`
- Base: `main` at `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`
- Exact-head CI run: https://github.com/vishaltradewinds/rupaykg/actions/runs/41190853951
- CI conclusion: SUCCESS. All steps passed, including migration validation, exact production-baseline reconstruction, schema/verifier capture, proposed upgrade chain, second-run idempotency, typecheck, build, browser smoke, disposable PostgreSQL acceptance, evidence upload and production-container build.

PR #157 contains the exact recovered source blobs for migration 096 and 20261022–20261025; their blob SHAs match the independently recovered historical sources recorded above. It also contains the broader 20261026–20261111 chain, migration-order phase handling, production-shaped reconstruction/upgrade tests, worker implementation and DB acceptance tests. The exact-head run is stronger CI evidence than the documentation-only PR #159 run and should remain the primary implementation review.

PR #159 remains a separate documentation/handoff PR only. No duplicate migration-source PR was opened.

## Additional Neon rehearsal branch and cost containment

A dedicated production-derived Neon branch was created for the limited 20261022–20261025 DDL rehearsal:
- Branch: `rupaykg-migration-rehearsal-prod-2026-10-31`
- Branch ID: `br-frosty-term-b47k7ayc`
- Parent: production `br-restless-base-b44cip2h`
- Its read-write compute endpoint was suspended after testing: `ep-polished-hat-b4y8wpnp`; final observed state: `idle`.
- The existing staging-derived rehearsal endpoint `ep-red-bar-b4ywq6ug` was also suspended after testing; final observed state: `idle`.

The new Neon branch itself remains present and contains a production-derived data snapshot plus the rehearsed DDL. Compute is suspended. Branch deletion was not performed; obtain explicit user approval before deleting it. Do not reactivate either endpoint unless a new rehearsal is approved.

The initial create request with a custom suspend timeout was rejected by account policy; retrying with account defaults succeeded. No billing-free guarantee is inferred from the tool response. Check current Neon pricing/usage before further branch or compute use.

## Consolidated execution decision

- Use PR #157 as the sole migration/worker implementation review path.
- Keep PR #159 as the durable execution log and audit trail.
- Do not merge either PR automatically.
- Production and staging remain unchanged; migration/deployment HOLD.
- Worker scheduler OFF; eight expired staging PROCESSING rows remain preserved.
- Independent review, live drift reconciliation, explicit change approval and recovery plan remain mandatory.


## Security regression discovered in migration 096 — 2026-10-31

### Finding

The production implementation of `prevent_invalid_verification()` refreshes the four authorization provenance fields whenever an UPDATE leaves `NEW.decision = 'APPROVED'`. A no-op or unrelated update to an already-approved verification can therefore replace the supposed decision-time permissions snapshot and timestamp with current role permissions. This makes the historical snapshot mutable.

This behavior was reproduced by the disposable PostgreSQL regression test in PR #140: change the role permissions, issue a no-op UPDATE to the approved verification, and observe the authorization snapshot/timestamp change. This is a material audit-integrity/security defect in the currently deployed function, not merely a staging/production difference.

### Candidate forward-fix hardening

PR #140 is the existing focused test path. Its unnumbered proposal was hardened on 2026-10-31:
- for any UPDATE where `OLD.decision = 'APPROVED'`, verifier/evidence/activity linkage changes are rejected regardless of the new decision value;
- an update transitioning away from APPROVED without changing linkage preserves the original snapshot;
- regression tests cover attempts to change evidence/activity while transitioning away and attempts to change verifier identity while transitioning away.

Latest PR #140 head: `5229e8299ba5a49af86748730e3fea42374e9d22`.
Exact-head CI: [#41191863577](https://github.com/vishaltradewinds/rupaykg/actions/runs/41191863577), IN PROGRESS at the time of this checkpoint. No pass claim is made.

### Impact on canonical migration PR #157

PR #157 exact-head CI run #41190853951 passes the production-shaped baseline and upgrade, and verifies the historical verifier function hash remains unchanged. That preservation test does **not** fix the snapshot-rewrite behavior; it preserves the current behavior. Treat PR #157's migration chain as engineering-tested but not security-complete for verification provenance.

### Required remediation gate

Before PR #157 can be considered for merge/release:
1. Finish exact-head CI for PR #140.
2. Independently review the proposed trigger semantics, especially row-lock/concurrency behavior, approved-row linkage immutability, explicit audited correction/reapproval, trigger privileges and search_path, and handling of historical approved rows.
3. Convert the reviewed semantics into a separately numbered forward-only migration after the existing candidate chain; never edit migration 096.
4. Add the migration to production-shaped reconstruction/upgrade/idempotency tests and API-level verifier authorization acceptance.
5. Rehearse on disposable PostgreSQL and review before any live migration request.

No live Neon function or trigger was changed. Production remains on the existing function. Staging remains on the older function. This is a P0/P1 security release blocker pending reviewed remediation.
