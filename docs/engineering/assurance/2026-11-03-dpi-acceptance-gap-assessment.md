# RupayKg — Shakti DPI Acceptance Gap Assessment

**Assessment date:** 2026-11-03  
**Canonical repository:** `vishaltradewinds/rupaykg`  
**Assessment baseline:** `main`, Git tree `a3fecc0abd2c46549a201058d3963afc0e3a73c9`  
**Governing standard:** Shakti Standards, including `SHAKTI-AMD-2026-11-03-01` (DPI Architecture and Ecosystem Qualification)  
**Assessment type:** Repository and recorded evidence review; no production database, deployment, role, secret, or live participant was modified.  
**Decision:** DPI acceptance **PARTIAL / NOT QUALIFIED**; tenant-isolation and production assurance **FAIL / HOLD**.

## 1. Executive finding

RupayKg has meaningful foundations for a sectoral circular-economy evidence and MRV platform: organization and identity models, geography scoping, versioned API routes, registry lifecycle controls, evidence vault, offline field synchronization, Guardian/Hedera provenance, methodology governance, and regulatory workflows.

These foundations do not yet demonstrate a production-grade federated DPI. The highest-priority blocker is database-enforced tenant isolation. The latest recorded read-only production Neon audit (2026-11-01) reports 67 public tables, zero with RLS enabled, zero with FORCE RLS, all 67 owned by the application login `rupaykg`, and that role has `BYPASSRLS` and privileged role attributes. The inspected role also inherits `neon_superuser`. This means application-level authorization is not yet backed by the required production database boundary.

The repository's current `main` auth implementation also authenticates through a shared `Pool`, while protected route operations commonly execute independent `pool.query` calls. It does not establish one universal request-scoped transaction context. RLS must not be enabled until the stacked auth/bootstrap and tenant-context work is reconciled, independently tested, and proven against a disposable production clone.

Several active draft PRs contain relevant work, but draft/unmerged branches are not part of the mainline production implementation and must not be counted as completed controls.

## 2. Evidence reviewed and limits

### Mainline source inspected

- `apps/src/auth.ts`: bearer-token hash lookup, session expiry/revocation and verified identity checks; verified memberships; explicit organization selection for multi-organization identities; permission checks.
- `apps/src/server.ts`: Fastify API registration, PostgreSQL pool, route-level authorization helpers and status/health endpoints.
- `apps/src/registry-routes.ts`: explicit high-risk issuance/transfer/retirement permissions, activity/evidence/verification binding, Guardian/HCS/Mirror Node evidence checks and fixture exclusion.
- `apps/src/evidence-vault-routes.ts`: organization/geography-scoped upload, read and review workflow; reviewer separation.
- `apps/src/mrv-routes.ts`: Guardian submission, Hedera anchoring, persisted provenance and Mirror Node verification path.
- `apps/src/production-config.ts`: production configuration validation, HTTPS origin restrictions, real-auth requirement and synthetic-data prohibition.
- `docs/API.md`, `docs/REGISTRY.md`, `docs/MRV_EVIDENCE_VAULT.md`, `migrations/README.md`, and `docs/SHAKTI_PRODUCTION_GATE_RUPAYKG.md`.
- Migrations `004`, `012`, `033`, and `087` for identity/session, geography scope, field-sync identity binding and registry-fixture/MRV guards.

### Live GitHub state checked

- Open PR #198: production tenant isolation/RLS design, open and not merged.
- Open PR #192: authentication/bootstrap integration, draft and not merged.
- Open PR #213: explicit-client EPR read route, draft and not merged; exact-head CI run #5098 succeeded at commit `480b3b1f429f12a91a6626599503caeff62959e7`.
- Open PR #216: verifier identity/subject-tenant hardening, draft and not merged.
- Open PR #218: signed tenant-context MRV workspace reads, draft and not merged.
- Open PR #219: pilot walkthrough integration with authorized MRV workspace, draft and not merged.
- Open PR #188: Neon production/staging branch reconciliation, draft and not merged.
- Open PR #221: recovery evidence for historical production migration 096, draft and not merged.
- Open PR #204: parallel execution evidence reconciliation, draft and not merged.

PR #213's successful CI is limited to that exact tested head and its CI suite; it does not validate mainline, the entire stacked branch chain, production RLS, or production release. A separate preceding attempt at commit `655989fecd7f8572a256b7c4ec6cbc09d39f9568` failed; the subsequent successful run is recorded as a later remediation. Recheck exact head and all required checks before integration.

### External environment evidence reviewed

The 2026-11-01 Neon reconciliation records:
- Project `steep-mud-79906940` (`rupaykg-production-fresh`).
- Production primary branch `br-restless-base-b44cip2h` (`main`), database `rupaykg`.
- Staging branch `br-spring-hill-b4544vz5`, with distinct data-bearing async inbox history.
- Production ledger: 92 rows, including historical production-applied migration 096.
- Staging ledger: 95 rows, including four staging-only migrations.
- Migration 096 and four staging-only migration sources were absent from the inspected mainline at that time; migration 096 has since been recovered as documentation/evidence in open PR #221, not as an executable migration.

This is recorded evidence, not a fresh live Neon query in this assessment. The exact Render runtime connection identity and current live role privileges still require direct read-only confirmation. Do not change production or staging based on stale environment assumptions.

## 3. Ten DPI acceptance gates

Status meanings: **PARTIAL** = foundation exists but acceptance evidence is incomplete; **FAIL** = a known mandatory control is absent or contradicted by evidence; **HOLD** = cannot be accepted until an external or operational prerequisite is demonstrated.

| Gate | Assessment | Evidence and remaining proof |
|---|---|---|
| R-DPI-01 Ecosystem and authoritative participants | PARTIAL | Organization, stakeholder, facility, geography, activity and registry concepts exist. Complete participant/authority map, source-of-truth ownership, independent counterparties, local-body/regulator roles and dispute/correction ownership remain to be evidenced. |
| R-DPI-02 Data governance and stewardship | PARTIAL | Regulatory source provenance and evidence lineage exist. A complete dataset-level purpose, lawful basis, controller/steward, retention, sharing, correction, deletion and grievance register is not evidenced across all domains. |
| R-DPI-03 Database-enforced tenant isolation | **FAIL / P0** | Latest recorded production audit: 0/67 RLS, 0/67 FORCE RLS; all 67 tables owned by `rupaykg`; application role has `BYPASSRLS` and privileged attributes. Mainline route-level membership/organization checks do not replace database enforcement. |
| R-DPI-04 Open interoperability and independent conformance | PARTIAL | API routes are versioned under `/api/v1` and API principles are documented. Complete published machine-readable schemas, OpenAPI contract, version compatibility policy, third-party conformance suite and independently operated implementation are not yet evidenced. |
| R-DPI-05 Evidence trust and credential lifecycle | PARTIAL | Evidence vault, SHA-256, append-only version/review records, Guardian/HCS provenance, Mirror Node marker and database issuance guard exist in source. Real production Guardian/Hedera/Mirror Node acceptance and key/issuer trust lifecycle remain open under production gate. |
| R-DPI-06 Statutory, EPR, CCTS and voluntary MRV separation | PARTIAL | Distinct regulatory and methodology modules, applicability controls and evidence-gated issuance exist. Require a complete requirement-to-control-to-test trace and independent numerical/methodology review for every production use case. No voluntary or technical workflow may be represented as statutory approval. |
| R-DPI-07 Inclusion and field readiness | PARTIAL | Offline envelopes, device enrollment, conflict workflows and web/mobile UI foundations exist. Real field-device qualification, intermittent-network replay/recovery, language/accessibility and representative operator acceptance are not evidenced as complete. |
| R-DPI-08 Operational governance, portability and sustainability | PARTIAL | Production config and backup/rollback documentation exist. Tested restore, recovery objectives, operational ownership, incident drills, portability/exit rehearsal, support model and lifecycle funding evidence remain open. |
| R-DPI-09 Independent assurance | **FAIL / P1** | Repository tests and CI are not independent security, privacy, methodology, field or external integration assurance. Independent reviewer evidence and signed acceptance records are not established. |
| R-DPI-10 Release authority and real-world approval | **HOLD** | Existing Shakti production gate explicitly blocks certification pending live Guardian/Hedera/Mirror Node evidence, monitoring, backup/restore, rollback and external approvals. No DPI designation or statutory approval is established. |

## 4. Cross-cutting architectural findings

### 4.1 Authentication and tenant boundary

Mainline `authenticate(request, pool)` validates a bearer session and verified membership, and selects an active organization for multi-organization identities. However, the current mainline request path uses a shared pool and individual queries; there is no universal same-client transaction wrapper carrying authenticated context through all protected reads/writes.

Required target sequence:
1. Authenticate the opaque bearer session through a narrowly privileged auth path.
2. Revalidate identity status, session state, verified membership and selected organization.
3. Acquire a dedicated non-owner, `NOBYPASSRLS` runtime database connection.
4. Begin a transaction and set a short-lived, signed request-context assertion transaction-locally.
5. Execute every protected query on that same transaction/client; never fall back to an unscoped pool.
6. Commit on success, rollback on error, and release the client.
7. Give workers and system jobs separate least-privilege identities and explicitly scoped service context.

The signed-context/auth-bootstrap work in PR #192 and dependent branches must be reviewed as one dependency chain before any RLS activation. Do not enable broad policies or rely on caller-settable custom GUC values as a cryptographic boundary.

### 4.2 Table policy model

Use the existing 67-table access classification from PR #189 and the detailed RLS design in PR #198 as the starting point, subject to current catalog revalidation. Classify each table as direct organization-owned, child/inherited, bilateral/multiparty, global reference, identity/auth secret, device principal, worker/control plane, or append-only audit. Every table needs an explicit reader/writer/service matrix and adversarial tests. A generic `organization_id` policy is not sufficient for inherited and multiparty tables.

### 4.3 Migration and database authority

Preserve the sole identified production Neon primary and data-bearing staging branch. The four staging-only migration sources and production historical migration 096 require exact provenance and compatibility review. The recovered 096 source is evidence-only; do not place it in the executable migration directory or replay it. No production migration, role change, RLS activation, branch promotion, reset, or deletion is authorized by this assessment.

### 4.4 Evidence and registry semantics

The source already prevents acceptance fixtures from backing value-bearing credentials and requires Guardian VERIFIED, Hedera CONSENSUS_CONFIRMED and persisted Mirror Node verification before issuance. This is a strong fail-closed design. It does not prove the provider rail has succeeded in the live production environment, that source observations are factually true, or that a statutory registry has issued/accepted a credit. Keep integrity, source authenticity, independent verification and regulatory approval as separate claims.

## 5. Prioritised coherent implementation batches

These batches are ordered by dependency. Continue safe work in parallel only where the dependency boundary is explicit.

### Batch A — Canonical identity and request-scoped database context (P0)
- Reconcile PR #192 with #213, #216 and #218 and the current mainline; resolve all route/worker consumers.
- Establish dedicated auth, runtime, owner and migrator role contracts. Verify actual Neon role flags and memberships on a disposable clone.
- Implement one request-scoped transaction/context adapter with signed, expiring context and transaction-local propagation.
- Migrate protected routes to the adapter in coherent domain batches; fail closed on missing context.
- Add tests for missing/malformed/expired/replayed context, revoked membership, organization switching, pooled-connection reuse, rollback, and cross-tenant reads/writes.
- Acceptance: no protected request path can silently query via an unscoped pool.

### Batch B — Table-by-table RLS policy and privilege rollout (P0)
- Revalidate production table inventory and role state read-only; reconcile the 67-table classification with all migrations and newer tables.
- Design per-class policies and composite tenant-consistency constraints; separate global reference/control-plane policies.
- Rehearse ownership and grants on a fresh disposable clone with realistic data fixtures.
- Enable and FORCE RLS only after runtime-role separation, policy review and transaction-context tests pass.
- Acceptance: every tenant-facing table has an explicit policy and positive/negative tests; runtime role is non-owner and NOBYPASSRLS; zero cross-tenant leakage under API, worker, sync, export and background-job paths.

### Batch C — Open interoperability and ecosystem contracts (P1)
- Generate and maintain OpenAPI for all public / partner API routes.
- Publish versioned JSON Schemas/data dictionaries for organizations, facilities, activities, material flows, measurements, evidence, credentials and verification status.
- Specify identifier ownership, source-of-truth semantics, idempotency, pagination, error model, rate limits, deprecation and data export.
- Build contract/conformance tests and a mock independent participant implementation.
- Acceptance: a separately implemented client can complete an authorised end-to-end exchange without private database access or undocumented assumptions.

### Batch D — Trust, provenance and MRV assurance (P1)
- Trace evidence from field/device/operator through activity, measurement, evidence, independent review, methodology, Guardian, HCS, Mirror Node and credential.
- Verify signing/key custody, rotation/revocation and issuer authority; document what each cryptographic proof does and does not prove.
- Exercise real production provider integrations with approved credentials and a real authorised pilot record; preserve exact provider receipts and read-back evidence.
- Independently reconcile calculations and confirm regulatory/voluntary methodology boundaries.
- Acceptance: reproducible evidence package, independent verification and exact external acceptance receipts; synthetic fixtures remain ineligible.

### Batch E — Field inclusion and operations (P1)
- Test offline-first workflows, delayed/duplicate/replayed envelopes, conflict resolution, device revocation and recovery.
- Run field usability/accessibility tests with representative users and local-language/assisted alternatives.
- Execute backup restore, disaster recovery, incident, credential rotation and rollback rehearsals.
- Verify data export and exit from hosting/provider dependencies.
- Acceptance: measured recovery and field acceptance evidence, accountable operators, and approved operating runbooks.

### Batch F — Independent assurance and release decision (P0/P1)
- Independent application/database security review and privacy review as applicable.
- Independent methodology/MRV review and field/site acceptance.
- Close all production gate blockers, statutory approvals and official API authorisations.
- Re-run the full combined suite on the exact final commit and record test/deployment evidence.
- Acceptance: every applicable Shakti and R-DPI gate PASS for the precisely defined release scope. Otherwise retain HOLD.

## 6. Active branch/PR integration order — do not merge out of sequence

The live PR graph is stacked. Preserve dependencies and validate exact heads:
- #192 auth/bootstrap integration is the base dependency for tenant-aware application routes.
- #213 EPR explicit-client route is based on the auth-bootstrap branch.
- #216 verifier identity/tenant hardening is based on the EPR security base.
- #218 signed tenant-context MRV reads is based on verifier identity hardening.
- #219 pilot walkthrough integration is based on #218.
- #198 RLS design is a separate main-based design PR; do not convert its design into production DDL until Batch A and B prerequisites pass.
- #188 Neon reconciliation and #221 historical migration recovery are evidence inputs, not authorization to mutate database branches or replay historical SQL.
- #204 execution reconciliation is a checkpoint and must be refreshed as PRs/CI/Neon evidence change.

Before integrating any stacked branch, verify its current base/head, exact-head CI, file overlap and database contract. Do not merge dependent PRs independently into main if doing so breaks their tested ancestry. Use a single reviewed integration sequence or rebase/retarget with exact-head CI.

## 7. Immediate next actions

1. Refresh the full mainline and stacked PR dependency graph and exact-head CI results.
2. Read and reconcile the complete PR #192 signed-context/auth-bootstrap diff with PRs #213, #216 and #218.
3. Revalidate the production Neon role/table baseline read-only and identify whether current Render runtime still connects as the overprivileged role.
4. Complete a disposable-clone integration rehearsal for the request-context adapter before authoring any RLS activation migration.
5. Build the full per-table policy/test matrix from the 67-table classification and current catalog.
6. Keep production schema/roles/branch and staging data unchanged until the required evidence and explicit release authority exist.

## 8. Evidence and authority register

- Mainline API contract: `docs/API.md`.
- Registry rules: `docs/REGISTRY.md`.
- Evidence vault scope and limits: `docs/MRV_EVIDENCE_VAULT.md`.
- Current Shakti production gate: `docs/SHAKTI_PRODUCTION_GATE_RUPAYKG.md`.
- Production tenant-isolation/RLS design: PR #198, `docs/engineering/assurance/2026-11-01-production-tenant-isolation-rls-design.md`.
- 67-table access classification and tenant isolation architecture: PR #189, `docs/security/TENANT_67_TABLE_ACCESS_CLASSIFICATION_2026-11-01.md` and `docs/security/TENANT_ISOLATION_ARCHITECTURE_AND_ROLLOUT_2026-11-01.md`.
- Neon production/staging reconciliation: PR #188, `docs/engineering/checkpoints/2026-11-01-neon-branch-reconciliation.md`.
- Live execution reconciliation: PR #204, `docs/engineering/checkpoints/2026-11-02-parallel-execution-live-reconciliation.md`.
- Recovered historical migration 096 provenance: PR #221, `docs/evidence/RECOVERED_096_VERIFICATION_AUTHORIZATION_PROVENANCE.md`.

**Authority boundary:** this is an internal engineering assessment. CDPI is a contextual architecture reference, not a regulator or certification authority. This assessment does not designate RupayKg as DPI, establish legal compliance, grant official API access, certify carbon outcomes, authorise production database changes, or approve a live release.


## 9. Additional 2026-11-03 security evidence — assessment refinement

A subsequent read-only audit package on the stacked verifier-hardening branch `shakti/verifier-identity-tenant-hardening-2026-11-02` provides more granular evidence. These findings are not merged into mainline and are recorded as audit inputs, not as completed controls:

1. **RLS remains 0/67:** the 2026-11-03 production policy-design inventory again reports 67 public application tables, zero RLS and zero FORCE RLS. The application login `rupaykg` retains BYPASSRLS, CREATEDB, CREATEROLE, REPLICATION and INHERIT. It also reports 67 public trigger functions without pinned `search_path`. Do not apply candidate role/function migrations to production before role, caller, trigger and rollback rehearsals.
2. **Request transaction adoption remains incomplete:** a static scan of 16 route/auth modules found `withRlsRequestTransaction` in only `mrv-routes.ts` and `epr-return-read-route.ts`; server root routes and the other modules remain outside the wrapper or only partially adopted. This is a source scan, not runtime proof, but it is sufficient to block RLS enablement.
3. **MRV worker is a distinct trust boundary:** its runtime design claims a non-bypass role and RLS/FORCE RLS checks, but the recorded production catalog lacks `mrv_submission_jobs` and `mrv_submission_job_events`. The worker's broad cross-tenant queue discovery cannot safely inherit a normal single-tenant request policy. It needs narrowly scoped queue-claim, live-lease job authorization, state-transition and provenance-finalization capabilities; do not grant broad tenant-table SELECT to make it work.
4. **Callable database functions need explicit review:** the production audit reports 11 ordinary application-owned public functions as SECURITY INVOKER, without pinned `search_path`, and with PUBLIC EXECUTE at audit time. Some are nested in triggers; others contain legacy role-name fallbacks or mutate EPR allocations without explicit actor authorization. Do not blanket-revoke EXECUTE or blanket-pin/apply function changes without mapping direct and nested callers, exact signatures, trigger execution semantics and per-role grants.
5. **Migration 096 remains a historical exception:** recovered SQL is preserved in evidence-only form and is not an executable migration. Production ledger records it applied. Keep the source under `docs/evidence/`; never replay or rewrite production history.
6. **Stacked PR ancestry must be preserved:** PR #213 is based on an earlier auth-bootstrap branch head, #216 is based on an EPR security base, #218 is based on #216, and #219 is based on #218. PR #192's current head is not automatically the tested base of every dependent PR. Reconcile exact base/head SHAs and exact-head CI before integration; a clean mergeability flag is not proof of correct dependency ancestry.

### Revised gate disposition

- R-DPI-03 remains **FAIL / P0**; the route-wrapper coverage and database role evidence make the gap more specific.
- R-DPI-05 remains **PARTIAL / HOLD**; the MRV worker needs a separate least-privilege job capability model and production schema parity.
- R-DPI-08 remains **PARTIAL**; database function and trigger hardening, recovery and operational evidence remain open.
- R-DPI-09 remains **FAIL / P1**; the cited audits are engineering reviews, not independent assurance.
- R-DPI-10 remains **HOLD**.

### Immediate implementation sequencing correction

The next engineering batch must not begin by writing or enabling broad RLS policies. First complete a single integrated route-to-database access inventory across every API route, worker, trigger, function, scheduler and external callback. Then converge authentication and signed context, role separation, callable-function privileges, and worker capabilities in disposable PostgreSQL. Only after this combined contract passes adversarial integration tests should table policies be finalized and rehearsed. Production remains unchanged.



## 10. Source-level recheck of signed transaction adoption

A direct re-fetch of `apps/src/value-routes.ts` at the current PR #216 head (`8693239b28587fb61e0f61c2f2d021b97f073fba`) found:
- imports `withRlsRequestTransaction`;
- contains ten references to the wrapper;
- registers nine carbon/EPR/ESG/BWG workspace handlers;
- its helper functions accept a `Pool | PoolClient` and are called with the checked-out `client` from the wrapped handler paths.

This is inconsistent with the PR #216 branch's earlier static route-coverage document, which listed `value-routes.ts` among modules without wrapper adoption. The current source inspection supersedes that specific module-level statement; the audit document must be refreshed rather than repeating a stale count.

This does **not** establish that the entire application is covered. `workspace-routes.ts` and `bwg-routes.ts` still show direct pool-based authorization/data queries in the inspected branch; other modules in the route inventory remain to be rechecked individually. The wrapper also intentionally rejects bilateral operations and requires one active verified organization, so registry transfers, settlements, regulator authority and cross-tenant workers need distinct contexts rather than forced reuse.

**Revised interpretation:** transaction-boundary adoption is progressing in selected modules, but is not application-wide. Keep R-DPI-03 FAIL until every tenant-data path and worker/trigger/function path has a tested context/policy contract and the production role/RLS prerequisites are satisfied.


## 11. Direct production Neon re-verification — 2026-11-03

A fresh read-only SQL inspection was executed against the previously identified authoritative Neon target: project `steep-mud-79906940`, production primary branch `br-restless-base-b44cip2h`, database `rupaykg`. The query used catalog metadata and aggregate counts only; no DDL, DML, role change, secret read, or deployment was performed.

Observed results:
- `current_database()` = `rupaykg`; `current_user` = `rupaykg`.
- 67 public ordinary tables; 0 RLS enabled; 0 FORCE RLS.
- All inspected public tables are owned by `rupaykg`.
- Runtime login `rupaykg`: LOGIN=true, BYPASSRLS=true, CREATEDB=true, CREATEROLE=true, REPLICATION=true, INHERIT=true, SUPERUSER=false.
- 115 public-schema functions; 78 owned by `rupaykg`; 115 SECURITY INVOKER; 115 without a pinned `search_path`; 115 expose PUBLIC EXECUTE under the inspected ACL/default-privilege calculation; 67 are trigger functions.
- `mrv_submission_jobs` and `mrv_submission_job_events` do not exist in this production database.
- `schema_migrations`: 92 rows; maximum recorded version `20261021`.

Interpretation:
- R-DPI-03 is confirmed **FAIL / P0** by fresh live catalog evidence, not merely a prior report.
- Function/trigger exposure requires a per-function and per-trigger caller/privilege/search-path inventory. Do not blanket-revoke PUBLIC EXECUTE or apply broad function changes; some functions are trigger dependencies.
- The production MRV worker's required queue tables are absent, so worker activation or deployment against this schema must remain blocked until an approved, separately rehearsed migration/data contract exists.
- The exact production runtime is still using the elevated `rupaykg` login in this inspected Neon connection. The Render service's live connection identity must be correlated to this database evidence before any role cutover; do not assume a replacement runtime is active.
- No role provisioning, migration, RLS activation, worker activation, or production deployment is authorised by this read-only audit.

This live check supersedes any stale statement that the role/table baseline has not been refreshed since 2026-11-01. It does not resolve the production release hold.


## 12. Parallel branch and exact-head CI reconciliation — 2026-11-03 09:03 UTC

The live PR graph and exact-head Actions runs were rechecked after the production audit. All statuses below refer to the recorded commit SHA, not to a broad branch label:

| PR | Exact head | CI evidence | Disposition |
|---|---|---|---|
| #192 auth/bootstrap | `070c2f9982406b91c8fe7b6354044c1def1467ae` | Run #5046 succeeded | Foundation candidate; draft/unmerged |
| #213 EPR explicit-client route | `41db6489aa2cf92fc0dec6e452e097e264ff76fb` | Run #5110 succeeded | Candidate canonical EPR stack; overlaps #228; draft/unmerged |
| #216 verifier identity | `8693239b28587fb61e0f61c2f2d021b97f073fba` | Prior evidence only; refresh exact head before integration | Base for #218 and #228; draft/unmerged |
| #218 MRV workspace signed tenant read | `31eba17c130481b7447851035e4dcd01d2cb115c` | Run #4990 succeeded | Source change passes CI, but adversarial matrix is a test contract only; no executable endpoint tests were added in this PR; draft/unmerged |
| #219 pilot UI integration | `c3ba46485bb2c2352ed3fc93097d470ca92d430f` | Run #4989 succeeded | Recorded base SHA `337bc5cc6abbf09acdc786c7c37ab7b4d1a57eb6` differs from current #218 head; rebase/reconcile ancestry and rerun exact-head tests; draft/unmerged |
| #227 DPI assessment | `8c33c1bc524505ada75cbf02920ca0c852966eaa` | Run #5103 succeeded | Documentation-only evidence; draft/unmerged |
| #228 EPR obligations read | `550ea742fc663e6f0684a46427dfc314b1bf002c` | Run #5104 failed 1 of 191 API integration tests | Six EPR route tests passed; Evidence Vault version-list test failed (expected 2 artifacts, received 1); draft/unmerged |

### EPR route overlap — integration decision

PR #213 and PR #228 both modify `apps/src/bwg-routes.ts` and implement `GET /api/v1/epr/obligations` using the signed explicit-client transaction boundary. They must not be merged independently. PR #213 additionally carries the read-only EPR returns route, startup contract, and candidate read-only EPR RLS migration. PR #228 adds valuable explicit bilateral-scope rejection, multi-organization ambiguity tests, missing-context tests, and rollback assertions. Reconcile those improvements into one canonical branch after verifying the exact auth foundation; retain only one route registration and one source of truth.

The #228 failure is in the existing Evidence Vault integration assertion at `apps/dist/src/evidence-vault.integration.test.js:69`: expected artifact list length 2, actual 1 after a second upload reported version number 2. This is not an EPR test failure. Root cause remains unresolved; do not weaken the assertion or claim a green full suite. Compare the second upload's returned evidence ID/series ID, persisted artifact rows, and the listing query under the same disposable PostgreSQL fixture to identify whether the defect is persistence, trigger/policy visibility, or query behavior.

### MRV acceptance evidence boundary

PR #218 adds `docs/security/2026-11-03-mrv-workspace-adversarial-acceptance-matrix.md`, whose status is explicitly REQUIRED / NOT YET EXECUTED. The PR changes the MRV route but adds no executable route test file. Its successful CI is not evidence of two-tenant route isolation. Add executable Fastify tests and disposable PostgreSQL acceptance for same-client authorization/reads, A/B tenant separation, foreign-geography denial, missing context/active organization/permission, and rollback on query/context failure. The current denial branches return ordinary callback values, which commit the transaction; if rollback is the intended contract, use a typed thrown denial and catch it after the wrapper rolls back. Explicitly decide and test bilateral-organization behavior.

### Integration rule

Do not merge overlapping PRs or repair ancestry by blind retargeting. Preserve the reviewed dependency order, reconcile overlapping files, rerun exact-head CI on the final combined commits, and keep all production database/role/secret/deployment state unchanged until disposable integration and independent assurance pass.


## 13. MRV route implementation and refreshed parallel branch state — 2026-11-03 09:16 UTC

### PR #218 — MRV signed workspace read

Current head: `feeac1de3325a831012e1dc4967dfe95f9914e6d`.

Changes now present on the branch:
- `GET /api/v1/workspaces/mrv` requires signed tenant context and one resolver-verified active organization.
- Permission and requested-geography checks execute on the same transaction client as the four protected reads.
- Permission/geography denials throw typed errors so `withRlsRequestTransaction` rolls back before the API returns 403.
- Geography authorization no longer directly reads `organization_memberships`; it relies on the resolver-validated VERIFIED active membership and calls `organization_has_geography_scope(activeOrganizationId, geographyId)`.
- Six executable Fastify route tests cover same-client transaction use, signed context, tenant-bound query parameters, permission/geography denial rollback, missing context, missing active organization, and protected-read failure.

Exact-head CI run #41609506785 completed **SUCCESS** on this commit, including migration validation, restricted verifier-owner provisioning/rehearsal, typecheck, build, browser smoke, API tests, and production-container build. The previous run #41609228776 exposed test-fixture defects (token regex escaping and mock query ordering); those were corrected without weakening the assertions.

**Evidence limitation:** the six route tests use a mocked Pool/PoolClient. They are not the required two-tenant disposable-PostgreSQL test under the exact NOBYPASSRLS runtime role, and do not establish database-enforced tenant isolation. The same module still contains `POST /api/v1/evidence/:evidenceId/verification` using a raw client transaction without signed tenant context. That adjacent MRV mutation route remains an explicit follow-up. PR #218 stays draft/unmerged.

### Refreshed exact-head branch reconciliation

| PR | Current exact head | Latest evidence | Disposition |
|---|---|---|---|
| #213 EPR explicit-client route | `fecef5f5aad41e13eadb29293cbbb413c882318e` | CI run #41608135173 succeeded | Candidate only; add explicit bilateral-scope 403 behavior and preserve #228 multi-org tests; draft/unmerged |
| #218 MRV signed workspace read | `feeac1de3325a831012e1dc4967dfe95f9914e6d` | CI run #41609506785 succeeded | Draft/unmerged; PostgreSQL/RLS acceptance and adjacent mutation route remain open |
| #219 pilot UI integration | `c3ba46485bb2c2352ed3fc93097d470ca92d430f` | Compared with current #218: diverged; #219 is 8 commits ahead and 9 commits behind; merge base `337bc5cc6abbf09acdc786c7c37ab7b4d1a57eb6` | Reconcile/rebase onto latest #218 only after its CI passes; do not blindly retarget; draft/unmerged |
| #228 EPR obligations read | `550ea742fc663e6f0684a46427dfc314b1bf002c` | CI run #41606578847 failed in Evidence Vault integration: expected 2 artifacts, received 1 after upload #2 reported version 2 | Root cause unresolved; diagnostic request posted; do not weaken assertion; draft/unmerged |
| #227 DPI assessment | documentation branch | Prior docs-only update | Draft/unmerged |

### Release decision

No merge, production migration, role/secret provisioning, RLS activation, worker activation, feature activation, or deployment is authorised by this work. The current code changes improve route-level controls but do not change the production tenant-isolation finding: R-DPI-03 remains FAIL / P0, independent assurance remains open, and release readiness remains HOLD. The remaining direct-query routes, including the MRV verification mutation, must be covered by the full route-to-data inventory and exact-role two-tenant acceptance before any TRL 9 or production claim.
