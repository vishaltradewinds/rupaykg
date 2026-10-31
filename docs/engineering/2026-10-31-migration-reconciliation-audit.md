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
