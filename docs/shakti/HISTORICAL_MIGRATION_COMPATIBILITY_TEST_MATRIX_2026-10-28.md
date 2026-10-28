# Shakti Standards — Historical Migration Compatibility Test Matrix

Date: 2026-10-28
Repository: vishaltradewinds/rupaykg
Scope: validation-only; no production database access or writes.
Related work: PR #97; validation-only PR #104.

## Current CI evidence

Validation workflow run 40679354379 / job 122785780123 completed successfully:
- production dependency audit
- migration structure validation
- clean PostgreSQL migration
- typecheck and build
- production web browser smoke test
- automated tests including disposable PostgreSQL acceptance
- production container build

This is clean-install evidence only. It does not establish compatibility with an existing schema_migrations ledger.

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

- [x] Candidate clean-install CI passed on run 40679354379.
- [x] Migration identity conflict documented with exact filenames and blob identities.
- [ ] Authorized read-only ledger evidence received for each relevant environment.
- [ ] Historical-state regression fixtures implemented and passing on disposable PostgreSQL.
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
- `apps/src/migrate.ts` checks the migration ledger before applying candidate migrations and emits `MIGRATION_IDENTITY_CONFLICT` if a known legacy filename is present. It does not alias, backfill, rename, or rewrite ledger entries.

This guard is a safety improvement, **not a compatibility fix**. Historical installations will intentionally stop with a clear error until a reviewed reconciliation path is implemented and tested. CI for the code changes is still being validated; do not treat the guard as release-ready until that run passes and independent review is complete.

