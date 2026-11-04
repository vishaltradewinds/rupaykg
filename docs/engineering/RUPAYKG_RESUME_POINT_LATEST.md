

## 2026-11-04 authoritative refresh — CTO Run 13

This section supersedes any conflicting PR #243/issue #245 status above.

### PR #243 exact-head evidence
- PR #243 remains OPEN, DRAFT and UNMERGED; branch `feat/mrv-source-snapshot-v2`.
- Exact head: `b700db8ffde6cd6492b545ed4c6e5bf2271b53b8`.
- Exact-head GitHub Actions run #5320 (`41693406353`) completed SUCCESS on 2026-11-04.
- The single `validate` job passed all configured stages: production dependency audit; migration validation; migrations applied to disposable PostgreSQL; TypeScript typecheck; production build; browser smoke test; full tests including disposable PostgreSQL acceptance; production-container build.
- The strict test assertion requiring the custom `MRV source snapshots cannot be truncated` trigger error is present in this exact tested head. The assertion was not relaxed to accept a foreign-key-only error.
- CI evidence closes the exact-head automated-validation item for this revision; it does not close independent DBA/security review, owner/runtime role boundary proof, migration drift, production tenant isolation, field acceptance or TRL 9.
- Issue #245 received the exact-head CI evidence comment. PR #243 received the exact-head validation comment.

### Current PR #243 implementation checkpoint
- PostgreSQL owns canonical snapshot digest calculation over UTF-8 bytes of `jsonb::text`; application obtains digest from PostgreSQL and the insert trigger independently recomputes it.
- Methodology code is bound to payload; a fixed golden digest vector is tested.
- Snapshot rows reject UPDATE, DELETE and TRUNCATE; strict TRUNCATE-trigger behavior is tested with CASCADE in disposable PostgreSQL.
- Activity source revisions are advanced by triggers for activity, verification, evidence, observations, measurements, artifact versions and independent reviews; credential issuance requires a current latest snapshot revision.
- Artifact version/review revision-trigger migration is present, but targeted regression tests for those two mutation paths have not yet been added. Inspect actual artifact schema and fixture constraints before writing those tests; do not guess column names or fixture shape.
- A preliminary code inspection found the artifact version/review trigger function resolves evidence IDs to activity IDs and increments old/new activities. Independently review its behavior for UPDATEs that move an artifact between evidence records and for missing/deleted evidence.

### Production safety / known blocker (unchanged)
- Authoritative Neon production main remains READ-ONLY / HOLD. Prior read-only evidence: 67 public base tables, 0 RLS, 0 FORCE RLS, 92 migration-ledger rows, latest `20261021`; `mrv_source_snapshots` absent; migration 088 not applied; login role `rupaykg` is BYPASSRLS-capable; Neon branch reported `protected=false`.
- No production migration, SQL write, role/grant/RLS change, branch operation, deployment, worker activation, merge or certification was performed in Run 13.
- PR #243 must remain draft until independent DBA/security review and all production/tenant-isolation dependencies are reconciled.

### Next actions
1. Inspect source migrations that create `evidence_artifact_series`, `evidence_artifact_versions` and `evidence_artifact_reviews`; verify actual FK and key columns.
2. Add targeted integration assertions proving artifact-version insert/update/delete and independent-review insert/update/delete each increment the correct activity revision, including evidence reassignment if schema permits. Use disposable PostgreSQL and preserve strict assertions.
3. Map actual application pool role, migration role, table owner, role memberships and deployment secret wiring from source/configuration without exposing secrets; test role boundaries in disposable PostgreSQL only.
4. Continue complete 67-table tenant ownership, endpoint and worker inventory before any RLS policy rollout.
5. Reconcile PR #215/#196 authorization and tenant isolation, PR #214 migration drift, PR #238 verification provenance and PR #242 EPR authorization. No overlapping incompatible routes or triggers.
6. Keep production READ-ONLY / HOLD; do not merge or deploy based on CI success alone.

### TRL / release posture
- Exact-head engineering CI for PR #243: PASS.
- Independent security/DBA review: NOT COMPLETE.
- Production migration and tenant isolation: NOT COMPLETE.
- Guardian/Hedera/Mirror Node live operational round-trip: NOT evidenced by this CI run.
- SITE-JBP-01 Kathonda field validation: PRE-VALIDATION; field evidence not established here.
- Production certification and TRL 9: NOT ACHIEVED.


## 2026-11-04 refresh — CTO Run 14 (06:06 UTC onward)

### MRV artifact invalidation tests
- Exact test commit `4a8a4572a084811725eed8dd31c2c4a3f4d39eac` passed exact-head CI run #5323 (`41783246996`) with SUCCESS.
- All configured stages passed: dependency audit, migration validation, disposable PostgreSQL migration, typecheck, production build, browser smoke, full tests including PostgreSQL acceptance, and production-container build.
- Added integration regressions for artifact-series mutation, artifact-version insertion, independent artifact-review insertion, and immutable/append-only UPDATE/DELETE rejection.
- Migration README documents 088, 089 and 20261022 in later commit `9bd10a7ae63ac07fe642b4044ad30383f25d71f2`. Exact-head CI #5324 (`41783404982`) is running; typecheck had started after dependency, migration validation and disposable PostgreSQL migration stages passed. Do not claim latest-docs-head CI pass until run completes.
- PR #243 and issue #245 received the exact CI evidence.

### Runtime/migrator privilege boundary finding
Read-only source inspection of main shows one database credential contract, not demonstrated least-privilege separation:
- `.env.example` documents only `DATABASE_URL`.
- `apps/src/server.ts` builds the runtime pool from `DATABASE_URL`.
- `apps/src/migrate.ts` builds the migration pool from the same `DATABASE_URL`.
- `render.yaml` declares one `DATABASE_URL` secret, no dedicated migrator secret.
This proves source/config does not demonstrate credential separation; it does not by itself prove the actual deployed role. Issue #196 has been updated with evidence and a safe remediation sequence. Production role membership/secret review remains required.

### Production safety and release posture
- Production remains READ-ONLY / HOLD. No production SQL writes, migrations, grants, RLS changes, deployment, merge, worker activation or certification.
- PR #243 remains draft/unmerged. CI success on the artifact-test commit is engineering evidence only.
- Independent DBA/security review, runtime-vs-migrator role proof, tenant isolation inventory, migration drift reconciliation, live external anchoring and Kathonda field evidence remain incomplete.

## 2026-11-04 authoritative refresh — CTO Run 15 (06:10 UTC onward)

### PR #244 handoff validation
- PR #244 exact documentation head 61094b13a1f9c76e78965765082b5791beaf4422 passed CI run #5327 (41784108394) end-to-end: dependency audit, migration validation, disposable PostgreSQL migration, typecheck, production build, browser smoke, full tests and production-container build.
- This confirms the handoff branch pipeline only; it does not prove production readiness or certification.
- Added a detailed production tenant-isolation inventory and API authorization/execution-surface review. Run-15 checkpoint: docs/engineering/checkpoints/2026-11-04-cto-run-15-tenant-isolation-and-geography-context.md.

### Tenant catalog and API review
- Production catalog remains 67 public tables, 181 FKs, 0 RLS, 0 FORCE RLS; all 67 tables owned by rupaykg, which remains BYPASSRLS-capable and privileged.
- 23 tables have direct organization/tenant keys; other tables need relationship-derived, identity-scoped, multi-party or explicit shared-reference policies.
- Static source map covers 90 API route declarations across 15 source files. It is a route-family inventory, not complete dynamic handler sign-off.
- No independent server-side worker/cron/queue consumer found in the repository tree. Operation sync is synchronous route intake/apply; offline queue is browser-side. External Render cron/worker services remain unverified. Guardian/Hedera live acceptance is a manual workflow_dispatch.
- Runtime and migration pool use the same DATABASE_URL; Docker web-service boot runs migrations before the API. Dedicated one-shot migration job and separate credential remain required.

### New geography authorization fix — PR #246
- Found geography roots/children reading any verified membership's scope rather than the selected active organization.
- Created draft PR #246, branch security/geography-active-organization-scope-2026-11-04, exact head 2fc6e37fc8000e766ac24cff8d234ce1c84aa327.
- New helper canReadGeography requires explicit active organization, exact verified membership and organization-bound geography scope. Roots/children endpoints now use active organization only.
- Added five unit tests: cross-org access denied without DB call; SQL binds selected org; no active org fails closed; malformed UUID fails closed; missing verified scope fails closed.
- CI #5329 (41784724429) reached migration validation and disposable DB migration success; TypeScript typecheck is currently running. Build, browser, full tests and container build remain pending at this refresh. Do not call PR #246 validated until exact-head CI completes.
- PR #246 remains draft/unmerged.

### Verification authorization
- Issue #215 updated: shared canVerifyEvidence does not itself take the subject organization; current call sites supply outer active-org/activity checks. Bind exact subject organization in helper or require a bound authorization context.
- PR #238 remains draft because legacy verification_independence_guard integration/removal and unified trigger design remain open. No production trigger change.

### Safety and release
- Production remains READ-ONLY / HOLD. No production SQL writes, DDL, role/grant/ownership changes, RLS activation, migration, branch protection change, deployment, merge, worker activation or certification.
- PR #243, #244, #238 and #246 remain draft/unmerged.
- Production migration drift, tenant RLS, runtime least privilege, independent DBA/security review, live Guardian/Hedera round-trip and SITE-JBP-01 field acceptance remain open.
- TRL 9 and production certification NOT ACHIEVED.

### Next actions
1. Complete exact-head CI #5329 on PR #246; fix any failure and rerun.
2. Continue dynamic route authorization tests for EPR/ESG DB permission functions, workspaces, evidence/artifacts and bilateral resources.
3. Complete all 67 table policies and actual-runtime-role cross-tenant tests on disposable Neon.
4. Reconcile production migration source/ledger drift without rewriting ledger history or blind replay.
5. Design and rehearse the dedicated migration job and least-privilege runtime identity. No production changes.


## 2026-11-04 authoritative refresh — CTO Run 16 (06:25 UTC onward)

### Exact-head CI closure
- PR #244 current head is `94d7eff6f1486e24dffc323b7eec7daca5fd8170`.
- Exact-head GitHub Actions CI run #5332 (`41784895122`) completed SUCCESS. Its single validation job passed dependency audit, migration validation, disposable PostgreSQL migration, TypeScript typecheck, production build, browser smoke, full tests including PostgreSQL acceptance, production-container build and cleanup.
- PR #244 remains OPEN / DRAFT / UNMERGED. This is engineering handoff validation, not a production release gate or TRL claim.

### Geography fix exact-head CI closure
- PR #246 remains at `2fc6e37fc8000e766ac24cff8d234ce1c84aa327`; exact-head CI #5329 (`41784724429`) completed SUCCESS, including all configured validation stages.
- The five active-organization geography authorization regression tests and build/test gates passed. PR #246 remains OPEN / DRAFT / UNMERGED pending independent review and broader tenant-isolation gates.

### Additional authorization source review
- Re-read current-main `apps/src/auth.ts`, `apps/src/epr-return-routes.ts`, `apps/src/bwg-routes.ts` and `apps/src/server.ts`.
- EPR read/write route-local membership checks are followed by `hasOrganizationPermission`, whose `canActForOrganization` check binds non-bilateral operations to the selected active organization. This is a useful second authorization layer; do not classify the route-local membership helper alone as an exploitable cross-org bypass.
- The known `canVerifyEvidence` helper concern remains: it takes identity and evidence IDs but not an explicit subject organization, and its query can consider any verified membership with geography scope. Current call sites must be exhaustively mapped and independently tested before a safe helper signature change is made. Do not change PR #238's legacy trigger until a single forward-only trigger design and regression coverage resolve the integration gap.
- An initial attempt to locate migration SQL by guessed root paths returned 404; no migration/function definition conclusion is drawn from that failed lookup. Next locate the authoritative migration directory via repository tree metadata, then inspect the exact SQL definitions and grants for `can_assess_epr` and `can_write_esg`.

### Safety / release status
- Production remains READ-ONLY / HOLD. No production SQL writes, migrations, role/grant/ownership changes, RLS activation, branch operation, deployment, merge, worker activation or certification occurred.
- Production catalog blocker remains 0/67 RLS and 0/67 FORCE RLS with privileged BYPASSRLS-capable table owner; no policy rollout is authorized by CI.
- Independent DBA/security review, runtime-role separation, 67-table tenant policy matrix, migration drift reconciliation, live Guardian/Hedera round-trip, and SITE-JBP-01 Kathonda field acceptance remain incomplete.
- Production certification and TRL 9 NOT ACHIEVED.

### Next execution batch
1. Resolve repository tree/migration directory and inspect exact SQL definitions, ownership, grants and search_path for EPR/ESG permission functions.
2. Map every `canVerifyEvidence` call site and write a subject-org-bound authorization contract with cross-org and pooling regressions on disposable PostgreSQL.
3. Continue dynamic workspace, evidence-vault, bilateral settlement and field-device authorization tests under the actual non-owner runtime role in an isolated disposable environment.
4. Build and review the 67-table policy matrix and migration-drift reconciliation plan.
5. Keep all PRs draft/unmerged and production READ-ONLY / HOLD pending independent review and controlled approvals.


## 2026-11-04 authoritative refresh — CTO Run 17 (06:28 UTC onward)

### Production migration ledger reconciliation — exact read-only evidence
- Queried the complete production `public.schema_migrations` ledger on Neon project `steep-mud-79906940`, branch `br-restless-base-b44cip2h`, database `rupaykg`; exactly 92 rows returned.
- Ledger records numbered migrations `001`–`087`, then `096_verification_authorization_provenance.sql`, plus dated migrations `20261018`–`20261021`. Versions `088`–`095` are absent from production ledger.
- Fresh current-main Git tree contains 91 migration SQL files: 87 numbered files `001`–`087` plus four dated files `20261018`–`20261021`. It does not contain active migration source `096`.
- Current-main `migrations/023_lifecycle_state_guards.sql` exists and production ledger records it, contradicting README's claim that 023 is absent.
- README inventory stops at 028 and omits 029–087 and dated migrations. It mislabels 015 as high-risk action permissions; actual 015 is Guardian/Hedera MRV and actual high-risk permission migration is 041.
- `scripts/validate-migrations.mjs` and `apps/src/migrate.ts` discover numeric SQL files from the directory, including 023 and 029–087; README is not the migration runner's inventory.
- The issue #214 thread now contains this source/tree/ledger discrepancy and the prior 096 history. Do not replay 096, rewrite ledger rows, rename or renumber migrations, or assume missing 088–095 should be restored. Recover source and deployment chronology before any reconciliation proposal.

### Production SQL authorization function inspection
- Read-only `pg_proc` inspection returned `can_assess_epr(uuid,uuid)`, `can_write_esg(uuid,uuid)`, `has_verification_permission(uuid)`, and `identity_has_permission(uuid,text,text[])` as owned by `rupaykg`, SECURITY INVOKER, STABLE, with no function-level `search_path` setting.
- Production `can_assess_epr` includes `epr:manage` and `epr.manage` aliases; production `can_write_esg` includes `csr:manage` and `csr.manage` aliases. These aliases are absent from current-main migration 018, indicating live definition/source drift.
- A database function-source search for calls to these functions returned no matches among other public PL/pgSQL/SQL function bodies. Application call sites have not yet been exhaustively proven absent; do not label them unused until source-tree search is complete.
- Current-main migration 018 includes role-name fallback for EPR/ESG management. Reconcile this with explicit permission-only policy and test all actual call paths under intended non-owner runtime identity before proposing forward-only changes.

### Validation and PR status
- PR #244 documentation head `9081e98fec3e263fc95c8a377ebd2156d6ea4cb3` passed exact-head CI run #5335 (`41785611740`) end-to-end: dependency audit, migration validation, disposable PostgreSQL migration, typecheck, production build, browser smoke, full tests/PostgreSQL acceptance, production-container build and cleanup.
- PR #244 remains OPEN / DRAFT / UNMERGED. PR #246 remains OPEN / DRAFT / UNMERGED with exact-head CI #5329 SUCCESS.

### Safety / next actions
- Production remains READ-ONLY / HOLD. No production SQL writes, DDL, migrations, function changes, role/grant/ownership changes, RLS activation, branch operations, deployments, merges, worker activation or certification.
- Continue with exact migration checksum/source chronology (including 096 and staging-only 20261022–20261025 artifacts), full application call-site map for DB authorization functions, 67-table policy matrix, actual non-owner runtime role proof, and disposable cross-tenant regression harness.
- Independent DBA/security review, production tenant isolation, Guardian/Hedera live round-trip, SITE-JBP-01 Kathonda field acceptance and TRL 9 remain NOT ACHIEVED.


## 2026-11-04 authoritative refresh — CTO Run 18 (06:40 UTC onward)

### PR #244 exact-head CI closure
- Documentation head `92b5215a56cba12a5880175e9b63e44c2aedb4b3` completed exact-head CI run #5337 (`41785952488`) SUCCESS. All configured stages passed: dependency audit, migration validation, disposable PostgreSQL migration, typecheck, production build, browser smoke, full tests/PostgreSQL acceptance, production-container build and cleanup.
- PR #244 remains OPEN / DRAFT / UNMERGED. Subsequent Run 18 evidence/documentation commits below require their own exact-head CI; do not reuse the #5337 result for later heads.

### Migration 096 exact-source recovery and verification guard review
- Recovered exact 97-line SQL from original commit `ca8f4100782e13f8d72106187fafc8e1e446214f`, Git blob `258b1f4534efbf915688f78aa84d4ec24a47cbc0`; removed by `54a7fe1ceb41b37a68720a71c10a1dd03af30dea` with explicit message that it was an unreviewed migration.
- Preserved the exact source as review-only evidence in `docs/security/RECOVERED_MIGRATION_096_REVIEW_2026-11-04.md`. Not restored to active migrations and not replayed.
- Read-only production trigger inspection confirmed `verifications_integrity_guard` (BEFORE INSERT OR UPDATE) calls `prevent_invalid_verification()` and matches recovered 096; separate `verification_independence_guard` (BEFORE INSERT) still allows role-name fallback `VERIFIER` / `AUDITOR`.
- The recovered/live 096 function recomputes and overwrites authorization snapshot columns on every APPROVED-row update. Snapshot immutability is therefore not enforced despite the column comments. Decision downgrade/re-approval semantics also remain undefined. Same-event trigger ordering must be considered; PostgreSQL orders same-kind triggers alphabetically by trigger name.
- Current-main `apps/src/value-routes.ts` calls `can_assess_epr` for EPR obligation assessment and `can_write_esg` for ESG metric writes and BWG workspace capability projection. Both functions have role-name fallback and live permission aliases that differ from migration 018. Route-level organization checks exist, but SQL permission vocabulary must be reconciled and tested, not silently rewritten.
- Targeted source search found no calls in inspected auth/server/EPR/BWG/statutory/MRV/evidence/workspace/registry/value route files beyond the confirmed `value-routes.ts` paths. A complete repository-wide application caller map remains open.

### Migration documentation repair on handoff branch
- Added `docs/engineering/MIGRATION_SOURCE_INVENTORY_2026-11-04.md` with the exact 91-file manifest and production ledger comparison.
- Added `docs/security/RECOVERED_MIGRATION_096_REVIEW_2026-11-04.md` with exact historical SQL, security findings and forward-only remediation design.
- Corrected `migrations/README.md`: current source inventory is 001–087 plus dated 20261018–20261021; 023 exists; 015 is Guardian/Hedera; 041 is high-risk permissions; production-only ledger 096 is documented as source drift, not as an active migration.
- Issue #214 updated with recovered source, exact trigger/function evidence, value-routes call sites and no-write release boundary.

### Next batch and release boundary
1. Add disposable PostgreSQL regression tests for a unified verification guard, strict same-organization explicit permission, no role-name fallback, self-approval, snapshot write-once, decision transitions, trigger-order independence and concurrency/revocation.
2. Build exact caller map and permission alias matrix for `can_assess_epr` / `can_write_esg`, including BWG workspace projection and any other DB callers.
3. Recover staging-only 20261022–20261025 source and deployment/build provenance for 096; compare exact checksums and deployed artifact chronology.
4. Run all security tests under a genuine non-owner runtime role on disposable PostgreSQL; production runtime separation and RLS remain unproven.
5. Keep PRs draft/unmerged and production READ-ONLY / HOLD. No production SQL/DDL, migration, trigger/function edit, role/grant/ownership/RLS change, branch operation, deployment, worker activation or certification occurred.
6. Independent DBA/security review, production tenant isolation, live Guardian/Hedera acceptance, SITE-JBP-01 field acceptance and TRL 9 remain NOT ACHIEVED.


## 2026-11-04 authoritative refresh — CTO Run 19 (staging migration recovery)

### Staging-only 20261022–20261025 catalog inspection
- Read-only Neon inspection of staging branch `br-spring-hill-b4544vz5` (`rupaykg-gov-inbox-staging-20261020`) confirms ledger rows for `20261022_async_mirror_inbox.sql`, `20261023_async_mirror_worker_leases.sql`, `20261024_ai_intake_rate_limits.sql`, and `20261025_ai_evidence_intake_jobs.sql`, all applied at `2026-10-20T10:48:38.647Z`.
- Exact original migration SQL remains unrecovered; live catalog has been documented as a reconstruction only in `docs/engineering/STAGING_ASYNC_MIRROR_AI_INTAKE_EVIDENCE_2026-11-04.md`. Do not claim this catalog snapshot is original source.
- Four tables are owned by `rupaykg`, with RLS/FORCE RLS disabled. `async_mirror_inbox` has no organization_id; `ai_evidence_intake_jobs` and `ai_intake_rate_limits` are organization/identity scoped.
- Staging data: 12 test-labelled inbox rows, 29 append-only events; 8 PROCESSING rows with expired leases, one RETRY past due, one QUARANTINED after 5 attempts, one RECEIVED and one VALIDATED. AI intake jobs and rate-limit tables are empty.
- Inbox has a status/attempt event trigger and append-only event-log guard. No user trigger on AI intake jobs. No matching current-main application/worker source files or independent deployed worker/scheduler/queue consumer was found/proven.
- Interpretation: abandoned staging test activity, not a live authority feed or healthy operational worker. Do not replay or reconstruct migrations for production from catalog state.
- Issue #214 updated with these findings and the recovery/assurance requirements.

### Updated handoff branch changes
- Recovered 096 review-only source, current migration source inventory, corrected migration README and staging schema evidence have been added to PR #244 branch.
- PR #244 latest branch head must be rechecked and CI must pass on that exact final head; prior CI #5337 passed only for earlier head `92b5215a56cba12a5880175e9b63e44c2aedb4b3`.

### Next actions
1. Verify exact-head CI for the new docs branch head and repair any issues.
2. Recover original staging migration SQL and worker source/deployment artifact from the actual deployment/build history; do not treat schema reconstruction as migration source.
3. Design worker lease fencing, claim exclusivity, retry/backoff, quarantine, idempotency and stale-lease recovery tests; prove worker runtime and tenant mapping before any operational claim.
4. Continue verification trigger unified design and EPR/ESG permission alias/caller tests on disposable PostgreSQL.
5. Production remains READ-ONLY / HOLD. No staging data, production schema, data, roles, grants, functions or triggers changed. TRL 9 NOT ACHIEVED.


## 2026-11-04 authoritative refresh — CTO Run 20 (verification guard clarification)

### Exact-head CI closure
- PR #244 head `0a8b55f62065080163bec5db858e6f75c2b03ad6` passed exact-head CI #5346 (`41787820120`) end-to-end, including dependency audit, migration validation, disposable PostgreSQL migration, typecheck, production build, browser smoke, full tests/PostgreSQL acceptance, production-container build and cleanup.
- Later clarification/documentation commit `5c4df001a91f4c1e7337d266a7b7abde759501aa` is newer and needs exact-head CI; #5346 must not be attributed to it.

### Verification-trigger interaction clarification
- `verification_independence_guard` is a BEFORE INSERT trigger; `verifications_integrity_guard` is BEFORE INSERT OR UPDATE. PostgreSQL fires same-event triggers alphabetically, so the legacy independence guard runs first and the strict 096 guard runs afterward.
- The legacy trigger's `VERIFIER` / `AUDITOR` role-name fallback is contradictory/redundant, but with the strict 096 guard still enabled it does **not** prove a successful role-name-only authorization bypass: the strict trigger subsequently rejects the verifier without explicit same-organization permission.
- Confirmed security defect remains snapshot mutability: every UPDATE of an APPROVED verification re-evaluates authorization and overwrites the four decision-time snapshot columns. This contradicts the intended immutable provenance. Decision downgrade/re-approval semantics are also undefined.
- Updated issue #214 and the recovered 096 review document to distinguish a confirmed defect from an unproven bypass. Consolidation must preserve self-approval protection, remove role-name fallback, and implement write-once snapshot/explicit transition semantics in one reviewed forward-only change.

### Current staging migration evidence
- The staging-only 20261022–20261025 schema reconstruction is preserved in `docs/engineering/STAGING_ASYNC_MIRROR_AI_INTAKE_EVIDENCE_2026-11-04.md`. It is catalog evidence, not original migration source. Eight TEST-AUTH/TEST-MUNI PROCESSING inbox rows have expired leases; one RETRY is overdue; no current-main worker source or independently deployed worker was proven. No staging writes were made.

### Next steps
1. Validate the latest PR #244 head after the clarification commit.
2. Recover original staging migration SQL and worker source/deployment artifact; keep staging test objects out of production.
3. Implement a single verification guard plus snapshot immutability and decision-state tests only on a disposable non-production environment after review.
4. Map all EPR/ESG function callers and permission aliases; test role-name-only and explicit-permission cases under non-owner runtime.
5. Production remains READ-ONLY / HOLD; no production/staging writes, DDL, migration, function/trigger, role/grant/RLS change, worker activation, deployment, merge or certification. TRL 9 NOT ACHIEVED.


## 2026-11-04 authoritative refresh — CTO Run 21 (cross-organization verification authorization)

### New P0 finding confirmed by route-to-database trace
- Evidence-vault review route `POST /api/v1/evidence-vault/:evidenceId/review` first checks `evidence:review` in the subject organization, then calls `canVerifyEvidence(client, identityId, evidenceId)`.
- Previous `canVerifyEvidence` SQL accepted `VERIFY_EVIDENCE` from any verified organization membership and checked geography scope against that membership's organization; it did not bind membership organization to `activities.organization_id`.
- Production 096 `prevent_invalid_verification()` applies same-organization permission only for APPROVED decisions. The legacy global-membership trigger can authorize a REJECTED insert based on a different organization membership.
- Thus an identity with `evidence:review` in Organization A and `VERIFY_EVIDENCE` in Organization B, both covering the activity geography, can satisfy the old API checks and create a REJECTED verification for A's evidence. This is a cross-org decision/write authorization defect, not an APPROVED-verification bypass.
- Issue #215 updated with exact route/function chain and remediation evidence.

### Focused candidate remediation — PR #247
- Branch: `security/verification-authorization-tenant-binding-2026-11-04`.
- PR #247 OPEN / DRAFT / UNMERGED; exact initial head `6a5fd9c5288e56d7243ab70f39f5a928f6235208`; CI run #5350 (`41788676133`) was in progress at checkpoint time.
- Application helper `canVerifyEvidence` now requires exact organization ID, joins membership to subject activity organization, and verifies identity active/non-suspended; evidence-vault route passes `row.organization_id`.
- Added unit query assertions and integration fixture for cross-org REJECTED API/direct-DB denial, valid same-org REJECTED, snapshot capture and update rejection.
- Added forward-only migration `20261104_verification_authorization_tenant_binding.sql` to replace legacy and recovered-096 triggers with one strict BEFORE INSERT/UPDATE guard; explicit same-org permission applies to every decision, self-verification/mismatch rejected, subject/identity/membership/role rows locked during decision, snapshot captured at insert, and verification UPDATE rejected.
- This migration is a candidate only and has not been applied to any database. Exact-head CI and disposable PostgreSQL tests must pass; independent DBA/security review remains required.

### CI and documentation status
- PR #244 latest docs head `12d9664e3e4b62138a0f69d0588715b743d63ee8` passed exact-head CI #5349 (`41788047688`) end-to-end. PR #244 remains draft/unmerged.
- PR #247 initial exact-head CI #5350 was in progress; no pass claim for PR #247 until exact head completes.

### Safety and next steps
1. Verify PR #247 migration syntax and integration test behaviour in exact-head CI; correct failures without weakening negative assertions.
2. Review any other insert/update paths for verifications; ensure every decision type is bound to the exact subject organization and explicit permission.
3. Validate transaction lock ordering and two-session race behaviour for identity suspension, membership revocation and role permission mutation.
4. Rehearse migration on disposable PostgreSQL and compare fresh-schema and production-like schema (where 096 columns already exist); never run against production.
5. Production remains READ-ONLY / HOLD. No production or staging writes, DDL, migration, function/trigger, role/grant/RLS change, worker activation, deployment, merge or certification. TRL 9 NOT ACHIEVED.


## 2026-11-04 authoritative refresh — CTO Run 22 (verification tenant-binding CI accepted)

### PR #247 exact-head CI success
- Focused security PR #247 branch `security/verification-authorization-tenant-binding-2026-11-04` exact head `50b0391dab1f2564f1d8e7a48ec592466eaa79e3` passed CI #5354 (`41789024956`) end-to-end: dependency audit, migration validation, disposable PostgreSQL migration, typecheck, production build, browser smoke, full tests/PostgreSQL acceptance, production-container build and cleanup.
- First CI #5350 failed typecheck because the second caller in `workspace-routes.ts` still used the old helper signature. Fixed by binding the workspace verification route to the evidence activity's exact organization.
- CI #5353 passed migration/typecheck/build/browser smoke and failed one lifecycle test only because the new self-approval error wording did not match the existing `/self-approve/` assertion. Updated the error text to preserve the established contract; exact-head #5354 then passed.
- Evidence-vault integration regressions passed: cross-org REJECTED direct DB insert denied; cross-org REJECTED API call denied; same-org APPROVED and REJECTED decisions accepted; decision snapshot persisted; UPDATE mutation rejected.
- PR #247 remains OPEN / DRAFT / UNMERGED. Migration `20261104_verification_authorization_tenant_binding.sql` is candidate-only and has not been applied to any database.

### Security meaning and remaining limits
- The confirmed cross-org REJECTED path is addressed in the candidate app helper and database trigger. APPROVED decisions were already rejected by the strict recovered-096 guard when same-org permission was absent; this PR unifies the boundary for both decisions.
- Candidate trigger locks evidence/activity, identity, exact membership and role rows during authorization; two-session concurrency/revocation race tests are still required. Geography fail-open when no scope exists remains a separate issue #215 candidate migration concern. Table-owner deletion/tamper resistance still depends on runtime privilege separation and audit controls.
- No independent DBA/security approval, production runtime-role proof, global RLS policy rollout or production migration is authorized by the CI result.

### PR #244 documentation handoff
- PR #244 head `76dfd7bbdc272bfbe98963005dd2727e177a46c5` passed exact-head CI #5351 (`41788775436`) end-to-end. PR #244 remains draft/unmerged.

### Next execution batch
1. Add two-session PostgreSQL concurrency tests for identity suspension, membership revocation and role permission mutation racing with verification insertion; test lock ordering and deadlock handling.
2. Test candidate migration against both fresh schema and a production-like schema with the four 096 columns/triggers already present; verify no duplicate or stale triggers remain.
3. Review DELETE privileges and immutable provenance under actual non-owner runtime role; update RLS/policy matrix and exact route/data map.
4. Resolve geography fail-open behavior in the broader tenant-isolation programme, not by silently widening this focused PR.
5. Keep PR #247 draft/unmerged and production READ-ONLY / HOLD until independent review and explicit approval. No production/staging writes, DDL, migration, function/trigger, role/grant/RLS change, deployment, worker activation or certification. TRL 9 NOT ACHIEVED.


## 2026-11-04 authoritative refresh — CTO Run 23 (verification revocation race assurance)

### PR #247 exact-head CI success with concurrency regression
- Latest PR #247 head `39ecdb1e373a4ffcc80c1465cfc6d42bfd10482f` passed exact-head CI #5357 (`41789402772`) end-to-end: dependency audit, migration validation, disposable PostgreSQL migration, typecheck, production build, browser smoke, full PostgreSQL acceptance tests, production-container build and cleanup.
- Added two-session PostgreSQL race test: session 1 locks and revokes `VERIFY_EVIDENCE` from the exact organization role; session 2 starts verification insert and is observed waiting on a PostgreSQL lock; session 1 commits; session 2 resumes and rejects the insert after permission re-evaluation. The previously approved verification's captured permission snapshot remains unchanged after role mutation.
- This proves the tested role-permission revocation serialization case in disposable PostgreSQL. Identity suspension and membership revocation race variants, lock-order/deadlock behaviour and non-owner runtime-role proof remain open.
- PR #247 remains OPEN / DRAFT / UNMERGED. Migration `20261104_verification_authorization_tenant_binding.sql` is candidate-only and has not been applied to any database.

### PR #244 documentation handoff exact-head CI success
- Latest PR #244 head `c15536707d3326156286b89bcea2b84d3a228a51` passed exact-head CI #5356 (`41789332489`) end-to-end. PR #244 remains draft/unmerged.

### Remaining assurance limits
- The new verification trigger is SECURITY INVOKER, with explicit safe search_path and row locks; actual non-owner runtime privileges/grants still need to be tested.
- It rejects UPDATE to verification rows, but table-owner DELETE/tamper resistance is not solved by this migration alone; runtime grants, audit chain and independent DB-owner separation remain required.
- Geography scope fail-open when no verified scope exists remains a separate issue #215 / tenant-isolation blocker; this PR's route helper requires non-null geography and calls the existing scope function, but it does not change the global geography function.
- Migration was tested on a fresh disposable schema. A separate production-like disposable schema test with the four recovered 096 columns and both existing triggers preinstalled is still required before independent DBA review.

### Next batch
1. Add two-session identity suspension and membership revocation race tests; review lock ordering and deadlock/timeout handling.
2. Test migration idempotency against a production-like schema with 096 columns and both historical triggers already present; prove exactly one authoritative trigger remains.
3. Test under an intended non-owner runtime role, including function EXECUTE, table SELECT/INSERT/UPDATE and trigger execution privileges; explicitly prove DELETE restrictions/compensating audit controls.
4. Complete 67-table policy matrix and geography fail-closed design separately.
5. Keep PRs draft/unmerged and production READ-ONLY / HOLD until independent DBA/security review and explicit approval. No production/staging writes, migrations, function/trigger, role/grant/RLS changes, deployments, worker activation or certification. TRL 9 NOT ACHIEVED.


## 2026-11-04 authoritative refresh — CTO Run 24 (three revocation race tests green)

### PR #247 exact-head CI closure
- Latest PR #247 head `4fed4494bfada75f0cb4c1cfbb4e10a8108198fc` passed exact-head CI #5360 (`41789915766`) end-to-end: dependency audit, migration validation, disposable PostgreSQL migration, typecheck, production build, browser smoke, full tests/PostgreSQL acceptance, production-container build and cleanup.
- Three two-session PostgreSQL races now pass on disposable PostgreSQL:
  1. Role permission revocation: verification waits on role-row lock and fails after permission removal commits.
  2. Membership status deactivation: verification waits on membership-row lock and fails after status changes from VERIFIED to PENDING.
  3. Identity suspension: verification waits on identity-row lock and fails after suspension commits.
- Previously approved decision's stored permission snapshot remains unchanged after role permission revocation/restoration.
- PR #247 remains OPEN / DRAFT / UNMERGED. Migration unapplied.

### PR #244 handoff exact-head CI closure
- Latest PR #244 head `ff6872c1f90c0964bd9c1e31cbeb1adbf96410a3` passed exact-head CI #5359 (`41789805891`) end-to-end. PR #244 remains draft/unmerged.

### Remaining gates
- These are deterministic disposable PostgreSQL race tests, not a full proof of all deadlock/lock-order cases or production role behavior. Continue reviewing lock ordering, timeout/retry behavior, and row-level lock privileges.
- Test migration on a production-like disposable schema where recovered 096 columns and both legacy triggers already exist; prove one canonical trigger remains and migration is repeatable.
- Verify behavior under actual non-owner runtime role; current production role remains BYPASSRLS-capable and 0/67 tables have RLS/FORCE RLS.
- Geography scope fail-open remains separate; this PR does not redefine global geography policy.
- Verification rows are protected from UPDATE, but deletion/tamper prevention still depends on DB grants, owner separation and audit controls.

### Next execution batch
1. Add migration idempotency/production-like schema test with 096 columns and both historical triggers preinstalled.
2. Test trigger/function execution under a dedicated non-owner role with exact grants and safe search_path.
3. Add lock-order/deadlock test or document a reviewed lock-order contract and bounded transaction timeout/retry semantics.
4. Complete 67-table tenant RLS matrix and geography fail-closed design separately.
5. Keep PR #247 draft/unmerged and production READ-ONLY / HOLD pending independent DBA/security review and explicit approval. No production/staging writes, migration, role/grant/RLS/function/trigger change, deployment, worker activation or certification. TRL 9 NOT ACHIEVED.


## 2026-11-04 authoritative refresh — CTO Run 25 (verification migration reapplication rehearsal)

### PR #247 exact-head CI closure
- Latest PR #247 head `c03e70b1f7a67f381479e4d63eed96b2d5c5f3c4` passed exact-head CI #5364 (`41790629910`) end-to-end: dependency audit, migration validation, disposable PostgreSQL migration, typecheck, production build, browser smoke, full tests/PostgreSQL acceptance, production-container build and cleanup.
- Added migration reapplication rehearsal in the disposable evidence-vault integration test: pre-existing authorization snapshot columns and both historical trigger names are recreated, the candidate migration is rerun, and the test confirms exactly one canonical `verification_authorization_guard` remains.
- The three two-session role permission, membership deactivation and identity suspension race tests remain green.
- PR #247 remains OPEN / DRAFT / UNMERGED. Candidate migration is not applied to any database.

### Newly documented runtime privilege constraint
- Candidate guard is SECURITY INVOKER and uses `SELECT ... FOR SHARE` on evidence, activities, organization_memberships, roles and identities.
- PostgreSQL row-locking SELECT requires UPDATE privilege on at least one column of each locked table. Current table-owner runtime satisfies this; a restricted non-owner runtime may not.
- Do not grant broad UPDATE to the API runtime role to satisfy row locks. A dedicated restricted guard execution role or coordinated advisory-lock design must be independently reviewed and tested under FORCE RLS before runtime separation. Issue #196 and #215 updated with this constraint.

### PR #244 handoff CI status
- PR #244 latest head `91554b8cc62b194388fe4bd01b27e259a835e372` passed exact-head CI #5362 (`41790300090`) end-to-end. Subsequent Run 25 checkpoint additions require their own exact-head CI.

### Next execution batch
1. Design a least-privilege-safe lock architecture that does not require broad UPDATE rights on tenant tables; assess a dedicated narrow execution role versus advisory locks with mutation-side triggers and consistent lock ordering.
2. Prove the chosen mechanism on a disposable schema with FORCE RLS and a genuine non-owner role; test cross-org negative paths and revocation races.
3. Add production-like schema rehearsal that reproduces exact historical 096 function body and trigger composition, not only the trigger names; compare before/after function/trigger definitions.
4. Continue geography fail-closed policy and 67-table tenant matrix separately.
5. Keep PR #247 draft/unmerged and production READ-ONLY / HOLD pending independent DBA/security review and explicit approval. No production/staging writes, migration, role/grant/RLS/function/trigger change, deployment, worker activation or certification. TRL 9 NOT ACHIEVED.


## 2026-11-04 authoritative refresh — CTO Run 26 (07:28 UTC onward)

### PR #247 — additional tenant-binding corrections
- Latest code head: `ff75e989fcdef02cbb0719b8aaeb993e506c3a56`; PR #247 remains OPEN / DRAFT / UNMERGED. Exact-head CI run #5367 (`41794095914`) was IN PROGRESS at this checkpoint.
- Extended membership-to-activity binding to the role row itself: both application permission helpers and the database verification guard now require `roles.organization_id = organization_memberships.organization_id`. This closes a malformed-membership case where an organization-A membership could reference an organization-B verifier role.
- Expanded the disposable PostgreSQL fixture to create that cross-organization role binding and assert a direct REJECTED verification insert is denied.
- Found that the candidate database trigger did not itself require a non-null activity geography or invoke `organization_has_geography_scope`, although the application helper did. The trigger now requires non-null geography and checks the existing organization scope function. Added a direct-DB regression for geography-less activities.
- Important boundary: `organization_has_geography_scope` still treats an organization with no VERIFIED configured geography roots as unrestricted. This is an existing global fail-open design decision and remains OPEN; Run 26 does not claim to have solved it.

### Local validation evidence and limitations
- On the clean Run-26 worktree, `npm run typecheck`, `npm run build`, `npm run validate:migrations` (92 migrations / 73 schema objects), and `git diff --check` passed.
- Focused `auth-permissions` suite passed 5/5.
- Full local workspace suite: 90 passed, 8 skipped, 1 failed. The failure was the CORS runtime spawn test because the spawned runtime exited on this Windows host; this is not yet classified as a code regression. PostgreSQL integration tests were skipped because no local `DATABASE_URL` or Docker engine was available. Exact-head CI is the authoritative PostgreSQL acceptance gate.
- PR comment #6625463871 records the two findings, local results and limitations. No production/staging DB was accessed or modified during this batch.

### Least-privilege trigger execution — still unresolved
- Current trigger remains SECURITY INVOKER with row-locking SELECT on evidence, activities, memberships, roles and identities. It cannot be validated under a restricted non-owner runtime without solving the UPDATE privilege requirement for row locks.
- No broad UPDATE grant was added. A narrow non-login SECURITY DEFINER guard role with column-limited lock privileges and explicit RLS policies remains one candidate architecture; it must be tested under FORCE RLS and reviewed for safe search_path, function ownership/EXECUTE exposure, GUC scoping, row visibility and lock order. Do not implement from design assumptions alone.
- Advisory-lock alternative remains unproven until mutation-side lock coverage, READ COMMITTED snapshot freshness and concurrent revocation tests are demonstrated.

### Immediate next actions
1. Complete exact-head CI #5367 for `ff75e989fcdef02cbb0719b8aaeb993e506c3a56`; inspect PostgreSQL acceptance logs and repair any failure without relaxing negative assertions.
2. Prototype the dedicated NOLOGIN guard-role design on disposable PostgreSQL with FORCE RLS and a genuine non-owner runtime; grant only the minimum SELECT and column-level UPDATE needed for row-locking, and ensure the API role cannot SET ROLE or invoke the guard function directly.
3. Add positive/negative tests for guard-role RLS visibility, trigger execution, function privilege boundaries, cross-tenant rows and DELETE/tamper resistance; verify role cannot login and has no BYPASSRLS.
4. Extend role/membership organization-consistency audit beyond verification to all shared permission helpers and DB functions, without widening this PR beyond reviewed dependencies.
5. Resolve the global geography no-scope behavior in the 67-table tenant/geography programme; do not silently change it in this focused verification patch.
6. Continue exact production-like 096 body/trigger rehearsal and independent DBA/security review.

### Production / TRL posture
- Production Neon remains READ-ONLY / HOLD. No production SQL writes, migrations, role/grant/ownership changes, RLS activation, deployment, merge, worker activation or certification.
- PR #247 and PR #244 remain DRAFT / UNMERGED. Candidate migration unapplied.
- Production tenant isolation remains 0/67 RLS and 0/67 FORCE RLS; runtime/migrator separation and non-owner role proof remain incomplete.
- SITE-JBP-01 Kathonda remains PRE-VALIDATION; field evidence not established. Live Guardian/Hedera round-trip and independent statutory/field acceptance remain incomplete.
- Production certification and TRL 9: NOT ACHIEVED.


### Run 26 exact-head CI closure (07:45 UTC refresh)
- PR #247 code head `ff75e989fcdef02cbb0719b8aaeb993e506c3a56` passed exact-head CI #5367 (`41794095914`) SUCCESS. All stages passed, including disposable PostgreSQL migration and acceptance tests, typecheck, build, browser smoke and production-container build. The malformed cross-tenant membership and geography-less direct-DB regressions passed in the PostgreSQL acceptance stage.
- PR #244 documentation head `3926690892527584c0cc7e3397d4f2ae79000caf` passed exact-head CI #5368 (`41794335224`) SUCCESS across all configured stages, including PostgreSQL acceptance and production-container build.
- PR #247 remains OPEN / DRAFT / UNMERGED; PR #244 remains OPEN / DRAFT / UNMERGED. CI success does not close the non-owner guard-role architecture, production RLS, migration drift, independent review, field acceptance or TRL 9 gates.

- Added design-only proposal `docs/security/VERIFICATION_GUARD_NON_OWNER_EXECUTION_DESIGN_2026-11-04.md`: dedicated NOLOGIN/NOBYPASSRLS SECURITY DEFINER guard role, column-limited lock privilege, guard-context RLS policies, fixed search_path, deterministic lock contract and disposable FORCE RLS test gates. This is a candidate for prototyping only; it is not implemented, approved or production-applied.

- Documentation head `1c39a399218584fc3ce8f143385e3e54adec754f` passed exact-head CI #5372 (`41794655157`) SUCCESS across all configured stages. The subsequently added non-owner guard design proposal is a newer docs-only change and requires its own exact-head CI.


## 2026-11-04 authoritative refresh — CTO Run 27 (membership-role tenant integrity)

### New structural finding and production evidence
- The database previously enforced only `organization_memberships.role_id -> roles.id`; it did not enforce that the referenced role belonged to the same organization as the membership. Multiple auth, onboarding and platform-admin joins also omitted the organization equality.
- Read-only Neon production main query (project `steep-mud-79906940`, branch `br-restless-base-b44cip2h`, database `rupaykg`) returned 0 mismatched membership-role pairs: 0 VERIFIED and 0 PENDING. No production rows were changed.

### PR #252 — stacked database/application hardening
- Branch `security/membership-role-tenant-integrity-2026-11-04`; exact head `2228100e0da0a1dc9321b11e48f6b2fa4ee6ba33`.
- PR #252 is OPEN / DRAFT / UNMERGED, stacked on PR #247's branch. New migration `2026110401_membership_role_tenant_binding.sql` adds a validated composite FK `(role_id, organization_id) -> roles(id, organization_id)` plus supporting indexes.
- Auth membership projections, onboarding hierarchy authority, platform-admin authorization, reserved-role checks, access-change review, membership directory and revocation queries now bind role organization to membership organization.
- PostgreSQL integration test reapplies and validates the migration, rejects cross-org role assignment on INSERT, and rejects membership organization reassignment on UPDATE. Platform-admin unit tests assert the equality in exercised authorization queries.
- Local evidence: migration validation PASS (93 migrations / 73 schema objects); typecheck PASS; production build PASS; focused platform-admin/auth permission tests 19/19 PASS; `git diff --check` PASS.
- Exact combined-stack CI #5376 (`41796337375`) was running via temporary validation PR #254. At checkpoint, dependency audit, migration validation, disposable PostgreSQL migration, typecheck, build, browser smoke and PostgreSQL acceptance had passed; production-container build remained in progress. Close #254 after final CI evidence; keep #252 as the authoritative stacked draft.

### Run 27 next actions
1. Verify exact-head CI #5376 final result and production-container build; add the evidence to PR #252 and issue #215.
2. Close temporary validation-only PR #254 after capturing the result.
3. Audit all historical SQL authorization functions against exact production definitions; preserve migration 096 source drift and do not replay/overwrite absent versions.
4. Rehearse composite FK on production-like disposable schema with recovered 096 trigger composition; independent DBA review remains required.
5. Continue the non-owner verification guard prototype under FORCE RLS; the design remains proposal-only.

### Current safety/TRL posture
- Production remains READ-ONLY / HOLD. Composite FK migration is not applied to production. No production writes, grants, role changes, RLS activation, deployments, merges, worker activation or certification.
- PR #247 and PR #252 remain draft/unmerged. Temporary PR #254 is CI-only and will be closed after evidence capture.
- Global 67-table RLS, geography fail-closed behavior, runtime/migrator separation, live Guardian/Hedera acceptance and SITE-JBP-01 field validation remain open. Production certification and TRL 9 NOT ACHIEVED.


## Run 28 — non-owner guard prototype checkpoint


Prototype PR #263 remains OPEN / DRAFT / UNMERGED, stacked on PR #252 and PR #247. Latest exact code head: 1ce986d3e5ceab339a77fd1d64d4911b0fbabad4. Exact-head CI #5407 (run 41804235750) completed SUCCESS across all configured stages, including disposable PostgreSQL integration and production-container build. Earlier exact head 178e7c77bb5c848fdef27281acdf6a404894d0d4 also passed CI #5402. Temporary validation-only PR #264 was closed unmerged after CI evidence capture.


Prototype results: the disposable PostgreSQL test used a real password-authenticated API login and a separate non-login function-owner role. The API could not assume the function-owner role. Custom context settings supplied by the API did not reveal protected evidence, and the trigger restored the caller's prior settings after both success and rejection. The trigger function used a fixed search path and enabled row security.

The database test also showed that a narrow column grant alone is insufficient for row locking under FORCE RLS. Exact-row policies are required as well: they allow the function-owner role to lock the selected row but reject changes to that row's identifier. The test covered same-organization success, cross-organization denial, self-verification denial, out-of-scope geography, suspended identities, and concurrent role, membership and identity revocation. The guard role has no table-level mutation or delete grant in the fixture.


Remaining gates: this is an isolated-schema prototype, not a rehearsal against the recovered migration-096 production schema. Neon managed-role provisioning, actual production grants and policies, geography-scope mutation races, evidence/activity reassignment races, lock-order/deadlock/timeout/retry analysis, destructive-owner controls and independent DBA/security review remain open. The production no-verified-geography-scope permissive behavior is still a separate fail-closed blocker.

Next: rehearse the guard against a disposable copy of the recovered 096 schema and trigger composition; validate role provisioning under Neon-like constraints; add geography and evidence/activity reassignment races; complete the 67-table tenant RLS matrix and runtime/migrator separation review. Production remains READ-ONLY / HOLD. No production or staging writes, grants, role changes, migrations, RLS activation, deployment or certification occurred. SITE-JBP-01 remains PRE-VALIDATION; TRL 9 NOT ACHIEVED.


## 2026-11-04 authoritative refresh — CTO Run 28 (non-owner verification guard and recovered 096 rehearsal)

### Prototype PR #263 — exact-head CI passed
- PR #263 remains OPEN / DRAFT / UNMERGED, stacked on PR #252 and PR #247.
- Latest exact head: `1f5e4a6f195f0514f7fe46be696b73561caeb80d`.
- Exact-head CI #5409 (`41805919316`) completed SUCCESS across dependency audit, migration validation, fresh disposable PostgreSQL migration, typecheck, production build, browser smoke, full tests including PostgreSQL acceptance, production-container build and cleanup.
- The dedicated non-owner/FORCE RLS guard test passed as API test 57. API suite 100/100; other workspace suites 22/22, 2/2, 29/29, 1/1 and 2/2.
- Prototype uses a real password-authenticated API login and a separate NOLOGIN/NOSUPERUSER/NOBYPASSRLS guard function-owner role. Guard role is not a tenant-table owner and has no BYPASSRLS. API has no function EXECUTE privilege and no SET ROLE path to guard.
- PostgreSQL SELECT ... FOR SHARE requires UPDATE privilege on at least one column. Prototype proves a narrow column-level UPDATE(id) grant plus exact-row UPDATE RLS USING/WITH CHECK policies allows locking while denying identifier mutation; no table-level UPDATE or DELETE is granted.
- FORCE RLS hides evidence with missing context; API GUC spoofing does not reveal tenant rows because policies target only guard role. Trigger restores caller GUC state. Same-org verification succeeds; cross-org, self-verification, out-of-scope geography and suspended identity fail. Role revocation, membership deactivation and identity suspension races all serialize and deny after revocation commits.

### Recovered migration 096 trigger-composition rehearsal
- Disposable integration fixture now recreates recovered migration-096 verification function body and the real migration-010 independence trigger under their historical trigger names.
- It proves the historical combined trigger composition rejects cross-org APPROVED but permits cross-org REJECTED, then applies the forward-only candidate migration and asserts exactly one authoritative verification trigger remains.
- This is a disposable trigger-composition rehearsal, not a full production-schema restore or replay of migration 096. Migration 096 remains review-only and must not be restored/replayed blindly.

### Temporary CI PR and documentation
- Temporary validation PR #264 was closed UNMERGED after exact-head CI evidence capture. PR #263 remains the authoritative prototype.
- Run-28 checkpoint: `docs/engineering/checkpoints/2026-11-04-cto-run-28-nonowner-verification-guard.md`.
- Guard design doc now records the passed prototype and separates verified proof from open production gaps.

### Remaining gates
1. Add evidence-to-activity reassignment and activity organization/geography reassignment races.
2. Geography-scope mutation locking and fail-closed no-scope behavior remain open; production permissive no-scope behavior remains a P0 blocker.
3. Review lock ordering across evidence/activity/identity/membership/role/scope; add deadlock, timeout and bounded-retry tests.
4. Validate Neon managed-Postgres role provisioning and ACL feasibility on disposable infrastructure only.
5. Continue 67-table RLS matrix, dynamic tenant tests, migration drift and runtime/migrator separation.
6. Independent DBA/security review is mandatory.

### Safety / TRL
- Prototype does not provision production roles, grants, policies or triggers. Production remains READ-ONLY / HOLD.
- No production/staging writes, migrations, role/grant/ownership changes, RLS activation, deployments, merges, worker activation or certification.
- PRs #247, #252 and #263 remain draft/unmerged. SITE-JBP-01 Kathonda remains PRE-VALIDATION. Production certification and TRL 9 NOT ACHIEVED.


### Run 28 — 67-table policy matrix refresh
- Read-only Neon catalog extraction returned column lists and foreign-key relationships for all 67 public base tables. Each remains RLS-disabled and FORCE-RLS-disabled; all are owned by rupaykg at the catalog snapshot.
- Added docs/engineering/PRODUCTION_TENANT_POLICY_MATRIX_2026-11-04.md, a 67-row table-by-table candidate matrix covering direct tenant keys, activity/evidence descendants, EPR/ESG/BWG reporting, bilateral credits/transfers/settlements, field-device/sync, identity/security, platform audit and governance/reference data. It specifies candidate access boundaries and required cross-tenant consistency checks without authoring policy SQL.
- Linked the matrix from PRODUCTION_TENANT_ISOLATION_INVENTORY_2026-11-04.md. This is a design inventory only; it is not approved policy or a production rollout authorization.


### Run 28 follow-on — reassignment races and fail-closed geography
- Latest prototype PR #263 head `d297861d9e6dc5b7b03cfb6162902e57a5893b00` passed exact-head CI #5444 (`41810684565`) and combined main-base CI #5445 (`41810809297`) SUCCESS end-to-end.
- Added and passed three new two-session races under the actual non-owner API login: evidence-to-activity reassignment, activity organization reassignment, and activity geography reassignment. In each, verification waits for the relevant evidence/activity row lock, then re-reads committed state and denies after ownership/scope changes.
- Prototype geography helper now fails closed when no VERIFIED geography scope exists; a direct PostgreSQL negative test confirms denial. This change is test-only. Production's existing no-scope permissive behavior remains a P0 blocker.
- Six races now pass: role permission revocation, membership deactivation, identity suspension, evidence reassignment, activity organization reassignment and activity geography reassignment.
- API suite 100/100; other workspace suites 22/22, 2/2, 29/29, 1/1 and 2/2. Browser smoke and production-container build passed.
- Temporary validation PR #273 was closed UNMERGED after CI #5445. PR #263 remains the authoritative stacked draft.
- Remaining: concurrent geography-scope row revocation locking; complete global lock order/deadlock/timeout/retry; Neon role provisioning feasibility; 67-table policy and actual non-owner runtime rollout; owner tamper controls; independent DBA/security review.


## 2026-11-04 authoritative refresh — CTO Run 29 (security convergence and release governance)

### Exact-head engineering evidence
- PR #272 head `a8ce1c9bbb1d88a88dffe142967fec65d7ad77d9` passed exact-head CI #5516 / run `41874461093` SUCCESS (18/18 steps). Verification now denies when an organization has no VERIFIED geography root; a full-schema PostgreSQL regression sets the only root to PENDING and proves denial.
- PR #284 prior head `2b1ebc88237e9274e563b5605295ce925cabd234` passed exact-head CI #5518 / run `41874715707` SUCCESS (18/18 steps). PUBLIC EXECUTE was removed from the signed-context helper functions; the disposable API role has only an explicit context-issuer grant and cannot directly call private validators.
- PR #284 current head `cbd743a8d2e17100cd1607ef19f90bef6a6ccc6d` ports exact activity-organization and role-organization binding into `hasOrganizationPermission` and `canVerifyEvidence`, checks active/non-suspended identity, passes the resolved organization from both verification write routes and adds SQL-shape/parameter assertions. CI #5521 / run `41875338287` is still in progress at this refresh; migration validation, context proof, typecheck, build, browser smoke and PostgreSQL acceptance have passed; production-container build remains pending.
- PR #252 tenant-role binding exact-head CI #5376 passed. PR #250/#251 combined geography rehearsal temporary PR #287 CI #5506 passed; #287 is closed unmerged. PR #268 migrator separation CI #5406 passed but remains draft/unmerged. PR #263 prototype CI #5457 passed. PR #282 and #277 proof branches have successful CI but remain evidence-only drafts.

### Fresh authoritative production and release-control evidence
- Neon main recheck: 67 public tables, 0 RLS, 0 FORCE RLS, 0 public policies; all 67 owned by `rupaykg`; 92 migration rows, latest `20261021`. `rupaykg` is LOGIN, BYPASSRLS, CREATEROLE, CREATEDB, REPLICATION and member of `neon_superuser`. Audit connection `current_user=session_user='rupaykg'` is not proof of the Render API identity.
- Render live service `srv-daki4d7qj5pc73b8qksg` auto-deploys on `commit` from `main`; checked-in `render.yaml` says `checksPass`. Latest live commit remains `934062ef8af2ca47bbcbf5e37c12de12a4f9f743`. No Render settings, secrets or deployments changed.
- GitHub `main.protected=false`; repository rulesets query is empty. No branch protection was changed.

### Convergence blockers and next actions
1. Finish PR #284 CI #5521. Do not claim exact-head success until container build/cleanup completes.
2. Consolidate #252 + #272 + #250/#251 + #284 into one canonical verification trigger and one shared NOLOGIN/NOBYPASSRLS guard owner. #272 and #284 currently define the same trigger/function; naive migration ordering replaces the signed-context trigger. Reuse `rupaykg_verification_guard`, do not retain separate `rupaykg_auth_context_owner`.
3. Preserve both context layers: `app.request_context` for general RLS and DB-issued bearer context for verification writes. Set both on the same client/top-level transaction, bind the same actor and active organization, compare claims in the final trigger, and prove pool/rollback/savepoint reset.
4. Identify the actual Render API runtime role safely; grant EXECUTE only on the context issuer to that role after proof. No PUBLIC grant.
5. Reconcile 92 production ledger rows against 91 active source files; preserve orphaned 096 as evidence and do not replay/rewrite it. Complete 67-table RLS matrix and actual non-owner FORCE RLS rehearsal.
6. Reconcile Render commit-trigger drift and unprotected main through a separately approved release-governance change.

### Readiness and safety
- Production remains READ-ONLY / HOLD. No production DDL/DML, migrations, role/grant/ownership changes, RLS, branch operations, secret/config changes, deployments, worker activation, merges or certification occurred.
- SITE-JBP-01 Kathonda remains PRE-VALIDATION. Provisional national-platform TRL 3; individual tested components at most TRL 4. Production certification and TRL 9 NOT ACHIEVED.
- Immutable Run-29 checkpoint: `docs/engineering/checkpoints/2026-11-04-cto-run-29-security-convergence-and-release-governance.md`. Session log: `docs/engineering/session-logs/2026-11-04-cto-session-29.md`.


## 2026-11-04 Run 29 CI closure — exact-head results confirmed

- PR #272 head `a8ce1c9bbb1d88a88dffe142967fec65d7ad77d9`: CI #5516 / `41874461093` **SUCCESS**, 18/18 steps.
- PR #284 head `cbd743a8d2e17100cd1607ef19f90bef6a6ccc6d`: CI #5521 / `41875338287` **SUCCESS**, 18/18 steps. This includes the exact activity-organization/role-organization application authorization port, both route call sites, context migration proof, typecheck, build, browser smoke, PostgreSQL acceptance and production-container build.
- PR #284 prior no-PUBLIC-EXECUTE head `2b1ebc88237e9274e563b5605295ce925cabd234`: CI #5518 / `41874715707` **SUCCESS**, 18/18 steps.
- These are isolated branch validations only. The combined #252 + #272 + #250/#251 + #284 migration/role/context rehearsal remains NOT DONE. One canonical trigger and one shared `rupaykg_verification_guard` owner are mandatory; do not merge individual drafts out of order.
- Follow-up immutable closure checkpoint: `docs/engineering/checkpoints/2026-11-04-cto-run-29-closure.md`. Closure session log: `docs/engineering/session-logs/2026-11-04-cto-session-29-closure.md`.
