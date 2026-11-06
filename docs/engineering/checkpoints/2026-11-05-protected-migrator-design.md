# Protected production migrator design — 2026-11-05

## Decision

RupayKg web-service startup must not own production schema mutation.

The production migration path is therefore defined as a **separate, explicitly invoked migrator job** with a distinct least-privilege migration credential, independent from the long-lived web runtime.

## Required execution topology

1. **Web service**
   - Runs `production-server.js` only.
   - Must never apply migrations.
   - Must never run acceptance seeding.
   - Uses the runtime application credential only.

2. **Migrator job**
   - Explicitly invoked as a release operation.
   - Uses a dedicated migration credential, not the web runtime credential.
   - Connects only to the approved authoritative production database/branch.
   - Runs ordered migrations transactionally and stops on first failure.
   - Emits non-secret audit evidence: deployed commit, migration source manifest version, target database identity, migration versions applied, start/end timestamps and result.
   - Must not expose its credential to the web container.

3. **Preflight**
   - Verify target database identity with `current_database()`, `current_user`, `session_user` and a non-secret deployment identifier.
   - Verify TLS/CA contract.
   - Verify migration source inventory and exact filename/version ordering.
   - Verify lineage gate.
   - Verify backup/restore evidence appropriate to the change.
   - Verify release commit matches the reviewed artifact.

4. **Migration**
   - Acquire a migration lock.
   - Reconcile the migration ledger against the approved source manifest.
   - Apply only the reviewed forward migrations.
   - Stop on first error.
   - Record success/failure evidence externally.
   - Never silently repair, delete, or rewrite ledger history.

5. **Postflight**
   - Re-check database identity and migration ledger.
   - Run schema/application acceptance against the same target.
   - Confirm web runtime remains migration-free.
   - Release traffic only after the acceptance gate passes.

## Credential separation

The migration credential must be distinct from the application runtime credential.

The application runtime must not receive migration privileges merely because the migration runner currently uses the same `DATABASE_URL` mechanism.

The migrator credential must be stored only in the deployment platform's protected secret mechanism and must never appear in Git, browser code, build artifacts, logs, or checkpoint documents.

## Lineage requirement

PR #290 provides the read-only source/ledger lineage validator.

Important limitation: `public.schema_migrations` currently has no source checksum column. Therefore version/filename reconciliation alone cannot establish byte-level historical source integrity.

The release process must use an immutable external migration evidence manifest containing at least:

- migration version;
- exact filename;
- SHA-256 of the reviewed SQL source;
- reviewed release commit;
- approval/reference identifier;
- target environment;
- execution result.

The manifest is evidence, not a replacement for the database ledger.

## Historical exceptions currently blocking release

### Migration 096

Historical source is recoverable from Git history, but it was explicitly removed from main as an unreviewed migration. It must not be reintroduced merely to make the ledger appear complete. Its production applicability requires an explicit reviewed decision based on the authoritative production schema and dependency analysis.

### 20261022–20261025

These four identifiers are present in the inspected non-authoritative staging ledger and their resulting schemas were fingerprinted. Exact original SQL source has not been recovered. They are therefore not production replay candidates.

## Release gates

The migrator is not production-ready until all of the following are evidenced:

- [ ] PR #289 web-startup migration removal reviewed and merged through normal release control.
- [ ] PR #290 lineage validator reviewed and merged through normal release control.
- [ ] Dedicated migrator implementation exists and is separately deployable/invocable.
- [ ] Distinct migration credential exists with least required privileges.
- [ ] Runtime DB identity is proven for the actual Render service.
- [ ] TLS/CA contract is explicit and tested.
- [ ] Immutable migration source manifest exists for the release.
- [ ] Migration 096 applicability is explicitly resolved.
- [ ] 20261022–20261025 source/classification gate is resolved or formally excluded.
- [ ] Full disposable PostgreSQL rehearsal passes from a clean database.
- [ ] Upgrade rehearsal passes from a production-representative database state.
- [ ] Backup/restore evidence passes.
- [ ] Tenant isolation/security rehearsal passes.
- [ ] Independent security/DB review passes.
- [ ] Controlled production migration is approved.
- [ ] Post-migration application acceptance passes.

## Safety boundary

No production database mutation, migration replay, ledger edit, role/grant change, RLS activation, deployment, or certification is authorized by this design document.

Production remains READ-ONLY/HOLD until the release gates above are independently evidenced.
