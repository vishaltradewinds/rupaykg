# Production / Staging Schema Drift — 2026-10-28

## Status

**Read-only comparison completed. Reconciliation NOT applied. Production certification remains HOLD.**

Compared Neon database `rupaykg` on:
- Production branch: `br-restless-base-b44cip2h`
- Staging branch: `br-spring-hill-b4544vz5`
- Project: `rupaykg-production-fresh`

The comparison used Neon’s branch schema-diff operation. No application SQL, DDL, DML, ledger repair, or queue mutation was executed by this audit.

## Main findings

### 1. Staging-only async mirror and AI intake schema

The schema diff reports these objects in staging but not production:
- `async_mirror_inbox` and its status-event table, sequence, indexes, constraints, and event triggers/functions
- `ai_intake_rate_limits`
- `ai_evidence_intake_jobs`

This matches the prior read-only ledger/catalog audit: staging records the date-prefixed migrations from 2026-10-22 through 2026-10-25; production does not. Staging had 12 inbox rows and 29 event rows in the earlier read-only row audit. These records were not modified.

The worker path is **not releasable** based on schema presence alone. In particular, the worker can emit `UNRESOLVED`, while the recovered 2026-10-23 status CHECK constraint does not allow that value. The proposed 2026-11-01 corrective migration is future-dated relative to this audit and is not proof of a deployed fix. Keep the scheduler disabled until a reviewed, correctly ordered corrective migration and real PostgreSQL transition tests are green.

### 2. Production-only verification authorization provenance

The schema diff also shows production contains verification authorization provenance fields absent from staging:
- `verifications.authorization_membership_id`
- `verifications.authorization_role_id`
- `verifications.authorization_permissions_snapshot`
- `verifications.authorization_checked_at`

Production’s verification trigger/function also contains stricter logic that binds verification to evidence/activity and checks active verifier permission within the activity organization, then records the authorization snapshot. The schema diff shows foreign keys from the membership/role provenance fields.

This is material functional drift, not merely migration naming. Do not downgrade production or replay migrations to force equality. Establish the canonical intended release and reconcile forward through reviewed migrations.

### 3. Scope and limits

- This is a schema-diff report, not a full data equivalence audit.
- The diff is directional: production compared with staging as the base. The findings above describe objects/definitions that differ in those directions.
- A matching object name or prior matching column/constraint counts does not prove every definition, trigger, index, policy, function body, sequence state, or seed row is identical.
- The live ledgers already diverge: production records numbered migration 096 and date-prefixed 2026-10-18–21 migrations; staging records date-prefixed 2026-10-18–25 migrations. Numbered replacements 088–091 are not a contiguous applied history in production.
- Do not edit already-applied migration files, delete staging queue rows, replay 088–091, or merge the substantially diverged AI middleware branch wholesale.

## Acceptance test result

GitHub Actions run:
https://github.com/vishaltradewinds/rupaykg/actions/runs/40725301742

Result: **success** for the full CI workflow, including:
- dual-ledger disposable PostgreSQL acceptance test
- actual `apps/src/migrate.ts` runner against isolated production-shaped and staging-shaped fixtures
- repeat-run no-op checks
- preservation checks for 12 synthetic inbox rows and 12 corresponding event rows in the fixture
- fail-closed check when a recorded migration file is absent
- production container build

Important limitation: these are compact test fixtures derived from recovered migration SQL, not a byte-for-byte run of both complete live historical ledgers. The test simulates the relevant ledger shapes in isolated schemas and does not make the live databases equivalent.

## Required next gates

1. Independently review fixture SQL against recovered source blobs; record any semantic differences and make fixtures faithful or explicitly justify each intentional reduction.
2. Extend acceptance coverage to the actual full migration runner against representative complete ledger histories, including the legacy date-prefixed migration filenames and production’s 096 history. Do not pretend the four-migration fixture is a full-ledger simulation.
3. Build a canonical object-level inventory for the staging-only and production-only objects, including function definitions, trigger bindings, constraints, indexes, sequence ownership/state, policies, and seed/reference data.
4. Resolve the worker `UNRESOLVED` status constraint with a reviewed forward migration and a real disposable-PostgreSQL integration test that proves both unresolved and normal transitions.
5. Prepare a forward-only reconciliation plan with explicit preconditions, rollback/restore approach, data preservation checks, and independent review. Test it on disposable/temporary branches before any live change.
6. Keep production certification, production migration changes, and scheduler activation **HOLD** until every gate is evidenced.

**Shakti disposition:** engineering test gate improved; live environment reconciliation and production certification remain blocked.

## Fixture fidelity follow-up

A normalized executable-SQL comparison was performed against the recovered feature-branch source blobs for all five fixture files (2026-10-22 through 2026-10-25 plus the proposed 2026-11-01 corrective migration). After removing SQL comments, normalizing case/whitespace, and normalizing whitespace around SQL punctuation, all five fixture bodies matched their recovered source bodies. The fixtures are not byte-for-byte copies; this comparison establishes normalized textual equivalence under that normalization, not equivalence proven by a full PostgreSQL parser. The actual-runner acceptance test is green on the isolated fixture schemas.

## Release-catalog reconciliation finding (confirmed against this branch)

A direct inventory of `migrations/` at this branch's head found **91 migration files: numbered migrations 001–087 plus the four date-prefixed files 20261018–20261021**. It does **not** contain `096_verification_authorization_provenance.sql` or the staging-only files `20261022_async_mirror_inbox.sql` through `20261025_ai_evidence_intake_jobs.sql`.

The previous history-fixture test incorrectly assumed numbered replacements 088–091 and 096 were in the current release catalog. That assumption is now removed: `apps/src/migration-ledger-history-fixtures.test.ts` reads the actual `migrations/` directory and verifies the real missing-file outcomes.

Consequences for the current branch:
- The four shared legacy migration records from 20261018–20261021 are present in the catalog.
- A production ledger containing `096_verification_authorization_provenance.sql` is orphaned against this branch's release catalog; the fail-closed guard must stop.
- A staging ledger containing 20261022–20261025 is orphaned against this branch's release catalog; the fail-closed guard must stop.
- This is a **release-blocking catalog mismatch**, not a reason to bypass the guard. Recover and review the exact missing historical sources, reconcile naming/history explicitly, and validate a forward-only release catalog before deployment.

## Expanded read-only object-definition checks

Read-only PostgreSQL catalog queries on production and staging confirmed:
- Staging has `async_mirror_inbox`, `async_mirror_inbox_events`, `ai_intake_rate_limits`, and `ai_evidence_intake_jobs`; production has none of those four tables.
- Staging's `async_mirror_inbox_status_check` allows `RECEIVED, PROCESSING, PROCESSED, VALIDATED, REJECTED, RETRY, QUARANTINED`, but not `UNRESOLVED`.
- Production's `verifications` table has `authorization_membership_id`, `authorization_role_id`, `authorization_permissions_snapshot`, and `authorization_checked_at`; staging does not.
- Production's `prevent_invalid_verification` trigger function binds evidence to its activity, requires an organization-scoped active verifier membership and allowed permission, and writes the authorization provenance snapshot. Staging's function uses a less restrictive `has_verification_permission` check and does not populate that snapshot.
- These differences are security- and behavior-relevant. Do not overwrite production's stronger verification policy with staging's definition; the intended canonical behavior and forward migration must be independently reviewed.

The object-level query covered the target tables, constraints, indexes, and relevant trigger/function definitions. It is not a claim that every object in the entire database has been fully reconciled.

## Recovery of production-recorded migration 096

The missing production source was recovered from Git history:
- Source commit: `ca8f4100782e13f8d72106187fafc8e1e446214f` — “Bind verification to organization and snapshot authority”.
- Source blob: `258b1f4534efbf915688f78aa84d4ec24a47cbc0`.
- Follow-up commit `54a7fe1ceb41b37a68720a71c10a1dd03af30dea` explicitly removed the migration from main as unreviewed.
- A non-release evidence fixture was preserved at `scripts/fixtures/legacy-migrations/096_verification_authorization_provenance.sql`; it is **not** in the release `migrations/` directory and must not be treated as approved deployment material.

The recovered SQL adds four verification authorization provenance fields and changes `prevent_invalid_verification()` to bind evidence to its activity, require organization-scoped active verifier permission, reject self-verification, and record the decision-time permission snapshot. This is consistent with the stronger production-side definition observed in the read-only catalog audit. Because the historical change was explicitly removed as unreviewed, its recovery is evidence preservation—not approval to reintroduce it into a release. Obtain independent security/domain review and prepare an approved forward migration or formally documented history-reconciliation approach before any release.

The actual-runner acceptance suite has been extended to model the production ledger's recorded `096` and staging's recorded `20261022`–`20261025` files against a release catalog that lacks them. It asserts the actual runner fails closed in both cases. The new CI run must pass before this batch is considered complete.

## Expanded actual-runner validation update

On CI run [40727032996](https://github.com/vishaltradewinds/rupaykg/actions/runs/40727032996), the actual `apps/src/migrate.ts` runner passed both historical-ledger negative cases: production-shaped history fails closed on absent `096_verification_authorization_provenance.sql`, and staging-shaped history fails closed on absent `20261022`–`20261025` migration files. The broader disposable PostgreSQL acceptance suite also passed. The production-container build was still in progress at the time of this update; this is not a claim that the entire workflow completed successfully.
