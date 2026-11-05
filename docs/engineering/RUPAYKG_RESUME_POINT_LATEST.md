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

## 2026-11-05 tenant isolation / RLS gate — VERIFIED BLOCKER
Fresh read-only SQL against the authoritative Neon branch/database succeeded.
Runtime identity observed: current_database=rupaykg, current_user=rupaykg, session_user=rupaykg.
Production schema_migrations is now directly VERIFIED for the current branch: the latest visible entries include 20261021, 20261020, 20261019, 20261018, then 096, followed by 087 and earlier entries. Version 096 is recorded as 096_verification_authorization_provenance.sql. This resolves the previous session's SQL-authentication evidence gap for the inspected branch; it does NOT establish that the source migration lineage is reconciled, because source-file inventory still needs to be compared against this ledger.
Most importantly, direct PostgreSQL catalog inspection shows all 67 public tables have relrowsecurity=false and relforcerowsecurity=false. A direct policy count returns 0 rows. Therefore RLS is NOT ENABLED and there are NO PostgreSQL RLS policies on the inspected database.
This is a release-critical tenant-isolation blocker. Do not enable RLS ad hoc in production: the correct next step is repository/source/migration reconciliation to design and validate the complete tenant-boundary policy set, including service-role/migrator exceptions, before any controlled migration is proposed.
No production DDL/DML or security mutation was executed.

### Evidence classification
- Runtime DB identity: VERIFIED for inspected Neon branch/database.
- Production migration ledger contents: VERIFIED for inspected Neon branch/database.
- RLS enablement: VERIFIED FALSE.
- RLS policy inventory: VERIFIED ZERO.
- Tenant isolation safety: NOT ACCEPTED / BLOCKED pending repository-level policy design and controlled validation.
- TRL 9: NOT CLAIMED.


## 2026-11-05 tenant-isolation reconstruction — IN PROGRESS / RELEASE BLOCKED
Branch: `shakti/2026-11-05-tenant-isolation-reconstruction`.
PR #305 is OPEN / DRAFT / UNMERGED / validation-only. Commits on this branch record the verified tenant-scope inventory, policy matrix, and transaction-scoped database-context design.

Direct Neon `information_schema.columns` inspection verified 31 organization-bearing column occurrences across 28 table names: single-organization ownership columns and bilateral relationships such as processor, actor, issuer, recycler, from/to, and obligated organization identifiers. This is an inventory input, not a completed RLS policy set.

The repository API currently uses a shared PostgreSQL pool and many direct `pool.query()` calls. Therefore RLS must not be enabled before protected data access is migrated to transaction-scoped authorization context. Session-level tenant state on pooled connections is prohibited.

Required next implementation batch: build the transaction-scoped DB context abstraction, migrate protected route/data-access paths, and add disposable PostgreSQL cross-tenant isolation plus pooled-connection leakage tests. Only after those tests pass should RLS SQL policies be implemented and rehearsed on disposable PostgreSQL.

Migration 096 remains unresolved at source/ledger lineage level: the inspected production ledger records `096_verification_authorization_provenance.sql`, while exact active-path checks did not locate that filename. Commit-history search identified historical authorization/provenance work but did not establish the exact missing migration filename/path. Do not mark 096 resolved by inference.

No production DDL/DML, role/grant change, RLS mutation, deployment, merge, certification, or TRL 9 declaration was performed in this batch.


## 2026-11-05 Tenant Context Implementation Batch

- Branch: `shakti/2026-11-05-tenant-isolation-reconstruction`.
- Implemented a reusable transaction-scoped PostgreSQL tenant/security context primitive in `apps/src/db-context.ts`.
- Context uses parameterized `set_config(..., true)` inside an explicit transaction, so the identity/organization/bilateral/service settings are transaction-local rather than session-local.
- Added unit tests in `apps/src/db-context.test.ts` covering commit/release and rollback/release behavior.
- Migrated the `POST /api/v1/resource-flows` protected write path to execute authorization, geography checks, and the insert in one tenant-context transaction.
- This is a bounded implementation checkpoint, not completion of tenant isolation.
- RLS remains disabled in the inspected Neon database and no production RLS mutation has been performed.
- Required next validation: CI on the new head, then disposable PostgreSQL isolation tests and pooled-connection reset evidence before broader protected-route migration or any RLS migration.
