# MRV Worker API Implementation Gate

Status: BLOCKED — TypeScript contract/state-transition corrections committed; database API migration, runtime provisioning and execution validation remain outstanding.

## 2026-11-03 implementation correction batch

- Commit `e1940cf91f51ec8c3bfaf16ab13188e378596f11` changes the adapter to accept only the exact `{ advanced: boolean }` JSONB envelope for `advance_job`. Bare booleans, arrays, null, non-boolean values, missing keys and extra keys are rejected.
- Commit `74ead03da6eaef21d4a55b3cc80b62ea614fe75a` adds adapter regression coverage for the documented envelope and rejects legacy boolean and malformed/ambiguous responses.
- Commit `9ef8de4d4ac4f1151a9cdb1e5f081efdaab0d9d7` corrects restricted worker stage sequencing: `CLAIMED -> GUARDIAN_SUBMITTED -> GUARDIAN_VERIFIED`, then persists the HCS transaction binding and advances `GUARDIAN_VERIFIED -> HCS_SUBMITTED` before submitting the persisted transaction. HCS submission now occurs from `HCS_SUBMITTED`; Mirror Node reconciliation begins only from `HCS_CONSENSUS_CONFIRMED`.
- The changes are source-level corrections only. Exact-head GitHub checks currently report zero check runs; no test, build, PostgreSQL acceptance or CI pass is claimed.
- PR #213 remains draft/unmerged and mergeability is false. No migration, role grant, RLS activation, worker enablement, deployment or certification occurred.


## Confirmed implementation mismatch

- `apps/src/mrv-worker-database-api.ts` currently treats `advance_job` JSONB as a boolean.
- The canonical contract in `docs/security/MRV_WORKER_RESTRICTED_DATABASE_API.md` declares `advance_job(uuid, uuid, text, jsonb) returns jsonb`.
- The adapter must accept only a documented JSON object envelope, e.g. `{ advanced: boolean }`, and reject booleans, arrays, null, missing keys and extra ambiguous shapes. The database implementation and tests must use exactly the same envelope.

## Additional API response contracts to freeze before SQL implementation

| Function | Return | Required runtime validation |
|---|---|---|
| `claim_next_job(text, integer)` | JSONB | `null` or `{ job: complete_job_row, leaseToken: UUID }`; validate all fields consumed by the worker, status enum, UUIDs, and lease token |
| `authorize_job(uuid)` | boolean | strict boolean only; no source-row details |
| `persist_guardian_binding(uuid, uuid, text)` | boolean | strict boolean only |
| `persist_hedera_binding(uuid, uuid, text, text, text)` | boolean | strict boolean only |
| `renew_lease(uuid, uuid, integer)` | timestamptz | timestamp or null |
| `advance_job(uuid, uuid, text, jsonb)` | JSONB | exact `{ advanced: boolean }` envelope |
| `release_job(uuid, uuid, timestamptz, text, text)` | boolean | strict boolean only |
| `finalize_provenance(uuid, uuid, text)` | boolean | strict boolean only |

## Schema and security release blockers

1. The durable job migration explicitly does not enable RLS, create a worker owner, or provision functions. It is not safe to assume these controls exist in the target database.
2. The worker owner must be a dedicated NOLOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS role with no memberships. The runtime login must have no direct table privileges and only exact function EXECUTE grants.
3. FORCE RLS on the source, job, event and provenance tables must be tested against the full application-role policy matrix. Do not enable RLS globally based solely on this worker's needs.
4. The security-definer owner policies must be scoped only to that owner and the exact required tables. Each function must derive tenant, geography, activity, evidence and verification identifiers from the locked job row, never from caller arguments.
5. The authorization operation must compare live source rows and immutable enqueue snapshots in one consistent database snapshot, including ordered MRV observations, evidence and latest measurement.
6. Finalization must verify the exact provenance tuple `(activity_id, verification_id, evidence_id, integrity_hash)` plus Guardian execution, HCS topic/transaction/consensus timestamp and Mirror Node verification timestamp. Conflicts must be checked for exact equality before being treated as idempotent.
7. The current repository evidence does not establish that the eight functions, dedicated owner, owner-only RLS policies or runtime grants exist in the target database.

## Required next validation batch

- Complete-job shape validation is still incomplete; validate every required job field, UUID, status, snapshot and date before provider execution.
- Execute adapter and worker tests, typecheck, build and full exact-head CI for commit `9ef8de4d4ac4f1151a9cdb1e5f081efdaab0d9d7`.
- Align SQL implementation and acceptance tests on the JSONB advance envelope.
- Add strict complete-job shape validation before any provider call.
- Implement SQL only after validating every referenced column and policy against the full migration chain on a disposable PostgreSQL database.
- Add hostile two-tenant tests for direct table denial, cross-tenant job IDs, revoked membership/permissions, stale leases, conflicting provider bindings, idempotent provenance and transactionally appended events.
- Run the full migration chain from empty and supported prior schemas; record exact commit and test output.
- Keep the worker disabled and PR draft until independent DBA/security review passes.

## Current decision

No production migration, RLS activation, role grant, worker enablement, merge or TRL claim is authorized by this engineering checkpoint.

## 2026-11-03 restricted-worker testability and stage coverage batch

- Commit `f2581e91723a63b39cb245b0822e4e0e4cd02350` adds explicit provider dependency injection to the restricted worker. Production defaults remain the existing Guardian/Hedera/Mirror implementations; the seam permits deterministic tests without live provider calls.
- Commit `1fb8303df481a844b37b8c485cfbc91b6788fac8` adds `mrv-submission-worker-restricted.test.ts` coverage for CLAIMED advancement, Guardian execution and verified-result persistence, HCS transaction binding before HCS_SUBMITTED, submission using the persisted transaction ID, and Mirror reconciliation only after HCS consensus confirmation.
- The adapter complete-job validator and regression tests now also enforce the durable migration's actual constraints: UUID primary/foreign identifiers, 32–128 character idempotency key, lowercase 64-character SHA-256 payload hash, status enum, object snapshots, dates and exact live lease-token equality (commits `39310e175330fff3494ae8ed61fb04a7491b815e` and `1a81146ae5f8b69d62b95520cc03187705569b1e`). The database API must return the canonical `mrv_submission_jobs` row shape; this still requires PostgreSQL contract validation.
- No exact-head CI/check run is visible for the current head `1fb8303df481a844b37b8c485cfbc91b6788fac8`; the commit's check-runs endpoint currently reports zero checks. No test/build pass is claimed.
- No live database, provider or production operation was executed. PR #213 remains draft, unmerged and non-mergeable. Worker enablement, production migration, role grants, RLS activation and certification remain blocked.
