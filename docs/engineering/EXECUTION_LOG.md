# RupayKg engineering execution log

This file is the durable, append-only session handoff for repository work. New sessions must read this log and the active migration reconciliation audit before changing code or infrastructure.

## 2026-10-31 — Resume and P0 migration audit

### Repository setup
- Canonical repository: `vishaltradewinds/rupaykg`
- Base commit: `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`
- Created working branch: `engineering/rupaykg-resume-2026-10-31`
- No changes made to `main`.

### Actions completed
1. Reconnected to GitHub and Neon project `steep-mud-79906940`.
2. Re-read canonical package scripts, migration validator and ecosystem-state reconciler.
3. Read exact production and staging `schema_migrations` rows.
4. Queried relevant table existence, verification columns, trigger names/definitions, constraints and row counts.
5. Recovered migration 096 source and exact blob SHA from historical commit `ca8f4100782e13f8d72106187fafc8e1e446214f`.
6. Recovered migration source names and exact blob SHAs for versions 20261022–20261025 from branch `shakti/restore-async-migration-source-2026-10-31`.
7. Confirmed staging has 12 inbox rows and 29 append-only event rows; production lacks the inbox/AI intake relations.
8. Confirmed production has migration 096 provenance columns while staging does not; production verification table had zero rows at audit time.
9. Created this durable log and the companion migration reconciliation audit.

### Actions explicitly NOT performed in the initial read-only inventory segment
- No production/staging SQL writes, DDL, migration execution, migration-ledger edits, data copy, row deletion, or queue mutation.
- No deployment, scheduler activation, external Guardian/Hedera submission, certification, or credit issuance.
- No source migration was restored to this documentation branch; canonical source files are already present in the existing implementation PR #157.

Later append-only entries record separate additive DDL rehearsals on isolated Neon rehearsal branches. They did not modify production or staging.

### Current gate
- P0 migration/schema reconciliation: IN_PROGRESS / BLOCKED pending exact DDL/function and rehearsal evidence.
- Production migration/deployment: HOLD.
- Scheduler: OFF.
- Certification: HOLD.

### Next action
Continue with exact source-manifest comparison and function/trigger DDL comparison. Then inspect data distributions and worker lease/event integrity read-only. Only after these checks should a candidate migration source restoration be proposed and rehearsed on disposable PostgreSQL.

## Required logging format for every subsequent batch

Append a dated entry recording:
- exact repository branch and base/head commit;
- files added/changed/deleted with reason;
- tools/actions and whether read-only or mutating;
- databases/branches touched and exact SQL or migration identifiers;
- test names, exact commit tested, results and artifacts;
- security/compliance implications;
- unresolved blockers and next single action;
- approval status before any production-affecting action.

Never mark a gate complete without durable evidence. Never replace historical entries; append corrections with timestamps.


### Follow-up actions — 2026-10-31 (same audit batch)
10. Compared `prevent_invalid_verification()` function definitions by live catalog hash and fetched both bodies. Confirmed a material security difference: production has decision-time organization membership/role/permission snapshot enforcement; staging retains the older generic permission check.
11. Captured staging worker queue status distribution: 8 PROCESSING, 1 QUARANTINED, 1 RECEIVED, 1 RETRY, 1 VALIDATED.
12. Confirmed all 8 PROCESSING leases are expired (expiry timestamps 2026-10-20); all have non-null lease token and lease_until. No rows were altered.
13. Confirmed `ai_intake_rate_limits` and `ai_evidence_intake_jobs` are present in staging and currently empty.
14. Updated the audit with these findings and a stricter security/worker recovery gate.

### New critical blocker
The `verifications_integrity_guard` trigger name is the same in both databases, but its function body is not. Production enforces decision-time organization-specific verifier authority and records the authorization snapshot; staging does not. Treat this as a security-control divergence, not a cosmetic schema mismatch.

The 8 expired PROCESSING inbox rows are preserved and must not be automatically replayed or reset. Worker recovery is a separate reviewed workstream.


### Disposable migration rehearsals — 2026-10-31
15. Inspected existing rehearsal branch ancestry and confirmed it is a staging-derived branch; no production/staging parent was modified.
16. Applied the exact historical migration 096 SQL transactionally to the staging-derived rehearsal branch `br-broad-glade-b46npw8o`. Verified all four provenance columns, one integrity trigger, and function fingerprint equal to production. Verification rows remained zero and ledger remained unchanged. Schema/function rehearsal PASS.
17. Created a dedicated production-derived Neon rehearsal branch `br-frosty-term-b47k7ayc` from production branch `br-restless-base-b44cip2h`. An initial branch-create request using a custom suspend timeout was rejected by account policy; retried with account defaults and branch creation succeeded. No production changes.
18. Applied exact migration SQL 20261022–20261025 in filename order inside one transaction on the production-derived rehearsal branch only.
19. Compared schema fingerprints against staging: columns, constraints, indexes and triggers matched; normalized function fingerprints matched.
20. Ran a rollback-contained synthetic trigger test: inbox insert created one event, status transition created a second, append-only event mutation was rejected, and all synthetic rows were rolled back. Post-test inbox/event row counts were zero.
21. Confirmed source migration filenames match live ledger filenames in the environments where they are already applied. Reviewed `apps/src/migrate.ts`: lexical ordering, version+filename identity, transactional per-migration application, stop on first failure.
22. Documented that the migration runner does not verify source-content checksums; this is a follow-up integrity gap, not changed in this batch.

### Current state after rehearsals
- 096 staging-shaped schema/function rehearsal: PASS.
- 20261022–20261025 production-shaped DDL and worker-trigger rehearsal: PASS.
- Full migration-runner rehearsal: NOT YET RUN.
- API-level verifier authorization acceptance: NOT YET RUN.
- Production/staging migration ledgers: UNCHANGED.
- Worker queue records: UNCHANGED; eight expired PROCESSING leases remain preserved.
- Production deployment and scheduler: HOLD/OFF.


### Coordination and cost-control update — 2026-10-31
23. Searched existing open migration PRs before creating any source-restoration PR. Found PR #157 already contains the exact source migrations 096 and 20261022–20261025, plus the broader migration chain, migration-order logic, worker and production-shaped CI acceptance. Verified exact blob SHAs for the five recovered source files match the independent historical source evidence. No duplicate migration PR was created.
24. Verified PR #157 exact head `b3655259ce0f9d650477c34fa07a2a61d4a72f75` CI run #41190853951 passed every listed workflow step, including exact 92-row production baseline reconstruction, upgrade, idempotency, PostgreSQL acceptance and production container build.
25. Created production-derived Neon rehearsal branch `br-frosty-term-b47k7ayc` from production, applied only 20261022–20261025 DDL in one transaction, ran schema and rollback-contained worker trigger tests, then suspended its compute endpoint `ep-polished-hat-b4y8wpnp`.
26. Suspended the existing staging-derived rehearsal compute endpoint `ep-red-bar-b4ywq6ug` after the 096 rehearsal. Both endpoints were verified IDLE. The new production-derived branch remains present; deletion requires explicit user approval. No guarantee of zero storage/branch cost is inferred.
27. Updated the audit to designate PR #157 as the canonical implementation path and PR #159 as documentation-only.

### Current next action
Review PR #157's exact-head migration ordering, baseline manifest, worker/security acceptance and open review blockers against the newly recorded live evidence. Do not duplicate migration sources, merge, deploy, or reactivate the worker.


### Verification provenance security review — 2026-10-31
28. Inspected existing PR #140 and its disposable PostgreSQL test. Confirmed the production migration-096 trigger refreshes authorization snapshots on any UPDATE of an approved row; a no-op update after role-permission change rewrites the decision-time snapshot.
29. Confirmed PR #157's production-shaped upgrade test preserves the existing verifier function hash; this is not a fix for the snapshot mutation defect.
30. Hardened PR #140's unnumbered proposed fixture so linkage is immutable for every update of an already-approved row, including transitions away from APPROVED. Added regression assertions for decision-away + evidence/activity mutation and verifier identity mutation. Plain transition away preserves the original snapshot.
31. Latest PR #140 head: `5229e8299ba5a49af86748730e3fea42374e9d22`; exact-head CI #41191863577 is in progress. No pass claim until it completes.
32. Commented on PR #157 to block security-complete/merge claims until a separately reviewed forward-only migration, API/DB acceptance and independent review address snapshot immutability.

### Updated release gate
Verification provenance integrity is NOT COMPLETE. Do not edit/replay migration 096, do not change live Neon, and do not merge PR #157 until the forward-only correction has exact-head acceptance and independent security/database review.


### Verification provenance lifecycle refinement — 2026-10-31
33. Reviewed the first PR #140 forward-fix proposal beyond the immediate transition: found that a later update after APPROVED→REJECTED could clear the snapshot, and direct reapproval could be accepted without a separate audited path.
34. Refined the unnumbered fixture to preserve provenance whenever the row is currently APPROVED or has a prior authorization timestamp; reject linkage changes after approval; and reject direct reapproval of a previously approved row pending a separate audited workflow.
35. Added disposable PostgreSQL assertions for repeated post-rejection updates, linkage mutation after rejection, and direct reapproval rejection.
36. Prior PR #140 head `5229e8299ba5a49af86748730e3fea42374e9d22` passed exact-head CI #41191863577. Latest head `f7e4ff12be336058b99bc19a8b729cdd3b636707` is under CI #41192000600; not yet validated.
37. Updated PR #157 and PR #140 comments; no versioned migration assigned and no live database touched.

### Current security gate
Do not integrate the proposed trigger into a numbered migration until latest exact-head tests pass and independent review addresses concurrency, audit/reapproval workflow, trigger privileges/search_path, and historical data. PR #157 remains draft and production release HOLD.


### Rehearsal drift refinement — 2026-10-31
38. Rechecked the staging-derived rehearsal after applying 096. Confirmed its `async_mirror_inbox_status_check` still includes `UNRESOLVED` and its status comment still matches the candidate 20261101 migration effect; staging lacks both.
39. Confirmed neither staging nor rehearsal ledger contains version `20261101`. Classified the rehearsal as schema-effect match / ledger provenance unresolved; no replay or ledger edit performed.


### Final handoff — 2026-10-31
40. PR #140 latest head `f7e4ff12be336058b99bc19a8b729cdd3b636707` passed exact-head CI #41192000600, including disposable authorization provenance tests and full build/container workflow. Proposal remains unnumbered and not approved for deployment.
41. PR #157 exact head `b3655259ce0f9d650477c34fa07a2a61d4a72f75` passed CI #41190853951; release/merge remains HOLD for verifier snapshot immutability, tenant isolation, live drift and independent review.
42. PR #159 prior head `e11ccf5c7c6a44c29c5109b7cf4bdfa125f4e30d` passed CI #41191756563. Subsequent changes were documentation-only; exact latest docs-head CI was not returned at handoff.
43. Updated issue #123 and PR #157/#140 comments with final evidence and blockers.
44. Final state: production/staging untouched; scheduler OFF; eight expired staging PROCESSING rows preserved; unledgered 20261101 rehearsal drift preserved; both rehearsal compute endpoints idle; new production-derived Neon branch remains present with compute suspended and deletion pending explicit user approval.

### Next-session starting point
Read this log and `docs/engineering/2026-10-31-migration-reconciliation-audit.md` first. Continue from PR #157 (canonical migration/worker path) and PR #140 (authorization snapshot forward-fix tests). Do not repeat repository/Neon discovery or create duplicate migration-source PRs. First implementation task is a separately reviewed forward-only migration for verifier snapshot immutability, followed by exact production-shaped CI and independent security/database review. No merge/deploy/production mutation is authorized.


### Final live-state verification — 2026-10-31
45. Re-ran a minimal read-only Neon check after all rehearsals. Production remains at 92 ledger rows, verifier function MD5 `934a7be13f08c034bbd15e96285eb1be`, zero verification rows, and no async inbox/AI intake jobs. Staging remains at 95 ledger rows, verifier function MD5 `43e9af83f5031460689f7943d697a50a`, zero verification rows, and the async inbox/AI intake objects remain present. This confirms no production/staging schema or ledger mutation occurred.
46. Latest documentation PR #159 head is `dc68b2a5e5dd5e8602b345cf674aa33029b710b0`; changes are documentation-only. Exact-head CI was not returned for this latest docs head; earlier docs head `e11ccf5c7c6a44c29c5109b7cf4bdfa125f4e30d` passed #41191756563.
47. PR #157 remains open/draft at `b3655259ce0f9d650477c34fa07a2a61d4a72f75`; PR #140 remains open/draft at `f7e4ff12be336058b99bc19a8b729cdd3b636707`; PR #159 remains open/draft. No PR was merged.


### Render runtime-role identification attempt — 2026-10-31
48. Re-read the Render service metadata for service `rupaykg` (`srv-daki4d7qj5pc73b8qksg`). It is a Docker web service on the `main` branch, auto-deploy-on-commit enabled, free plan, Singapore region, public URL `https://rupaykg.onrender.com`. The service metadata response did not expose environment-variable names or values, so it does not identify the database login role. No environment variable was read, printed, changed or rotated.
49. Queried application logs using database/PostgreSQL/connection terms. The returned matching logs were historical (latest observed 2026-10-26) and contained only PostgreSQL connection-string SSL-mode warnings and migration-current messages; no runtime database role diagnostic was present. This is insufficient to infer the live Render login role.
50. Result: Gate A runtime-role identity remains OPEN. Do not infer that Render uses `rupaykg` or `neon_service`; the production catalog findings establish only that those roles are unsafe if used by the runtime. Next safe implementation is a reviewed, non-secret diagnostic that reports only `current_user`, `session_user`, and boolean privilege flags, exposed through an authenticated operator-only path or a startup log with no connection string/secret data. It must be added to a non-production rehearsal first; do not deploy it to the live `main` service before code review and an approved change window.
51. PR #140 exact-head workflow lookup for `9b0f493de4b02f63080fa77752f93eb0decbd419` returned no workflow runs. Latest SQL fixture/test changes remain unvalidated by exact-head CI. PR #140, #157 and #159 remain draft/unmerged; production release remains HOLD.


### Read-only runtime DB identity diagnostic added — 2026-10-31
52. Added `scripts/diagnostics/runtime-db-role-readonly.sql` and `docs/security/RUNTIME_DATABASE_IDENTITY_DIAGNOSTIC_2026-10-31.md` on a dedicated security branch. The SQL reports only current_user/session_user, role attributes, inherited memberships and selected verification/schema privileges inside a READ ONLY transaction; it does not inspect credentials, passwords, environment variables or secret stores.
53. Opened draft PR #160: https://github.com/vishaltradewinds/rupaykg/pull/160. It is based on PR #157's branch so the diff is limited to the two diagnostic artifacts. Exact-head CI run #41195074132 is in progress; no validation claim yet.
54. The diagnostic is explicitly rehearsal-first. Running it through an admin/personal connection does not identify Render's runtime role. No SQL was executed against production or staging; no Render env, credential, role, grant, ownership, RLS, deployment or live data changed. Production HOLD remains.


### Protected runtime DB identity diagnostic implementation — 2026-10-31
52. Added `GET /api/v1/admin/database-runtime-identity` to the draft tenant-isolation implementation branch. It is protected by the existing Super Admin authorization path and requires `admin:security`. It returns only `session_user`, `current_user`, role attribute booleans (SUPERUSER/BYPASSRLS/CREATEROLE/CREATEDB), public-schema CREATE, and verification-table TRUNCATE/TRIGGER booleans. It does not return connection strings, host/database details, passwords, credentials, raw grants or role membership names. Query is read-only.
53. Added route tests for authorized response shape and non-admin denial. Documented that CI/test calls identify only the test DB role; production identity can be observed only by a controlled call through the deployed application pool.
54. Implementation commits: route `b945e567674f9097b0d762cde672d7fa0947b87d`; tests `173d26ac148a0e80f3cc3e71fd79d09dc88c5907`; design documentation `ca66168a61da5efafc9f5abd67e22eda0586a51e`. Exact-head workflow lookup for the latest commit returned no runs; changes remain unvalidated by CI and PR #157 remains draft/unmerged.
55. Diagnostic is not deployed. No production/staging DB, Render environment, role, grant, ownership, credential, deployment or migration was changed. RLS policies and least-privilege runtime role remain unresolved release blockers. A controlled deployment and operator observation require separate review/approval.


### Route × table database access inventory — 2026-10-31
56. Reviewed PR #157 source tree at `ca66168a61da5efafc9f5abd67e22eda0586a51e` and performed a first-pass static scan across 15 route modules plus server, async mirror worker, acceptance seeder and migration runner.
57. Recorded literal endpoint counts, tenant transaction helper call sites, direct `pool.query`/manual connection counts, and candidate SQL table references by module. The scan identifies context gaps: auth/onboarding, intelligence, platform-admin, statutory, sync and value paths require endpoint-level separation; value-routes has both tenant-helper and direct-pool paths; async worker and acceptance seed use direct pool access.
58. Added `docs/engineering/DATABASE_ROUTE_TABLE_ACCESS_INVENTORY_2026-10-31.md` on PR #157 branch; commit `ddbed3ab68fd0a06f055f3c68e5c678e26384c34`. It is explicitly a first-pass static inventory, not an exhaustive query graph or RLS policy specification. Regex false positives/omissions and helper-internal SQL must be resolved before policy design.
59. No code behavior, schema, RLS, database role/grant, credentials, Render configuration, production/staging data or worker state was changed. No RLS migration was created. Production remains HOLD.
60. Next: expand inventory to exact statement-level provenance and migration-defined ownership/FK chains; classify every endpoint into tenant, identity, governance, platform-admin, shared-reference, worker and migration execution contexts. Refactor missing contexts and add negative tests before any RLS rehearsal.



### Exact-head CI and statement-level route review — 2026-10-31 11:16 UTC
61. Rechecked the latest PR #157 candidate head `ddbed3ab68fd0a06f055f3c68e5c678e26384c34`: exact-head CI run #41195996022 completed successfully. Rechecked PR #159 head `33a0c6b04fb7d86a1c63573844666a76efdd29e1`: exact-head CI run #41196033601 completed successfully. PR #140 head `9b0f493de4b02f63080fa77752f93eb0decbd419` still has no PR-triggered workflow run.
62. Expanded source inspection on PR #157 to exact SQL call sites in intelligence, statutory, value, sync, registry, server and database-context modules. Confirmed statutory routes still perform permission/evidence/parent ownership checks and persistence in separate pool operations; BWG profile/period/report writes in value-routes still use direct pool queries; intelligence workspace checks permission/geography and reads activities on separate pool operations.
63. Recorded exact route-to-table access paths, global reference-data distinctions, multi-organization aggregation concerns, device principal requirements, bilateral settlement policy requirements and prioritized safe remediation order in `docs/engineering/STATEMENT_LEVEL_TENANT_ACCESS_REVIEW_PRIORITY_ROUTES_2026-10-31.md`. Commit `078132a35cb0f003446a53be9718bfc411e7f86f` on PR #157 branch.
64. This new documentation commit has not yet produced an exact-head CI run. Do not infer that prior run #41195996022 validates it. PR #157 remains draft/unmerged.
65. No application code, schema, RLS policy, live DB, Render configuration, role/grant, credentials, deployment, worker activation, government submission, Guardian/Hedera submission or carbon-credit issuance changed. Production remains HOLD.
66. Next: continue statement-level inventory for auth/onboarding, platform-admin, workspace, BWG, migration/worker/seed and helper internals; then design a separate transaction context for statutory writes and verified field devices. Do not enable RLS until full mapping, non-owner role and cross-tenant/bilateral/device negative tests are complete.


### BWG tenant-transaction remediation — 2026-10-31 11:20 UTC
67. Updated `apps/src/value-routes.ts` on PR #157 branch, commit `85bb6ae9f7b8180f37d65d6395eff6f6bca0c862`.
68. BWG profile and reporting-period writes now execute inside `createTenantTransaction`, require the selected verified active organization to match the request organization, and perform permission/geography checks on the same transaction client as the write.
69. BWG waste/EPR/ESG report paths now open a tenant transaction from the server-verified active organization, select the reporting period constrained by that organization with `FOR UPDATE`, perform permission, scheme, evidence and approved-verification binding checks on the same client, then insert the report on that client. A foreign-organization period ID now returns not-found instead of revealing its owner.
70. This is a code change, not a verified RLS guarantee. The transaction helper installs transaction-local tenant context but RLS remains disabled. No new route-specific integration tests have yet run; exact-head CI for `85bb6ae...` must pass before this batch is accepted. The existing test file `apps/src/value-routes.test.ts` only covers statutory-boundary basis logic, not these route transaction paths.
71. No production/staging DB, Render environment, role/grant, deployment, worker activation, Guardian/Hedera submission or carbon-credit issuance changed. PR #157 remains draft and production HOLD.


### Statutory route transaction remediation — 2026-10-31 11:24 UTC
72. Updated `apps/src/statutory-routes.ts` on PR #157 branch, commit `9b9a316f3e009d4840799992bf938dc1094417bb`.
73. All five statutory routes now use the shared tenant transaction helper for permission checks and SQL reads/writes. Route section contains zero direct `pool.query` calls; five tenant transaction boundaries and nine client SQL call sites.
74. Organization scope now requires the server-verified active organization and rejects a body organizationId that differs from it. EPR external-registration lookup and update are combined into one organization-constrained UPDATE; foreign-organization record IDs return not-found.
75. BWG assessment and EPR applicability evidence/verification binding now executes on the same transaction client as the insert/upsert. EPR catalog lookup and statutory applicability projections are transaction-bound too. Global verified EPR schemes remain reference data, not tenant-owned.
76. Exact-head CI run #41196781856 was queued/initializing at log time. No pass claim until all workflow stages complete. No dedicated statutory route integration tests were added in this batch; existing tests cover normalization/status boundaries only. Review and test authorization/error compatibility before merge.
77. No production/staging DB, Render environment, role/grant, deployment, worker activation, Guardian/Hedera submission or carbon-credit issuance changed. RLS remains disabled; PR #157 remains draft; production HOLD.


### Field-device organization binding and sync transaction hardening — 2026-10-31 11:24 UTC
78. Updated `apps/src/sync-routes.ts` on PR #157 branch. Initial device-binding commit `9af3845015579a6b9c4e9402a6026ff1fef5d80c`; active-organization enforcement `38062ff4eac4656478b783656ad6bc3b79ce861d`; evidence/activity organization constraint `8258314980d8879ad9a4c6622f86ca48640921`.
79. Removed pre-transaction device verification lookup. Envelope intake now locks the verified device row inside the same transaction, requiring authenticated identity, VERIFIED status and equality with the active organization. Envelope apply locks the envelope plus device row and rechecks identity, device status and active organization.
80. Authoritative operation application now receives the organization from the locked device row. Activity/resource-flow creation must target that organization; measurement/evidence operations resolve their activity only inside that organization. Device scope is not accepted from payload.
81. Added `docs/engineering/FIELD_DEVICE_PRINCIPAL_SYNC_CONTROLS_2026-10-31.md` (commit `de9682d4904aa8bea212e6499befd27d2aa10430`). This explicitly records that the current model is still bearer-authenticated human identity plus a verified device record—not independent cryptographic device authentication—and that worker role isolation and complete conflict/inventory review remain outstanding.
82. Exact-head CI for PR #157 commit `38062ff...` run #41196883067 was initializing; subsequent commit `8258314...` and documentation commit `de9682d...` do not yet have verified completed CI. Statutory route CI run #41196781856 had reached production-container build after all previous stages succeeded; final result not yet verified at log time.
83. No production/staging DB, Render environment, role/grant, deployment, worker activation, queue mutation, Guardian/Hedera submission or carbon-credit issuance changed. RLS remains disabled; PR #157 draft; production HOLD.


### Sync lock-order correction and final device scope — 2026-10-31 11:24 UTC
84. Follow-up sync commits `3250e478b976648767eb6ac620546e1c0b11c257` and `c09cbf3358ef5b34f6d8d08071eeff5d7395a93c` establish a consistent device-before-envelope row-lock order for both intake and apply. Apply now first resolves the device ID, locks and validates the device for the active organization, then locks the envelope constrained to that device and identity; the organization passed to operation application comes directly from the locked device row.
85. Updated device control document in commit `e7856769150f440c91cafb827a4e38505a8a873f` to record lock order and deadlock rationale. These latest code/documentation commits require exact-head CI; earlier CI results do not validate them.


### Verification update — statutory and device-sync batches — 2026-10-31 11:25 UTC
86. Exact-head CI for BWG code commit `85bb6ae...` completed successfully (run #41196566577): migration validation, exact production baseline reconstruction, upgrade/idempotency, typecheck, build, browser smoke, disposable PostgreSQL acceptance, evidence upload and production container build all passed.
87. Exact-head CI for statutory transaction commit `9b9a316...` completed successfully (run #41196781856): all workflow steps passed, including disposable PostgreSQL acceptance and production container build. This run validates the statutory code commit.
88. Exact-head CI for the first device-binding sync commit `38062ff...` completed successfully (run #41196883067): all workflow steps passed. Later sync lock-order and type-narrowing corrections are newer commits and are not covered by that run.
89. Latest sync CI run #41196987657, associated with commit `c09cbf3...`, had passed migration validation and production-baseline/upgrade/idempotency stages; TypeScript typecheck was in progress. Subsequent sync/documentation commits `f8d76a3...` and `e785676...` are not yet verified by exact-head CI.
90. Current PR #157 head at log time: `f8d76a33c46a709e8ae6ce97153c3c37b42b0e4d`. Keep draft until exact-head CI passes and the device replay/organization spoofing integration tests and independent security review are complete.


### Government inbox worker least-privilege audit — 2026-10-31 11:30 UTC
91. Audited `apps/src/async-mirror-worker.ts`, its fake-pool tests, `apps/src/server.ts`, `apps/src/production-server.ts`, and API package scripts. The worker accepts an injected Pool; no worker runner/import/start path was found in the inspected application source, and the web server does not start it. This is source evidence only; deployment inventory must rule out an external worker.
92. Identified minimum candidate privileges: queue-only SELECT/column UPDATE for bounded claim, fenced status transitions and reconciliation; SELECT-only approved crosswalk/source/activity references; EXECUTE only on reviewed geography/source-scope functions. The web runtime must not receive queue-claim/state-transition privileges.
93. Added `docs/engineering/GOVERNMENT_INBOX_WORKER_LEAST_PRIVILEGE_GATE_2026-10-31.md` in commit `e5439d5a1cd5c110e52e0d65b054496ca8b1712c`. It records the role split, exact capability matrix, required disposable-clone positive/negative tests, activation prerequisites, and worker lease/crosswalk race risks.
94. Deliberately did not create role/grant migration or a runner: actual Render runtime identity is unverified, schema-level column/function grants need fresh schema inspection, and eight expired PROCESSING rows in staging must remain untouched. Worker remains OFF; no staging/production queue processing occurred.
95. Exact-head CI for latest PR #157 device-sync changes remains a required gate. No role/secret/Render/deployment/queue/RLS changes. Production HOLD.


### Device-sync exact-head CI confirmation — 2026-10-31 11:30 UTC
96. CI run #41197036782 for device-sync code commit `f8d76a33c46a709e8ae6ce97153c3c37b42b0e4d` completed successfully. All workflow steps passed: dependency audit, migration validation, exact production baseline reconstruction, pre-upgrade baseline capture, migration upgrade/idempotency, typecheck, build, browser smoke, disposable PostgreSQL acceptance, evidence upload and production container build.
97. This validates code at `f8d76a3...`; subsequent worker least-privilege documentation commit `e5439d5...` does not change runtime code but is the current PR #157 head. Keep PR draft for outstanding worker-role/runtime-identity and independent-review gates.


### Government inbox runtime identity and worker pool guard — 2026-10-31 11:48 UTC
98. Read-only Render inspection confirms the RupayKg web service auto-deploys from `main`; current live deploy `dep-dbis4nm417fc73a8m7ng` runs commit `862512c8c904cef0f604df0350f02672318953af`. The protected database-runtime-identity route is only on unmerged PR #157 and is not in the live deploy. No diagnostic request was made; inspected logs showed routine health checks only. Merging the route would trigger production auto-deploy, so no merge/deploy was performed.
99. Added `docs/engineering/GOVERNMENT_INBOX_RUNTIME_IDENTITY_AND_LEAST_PRIVILEGE_GATE_2026-10-31.md` (commit `5e46cb3f49e4cf4fc62ab6881cd9f70a0d792ece`). It records live deployment facts, safe role-verification requirements, the dedicated worker identity policy, and the outstanding independent runtime inventory gate.
100. Added `apps/src/async-mirror-worker-runner.ts` and `apps/src/async-mirror-worker-runner.test.ts` on PR #157. The non-activating pool factory requires `GOVERNMENT_INBOX_DATABASE_URL`, has no `DATABASE_URL` fallback, rejects an identical app/worker DB principal, bounds pool size, and provides a read-only schema preflight for inbox/events, crosswalk/source-snapshot relations, geography scope functions, UNRESOLVED status support and the append-only event trigger.
101. The runner guard is not imported by the web server and does not start/schedule the worker. Unit tests cover missing dedicated URL, same-principal rejection, dedicated URL use, schema readiness success, missing dependency fail-closed and empty catalog response. It does not establish real PostgreSQL role grants; a separate login-based disposable PostgreSQL positive/negative privilege test remains required.
102. Highlighted that the worker exhaustion sweep can quarantine expired PROCESSING rows once attempts are exhausted. Preserve all eight staging PROCESSING leases; no worker test or replay against staging. No Render environment values/secrets were read or changed; no database roles/grants/schema/data, deployment, scheduler, or worker state changed.
103. CI run #41198239381 for PR #157 head `6054fcd0045fa387afd5300293c86202ea116a59` passed migration validation, exact production baseline reconstruction, upgrade/idempotency, typecheck, build, browser smoke, and disposable PostgreSQL acceptance. Production container build was still running at log update time; do not mark the full workflow successful until it completes.
104. PR #157 remains draft/open; PR #159 remains draft/open. Production and staging remain HOLD. No worker activation, government filing, MRV approval, Guardian/Hedera submission, or credit issuance.

105. Final CI confirmation: run #41198239381 completed successfully for PR #157 code head `6054fcd0045fa387afd5300293c86202ea116a59`; all workflow steps passed, including disposable PostgreSQL acceptance and production container build. Updated `GOVERNMENT_INBOX_WORKER_POOL_GUARD_2026-10-31.md` in commit `b2ee087dbcf662ccbe00d7b19dc4a0cef1aa63b6` to record the completed run. This does not prove live database role grants or Render identity.

106. Read-only Render workspace inventory returned six web services and one static site; no Render cron-job service was present in the returned workspace inventory. Added this bounded finding to `GOVERNMENT_INBOX_RUNTIME_IDENTITY_AND_LEAST_PRIVILEGE_GATE_2026-10-31.md` in commit `b5fb843aa5c3c1b5c01499c0e27b137e56c04b6b`. This does not rule out an embedded worker, external scheduler, other workspace/account, GitHub Actions process or third-party host.

107. Inventory count correction: the seven returned Render services are five web services and two static sites (not six web plus one static). Corrected the runtime identity gate document in commit `d60414a067b2cb9d9cf080c14c2e0d469bf79733`; no service inventory conclusion changes—no Render cron-job service appeared in the returned list.

108. Authoritative Neon database check (read-only): project `steep-mud-79906940`, database `rupaykg`, default production branch `main` / `br-restless-base-b44cip2h`; staging `br-spring-hill-b4544vz5`; staging-derived rehearsal `br-broad-glade-b46npw8o`. Production ledger is 92 rows through `20261021`; inbox, inbox-events, government crosswalk and authoritative source snapshot tables are absent. Staging and rehearsal ledgers are 95 rows through `20261025`; both have inbox/event tables but no crosswalk/source snapshot tables. Staging excludes `UNRESOLVED`; rehearsal allows it without a corresponding ledger entry. Previous production-derived rehearsal branch `br-frosty-term-b47k7ayc` is absent from the current branch list.
109. Staging queue status-only counts remain PROCESSING 8, QUARANTINED 1, RECEIVED 1, RETRY 1, VALIDATED 1. Preserve the eight expired PROCESSING leases and all other rows; no queue mutations performed.
110. Production `rupaykg` database role: BYPASSRLS, CREATEROLE and CREATEDB enabled; member of `neon_superuser`; owns 67 public tables; broad DELETE/INSERT/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE grants across 67 public tables. Staging role is similarly overprivileged with broad grants across 71 tables. Neon inspection session identity is not evidence of Render's actual DB login.
111. Authoritative DB findings posted to PR #159 comment #6543035798. Production remains authoritative and unchanged; worker OFF. Do not apply migrations or enable the worker until ordered migration reconciliation and disposable-branch separate-login privilege tests are complete.

112. Live staging catalog audit found `record_async_mirror_inbox_event()` is SECURITY INVOKER, has no pinned search_path and is owned by over-privileged `rupaykg`. Since it inserts into the append-only event table, granting worker direct INSERT would let it forge audit rows. This was not visible in the previous privilege matrix and is a newly identified security dependency.
113. Added proposed migration `20261112_inbox_event_trigger_security_definer.sql` (commit `06259fef391bb5aacd8caf66c17aa64ddb4a5b52`, with dynamic role creation) to create a NOLOGIN, non-superuser/non-BYPASSRLS event-writer capability role with only event INSERT and sequence USAGE; trigger function becomes SECURITY DEFINER with pinned search_path and fully qualified table reference; public execute revoked. Worker does not receive event-table INSERT.
114. Added `apps/src/async-mirror-worker-privileges-db.test.ts` (commit `0a32523ea6efdd74aa73f13fe2b4e01b40491a0e`) to test using a genuinely separate temporary PostgreSQL login: restricted inbox update fires event trigger, direct event INSERT, inbox DELETE, payload hash update, unrelated evidence SELECT and schema DDL are denied. CI run `41199041215` was in progress at typecheck/build stage at this log update; no pass claim yet.
115. Updated worker least-privilege gate document with the event-trigger finding and proposed capability isolation (doc commit `5e202a6eb2e26839f223d93efebe244e159a98d2`). No Neon branch, live schema, role, grant, queue row, secret or deployment was changed. Worker OFF; production HOLD.

116. CI run `41199041215` validated migration ordering/application/idempotency, typecheck, build and browser smoke, but failed in the new disposable DB privilege test at its search_path assertion. Root cause: test assertion used an over-escaped whitespace regex; the migration itself had applied successfully in CI. Corrected the assertion to normalize spaces in commit `e5a1754eaa1dcf0e5c9e3787e62cf7062c302416`. Follow-up CI run `41199213943` is pending; do not claim separate-login test pass until it completes.

117. Follow-up CI run `41199213943`: migration validation/reconstruction/application/idempotency, typecheck, build and browser smoke all passed. Disposable PostgreSQL test then failed during cleanup: the temporary worker login had grants on inbox tables, so PostgreSQL correctly refused DROP ROLE while those dependencies remained. The security assertions themselves reached expected denials for direct event INSERT, inbox DELETE, payload-hash rewrite, unrelated evidence SELECT and schema DDL; however the test is marked failed because cleanup was incomplete. Corrected cleanup to execute `DROP OWNED BY <temporary role>` before `DROP ROLE` in commit `6168499facaae31dbba1f7b02cf64c12d6bfd38d`. New CI run `41199424164` is in progress. No live database changes.

118. CI run `41199424164` completed SUCCESS (job `validate`): migration validation; exact production-baseline reconstruction; proposed migration application and idempotency; typecheck; build; browser smoke; full tests including disposable PostgreSQL separate-login acceptance; migration evidence upload; production container build. This is a CI engineering pass only, not a production deployment or statutory certification.
119. Independent review of proposed event-trigger migration `20261112_inbox_event_trigger_security_definer.sql`: dedicated NOLOGIN/NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOINHERIT/NOBYPASSRLS owner; narrow INSERT + sequence USAGE; fixed search_path; fully qualified event relation; worker direct event INSERT denied by disposable test. Read-only staging catalog confirms event table currently has RLS disabled and is owned by `rupaykg`. Important production blocker: authoritative production main did not contain `async_mirror_inbox_events` or its parent inbox schema at audit time, so this migration cannot be applied to production independently or ahead of a production-compatible prerequisite migration chain. Existing staging state is not production baseline. The migration still requires independent PostgreSQL/security review of role-membership/ownership-transfer semantics and a production-derived rehearsal. No live writes or changes.
120. CI evidence and staging catalog are not evidence of Render runtime identity. Worker remains OFF; no production/staging migration, role, grant, secret, queue, or deployment changes.

121. Created isolated Neon rehearsal branch `shakti-prod-main-rehearsal-20261031` (`br-spring-lab-b4hqez2o`) directly from authoritative production `main` (`br-restless-base-b44cip2h`) at parent LSN `0/2A37470`. Branch is non-default and was created with `no_compute=true`; no database compute endpoint or SQL execution was started. This preserves an exact production-derived snapshot for the next ordered-chain rehearsal without incurring compute or mutating production. Branch has not been used for writes.
122. Latest documentation commit triggered CI run `41199703337`; monitor it to completion before treating the PR head as fully green.

123. CI run `41199703337` completed SUCCESS across all stages, including the disposable PostgreSQL least-privilege acceptance, evidence upload and production container build.
124. Inspected artifact `production-shaped-migration-report` from run `41199424164` (PostgreSQL 16.15, disposable CI only; SHA-256 baseline manifest `139bc60d5f99f38f68f2d454905ab5f91bc8217bc3fd67759826ce6486b7fa8d`). It reconstructed the exact 92-entry production ledger (001–087, 20261018–20261021, and production-only 096) and appended proposed migrations 20261022–20261112 in order. Assertions passed: exact 92-row baseline; migration 023 preserved; production-only 096 preserved; proposed chain follows 096; verifier provenance columns and function guard markers preserved; source-scope triggers revalidate transitions. Schema diff: 67 to 78 public tables; 11 added tables; 19 added triggers; 18 added functions; 130 added constraints. Verifier function hash unchanged. Limitations explicitly state semantic review still required and CI is not a production data clone/live Neon rehearsal.
125. The report confirms the proposed migration chain's synthetic PostgreSQL replay can reconstruct production schema baseline and apply ordered additions in disposable CI. It does not resolve actual production data migration/backfill safety or prove current live Neon schema matches CI snapshot beyond previously inspected catalog/ledger. The Neon production-derived branch `br-spring-lab-b4hqez2o` has no compute endpoint; no live rehearsal SQL executed. Avoid creating compute until cost/approval is clear. Production and staging unchanged; no worker activation.

126. Security-scope clarification: live staging catalog reports `async_mirror_inbox_events` RLS disabled and FORCE RLS disabled. Current disposable acceptance proves object/column privileges, not row-level tenant isolation. The proposed government inbox worker's SELECT scope is therefore global across the national inbox table. This must be explicitly approved as an intended cross-authority processing boundary or redesigned with row-scoped access before activation; do not describe it as RLS-isolated. Any RLS enablement/policies are a separate reviewed migration and are not silently bundled into the event-trigger migration.
127. Documentation update on PR #157 records this limitation. CI run `41200006681` for the prior engineering-log update was in progress at last inspection; recheck current head CI before considering the latest PR documentation fully green.


### 128. Exact-head inbox-worker CI and independent review — 2026-10-31

- Rechecked PR #157 exact head `5142781530620b2fca330e7e8f0fe4f53447ea5b`; workflow run [#41200068648](https://github.com/vishaltradewinds/rupaykg/actions/runs/41200068648) completed successfully. All 21 reported job steps passed, including dependency audit, migration validation, exact production baseline reconstruction, pre-upgrade capture, ordered upgrade, idempotency, typecheck, build, browser smoke, disposable PostgreSQL acceptance, artifact upload and production container build. Earlier run #41200006681 also passed.
- PR #157 remains OPEN, DRAFT, UNMERGED; PR #159 remains OPEN, DRAFT, UNMERGED.
- Independent review found the CI migration principal is PostgreSQL `postgres` superuser (`.github/workflows/ci.yml` service and `DATABASE_URL`), so the CI pass does not establish that the actual production migration principal can create/grant/revoke the dedicated capability role or transfer function ownership. Verify these exact authorities and semantics on the production-derived rehearsal before any live application.
- Worker implementation still performs exhausted-row sweep, claim, crosswalk lookup and terminal transitions as separate pool queries. Fencing protects terminal writes, but transactional sweep/claim, lease-expiry behavior during long validation, crosswalk snapshot consistency and competing-claimer behavior remain open acceptance work.
- National inbox SELECT scope remains global while inbox/event RLS is disabled. Governance must explicitly approve the global cross-authority processing scope or require a row-scoped design. Do not claim tenant isolation.
- Added the findings and exact-head CI evidence to PR #157 conversation. No live database writes, role/grant changes, secrets, queue changes, compute activation, merge, deployment, worker activation or external statutory/Guardian/Hedera submission occurred. Production remains HOLD; TRL 9 remains unclaimed.


### 129. Atomic inbox claim and PostgreSQL concurrency hardening — 2026-10-31

- Created stacked draft PR #161, based on PR #157 branch `shakti/integrate-government-inbox-worker-2026-10-31`, to keep the diff limited to four files rather than duplicate the full parent PR.
- Worker exhausted-attempt quarantine and bounded batch claim now execute in one PostgreSQL data-modifying CTE statement. The candidate claim retains `FOR UPDATE SKIP LOCKED`; the validation loop starts after the claim statement completes; terminal writes retain lease-token and unexpired-lease fencing.
- Added disposable PostgreSQL integration coverage for two concurrent workers claiming four synthetic rows without overlap, and for a stale worker being unable to complete after its fencing token is replaced.
- Updated the worker least-privilege gate document with design boundaries and remaining risks.
- PR #161 exact head: `fd2c89bc7224b65532f24d4cca9cb399def20dfe`. CI run [#41200756007](https://github.com/vishaltradewinds/rupaykg/actions/runs/41200756007) was in progress at checkpoint; migration validation and production-baseline reconstruction passed, upgrade-chain application was running. Do not claim the new tests or build pass until the full run completes.
- Remaining: lease renewal/strict validation timeout, crosswalk immutable snapshot consistency, explicit global queue-scope governance or row-scoped RLS, real production migration-principal authority verification, full production-derived rehearsal. No live DB writes, staging queue changes, role/grant changes, worker activation, secret, deployment, merge or external submission. TRL 9 remains unclaimed.


### 130. Atomic inbox claim — corrected concurrency harness and full CI pass — 2026-10-31

- Initial run #41200756007 failed only in the new concurrency-test barrier: the test waited for four validators to start, but each worker processes rows sequentially. Corrected the barrier to release after both worker invocations enter validation. No production worker logic rollback was required.
- Corrected exact-head run [#41201066607](https://github.com/vishaltradewinds/rupaykg/actions/runs/41201066607) passed in full at commit `2487e8bb041dc41798b8349f8e11e9d36132b51d`: dependency audit, migration validation, production baseline reconstruction, upgrade application/idempotency, typecheck, build, browser smoke, full unit and disposable PostgreSQL integration tests, artifact upload, and production container build.
- New PostgreSQL tests passed: two concurrent workers claimed four synthetic rows without overlap; a stale worker could not complete after its fencing token was replaced.
- PR #161 retargeted back to stack on PR #157, keeping the incremental diff to four files. PR #161 remains draft/open/unmerged. Parent PR #157 remains draft/open/unmerged.
- This is a code/CI engineering pass only. Lease renewal or strict validator timeout, immutable crosswalk snapshot consistency, global queue-scope approval or row-scoped RLS, production migration-principal authority semantics, and full production-derived rehearsal remain release gates. No live DB writes, staging queue changes, roles/grants/secrets, worker activation, deployment, merge or external statutory/Guardian/Hedera submission. TRL 9 remains unclaimed.
