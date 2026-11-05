# RUPAYKG RESUME POINT — 2026-11-05

## Controlled integration spine
Authoritative repository: vishaltradewinds/rupaykg.
Current main: 5bdb3875f947aa53adad1768ab13657749d71a3f.
Production remains READ-ONLY / HOLD.

## Current critical path
1. P0 web startup isolation: remove implicit production migrations/fixtures from long-lived web startup.
2. Protected migrator remains separate and unmerged (#291).
3. Migration lineage is fail-closed in the protected migrator: every applied ledger version must map to an active source migration with the expected filename. Authoritative production lineage still requires read-only verification.
4. Tenant isolation/RLS and runtime DB identity remain release gates.
5. Recovery/restore evidence must be disposable and bounded; never use production for rehearsal.

## Latest engineering batch — VERIFIED
Branch: shakti/2026-11-05-bounded-recovery-rehearsal.
PR #303.
Verified branch head: 27ab49e775775f6bebc39d5a51466ed67a5c06f0.
CI #5628 / run 42067352947: SUCCESS.
All validation job steps 1–15 completed successfully, including migration validation, API migration execution in CI, typecheck/build, browser smoke test, disposable PostgreSQL acceptance tests, production container build, bounded disposable pg_dump/pg_restore rehearsal, and explicit startup-isolation assertion.

This validates the branch-level engineering gate in CI. It does not validate production deployment, production database state, field acceptance, statutory/regulatory approval, certification, or TRL 9.

## Current reconciliation batch — VERIFIED
Branch: shakti/2026-11-05-protected-migrator-startup-reconciliation.
PR #304 is OPEN / DRAFT / UNMERGED / validation-only.
CI #5634 / run 42073823692: SUCCESS on validated code head a96cc533aea3be23bf5a302c398c4a19d5f3deae.

CI evidence on that validated code head completed successfully through the full validation path:
- migration validation
- migration manifest generation and validation
- protected-migrator configuration contract validation
- API migration execution in CI
- typecheck
- build
- browser smoke
- disposable PostgreSQL acceptance tests
- production container build
- bounded disposable backup/restore rehearsal
- startup-isolation assertion

A subsequent documentation-only commit 2bc4cb3ff34eec6812aa83b74dc0eafce6cf05db updated this resume point. That commit itself is documentation-only and is not being represented as a new application validation result.

The reconciliation also adds fail-closed migration lineage validation to apps/src/migrate.ts. If schema_migrations contains a version with no active source migration, or a filename that differs from the active source filename, migration execution aborts instead of silently accepting the mismatch.

## Database control-plane evidence — READ-ONLY
Neon control-plane inspection of the authoritative project steep-mud-79906940, branch br-restless-base-b44cip2h, database rupaykg succeeded for metadata inspection.
- Database-scoped table inventory reports 67 public tables.
- The application database inspected is rupaykg.
- The branch's visible PostgreSQL role inventory currently exposes the rupaykg role.
- public.organizations currently has no organization_id/tenant_id column; this is expected for the organization root table and is not, by itself, a tenant-isolation failure.
- The metadata inspection interface does not expose table RLS state, so RLS enablement is NOT VERIFIED from this inspection.
- No production SQL mutation, DDL/DML, role/grant change, deployment, or branch mutation was performed.

## Production evidence / unresolved verification
Prior repository/production evidence recorded a production ledger entry for migration 096 while the corresponding active source migration was absent, with staging-only 20261022–20261025 migrations not production-applied. This remains a release-critical evidence item.

A fresh direct read-only Neon SQL verification of production migration lineage was attempted; the connector returned HTTP 401 authentication failure. Therefore current authoritative production migration lineage is NOT VERIFIED in this session. The successful control-plane metadata inspection above does not substitute for querying schema_migrations.

Do not rewrite, delete, reintroduce, or mark migration 096 resolved based on inference. Resolve the evidence gap first, then perform an independently reviewed lineage reconciliation.

## Parallel release/security work
- #291 protected migrator: open, unmerged, non-draft; validation-only.
- #298 security convergence: draft/open/unmerged; validation-only.
- #302 oversized production-representative rehearsal stack: open, unmerged; do not merge.
- #303 bounded recovery/startup isolation branch: open, unmerged; CI #5628 SUCCESS.
- #304 protected-migrator/startup reconciliation: open, draft, unmerged; validated code head CI #5634 SUCCESS.

## Next safe actions
1. Preserve #304 as a verified validation artifact; do not merge/deploy automatically.
2. Resolve authoritative production migration-lineage evidence, including version 096, through a successful read-only connection.
3. Continue repository/database release-gate audit for tenant isolation/RLS, runtime DB identity, and least privilege using actual source and metadata evidence.
4. Keep recovery rehearsals disposable and bounded.
5. Do not perform production DDL/DML, role/grant/RLS changes, deployment, worker activation, certification, or TRL 9 declaration without the required independent gates and explicit founder approval.
