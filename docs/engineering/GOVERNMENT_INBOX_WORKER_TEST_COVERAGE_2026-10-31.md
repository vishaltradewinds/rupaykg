# Worker integration coverage assessment — 2026-10-31

## Existing evidence

The branch already contains:
- `apps/src/async-mirror-worker.test.ts`: fast unit tests using a fake pool.
- `apps/src/async-mirror-worker-db.test.ts`: disposable PostgreSQL integration test, enabled only in CI with `RUPAYKG_RUN_DB_INTEGRATION_TESTS=1`.

The database integration test provisions synthetic organizations, identities, geography, evidence-vault records, source snapshots, crosswalk requests and independently approved crosswalk mappings. It exercises:
- strict state/district/local-body source scope and LGD directory binding;
- approved source scope immutability and prevention of hierarchy expansion;
- transient retry and successful recovery;
- wrong source-version, expired/revoked crosswalk and retired source snapshot unresolved handling;
- retry exhaustion and quarantine, including the exhausted PROCESSING sweep;
- null-lease recovery;
- append-only, payload-free inbox event evidence;
- concurrent workers not claiming the same live lease;
- lease expiry preventing old-worker completion;
- expired lease reclaim by a later worker;
- superseded lease token preventing stale worker finalization.

This is substantive PostgreSQL evidence, not merely fake-pool coverage. It should not be duplicated.

## Remaining gaps

The existing suite does not establish:
1. A dedicated worker DB role's positive and negative privileges. It runs using the CI database login; that is not a proof of least privilege.
2. That the worker can connect only with a dedicated worker secret and cannot fall back to `DATABASE_URL`.
3. Actual deployed Render session/effective role identity.
4. A real process-kill/disconnect between claim, validation and fenced completion.
5. Crosswalk temporal-overlap exclusion for multiple VERIFIED historical intervals; test only exact expiry/revocation cases.
6. Approval lifecycle attempts for expired crosswalk requests, requester/approver self-approval, evidence mismatch, and crosswalk source-snapshot mismatch at every mutation boundary.
7. Queue event trigger behavior under concurrent status updates and exact once-only event expectations across failure/retry transitions.
8. Worker transaction boundaries and lock-order behavior under concurrent exhaustion sweep and claim.
9. Runtime denial of unrelated tenant evidence, activities, credentials, settlements, RLS bypass, DDL, DELETE/TRUNCATE/TRIGGER.
10. Worker behavior when required schema/migration prerequisites are absent or at an older version. It currently starts issuing operational SQL without a dedicated schema readiness gate.

## Code-level observation

The worker claims a batch in one atomic `UPDATE ... RETURNING` statement and finalizes each row with a fencing predicate (`status='PROCESSING'`, matching lease token, lease still in future). The existing integration suite demonstrates the token and expiry fences.

However, the exhaustion sweep, claim, crosswalk lookup and each row finalization use separate `pool.query` operations. Do not wrap validation in a long transaction: validator execution must remain outside row locks. A safe refactor should use short checked-out-client transactions for bounded state transitions, preserve a consistent lock order, and commit the claim before validation. Any sweep must be bounded, row-locked, fenced, and independent of the main claim transaction. Add regression tests before changing these paths.

## CI status

The compatibility-documentation commit `6450a6ec49f2cf0055995624201a3897223d4e2d` completed CI run `41197792228` successfully. All steps passed, including migration validation, exact production-baseline reconstruction, migration upgrade/idempotency, typecheck, build, browser smoke, the disposable PostgreSQL integration suite, and production container build. This validates the existing worker tests and migration chain on a fresh CI PostgreSQL instance only; it does not validate live Neon staging/production schema or the deployed Render database identity. The later coverage-documentation commit `9efffe304d39eecc9feab2747c531153e4bf3eba` triggered CI run `41197918035`, which was still in progress when this note was updated.

## Gate decision

The integration suite is strong enough to be the foundation for the next test increment. The worker remains **OFF** until:
- the current CI run passes;
- least-privilege role tests and missing-schema fail-closed tests are added;
- crosswalk overlap and lifecycle edge tests are added;
- worker secret/runtime identity is verified;
- live migration and activation receive separate approval.

No production/staging migration, role, secret, deployment, scheduler or inbox-row mutation was performed.
