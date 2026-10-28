# Shakti Standards — Historical Migration Compatibility Test Matrix

Date: 2026-10-28
Repository: vishaltradewinds/rupaykg
Scope: validation-only; no production database access or writes.
Related work: PR #97; validation-only PR #104.

## Current CI evidence

Latest completed validation run before the current test expansion: run 40681738454 / job 122793881189, commit 2e9fb91d807e52f699d98703d847ef47f86db0b7, completed successfully. It passed:
- production dependency audit
- migration structure validation
- clean PostgreSQL migration
- typecheck and build
- production web browser smoke test
- automated tests including the then-current disposable PostgreSQL legacy-identity rejection test
- production container build

That run proves the single-pair integration regression at that commit. The expanded test covering all four known pairs plus a mixed-ledger fixture is a newer commit and its own CI run must pass before it is considered verified. Clean-install success does not establish compatibility with an existing schema_migrations ledger.

## Historical-state matrix (required before any reconciliation code)

| Fixture | Starting ledger / schema state | Expected safe result |
|---|---|---|
| A — empty | Empty disposable PostgreSQL database | Candidate migrations apply in order; all ledger rows match filenames |
| B — date-prefixed history | Representative schema state and ledger rows for 20261018/19/20/21 filenames | Candidate runner must not re-run equivalent DDL; it must either use a reviewed compatibility path or fail closed with a clear diagnostic |
| C — ordinal history | Representative schema state and ledger rows for 088/089/090/091 filenames | Candidate runner recognizes exact recorded filenames and does not re-run DDL |
| D — mixed history | Ledger contains some date-prefixed and some ordinal identities | Must classify each pair explicitly; unknown combinations fail closed rather than guessing |
| E — content mismatch | Same proposed alias filename but migration SQL differs from approved known content | Fail closed; no ledger mutation |
| F — conflicting rows | Version and filename disagree, duplicate/equivalent records conflict, or migration is partially applied | Fail closed; no automatic repair |
| G — transactional failure | Deliberately fail during a migration in disposable PostgreSQL | DDL and ledger write roll back together where PostgreSQL transaction semantics permit |
| H — rollback direction | Candidate history exists and a later deployment uses date-prefixed main history | Must be explicitly tested or documented unsupported; never assume reverse compatibility |

## Test implementation requirements

1. Use only disposable PostgreSQL instances created by CI. Never point tests at a shared, staging, or production database.
2. Make fixtures deterministic and self-contained; do not rely on a developer's local migration history.
3. Verify both database schema effects and exact ledger tuples: version and filename.
4. Assert that rejected states leave the ledger and schema unchanged.
5. For a compatibility alias, allowlist exact source filename, target filename, expected SQL/blob digest, and expected ledger state. Do not infer equivalence from filename similarity alone.
6. Preserve transactionality and log a machine-readable reconciliation event if a future approved implementation records one.
7. Require independent review of migration-runner changes and fixture coverage before any environment migration.
8. Run the existing clean-install suite plus the historical-state matrix on every change to migration discovery or ledger handling.

## Release gates

- [x] Candidate clean-install CI passed on run 40681738454 (commit 2e9fb91; prior to expanded matrix test).
- [x] Migration identity conflict documented with exact filenames and blob identities.
- [ ] Authorized read-only ledger evidence received for each relevant environment.
- [ ] Full historical-state matrix implemented and passing on disposable PostgreSQL. Expanded all-four-pairs plus mixed-ledger coverage passed the automated-test step in run 40682490733 (commit 8284c52). A follow-up preflight regression now covers a late migration-version conflict and asserts no candidate DDL; its CI result is pending.
- [ ] Independent review of any proposed reconciliation logic.
- [ ] Recovery/rollback procedure approved.
- [ ] Live non-production Guardian/HCS/Mirror Node acceptance evidence collected separately.
- [ ] Production release approval.

## Decision

**HOLD.** Do not merge PR #97, do not merge validation-only PR #104, do not rename applied migration files, do not backfill or rewrite a live ledger, and do not enable production certification based solely on clean-install CI. The next work is to verify the expanded historical-ledger regression harness in CI and add the remaining historical-state scenarios. A narrowly allowlisted reconciliation implementation may be considered only if authorized ledger evidence demonstrates that it is needed.

## Engineering progress — fail-closed guard

A fail-closed guard has been added in the validation branch:
- `apps/src/migration-identity.ts` contains an explicit allowlist of the four observed legacy-to-candidate filename identity pairs.
- `apps/src/migration-identity.test.ts` covers a legacy conflict, a clean ledger, unrelated names, and mixed historical rows.
- `apps/src/migration-identity.integration.test.ts` has been expanded to seed each of the four known legacy filenames independently and a mixed legacy-ledger case in separate disposable PostgreSQL databases. Each scenario asserts fail-closed diagnostics, unchanged exact ledger tuples, and no candidate migration DDL. The expanded test is not verified until its corresponding CI run succeeds.
- `apps/src/migrate.ts` checks the migration ledger before applying candidate migrations and emits `MIGRATION_IDENTITY_CONFLICT` if a known legacy filename is present. It now also preflights all recorded version/filename pairs against the candidate migration tree and emits `MIGRATION_VERSION_CONFLICT` before any candidate DDL when a version maps to a different filename. It does not alias, backfill, rename, or rewrite ledger entries.\n- Unit and disposable-PostgreSQL regression coverage has been added for a version/filename mismatch, asserting the runner rejects before candidate DDL and preserves the ledger. This new coverage is pending its own CI run.

This guard is a safety improvement, **not a compatibility fix**. Historical installations will intentionally stop with a clear error until a reviewed reconciliation path is implemented and tested. The latest completed run validates the earlier single-pair test; the expanded multi-scenario regression has a new commit and must pass its own CI. Do not treat the guard as release-ready until that run passes and independent review is complete.



## Follow-up hardening — preflight before DDL (2026-10-28)

After the expanded identity guard passed CI, the migration runner was hardened to compare all candidate migration versions against the existing ledger before entering the DDL loop. This prevents a conflicting version that sorts late in the migration tree from being discovered only after earlier candidate migrations have already run.

A new disposable-PostgreSQL integration scenario seeds a conflicting ledger filename for version `091`, expects `MIGRATION_VERSION_CONFLICT` and `No migrations were applied`, and verifies both the exact ledger tuple and absence of candidate-created tables. This change is validation-only and awaits its own CI result. It does not validate content digests, partial migrations, rollback direction, or production histories.


## CI verification update — late conflict preflight

Run [40683182559](https://github.com/vishaltradewinds/rupaykg/actions/runs/40683182559) completed successfully on commit `0a5ea6e3d079a92f26ac1a6a3c3ce8966d4d43db`. The workflow passed migration validation, clean migration, strict typecheck, build, browser smoke test, the automated test step (including disposable PostgreSQL integration mode), and production container build.

Intermediate runs failed on transient/incomplete commits while the runner and tests were being updated. The successful run above is the verification point for the consolidated preflight change. This still does not prove the unimplemented historical states listed in the matrix.


## Transactional rollback regression — CI verified

A disposable-PostgreSQL integration test now supplies a temporary migration fixture that creates a table and then deliberately fails. The test expects the runner to fail, verifies the failed migration has no ledger row, and verifies the table DDL rolled back. The runner's test-directory override is gated by both `RUPAYKG_RUN_DB_INTEGRATION_TESTS=1` and `NODE_ENV=test`; ordinary runs continue using the normal repository/container migration directory. CI run 40683464471 completed successfully on commit `c51f99072d12d895ecf09d52491bfb055d1b72b8`. The automated-test step and production container build both passed. The run passed the complete workflow: dependency audit, migration validation, clean migration, typecheck, build, browser smoke test, automated tests including disposable PostgreSQL acceptance, and production container build. This verifies the rollback regression on that commit; it does not close the other historical-state gaps below.


## CI verification update — transactional rollback (2026-10-28)

Run [40683464471](https://github.com/vishaltradewinds/rupaykg/actions/runs/40683464471) completed with conclusion `success` for commit `c51f99072d12d895ecf09d52491bfb055d1b72b8`. All workflow steps passed, including `Run tests including disposable PostgreSQL acceptance` and `Build production container`. The rollback fixture therefore has CI evidence that the deliberate migration failure leaves no ledger row and rolls back its table DDL in the disposable PostgreSQL test environment.

**Still open:** the current PR head is a later documentation commit; the successful run was on the preceding code commit. Re-run/confirm CI against the latest PR head before treating the complete branch as verified. The full matrix remains incomplete: ordinal already-applied history, content mismatch, partial/conflicting states beyond the covered preflight cases, reverse-deployment compatibility, authorized per-environment ledger evidence, independent review, recovery approval, and separate live Guardian/HCS/Mirror Node acceptance. Production certification remains OFF/HOLD.


## Ordinal-history rerun guard regression added (2026-10-28)

A new disposable-PostgreSQL integration test seeds an exact ledger tuple for an ordinal migration identity and supplies a fixture SQL file that would create a probe table if executed. It asserts the runner exits successfully, preserves the exact ledger tuple, and does not create the probe table. This covers the narrow behavior that an exact already-recorded version/filename identity is skipped without rerunning DDL; it does **not** prove that the actual historical schema matches the migration's intended effects or verify production ledger state.

The test is added on the validation branch in commit `5c051a620c02d01f16f73e74aa595e1d456b384e`. CI for this commit must pass before this regression is considered verified. Validation-only scope remains unchanged: no production DB access or writes, no merge, and certification OFF/HOLD.


## Reverse-deployment identity guard added (2026-10-28)

Code review of the matrix identified a reverse-direction risk: when a date-prefixed migration tree is deployed against a ledger recording the corresponding ordinal filename, the earlier guard only checked ordinal candidates against date-prefixed ledger rows. The guard now rejects either direction for the four explicit filename pairs. Unit coverage and a disposable-PostgreSQL integration test verify that a date-prefixed candidate against ordinal history emits `MIGRATION_IDENTITY_CONFLICT`, preserves the exact ledger tuple, and applies no candidate DDL. These changes are on the validation branch in commits `647215b4c1121a7302cbe50c80458703e594c8d9`, `5a4fe0096a7acb9f77772ce2c141d1b01fa95d03`, and `3e68ce2395d8b628a45d9c140288a4715b1a4ee0`. They remain unverified until the relevant CI run completes successfully. This closes only the identified fail-closed guard gap; it does not establish bidirectional deployment compatibility.


## CI finding and corrective change — reverse guard (2026-10-28)

CI run [40684318481](https://github.com/vishaltradewinds/rupaykg/actions/runs/40684318481) exposed a real gap: the reverse-direction helper test passed, but the integration test showed `migrate.ts` queried only date-prefixed ledger filenames, so an ordinal ledger row was never passed to the reverse-direction conflict checker. Corrected the preflight query to include both keys and values of the explicit identity map in commit `477e01ef99576019c47318b75abfa18a290bd0e9`. The reverse integration test and full CI must pass on this fix before verification. This is a valuable fail-closed test finding, not a release pass.


## Latest CI verification — reverse identity guard (2026-10-28)

The corrective change that queries both ordinal and date-prefixed names is now verified by two successful full workflow runs:

- Run [40684760311](https://github.com/vishaltradewinds/rupaykg/actions/runs/40684760311), commit `477e01ef99576019c47318b75abfa18a290bd0e9`: success. All steps passed, including migration validation, clean PostgreSQL migration, strict typecheck, build, browser smoke test, automated tests with disposable PostgreSQL acceptance, and production container build.
- Run [40684775244](https://github.com/vishaltradewinds/rupaykg/actions/runs/40684775244), commit `4cc753f42a9ef9c775a4494a1abebf3b98ec9580`: success on the latest documentation-updated validation branch head. All workflow steps passed, including the disposable PostgreSQL acceptance suite and production container build.

The reverse-direction regression that failed in run 40684318481 is now covered by successful full CI on the corrective code commit; the later branch-head run is also green. This verifies the current fail-closed guard and existing regression suite, not production-history compatibility or authorization to release.

## Explicit content-integrity decision

The current `schema_migrations` ledger records `version`, `filename`, and `applied_at`, but no migration content digest. Therefore, the ledger alone cannot prove which exact SQL bytes were historically applied. A matching filename/version is not proof of matching content or resulting schema.

- Do not retroactively invent, backfill, or assert historical checksums without independent, environment-specific evidence.
- For future migrations, consider a versioned checksum ledger or immutable migration manifest, with a controlled rollout and compatibility plan; do not silently change the existing ledger contract.
- Before any environment-specific reconciliation, obtain authorized read-only ledger/schema evidence, compare it with repository history and deployment records, and require independent review plus an approved recovery plan.
- Arbitrary partial application cannot be reliably inferred from a missing ledger row alone because migration DDL may have non-transactional or external effects. Keep the runner fail-closed; test known transaction behavior in disposable PostgreSQL and document migration-specific exceptions rather than promising universal rollback.

## Current disposition

The reverse-identity fail-closed regression is CI-verified on the latest validation branch. The full historical-state matrix remains incomplete, including authorized environment evidence, broader partial/conflicting-state characterization, independent review, recovery approval, and separate live Guardian/HCS/Mirror Node acceptance.

**Release remains HOLD.** PRs #97 and #104 remain unmerged; production certification remains OFF. No production database was accessed or modified.


## CI verification — malformed ledger fail-closed guard (2026-10-28)

The runner's malformed-ledger guard and its disposable-PostgreSQL regression are now CI-verified:

- Run [40687283301](https://github.com/vishaltradewinds/rupaykg/actions/runs/40687283301), commit `2149a558cbca05fae3a53ce58c988e0de777079f`: success. The runner guard passed the full workflow.
- Run [40687328797](https://github.com/vishaltradewinds/rupaykg/actions/runs/40687328797), commit `58dd84696f2ad6e626ac5bd766e694ec6cda0d50`: success. The test-containing commit passed the full workflow, including disposable PostgreSQL acceptance. The regression verifies that a ledger missing the required `filename` column is rejected with `MIGRATION_LEDGER_SCHEMA_INVALID`, the existing row and table shape remain unchanged, and no candidate DDL is applied.

The subsequent documentation commit has its own CI run and is not represented by these two code-test results. This closes the malformed-ledger-schema regression for the tested shape; it does not cover arbitrary partially-applied migrations or prove any live environment's history.

## Revised current disposition

CI now verifies the tested fail-closed cases: known identity conflicts in both deployment directions, exact recorded ordinal identity is skipped without rerunning fixture DDL, late version/filename conflicts are preflighted before candidate DDL, transactional rollback for the tested PostgreSQL failure, and rejection of a malformed migration ledger. The full historical-state matrix is still **not complete**.

Open gates remain: partial application and conflicting states beyond the fixtures, historical content integrity (no retroactive checksum claims), authorized read-only ledger/schema evidence per relevant environment, independent review, approved recovery plan, separate live Guardian/HCS/Mirror Node acceptance, and production release approval.

**Release remains HOLD.** PRs #97 and #104 remain unmerged; production certification remains OFF. No production database was accessed or modified.


## CI verification — partial DDL and ledger constraints (2026-10-28)

The partial-DDL collision fixture passed in [run 40688756509](https://github.com/vishaltradewinds/rupaykg/actions/runs/40688756509), commit `d6af70441a1c55877dcebffc6350956b4761584f`. In disposable PostgreSQL, an existing candidate table with no matching ledger row causes migration failure; the runner does not insert a false ledger row and the pre-existing table data remains unchanged.

The migration ledger guard was then strengthened to validate the ledger's minimum structural contract before migration discovery/application:
- Required `version` and `filename` columns must exist.
- Both columns must be `NOT NULL`.
- `version` must be the sole primary-key column.

CI run [40689183426](https://github.com/vishaltradewinds/rupaykg/actions/runs/40689183426) passed on runner commit `012c4efd86d50c8c1c5c1339c35db6224a852570`. The disposable-PostgreSQL duplicate-version/no-primary-key regression passed in [run 40689214299](https://github.com/vishaltradewinds/rupaykg/actions/runs/40689214299), commit `36e42bf47aee067c3d161ae591a64833b8220a99`. It verifies the malformed ledger is rejected with `MIGRATION_LEDGER_SCHEMA_INVALID` before candidate DDL, and duplicate historical rows remain unchanged for manual review.

These results cover the tested failure modes only. They do not prove all partial migrations are recoverable, validate every possible schema drift, or establish the state of any live environment.

**Remaining release gates:** authorized read-only per-environment ledger/schema evidence; broader historical-state characterization; independent review and recovery approval; separate live Guardian/HCS/Mirror Node acceptance; production release approval. No production database was accessed or modified. Production certification remains OFF/HOLD.
