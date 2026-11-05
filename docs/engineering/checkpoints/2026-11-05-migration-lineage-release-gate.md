# Migration lineage release gate — 2026-11-05

## Verified engineering evidence

- PR #290 exact head: c73f1685f4aad97bfccec0d7f855ad6849636932.
- Exact-head CI run #5556 completed SUCCESS.
- The lineage validator inventories active SQL migrations and computes SHA-256 hashes.
- Ledger reconciliation is only attempted when MIGRATION_LINEAGE_DATABASE_URL is explicitly supplied.
- The validator refuses to reuse DATABASE_URL.
- TLS is fail-closed for the lineage connection: a CA certificate is required unless SSL is explicitly disabled.
- The validator compares ledger versions/filenames with active source and reports missing source, filename mismatch, duplicate ledger versions, and source-not-recorded conditions.

## Production boundary

The validator has not been executed against the authoritative production ledger in this execution because the separately controlled read-only MIGRATION_LINEAGE_DATABASE_URL and CA contract are not available through the current execution path.

Therefore this checkpoint does **not** claim a fresh production lineage result.

Known historical audit evidence remains the controlling input for the open lineage decision:

- production audit previously identified 67 public tables, 92 migration-ledger rows and the historical migration-096 source/ledger reconciliation issue;
- migration 096 was removed from main after its historical appearance;
- staging-only 20261022–20261025 migrations remain classified as NOT RECOVERED / NOT PRODUCTION-APPLICABLE pending formal evidence.

## Release decision

Production remains HOLD.

Required before controlled production migration execution:

1. dedicated read-only production lineage connection and CA contract;
2. actual ledger/source reconciliation output;
3. formal 096 applicability decision;
4. formal 20261022–20261025 disposition;
5. frozen reviewed migration manifest;
6. runtime DB identity proof;
7. backup/restore and clean/upgrade rehearsal;
8. web-startup migration removal;
9. tenant/security convergence and independent review.

No production DB write, migration, deployment, merge, RLS activation, role/grant change, or certification occurred.
