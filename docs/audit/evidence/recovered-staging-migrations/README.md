# Recovered staging-only migration source manifest

**Status:** exact source recovered from historical Git branches; archived for audit only. These are not active production migrations and must not be replayed or copied into `migrations/` without a separate approved reconciliation.

## Source refs and blob identities

The four files were independently fetched from these three Git branches:
- `ci/enable-worker-integration-pr-validation-2026-10-30`
- `ci/enable-worker-postgres-pr-validation-on-feature-base-2026-10-30`
- `ci/worker-lease-validation-v5-2026-10-31`

All three refs returned identical Git blob SHAs and byte lengths for each file.

| Original migration | Original blob SHA | Byte length |
|---|---|---:|
| `20261022_async_mirror_inbox.sql` | `4d08607e03561b9fbb4ce502b4c4211127237050` | 1,004 |
| `20261023_async_mirror_worker_leases.sql` | `33cb4d5d2e29a4a111340e5a0ac34170a0081895` | 3,408 |
| `20261024_ai_intake_rate_limits.sql` | `87b51fe60a96a4e0752c8b0a9a170c81f9936dbb` | 872 |
| `20261025_ai_evidence_intake_jobs.sql` | `6a0ae54530b7b756dac33589eaf18df3b071d8f2` | 1,785 |

Archived copies are placed in `docs/audit/evidence/recovered-staging-migrations/` with `.recovered.sql` suffixes. They are kept outside the active migration directory.

## Staging schema reconciliation

Read-only inspection of Neon staging branch `br-spring-hill-b4544vz5` confirms all four filenames in `schema_migrations`, each with recorded applied_at `2026-10-20T10:48:38.647Z`. The inspected schema fingerprint is recorded in `docs/audit/evidence/2026-11-04-staging-migrations-schema-fingerprint.md`.

The catalog state is consistent with:
- migration 20261022 creating the initial mirror inbox table and base status check;
- migration 20261023 adding worker lease/retry/quarantine columns, expanding the status check, creating append-only event history and its two triggers;
- migration 20261024 creating the per-identity/per-organization rate-limit table;
- migration 20261025 creating the AI evidence-intake idempotency/recovery ledger.

The staging branch also contains no RLS/FORCE RLS or policies on these four tables. This is a staging observation, not production authorization or proof of safe deployment.

## Verification results

The archived files were fetched back from the archive branch and their Git blob SHAs were compared with the original historical source blobs. All four are **identical at the Git object level**:

| Migration | Original blob SHA | Archived blob SHA | Result |
|---|---|---|---|
| `20261022_async_mirror_inbox.sql` | `4d08607e03561b9fbb4ce502b4c4211127237050` | `4d08607e03561b9fbb4ce502b4c4211127237050` | PASS |
| `20261023_async_mirror_worker_leases.sql` | `33cb4d5d2e29a4a111340e5a0ac34170a0081895` | `33cb4d5d2e29a4a111340e5a0ac34170a0081895` | PASS |
| `20261024_ai_intake_rate_limits.sql` | `87b51fe60a96a4e0752c8b0a9a170c81f9936dbb` | `87b51fe60a96a4e0752c8b0a9a170c81f9936dbb` | PASS |
| `20261025_ai_evidence_intake_jobs.sql` | `6a0ae54530b7b756dac33589eaf18df3b071d8f2` | `6a0ae54530b7b756dac33589eaf18df3b071d8f2` | PASS |

A read-only query against the authoritative production Neon branch returned:
- matching production ledger rows for these four filenames: **0**;
- matching production tables present: **0**;
- production ledger row for `096_verification_authorization_provenance.sql`: **1**.

This independently confirms that the four migrations are staging-only relative to the inspected production ledger/schema. No production writes were performed.

## Critical boundary

These migrations were recorded on a non-authoritative staging branch, not the authoritative production branch. The archive establishes exact historical source availability, not production applicability. Do not:
- add them to the active production migration sequence;
- edit production `schema_migrations`;
- replay them against production;
- infer that staging-only AI intake or mirror worker features are production-enabled.

## Next steps
1. Verify archived contents against the original Git blobs using the Git object API or a local `git hash-object` check; do not rely only on matching displayed text.
2. Reproduce the four migrations in a disposable PostgreSQL database, then compare tables, columns, defaults, constraints, indexes, sequences and triggers to the staging schema fingerprint.
3. Review the source code consumers and the later `20261101_async_mirror_unresolved_crosswalk.sql` file separately; that later file is not one of the four migration ledger rows inspected here.
4. Decide, with independent review, whether these features remain staging-only, are abandoned, or require a new forward-only production migration plan.
5. Keep production read-only until explicit founder approval and independent DBA/security review.
