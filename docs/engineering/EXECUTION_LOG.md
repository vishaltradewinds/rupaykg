# RupayKg engineering execution log

Append-only resume log. Record concrete actions, exact evidence, limitations and safety posture. Do not rewrite prior entries to alter the timeline.

## 2026-10-31 — Canonical live database and repository cleanup

- Neon project inventory returned one RupayKg project: `rupaykg-production-fresh`, project ID `steep-mud-79906940`.
- Inspected project metadata, all four branches and the three available compute endpoints. Identified the sole authoritative live system-of-record target as project `steep-mud-79906940` / branch `main` (`br-restless-base-b44cip2h`) / database `rupaykg`, PostgreSQL 18.6, active read/write endpoint `ep-restless-flower-b48dupda`.
- Read-only identity/schema queries on production main, legacy staging and older rehearsal returned database `rupaykg`, PostgreSQL 18.6, `session_user=current_user='rupaykg'`, and `pg_is_in_recovery()=false`.
- Production main has 92 migration-ledger rows and lacks inbox, inbox-event, jurisdiction-crosswalk and authoritative-source-snapshot relations. Staging and older rehearsal have 95 rows and inbox/event relations, but lack crosswalk/source-snapshot relations. The fresh main-derived rehearsal has no endpoint and was not queried.
- Decision: production main is the only source of official platform state. All engineering DB changes must be rehearsed on a fresh isolated branch derived from this main baseline. Do not use legacy staging or the older staging-derived rehearsal as authoritative or as a substitute for production.
- Created `docs/engineering/RUPAYKG_AUTHORITATIVE_DATABASE_AND_REPOSITORY_POLICY_2026-10-31.md` with database identities, branch classification, safe-use rules, worker schema gap and open gates.
- Archived original Git blob IDs for four transient CI marker files in `docs/archive/CI_MARKER_CLEANUP_2026-10-31.md`, then removed those four marker files from this review branch only. Git history remains intact.
- Added this log and refreshed `docs/CURRENT_SOURCE_OF_TRUTH.md` and `docs/EXECUTION_STATUS.md`. Root README is updated to point to the canonical records.
- Repository branch: `engineering/authoritative-db-repository-cleanup-2026-10-31`, created from main commit `862512c8c904cef0f604df0350f02672318953af`. This is a documentation/working-tree cleanup branch; it is not merged.
- Worker PR #161 remains draft/open/unmerged. Runtime SHA `fd2e52e3f73d03f73632bdccd0f0b6a03193f8b5` passed CI [#41205115744](https://github.com/vishaltradewinds/rupaykg/actions/runs/41205115744); current head `1b0d972b3b8899f4960e5030856fff645b177941` is docs-only beyond the tested runtime SHA.
- No live Neon writes, migrations, role/grant/RLS changes, branch/endpoint changes, Render secret/config/deployment changes, worker/scheduler activation or statutory/Guardian/Hedera submissions occurred.
- Remaining gates: complete migration-chain rehearsal from authoritative main; queue authority approval; RLS/tenant-isolation decision; deployment-principal verification; independent security review; exact-head CI for later runtime changes; explicit deployment approval. Production HOLD; worker OFF; scheduler OFF; certification OFF; TRL 9 not claimed.


## 2026-10-31 — Cleanup review PR opened

- Opened draft PR [#173](https://github.com/vishaltradewinds/rupaykg/pull/173), base `main`, head `engineering/authoritative-db-repository-cleanup-2026-10-31`.
- PR contains 10 changed files: canonical database policy, source-of-truth checkpoint, execution status/log, README index, archive of four CI marker blob IDs, and removal of the four transient marker documents.
- GitHub reports the PR is mergeable; it remains draft/open/unmerged. No CI run is claimed because the changes are documentation-only.
- The four marker deletions are present only on the review branch until PR approval/merge. Main is unchanged. Historical migration files, legacy reference documents, live database branches and endpoints are retained.


## 2026-10-31 — Live migration ledger / repository mismatch found

- Read the complete production-main and staging `schema_migrations` ledgers and compared their version/filename pairs with the migration files on repository `main` and the current worker PR stack.
- Production main ledger: 92 rows; version `096` records `096_verification_authorization_provenance.sql`, while repository `main` does not contain that file. The exact same file exists on the worker PR stack with Git blob SHA `258b1f4534efbf915688f78aa84d4ec24a47cbc0`, matching the historical blob identity already recorded in the legacy checkpoint.
- Staging ledger: 95 rows; versions `20261022`–`20261025` are applied there, but those four migration files are absent from repository `main`. They are present on the worker PR stack. Staging does not contain version `096`.
- Repository `main` currently contains migrations through `20261021`; production main has `096` and staging has `20261022`–`20261025`. This is a material source-control/database migration provenance gap.
- Git blob identity is not a SHA-256 of deployed SQL bytes and does not prove exact Render execution provenance. No SQL, migration ledger or database state was changed.
- Added the exact discrepancy and resolution gates to the authoritative database policy. Preserve both live ledgers; do not renumber, rewrite or replay migrations. Reconcile the entire ordered migration chain on a fresh production-main-derived disposable branch before merging migration-bearing worker code.


## 2026-10-31 — Migration README contradiction corrected

- Corrected the obsolete statement that migration 023 was intentionally absent. The actual canonical repository contains `023_lifecycle_state_guards.sql`, and production/staging ledgers record version `023`.
- Added the live ledger/source-control gap to `migrations/README.md`: production records `096` while repository main lacks the file; staging records `20261022`–`20261025` while repository main lacks those files; the unmerged worker PR stack contains them.
- No SQL migration, live ledger or database was changed. The migration gap remains a merge/deploy blocker until full-chain reconciliation and disposable rehearsal.


## 2026-10-31 — Render source deployment cross-check

- Read-only Render service inspection confirmed service `rupaykg` (`srv-daki4d7qj5pc73b8qksg`) is connected to repository `vishaltradewinds/rupaykg`, branch `main`, with automatic commit deployments.
- Latest observed live deployment is `dep-dbis4nm417fc73a8m7ng`, source commit `862512c8c904cef0f604df0350f02672318953af`.
- This confirms the production code source branch, not the database connection target. Render secret values were not accessed or exposed; exact Neon branch/database used by the running service remains unverified.
- Updated the authoritative database policy to preserve this distinction. No Render settings, secrets or deployment were changed.


## 2026-10-31 — Restore production-applied migration 096 source

- Retrieved `096_verification_authorization_provenance.sql` from the worker PR stack and restored it to the cleanup review branch. The restored source Git blob SHA is `258b1f4534efbf915688f78aa84d4ec24a47cbc0`, matching the exact reviewed source blob already on that stack; file size 3,877 UTF-8 bytes.
- Read-only query against authoritative Neon production main confirmed the four migration-defined columns exist on `public.verifications`: `authorization_membership_id` (uuid), `authorization_role_id` (uuid), `authorization_permissions_snapshot` (jsonb), and `authorization_checked_at` (timestamptz).
- This closes the known production-applied migration-file omission on the cleanup branch. It does not change main until PR #173 is reviewed/merged.
- Clarified that staging ledger migrations `20261022`–`20261025` are not production-applied. They remain with the pending worker/feature stack and must not be promoted to the production baseline or applied to Neon without full migration review and separate approval.
- No production SQL, migration ledger, schema, role, grant, RLS, Render secret, deployment or service was changed. Worker/scheduler remain OFF; production HOLD; certification OFF; TRL 9 not claimed.
