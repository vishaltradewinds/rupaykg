# Production-shaped CI evidence review — 2026-10-31

## Exact run and artifact

- Workflow run: https://github.com/vishaltradewinds/rupaykg/actions/runs/41187030802
- Candidate branch: `shakti/integrate-government-inbox-worker-2026-10-31`
- Candidate commit: `fd90b9c3e954c3b120f33f24066d0f42b08604eb`
- Run conclusion: success; all workflow steps completed successfully.
- Artifact: `production-shaped-migration-report`
- Artifact SHA-256: `ddfaf4f9ac8506b1bb7cdfc76dad53eccfadce50a538dd917ef584f7ede5512f`
- Artifact contains `production-shaped-baseline.json` and `production-shaped-migration-report.json`.

## Verified CI facts

- Disposable database: PostgreSQL 16.15.
- Captured production baseline: 92 migration identities.
- Proposed upgrade result: 113 migration ledger entries.
- The exact 92-row production manifest is checked by immutable version/filename identity; disposable `applied_at` timestamps are regenerated and recorded separately.
- Migration 023 remains in the historical baseline.
- Production-only migration 096 is restored from its historical Git blob and runs after 20261021 and before 20261022+.
- Second upgrade execution is idempotent.
- Typecheck, build, browser smoke, database acceptance tests, evidence upload and production container build all passed.
- `prevent_invalid_verification()` definition SHA-256 is identical before and after the proposed upgrade:
  `d3cad74b92990cf3729862e35833f726d7fd95e085c26c3a53145597dfe6a291`.

## Catalog inventory comparison

| Object | Baseline | After upgrade | Added | Removed |
|---|---:|---:|---:|---:|
| Tables | 67 | 78 | 11 | 0 |
| Columns | 756 | 933 | 177 | 0 |
| Constraints | 393 | 523 | 131 | 1 |
| Indexes | 215 | 249 | 34 | 0 |
| Triggers | 70 | 89 | 19 | 0 |
| Functions | 114 | 132 | 18 | 0 |

### Constraint replacement explained

The one removed constraint identity is:

`cpcb_swm_stakeholder_workspaces.cpcb_swm_stakeholder_workspaces_stakeholder_type_check`

This is intentionally dropped by `20261103_swm_stakeholder_taxonomy_registry.sql`. That migration creates a governed `swm_stakeholder_taxonomy` registry, seeds seven baseline-supported taxonomy codes, and replaces the inline stakeholder-type check with `cpcb_swm_workspace_taxonomy_fk` referencing the registry. The change is a controlled move from a hard-coded list to a governed FK, not an unexplained constraint deletion.

Review before approval:
1. Verify every existing production stakeholder_type value is represented by a taxonomy row before applying the FK in any live environment.
2. Confirm the seven seeded rows are justified by the authoritative CPCB source/version evidence and that `BASELINE_SUPPORTED` is not represented as CPCB endorsement or official registration.
3. Confirm no application write path permits unreviewed taxonomy insertion or mutation to grant regulatory status.
4. Confirm rollback/recovery handles the FK dependency and preserves valid workspace rows.

## Worker/security review points

- Worker claims bounded batches with `FOR UPDATE SKIP LOCKED`, lease expiry and per-claim fencing tokens.
- Payload hashes are checked before structural validation.
- The built-in validator explicitly labels its result structural-only; it does not perform official acceptance, authoritative MRV mutation or Guardian/Hedera submission.
- Jurisdiction resolution requires exactly one verified, effective crosswalk, approved source snapshot, matching source version, explicit organization geography scope and source-scope coverage.
- Ambiguous or missing jurisdiction mapping is recorded as `UNRESOLVED`, not silently accepted.
- Retry/backoff and quarantine are bounded.
- Operational reconciliation function is read-only.
- Migration 20261110 binds administrative source scope to a verified, versioned LGD geography node; migration 20261111 blocks adding/reparenting descendants under frozen approved scope.
- The disposable PostgreSQL acceptance tests exercise transient retries, quarantine, unresolved cases, scope containment, immutable source bindings and hierarchy expansion attempts.

## Limitations and release gate

This is a disposable PostgreSQL reconstruction, not a production data clone, live Neon rehearsal, government-system integration test, independent security review, or certification. The catalog report compares object identities; reviewers must inspect SQL definitions and application authorization paths. Byte-for-byte preservation of the verifier function is useful evidence but does not replace semantic review of its surrounding schema and callers.

No live Neon DDL/data writes were performed. No merge, deployment, worker/scheduler activation, Guardian/HCS submission, authoritative MRV mutation or certification is authorized by this CI result.

**Disposition: engineering CI gate passed; production release gate remains HOLD pending authorized independent migration/security review, live drift reconciliation, backup/restore evidence, approved change window and rollback plan.**


## Follow-up security hardening found during source-scope review

A manual review of the source-scope trigger event lists identified a legacy-row transition edge case: the scope guard ran on INSERT and updates to the source snapshot/geography columns, but did not explicitly rerun when a pending request or crosswalk changed status. New rows were already checked, and the dual-control/request binding provided additional protection, but status-transition revalidation is the safer fail-closed contract for any rows that may predate the guard.

The candidate migration `20261110_government_source_scope_geography_binding.sql` now includes `status` in the UPDATE event columns for both the request and verified-crosswalk source-scope triggers. The production-shaped acceptance test asserts that both installed trigger definitions include `UPDATE OF ... status`.

This is a hardening change to be validated by a fresh exact-head CI run. It has not been applied to any live Neon branch. The earlier run evidence above applies to commit `fd90b9c3e954c3b120f33f24066d0f42b08604eb`; it does not certify this follow-up patch until the new run passes.
