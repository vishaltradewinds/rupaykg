# G-002 Migration 096 Recovery — 2026-11-07

## Result

Production ledger row:

- version: `096`
- filename: `096_verification_authorization_provenance.sql`
- applied: `2026-10-27T13:46:14.262Z`

The exact SQL was recovered from the primary repository's authoritative Git history.

## Evidence chain

1. Commit `ca8f4100782e13f8d72106187fafc8e1e446214f` — **Bind verification to organization and snapshot authority**
   - created `migrations/096_verification_authorization_provenance.sql`
   - timestamp: 2026-10-27T13:44:50Z
   - contains the complete 97-line migration.

2. Commit `54a7fe1ceb41b37a68720a71c10a1dd03af30dea` — **Remove accidentally placed unreviewed verification migration from main**
   - timestamp: 2026-10-27T13:45:20Z
   - removed that exact migration file from the release branch.

3. Production ledger subsequently records version `096` as applied at 2026-10-27T13:46:14.262Z.

## Reconciliation conclusion

The previously unexplained production-only migration is now **recoverable historical SQL with authoritative provenance**.

It was intentionally removed from the then-current `main` because it was considered unreviewed, but production nevertheless recorded it as applied shortly afterward. Therefore:

- the SQL is not fabricated;
- the production ledger entry is not deleted or rewritten;
- the migration is restored on the G-002 reconciliation branch for lineage preservation;
- this does **not** mean it is automatically approved for re-application to production;
- the branch must next be checked for schema-effect parity against the live database.

## Required next checks

1. Compare migration 096 SQL effects with live `verifications` columns, trigger definition, and related constraints.
2. Verify whether the four authorization columns and `prevent_invalid_verification()` trigger exist in production.
3. If live schema matches, classify 096 as **historically applied + schema-confirmed**.
4. If live schema differs, classify the discrepancy explicitly and do not mutate production.
5. Regenerate the deterministic migration reconciliation manifest.

**G-002 remains OPEN until live schema-effect parity is proven.**
