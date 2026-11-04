# RupayKg — latest engineering resume point

Updated: 2026-11-04 (IST)  
Canonical repository: vishaltradewinds/rupaykg  
Reference UI repository: vishaltradewinds/rupaykg-aistudio  
Governing standard: Shakti Standards — one lifecycle standard, project-specific operating systems.

## Current run — 2026-11-04

### Release posture
- **Production Neon: READ-ONLY / HOLD.**
- Tenant isolation: **FAIL/BLOCKED** — 0/67 public base tables have RLS; 0/67 have FORCE RLS; 0 public policies.
- Runtime separation: **NOT ESTABLISHED** — the observed `rupaykg` login role has BYPASSRLS, CREATEROLE and CREATEDB. No dedicated `rupaykg_app_runtime` or `rupaykg_auth_runtime` role was observed.
- Worker/scheduler: OFF. Certification: OFF.
- National platform: provisional TRL 3; tested software components at most TRL 4. TRL 9 NOT ESTABLISHED.
- No regulator acceptance, live-site operation, calibrated field instrumentation, live Guardian/Hedera/Mirror Node acceptance, independent field evaluation or disaster-recovery acceptance is established.
- No production DDL/DML, migration, role/grant/RLS change, Neon branch operation, secret write, deployment, provider write, worker activation or certification without required independent gates and explicit founder approval.

### Latest verified engineering progress
- **PR #282 — authenticated verification database context, v4.** Head: `7963719280d20d2e285d3011ea390aee5ab46e9d`. Exact-head CI **#5474 / 41815073863 SUCCESS**. All 37 reported job steps completed successfully, including migration validation, exact candidate fixture application on disposable PostgreSQL, authenticated-context spoof/revocation tests, actual-schema non-owner and SECURITY DEFINER proofs, typecheck, build, browser smoke, PostgreSQL acceptance tests and production-container build.
- PR #282 proves a disposable-CI mechanics pattern: an opaque bearer session is validated against active identity, verified organization membership and VERIFIED organization; a dedicated NOLOGIN/NOSUPERUSER/NOBYPASSRLS context owner signs transaction-local context with a private HMAC key; caller-forged GUCs and revoked sessions are rejected; row-lock privileges are column-scoped rather than table-wide.
- **Critical limitation:** PR #282 explicitly remains an architecture proof. It is not yet integrated into all API request transactions or all tenant RLS policies. It is not a migration, production grant plan, independent DBA/security review, tenant-isolation certification or production readiness proof.
- **PR #277** actual-schema non-owner proof: exact head `f49fb026b6651fef2822d970bf78c762283b8b25`; CI #5465 / 41813321638 SUCCESS. It confirmed candidate trigger mechanics and exposed cross-tenant evidence visibility on the current no-RLS baseline, plus caller-controlled tenant-GUC spoofing in the SECURITY DEFINER test.
- **PR #278** geography-scope revocation/reassignment CI-validation PR: exact-head CI #5457 / 41812353414 SUCCESS. Closed unmerged after capturing the evidence, as its body required; authoritative PR #263 remains unchanged.
- **Duplicate security-proof cleanup:** earlier v1–v3 PRs #279, #280 and #281 were closed unmerged as superseded by the v4 proof in #282. Their branches were not deleted. PR #282 is the single current proof candidate.
- PR #282 exact-head result and scope were recorded in its PR discussion and issue #215. Issue #215 remains OPEN / P0 pending API integration, full policy design, legacy-trigger reconciliation, concurrency coverage and independent review.
- PR #275 remains a draft documentation-only ODK/CREDEBL interoperability contract. It is not a live connector or field deployment.

### Authoritative Neon production — fresh read-only inspection
- Project: `rupaykg-production-fresh` / `steep-mud-79906940`.
- Default branch: `main` / `br-restless-base-b44cip2h`; Neon reports `protected=false`.
- Database: `rupaykg`.
- Public base tables: 67; RLS enabled: 0; FORCE RLS: 0; public policies: 0.
- `schema_migrations`: 92 rows; latest version `20261021`.
- Observed relevant login role: `rupaykg`; LOGIN=true, BYPASSRLS=true, CREATEROLE=true, CREATEDB=true, SUPERUSER=false. Dedicated app/auth runtime roles were not observed.
- Queries were SELECT/catalog-only. No production writes or branch operations occurred.
- Production remains the sole authoritative live database; rehearsal/lab branches are not release authority.

## Open P0 gates and dependency order

1. **Verification authorization (#215):** reconcile PR #282 signed-context proof with the API transaction boundary and the canonical verification trigger; require trusted verifier/tenant provenance, same-organization active membership and explicit permission for every decision; lock identity, membership, organization and geography authority in a reviewed global order; remove the legacy global-membership/role-name trigger only after unified replacement tests cover all decisions; retain fail-closed geography. Add real two-tenant PostgreSQL tests for forged identity/tenant, revoked session, suspension, membership/role changes, organization status, geography revocation/reassignment, self-approval, immutable snapshots, DELETE/TRUNCATE and role/function bypass paths.
2. **Migration lineage (#214):** production ledger contains 92 rows including applied 096, while the active migration directory previously lacked the executable 096 source. Preserve recovered 096 as evidence only. Complete exact-byte provenance for all 92 ledger rows and recover exact source for staging-only 20261022–20261025; do not rewrite ledger rows or replay 096.
3. **Tenant isolation and least privilege (#196):** complete 67-table ownership/policy/function/trigger/search_path/grant matrix and endpoint-to-data authorization map. Design dedicated NOLOGIN/NOBYPASSRLS owner/runtime/migrator roles; prove under actual runtime identities in two-tenant disposable PostgreSQL. No blanket grants/revokes or production RLS changes.
4. **Release governance:** GitHub rulesets previously returned empty; main branch-protection request returned 403, so protection remains unverified. Neon main remains unprotected. Render web service auto-deploys from main. No security/migration merge or deployment until independent review and explicit founder release approval.
5. **EPR:** preserve one controlled signed-RLS GET route; do not register duplicate GET implementations. Port write/session-lock guarantees into the same tenant transaction boundary only after real PostgreSQL concurrency tests. Feature flags remain OFF.
6. **Worker/MRV:** complete system-actor/RLS contract, lease-loss, retries and provider reconciliation. Worker remains OFF.
7. **BWG/national operations:** complete independent BWG review and field evidence, then site/facility workflows, measured pilot operation, statutory applicability and independent acceptance.
8. **TRL:** reassess only from measured field operation, independently accepted methodology/controls, live integrations, security, continuity and operational evidence. Never infer TRL 9 from CI.

## Current PR disposition
- PR #282: OPEN / DRAFT / UNMERGED; latest authenticated-context proof; exact-head CI #5474 SUCCESS; independent review and API/RLS integration still required.
- PR #277: OPEN / DRAFT / UNMERGED; actual-schema security evidence; CI #5465 SUCCESS; contains negative findings, not a tenant-isolation pass.
- PR #263: remains the authoritative stacked geography/verification prototype; do not replace it with temporary validation PRs.
- PR #278: CLOSED / UNMERGED after CI evidence capture.
- PRs #279–#281: CLOSED / UNMERGED as superseded by #282; branches retained.
- PR #275: OPEN / DRAFT / UNMERGED; ODK/CREDEBL contracts only.
- PR #204: prior documentation/checkpoint handoff branch; this run's checkpoint is on a new branch based on its last recorded head. No PR merge is performed by this run.

## Read first
1. This resume point.
2. Immutable checkpoint: `docs/engineering/checkpoints/2026-11-04-cto-run-01-authenticated-verification-context.md`.
3. Session log: `docs/engineering/session-logs/2026-11-04-cto-session-01.md`.
4. Append-only execution log: `docs/engineering/EXECUTION_LOG.md`.
5. P0 issues: #196 tenant isolation, #214 migration source/ledger, #215 verification authorization.

## Safety boundary
All current engineering evidence described above is from GitHub disposable CI and read-only Neon inspection. No production DDL/DML, migration, role/grant/RLS change, Neon branch operation, deployment, worker activation, external provider write, merge or certification occurred. Production HOLD; worker OFF; certification OFF; TRL 9 NOT ESTABLISHED.
