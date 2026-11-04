

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
