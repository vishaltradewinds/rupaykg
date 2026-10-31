# Government inbox worker module integration — 2026-10-31

## Scope

This draft adds the isolated government inbox worker module and its unit/real-PostgreSQL acceptance tests on top of migration-chain PR #156. It does not wire a scheduler, start a background process, add an HTTP trigger, or activate the worker in any environment.

## Restored source files

| File | Historical Git blob SHA |
|---|---|
| apps/src/async-mirror-worker.ts | 4597bf5c523a00637b5cf334faace100252fe985 |
| apps/src/government-inbox-hash.ts | 653b489ded2b5df9ada1524042ca8d452c587bc2 |
| apps/src/async-mirror-worker.test.ts | c1d12ea207fc95e9f9e42a28f63463467bdc3238 |
| apps/src/async-mirror-worker-db.test.ts | a465afb14a24e7f38a55d6959d1c2867978a7079 |

The worker implementation source includes the null-or-expired lease recovery correction and the matching read-only reconciliation predicate. The DB test uses synthetic fixtures only and requires `RUPAYKG_RUN_DB_INTEGRATION_TESTS=1` plus a disposable `DATABASE_URL`.

## Behaviour under test

- bounded claims using PostgreSQL `FOR UPDATE SKIP LOCKED`;
- per-claim lease tokens and fencing of stale worker completions;
- null/expired lease reclamation and attempts-exhausted quarantine;
- retry/backoff and deterministic rejection;
- canonical payload SHA-256 and timestamp binding;
- exact one-to-one, verified, effective-date/source-version crosswalk resolution;
- missing, ambiguous, expired, revoked and retired mappings remain internal `UNRESOLVED`;
- append-only, payload-free transition history;
- no official acceptance, authoritative MRV mutation, or Guardian/HCS submission.

## Review findings / cautions

- The worker module is intentionally not scheduled or started by the application.
- A successful internal `VALIDATED` result means structural and jurisdiction crosswalk checks only. It is not official acceptance, a verified MRV record, carbon-credit issuance, or external authority confirmation.
- The DB acceptance test provisions synthetic organizations, identities, geography, evidence-vault artifacts, source snapshots and crosswalk requests in the disposable database only.
- The worker's runtime schema depends on the full migration chain in parent PR #156. This is a stacked draft; do not merge this PR before #156 is independently reviewed and merged.
- The historical feature branch is not merged or cherry-picked.

## Required validation

1. Exact historical blob equality at this PR head.
2. Typecheck/build/unit tests.
3. Run the DB acceptance test in disposable PostgreSQL with zero skips and retain test output.
4. Review worker error paths, retry idempotency, event trigger coverage, lease race behaviour, query plans/indexes and data retention/privacy.
5. Confirm no route, scheduler, cron, or deployment starts the worker by default.
6. Independent security review before merge.

## Release posture

No live database writes/DDL, no merge, no deployment, no scheduler activation. Production HOLD. TRL 9 not established.
