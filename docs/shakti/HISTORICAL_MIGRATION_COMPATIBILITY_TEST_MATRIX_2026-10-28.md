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

**HOLD.** Do not merge PR #97, do not merge validation-only PR #104, do not rename applied migration files, do not backfill or rewrite a live ledger, and do not enable production certification based solely on clean-install CI. The next code change should be a dedicated historical-ledger regression harness, followed by a narrowly allowlisted reconciliation implementation only if authorized ledger evidence demonstrates that it is needed.

## Engineering progress — fail-closed guard

A fail-closed guard has been added in the validation branch:
- `apps/src/migration-identity.ts` contains an explicit allowlist of the four observed legacy-to-candidate filename identity pairs.
- `apps/src/migration-identity.test.ts` covers a legacy conflict, a clean ledger, unrelated names, and mixed historical rows.
- `apps/src/migration-identity.integration.test.ts` has been expanded to seed each of the four known legacy filenames independently and a mixed legacy-ledger case in separate disposable PostgreSQL databases. Each scenario asserts fail-closed diagnostics, unchanged exact ledger tuples, and no candidate migration DDL. The expanded test is not verified until its corresponding CI run succeeds.
- `apps/src/migrate.ts` checks the migration ledger before applying candidate migrations and emits `MIGRATION_IDENTITY_CONFLICT` if a known legacy filename is present. It does not alias, backfill, rename, or rewrite ledger entries.

This guard is a safety improvement, **not a compatibility fix**. Historical installations will intentionally stop with a clear error until a reviewed reconciliation path is implemented and tested. The latest completed run validates the earlier single-pair test; the expanded multi-scenario regression has a new commit and must pass its own CI. Do not treat the guard as release-ready until that run passes and independent review is complete.



## Follow-up hardening — preflight before DDL (2026-10-28)

After the expanded identity guard passed CI, the migration runner was hardened to compare all candidate migration versions against the existing ledger before entering the DDL loop. This prevents a conflicting version that sorts late in the migration tree from being discovered only after earlier candidate migrations have already run.

A new disposable-PostgreSQL integration scenario seeds a conflicting ledger filename for version `091`, expects `MIGRATION_VERSION_CONFLICT` and `No migrations were applied`, and verifies both the exact ledger tuple and absence of candidate-created tables. This change is validation-only and awaits its own CI result. It does not validate content digests, partial migrations, rollback direction, or production histories.
