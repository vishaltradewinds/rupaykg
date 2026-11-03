# RupayKg Master Claim & Evidence Register — First Pass

**Assessment date:** 2026-11-03  
**Repository:** `vishaltradewinds/rupaykg`  
**Baseline ref:** `main`  
**Baseline commit recorded by the controlling charter PR:** `a3fecc0abd2c46549a201058d3963afc0e3a73c9`  
**Status:** Initial documentation/configuration reconciliation only; not a complete code, CI, deployment, legal or field audit.

This register records only facts directly observed in repository files during this pass. It does not infer runtime behavior from documentation. All implementation claims require code-path inspection and reproducible tests at an exact commit.

## 1. Initial claim register

| Claim ID | White-paper area | Claim / observed fact | Current state | Evidence inspected | Gap / next acceptance action |
|---|---|---|---|---|---|
| RK-001 | Positioning | Repository README positions RupayKg as a nationwide circular-economy platform covering resource flows, MRV, carbon accounting, EPR, ESG, credentials, registry operations and governed settlement. | Specified (README statement only) | `README.md` at main, blob `76f91ecdab35b055ffa09f049fd51a7f4fa924c4` | Product/module and user-journey audit required; README is not proof that every capability is implemented or operational. |
| RK-002 | Architecture | Repository is an npm workspace monorepo with web, API and domain-oriented packages and build/typecheck/test/migration scripts. | Specified | `package.json` at main, blob `cb98f9ae776cb16d6f0e34398a76aedc5f955a86` | Inspect package manifests, dependency graph, runtime entrypoints, API routes and tests; run commands on exact head. |
| RK-003 | Authentication | Authentication documentation specifies Firebase Authentication, verified Firebase ID-token exchange and Firebase project variables. However, current inspected web sign-in calls `/api/v1/auth/register` and `/api/v1/auth/login`; backend routes create native PostgreSQL identities/password credentials and opaque sessions. | Source implementation observed; documentation contradictory | `docs/AUTHENTICATION.md` blob `c8c32fff1decaa94caa3ff76547728b075657bfa`; `apps/src/auth-routes.ts` blob `95860bba8cc6c74367478c699e35d9e5494fcca4`; `apps/src/auth.ts` blob `49a16d3c0ac7399c8a677b6530f0c6ab72e9b8c3`; `apps/web/src/main.tsx` blob `a9cd8da0631b00096645e71be2953e58f7898a96` | Trace all auth entrypoints and tests; resolve stale docs and Firebase build requirements. Confirm no hidden Firebase auth flow exists. |
| RK-004 | Authentication | Environment example states native PostgreSQL-backed authentication and no third-party identity-provider configuration is required; inspected `apps/src/auth-routes.ts` implements password hashing with scrypt, database-backed opaque sessions, and login/register routes. | Implemented in inspected source; end-to-end tests not yet run | `.env.example` blob `2b836da780eba8d178b5def8719f1cee284d63ed`; `apps/src/auth-routes.ts` blob `95860bba8cc6c74367478c699e35d9e5494fcca4`; `apps/src/auth.ts` blob `49a16d3c0ac7399c8a677b6530f0c6ab72e9b8c3` | Verify auth route tests, rate limiting/lockout, password reset/recovery, session expiry/revocation and cross-tenant authorization. Firebase references in docs/cloudbuild must be reviewed before removing or retaining. |
| RK-005 | Deployment | Cloud Run contract specifies Firebase web configuration at build time, PostgreSQL runtime configuration, Secret Manager and an acceptance sequence. The document explicitly says it is a specification, not a deployment record. | Specified | `docs/CLOUD_RUN_PRODUCTION_CONTRACT.md`, blob `9dc57a17250c93a576bfbb2e7748b6f492439dad` | Verify Dockerfile, cloudbuild, actual GCP resources, image digest, revision, runtime health and exact-head acceptance. No deployment claim accepted from this document. |
| RK-006 | Engineering status | Build-state document describes migrations 001–008 and multiple domain/API capabilities, but is dated 2026-09-02 and lists remaining work. | Historical statement; stale until revalidated | `docs/BUILD-STATE.md`, blob `c062b71b5d58724c4a554ffadbae8d3e1b10c54b` | Reconcile every listed capability against current migrations, code, tests and exact-head CI. Do not use as current completion evidence. |
| RK-007 | Carbon MRV | Carbon methodology implementation standard documents a source lock for BEE BM WA03.001 v1.0 and a fail-closed applicability/input-validation boundary; it explicitly leaves additionality, baseline methane potential, monitoring acceptance, calibration and regulatory approval unresolved. | Specified; partial implementation asserted by document, code not yet inspected | `docs/CARBON_METHODOLOGY_IMPLEMENTATION_STANDARD.md`, blob `80d651af8ebe3dd74c0507f528ff3f891abafcbd` | Inspect exact code/tests and retrieve/re-hash official source artifact. Independently review methodology transcription and test vectors. |
| RK-008 | CCTS registry | CCTS methodology document explicitly labels the registry foundation as registry-only; 12 methodologies and 17 tools are a dated BEE register snapshot, not proof of adapter implementation, project eligibility or issuance. | Specified; registry-only boundary | `docs/CCTS_METHODOLOGY_REGISTRY_FOUNDATION.md`, blob `07970aa3f7eef87ba2b308eda566d57d28f061d3` | Recheck current official BEE register; inspect registry code/tests; keep adapters, eligibility, validation and issuance separate. |
| RK-009 | SWM 2026 | CPCB SWM 2026 mapping labels itself architecture/design proposal only and states RupayKg does not issue official EBWGR certificates or assume a public API. | Specified; proposal | `docs/CPCB_SWMP_2026_MRV_MAPPING.md`, blob `3bf298c013ad78d17fc0a9a8344e99e510473556` | Legal review against current Gazette/CPCB primary sources; confirm amendments and jurisdictional rules; obtain written integration authorization before any portal automation. |
| RK-010 | Guardian/HCS | Environment example contains placeholder Guardian endpoint/policy values and Hedera testnet/topic/operator placeholders; it says HCS writes are fail-closed until real values exist. | Configuration template only; not operational evidence | `.env.example`, blob `2b836da780eba8d178b5def8719f1cee284d63ed` | Inspect adapter code and tests; verify deployed Guardian endpoint, policy execution, real HCS transaction receipt/consensus and independent verification. |
| RK-011 | Jabalpur pilot | The controlling charter and project baseline identify SITE-JBP-01 as a pre-validation target; no site permission, baseline, operational record or independent field evidence was inspected in this pass. | Proposed / pre-validation | Master positioning charter PR #240; project execution baseline supplied 2026-11-03 | Obtain written access/permissions, operational boundary, source records, instrument calibration, measurement plan, data-sharing basis and independent reviewer evidence. |
| RK-012 | TRL 9 | No evidence of sustained operation in the intended real-world environment or independent TRL 9 assessment was inspected in this pass. | Objective; not achieved on evidence reviewed | Master positioning charter PR #240; `docs/CLOUD_RUN_PRODUCTION_CONTRACT.md` | Build a traceable assurance case with field operation, performance, resilience, security, validated interfaces and independent assessment. |
| RK-013 | Authentication implementation | Current inspected web/API source implements native PostgreSQL-backed credentials and opaque sessions; production config requires `RUPAYKG_AUTH_MODE=real`. | Implemented in inspected source; exact-head automated auth acceptance not established | `apps/web/src/main.tsx` blob `a9cd8da0631b00096645e71be2953e58f7898a96`; `apps/src/auth-routes.ts` blob `95860bba8cc6c74367478c699e35d9e5494fcca4`; `apps/src/auth.ts` blob `49a16d3c0ac7399c8a677b6530f0c6ab72e9b8c3`; `apps/src/production-config.ts` blob `21b386d95e88babd6708f522a9ea1aff33d9ea8f` | Complete test inventory and run registration/login/lockout/session expiry/revocation/organisation-scope tests; reconcile Firebase docs and Cloud Build variables. |
| RK-014 | Evidence vault | Source includes scoped upload/list/download/review routes, SHA-256 integrity checks, versioned artifact storage, uploader self-review rejection and immutable final review state. | Implemented in inspected source; integration test exists but is opt-in and run status unknown | `apps/src/evidence-vault-routes.ts` blob `797f9ff77e8442d3752c20bc1698b400777c8ea3`; `apps/src/evidence-vault.integration.test.ts` blob `7f905cc97f10f42339bf0f5baef4b3d855563782`; `apps/src/evidence-vault-routes.test.ts` blob `88ba82d86c13dc0aa3f955c92b1a0956ad2e92ae` | CI workflow config provisions PostgreSQL, migrates, enables `RUPAYKG_RUN_DB_INTEGRATION_TESTS=1` and runs `npm test`; no run result is available for this PR head. Verify latest exact-head run and expand mutation/write-path coverage and independent-review concurrency tests. |

## 2. Material inconsistency — authentication source of truth

The repository currently contains a stronger source/documentation mismatch:

1. `docs/AUTHENTICATION.md` says Firebase Authentication is the identity provider and specifies Firebase web/API variables.
2. `.env.example` says native PostgreSQL-backed authentication is used and no third-party identity provider is required.
3. `docs/CLOUD_RUN_PRODUCTION_CONTRACT.md` requires Firebase web configuration at build time.

**Disposition: OPEN / BLOCKING — likely stale Firebase documentation/build configuration, but not yet authorized for cleanup.** The inspected current web and API source point to native PostgreSQL authentication. The Cloud Build pipeline still requires Firebase variables. Confirm the complete codebase and tests, then update the obsolete docs/build validators in a dedicated change. Do not change production configuration or remove an auth provider based only on this partial source trace.

Required resolution record:
- complete auth entrypoints and provider SDK usage across all packages;
- API token verification and session creation/refresh/revocation paths;
- all auth-related environment variables read by source;
- CI and production build requirements;
- migration/schema dependencies;
- positive, negative, expiry, revocation and cross-organisation authorization tests;
- one approved architecture decision and synchronized docs/config.

## 3. Immediate work queue

| Priority | Work item | Acceptance evidence |
|---|---|---|
| P0 | Resolve authentication architecture conflict (RK-003/004/005/013). | Complete dependency trace, approved ADR, synchronized docs/build, passing auth acceptance tests and exact-head CI. Provisional ADR added at `docs/AUTHENTICATION_ARCHITECTURE_DECISION.md`; not approved for production changes. |
| P0 | Reconcile authoritative database, migrations and tenant isolation. | One declared production database topology; migration inventory; RLS/policy/role audit; protected route read/write matrix; negative cross-tenant tests. |
| P0 | Complete evidence-vault and independent-review write-path audit (RK-014). | Existing source has scoped routes and an opt-in DB integration test; obtain exact CI execution evidence, review transaction isolation/concurrency, ownership and reviewer separation. |
| P1 | Verify deterministic MRV and methodology registry. | Source-locked methods, reviewed equations, test vectors, reproducible calculations, uncertainty and versioning. |
| P1 | Validate statutory mappings. | Current official primary sources, exact provisions/effective dates/applicability, qualified legal review. |
| P1 | Verify Guardian/HCS and W3C VC. | Real endpoint/policy evidence, asymmetric signature verification, HCS transaction and consensus receipt, credential status/revocation checks. |
| P1 | Verify IoT/weighbridge chain. | Device identity, calibration, raw measurement, timestamp/provenance, offline/idempotency and field acceptance tests. |
| P2 | Establish SITE-JBP-01 field validation. | Permissions, boundaries, baseline, source measurements, reconciliations, independent review and operating results. |
| P2 | Compile TRL 9 assurance dossier. | Traceability from requirements to sustained real-world performance and independent assessment. |

## 4. Rules for continuing this register

- Every new claim must cite an exact repository path and commit/blob, test run, official source or field record as applicable.
- Record contradictory evidence; do not silently choose one version.
- Do not equate code presence with tested, integrated, validated or operational status.
- Do not enable global RLS, change production auth/database settings, deploy, issue credentials or promote production certification as part of a documentation-only reconciliation.
- Keep the pan-India objective and organisation-scoped execution model.
- Keep the Jabalpur site at pre-validation until field evidence exists.
- Reconcile the register at each material commit and before any external white-paper publication.

**Current assessment:** The repository has substantial documented architecture and standards work, but this first pass is not a complete source-code audit. Native PostgreSQL authentication and the evidence-vault route implementation are directly visible in source. Firebase authentication documentation and build-time requirements conflict with the inspected native auth path. A provisional ADR now records the evidence and safe disposition. Evidence-vault integration test is opt-in but the CI workflow explicitly enables it; no exact-head run result is available for this PR head. Do not remove Firebase build requirements, change production auth/database settings, or enable RLS globally until the complete dependency trace and acceptance evidence are available. All other capability states remain limited to the evidence explicitly described above.


## 5. Supplemental repository and CI reconciliation — 2026-11-03

### Exact-head CI result — RK-014 / PR #241

GitHub Actions CI run [#5208](https://github.com/vishaltradewinds/rupaykg/actions/runs/41679358836) completed with conclusion **SUCCESS** on the exact PR #241 head `650ed37db50739924a383ccae756d92daef52d84`. The single `validate` job passed dependency installation, production dependency audit, migration validation, disposable PostgreSQL migration execution, TypeScript typecheck, production build, browser smoke test, automated tests including disposable PostgreSQL acceptance, production-container build and cleanup.

This is exact-head engineering CI evidence for the documentation PR. It does not prove deployed database state, production security, regulatory approval, pilot operation or TRL 9. PR #241 remains open and draft.

### Authentication test inventory correction

The first-pass ADR incorrectly stated that no auth-specific automated test file was found in the inspected `apps/src` inventory without acknowledging the separate `apps/test` directory. The repository tree contains `apps/test/auth-permissions.test.ts` (blob `c6478885319771e82e55f826e99ac4da0403ef48`). It tests the high-risk permission allow-list, database-backed role permission evaluation, active-organization/target-organization matching and fail-closed behavior when permission is absent.

This is meaningful authorization-policy unit coverage. It is **not** a full authentication lifecycle suite: it does not by itself establish registration/login, password lockout, session expiry/revocation, multi-membership selection, password recovery or full cross-tenant negative integration coverage. The precise gap is therefore "full auth lifecycle and route-level integration coverage not yet demonstrated", not "no auth-specific test exists".

### Migration and tenant-boundary sample

The repository tree contains migrations `001_core.sql` through `087_acceptance_fixture_registry_exclusion.sql`, plus dated migrations `20261018` through `20261021`; the README documents ordered migration ownership. This is a source-tree inventory, not proof of the production migration ledger or deployed schema.

The inspected migrations `004_security_auth.sql`, `012_geography_authorization.sql`, `030_authorization_role_defaults.sql`, `032_authorization_lifecycle_hardening.sql`, `033_field_sync_tenant_integrity.sql`, and `079_native_password_auth.sql` provide organization membership/session structures, geography-scope enforcement, role-permission defaults, authorization helpers/guards, field-device binding and native password credential storage. The inspected sample did not show `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY` or `CREATE POLICY`. This is not an exhaustive scan of every migration and does not establish that RLS is absent or present across the deployed database. Full policy/role audit and negative cross-tenant tests remain P0.

### MRV/EPR route boundary — preliminary source finding

The inspected `apps/src/mrv-routes.ts` and `apps/src/epr-return-routes.ts` authenticate a request, check organization membership/permission and then perform protected reads/writes using the shared `Pool` in multiple separate queries. The EPR submit/update paths do use explicit transactions and row locks for parts of the workflow, but the reviewed source does not establish that authentication, permission revalidation, target-row lock and mutation are consistently bound to one tenant-scoped transaction. The MRV provenance path similarly performs several pool-level reads before persistence.

Disposition: **P0 route-level transaction/authorization review required**, not a confirmed exploit. Build a per-route matrix for target organization, active organization, geography, permission, transaction boundary, row lock, and final mutation; then move sensitive write paths to a transaction that revalidates membership/permission and locks the authoritative target row before mutation. Add two-tenant negative tests and race tests before any RLS activation.

### Live authorization-provenance work — PR #238

PR #238 remains open and draft. Its current head `33d229181f3057158ab27c8fbf5de5fe2e9a3747` passed CI run [#5209](https://github.com/vishaltradewinds/rupaykg/actions/runs/41679597943), including disposable PostgreSQL tests for legacy authorization-snapshot rewrite, hostile search_path, and concurrent approval versus membership revocation, role permission changes and identity suspension.

However, PR #238 explicitly records unresolved production blockers: actual Render runtime database role is unidentified; read-only Neon inspection found elevated `rupaykg` and `neon_service` roles with BYPASSRLS and powerful privileges; least-privilege runtime role, production trigger execution context/grants/RLS, correction lineage and independent security review remain open. Its forward-fix SQL remains a disposable fixture, not a numbered migration. Do not merge/deploy or apply it to production on CI success alone.

### Updated disposition

- PR #241 exact-head CI: PASS; draft documentation PR.
- Authentication: native PostgreSQL implementation observed; Firebase docs/build mismatch remains unresolved; authorization-policy unit test exists; full lifecycle coverage not demonstrated.
- Migration/RLS: sampled migrations show database-level organization/geography guards; exhaustive RLS/policy and live role audit remains open.
- MRV/EPR: preliminary transaction-boundary/authorization revalidation gap requires route-by-route review.
- PR #238: exact-head disposable CI PASS; production least-privilege and independent review blockers remain.
- No live DB changes, RLS activation, auth/config edits, deployment, merge or certification were performed.
