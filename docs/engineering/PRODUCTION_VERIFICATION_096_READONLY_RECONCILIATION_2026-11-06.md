# Production Verification / Migration 096 Read-Only Reconciliation — 2026-11-06

## Authoritative production target

- Neon project: `steep-mud-79906940`
- Branch: `br-restless-base-b44cip2h`
- Database: `rupaykg`
- Operation mode: **READ-ONLY**
- No production DDL, DML, migration, role, grant, RLS, ownership or deployment change was performed.

## Migration ledger

Read-only inspection confirms 92 rows in `public.schema_migrations`.

The ledger contains version `096` applied at `2026-10-27T13:46:14.262Z`.

The ledger also contains the date-prefixed versions `20261018` through `20261021`.

The active repository migration source currently contains 91 SQL migration files; the exact historical `096_verification_authorization_provenance.sql` source is absent from the active migration directory and is preserved separately as recovered historical evidence.

## Production schema evidence for 096

The production `verifications` table contains all four columns introduced by recovered 096:

- `authorization_membership_id uuid`
- `authorization_role_id uuid`
- `authorization_permissions_snapshot jsonb`
- `authorization_checked_at timestamptz`

The production trigger inventory currently contains:

1. `verification_independence_guard` → `enforce_verification_independence()`
2. `verifications_integrity_guard` → `prevent_invalid_verification()`

Both functions are currently owned by `rupaykg`.

## Security divergence confirmed

Read-only function inspection confirms the legacy `enforce_verification_independence()` still authorizes through:

- global `organization_memberships` lookup without binding membership to the activity organization;
- explicit `VERIFY_EVIDENCE` permission **or role names `VERIFIER` / `AUDITOR`**.

The recovered 096 `prevent_invalid_verification()` function contains the stronger same-organization membership check and explicit permission-key requirement for APPROVED decisions, but the legacy independence trigger remains active.

Therefore production is **not** treated as having the converged verification authorization boundary.

## Required forward-only reconciliation

1. Preserve recovered 096 exactly as historical evidence.
2. Do not replay 096 blindly.
3. Reconcile the final canonical verification guard against #252 + #250/#251 + #272 + #284 semantics.
4. Remove the contradictory legacy role-name authorization path only through an independently reviewed forward-only change.
5. Enforce immutable decision-time authorization provenance.
6. Reconcile production runtime ownership/BYPASSRLS/RLS separately under Batch C.
7. Obtain independent DBA/security review before any production mutation.

## Evidence boundary

This record establishes read-only production catalog/function evidence only. It does **not** establish production tenant isolation, production authorization correctness, regulatory approval, field acceptance, certification, or TRL 9.
