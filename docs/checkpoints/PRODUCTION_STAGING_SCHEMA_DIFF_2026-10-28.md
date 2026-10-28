# Production / Staging Schema Drift — 2026-10-28

## Status

**Read-only comparison completed. Reconciliation NOT applied. Production certification remains HOLD.**

Compared Neon database `rupaykg` on:
- Production branch: `br-restless-base-b44cip2h`
- Staging branch: `br-spring-hill-b4544vz5`
- Project: `rupaykg-production-fresh`

The comparison used Neon’s branch schema-diff operation. No application SQL, DDL, DML, ledger repair, or queue mutation was executed by this audit.

## Main findings

### 1. Staging-only async mirror and AI intake schema

The schema diff reports these objects in staging but not production:
- `async_mirror_inbox` and its status-event table, sequence, indexes, constraints, and event triggers/functions
- `ai_intake_rate_limits`
- `ai_evidence_intake_jobs`

This matches the prior read-only ledger/catalog audit: staging records the date-prefixed migrations from 2026-10-22 through 2026-10-25; production does not. Staging had 12 inbox rows and 29 event rows in the earlier read-only row audit. These records were not modified.

The worker path is **not releasable** based on schema presence alone. In particular, the worker can emit `UNRESOLVED`, while the recovered 2026-10-23 status CHECK constraint does not allow that value. The proposed 2026-11-01 corrective migration is future-dated relative to this audit and is not proof of a deployed fix. Keep the scheduler disabled until a reviewed, correctly ordered corrective migration and real PostgreSQL transition tests are green.

### 2. Production-only verification authorization provenance

The schema diff also shows production contains verification authorization provenance fields absent from staging:
- `verifications.authorization_membership_id`
- `verifications.authorization_role_id`
- `verifications.authorization_permissions_snapshot`
- `verifications.authorization_checked_at`

Production’s verification trigger/function also contains stricter logic that binds verification to evidence/activity and checks active verifier permission within the activity organization, then records the authorization snapshot. The schema diff shows foreign keys from the membership/role provenance fields.

This is material functional drift, not merely migration naming. Do not downgrade production or replay migrations to force equality. Establish the canonical intended release and reconcile forward through reviewed migrations.

### 3. Scope and limits

- This is a schema-diff report, not a full data equivalence audit.
- The diff is directional: production compared with staging as the base. The findings above describe objects/definitions that differ in those directions.
- A matching object name or prior matching column/constraint counts does not prove every definition, trigger, index, policy, function body, sequence state, or seed row is identical.
- The live ledgers already diverge: production records numbered migration 096 and date-prefixed 2026-10-18–21 migrations; staging records date-prefixed 2026-10-18–25 migrations. Numbered replacements 088–091 are not a contiguous applied history in production.
- Do not edit already-applied migration files, delete staging queue rows, replay 088–091, or merge the substantially diverged AI middleware branch wholesale.

## Acceptance test result

GitHub Actions run:
https://github.com/vishaltradewinds/rupaykg/actions/runs/40725301742

Result: **success** for the full CI workflow, including:
- dual-ledger disposable PostgreSQL acceptance test
- actual `apps/src/migrate.ts` runner against isolated production-shaped and staging-shaped fixtures
- repeat-run no-op checks
- preservation checks for 12 synthetic inbox rows and 12 corresponding event rows in the fixture
- fail-closed check when a recorded migration file is absent
- production container build

Important limitation: these are compact test fixtures derived from recovered migration SQL, not a byte-for-byte run of both complete live historical ledgers. The test simulates the relevant ledger shapes in isolated schemas and does not make the live databases equivalent.

## Required next gates

1. Independently review fixture SQL against recovered source blobs; record any semantic differences and make fixtures faithful or explicitly justify each intentional reduction.
2. Extend acceptance coverage to the actual full migration runner against representative complete ledger histories, including the legacy date-prefixed migration filenames and production’s 096 history. Do not pretend the four-migration fixture is a full-ledger simulation.
3. Build a canonical object-level inventory for the staging-only and production-only objects, including function definitions, trigger bindings, constraints, indexes, sequence ownership/state, policies, and seed/reference data.
4. Resolve the worker `UNRESOLVED` status constraint with a reviewed forward migration and a real disposable-PostgreSQL integration test that proves both unresolved and normal transitions.
5. Prepare a forward-only reconciliation plan with explicit preconditions, rollback/restore approach, data preservation checks, and independent review. Test it on disposable/temporary branches before any live change.
6. Keep production certification, production migration changes, and scheduler activation **HOLD** until every gate is evidenced.

**Shakti disposition:** engineering test gate improved; live environment reconciliation and production certification remain blocked.
