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

## Live schema-effect verification

Read-only inspection of production Neon confirms all effects of migration 096:

- `verifications.authorization_membership_id`: UUID, nullable.
- `verifications.authorization_role_id`: UUID, nullable.
- `verifications.authorization_permissions_snapshot`: JSONB, nullable.
- `verifications.authorization_checked_at`: timestamptz, nullable.
- Foreign key `verifications_authorization_membership_id_fkey` → `organization_memberships(id)`.
- Foreign key `verifications_authorization_role_id_fkey` → `roles(id)`.
- Function `public.prevent_invalid_verification()` exists and matches the recovered migration logic.
- Trigger `verifications_integrity_guard` exists as BEFORE INSERT OR UPDATE and invokes `prevent_invalid_verification()`.

## Reconciliation conclusion

Migration 096 is now classified:

**RECOVERED HISTORICAL SQL + LIVE SCHEMA EFFECT CONFIRMED**

The production-only migration discrepancy is therefore resolved as a historical-lineage gap, not an unexplained schema divergence.

Important: this does **not** authorize re-application of migration 096. Its production ledger entry remains authoritative evidence and must not be duplicated.

## G-002 impact

The 91 repository SQL-file count versus 92 production-ledger-row count is now explained by migration 096 being present in production history but intentionally absent from the current release branch.

G-002 migration-history reconciliation is therefore **SUBSTANTIALLY RESOLVED**, subject to final deterministic manifest generation and independent review.

Remaining G-002 blockers are separate:
- deployed runtime DB identity is not yet independently proven NOBYPASSRLS;
- production RLS/tenant isolation remains unproven;
- two-organization runtime A/B isolation remains unproven.

No production mutation was performed.
