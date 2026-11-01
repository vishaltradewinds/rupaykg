# Neon production/staging branch reconciliation — 2026-11-01

**Repository:** `vishaltradewinds/rupaykg`
**Authoritative Neon project:** `steep-mud-79906940`
**Production branch:** `br-restless-base-b44cip2h` (`main`, primary)
**Staging branch:** `br-spring-hill-b4544vz5` (`rupaykg-gov-inbox-staging-20261020`)
**Database:** `rupaykg`
**Method:** read-only SQL/catalog inspection and repository source lookup. No DDL/DML or branch mutations.

## Executive decision

Production `main` is the only authoritative live production database branch identified in this audit. The staging branch is not a disposable/empty rehearsal: it contains distinct schema history and persisted asynchronous inbox data. Do not delete, reset, promote, or merge its schema/data automatically.

## Migration ledger comparison

| Branch | Ledger rows | Relevant range / exceptions |
|---|---:|---|
| Production | 92 | Baseline through 20261021, plus historical version 096 |
| Staging | 95 | Baseline through 20261025; no version 096 |

Exact staging-only ledger entries:
- `20261022_async_mirror_inbox.sql`
- `20261023_async_mirror_worker_leases.sql`
- `20261024_ai_intake_rate_limits.sql`
- `20261025_ai_evidence_intake_jobs.sql`

Exact production-only historical entry:
- `096_verification_authorization_provenance.sql`

Repository source lookup on `main` returned NOT_FOUND for all five files. The production-only version 096 is already documented as a historical production-applied migration whose source was removed from main; it must remain an explicit, checksummed historical exception and must not be recreated or rerun blindly. The four staging-only migrations have no source files on main and must be recovered from their originating branch/commit or deployment artifact before any promotion, rollback, or schema cleanup decision.

## Staging-only object and data findings

The four staging-only migrations correspond to four additional public tables:
- `async_mirror_inbox`
- `async_mirror_inbox_events`
- `ai_intake_rate_limits`
- `ai_evidence_intake_jobs`

Read-only counts on staging:
- `async_mirror_inbox`: 12 rows
- `async_mirror_inbox_events`: 29 rows
- `ai_intake_rate_limits`: 0 rows
- `ai_evidence_intake_jobs`: 0 rows

Inbox status distribution:
- PROCESSING: 8
- QUARANTINED: 1
- RECEIVED: 1
- RETRY: 1
- VALIDATED: 1

All 8 PROCESSING rows had expired leases at audit time; there were zero PROCESSING rows with a non-expired lease. One RECEIVED/RETRY item was due for processing. This is not evidence that the worker should be started: the records and event history require item-by-item reconciliation first.

All four staging-only tables had RLS disabled, FORCE RLS disabled, and zero RLS policies in the inspected catalog. The production branch also had zero RLS-enabled public tables and the inspected database role `rupaykg` has `BYPASSRLS`.

## Required decisions and safe next actions

1. Keep the production Neon primary branch as the sole production authority. Do not switch application targets based on branch names or migration counts alone.
2. Preserve staging data. Do not drop the four staging-only tables or reset the branch.
3. Recover the exact four staging migration source files and their commit provenance. Compare each source with the live staging schema before deciding whether these capabilities are still required.
4. Preserve version 096 as a production historical exception with exact provenance/checksum. Never restore it as a runnable pending migration without a separate compatibility analysis.
5. Keep asynchronous mirror and AI intake workers OFF. Reconcile all 12 inbox rows against the 29 append-only events, source batch IDs, lease history, payload hashes, and authority acknowledgements. Decide retry/quarantine/manual closure per record with evidence.
6. Before any worker activation, add tenant ownership, least-privilege worker identity, RLS/policy coverage, idempotency, bounded retries, lease recovery, dead-letter handling, and observability. Prove isolation and replay safety on a disposable branch.
7. Do not promote staging-only migrations to production until source recovery, migration replay tests, data compatibility checks, security review, and explicit release approval pass.
8. Keep production HOLD. This checkpoint is discovery evidence, not a production change approval.

## Release and TRL posture

- Production DDL/DML: none.
- Staging DDL/DML: none.
- Worker/scheduler activation: none.
- Production certification: OFF / HOLD.
- TRL 9: not established.

**Decision:** production is authoritative; staging is retained as a data-bearing divergent environment under quarantine/reconciliation, not treated as obsolete or safe to delete.
