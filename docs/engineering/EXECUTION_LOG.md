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
