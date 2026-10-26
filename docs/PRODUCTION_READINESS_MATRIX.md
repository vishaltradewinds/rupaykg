# RupayKG Production Readiness Matrix

This matrix converts the useful readiness discipline from the former AI Studio repository into the current canonical architecture.

## Status legend

- **GREEN** — implemented in the current repository and supported by tests or authoritative code controls.
- **AMBER** — implemented or structurally supported, but an external/configuration/runtime gate remains.
- **RED** — critical defect blocks the target.
- **NOT_IMPLEMENTED** — intentionally absent or not yet verified.

A status must never be inferred from legacy documentation alone.

## Current evidence snapshot

**Evidence snapshot: 2026-10-26.** The last known deployed `main` commit is `0ddcf6087620880e21ea60f954c9f05d6b759469` (2026-10-20). The live service currently returns HTTP 200 from `/health`, reports PostgreSQL as its source of truth and `syntheticData=false`, and returns HTTP 401 for the protected overview route without authentication. These checks establish reachability and fail-closed behavior only; they do not identify the exact database host or prove end-to-end operational acceptance. The current live responses also lack baseline browser security headers. PR #52 passed exact-head CI #2164 but is not merged/deployed. PR #53's production acceptance-seed isolation changes passed exact-head CI #2172 for head `10ca7d8b623b85fd0cd3340f956ae4b8f620de41`; PR #47's hardware register/site-evidence documentation passed exact-head CI #2193; PR #51's full hardware-approval/evidence-bound parameter stack passed exact-head CI #2199 for current head `f20a1d4ff85b324962607b450a9162816dc1e86c`; runtime-role least-privilege PR #55 passed exact-head CI #2184; focused migration-runner hardening PR #56 passed its prior exact-head CI #2182, and its latest credential-retention hardening passed exact-head CI #2188. All remain draft/unmerged/undeployed. CI evidence on a pull-request branch is not evidence that the same code is running in production.

| Domain | Current status | Acceptance evidence / remaining gate |
|---|---|---|
| Authoritative database target and runtime role | RED | The live API reports PostgreSQL, but the exact host/project/branch and runtime role are not authoritatively mapped. A Neon candidate shares all 26 live regulatory-source IDs, and its main branch has 91 migration rows last applied on 2026-10-18; Render logs on 2026-10-20 report the live app had 91 migrations current. This timing/schema match strongly supports the candidate but is not definitive host-level proof. Both checked Neon branches have zero rows in core operational tables. Their only listed role is `rupaykg`, with CREATEDB, CREATEROLE, REPLICATION and BYPASSRLS attributes; it is owner-level and must not be used as a production application runtime role. |
| Lifecycle state model | GREEN | Current target defines authoritative lifecycle and value gates; lifecycle integration tests execute in CI. |
| Organization authorization | GREEN | Verified membership required for protected organization operations; authorization tests pass. |
| Geography authorization | GREEN | Organization geography scope is checked server-side and exercised at runtime. |
| Field-device enrollment | GREEN | Device must be verified and bound to authorized identity/org; pending-device runtime acceptance passes. |
| Offline synchronization | GREEN | Envelopes carry identity, sequence/timestamp/idempotency data and are replay-aware; runtime replay and cross-identity rejection pass. |
| MRV measurements | GREEN | Measurement writes require authorized activity geography; lifecycle runtime acceptance passes. |
| Evidence | GREEN | Evidence requires activity linkage and content URI/hash; provenance is retained and independently verified. |
| Verification | GREEN | Verifier authorization, self-verification rejection and database permission guard are covered. |
| Carbon calculations | AMBER | Generic deterministic calculation is evidence-bound with dataset/formula/calculation hashes and mismatched-activity evidence fails closed at runtime; methodology-specific production eligibility and external acceptance remain gated. |
| Methodology governance | AMBER | Source lock, applicability/parameter/equation mappings, independent numerical-reconciliation evidence and independent regression evidence are database-enforced and tested; actual regulatory/production methodology approval remains external. |
| EPR/compliance | GREEN | Evidence/authorization controls are present in current value routes and tests. |
| ESG reporting | GREEN | Organization-scoped reporting path exists and is built in CI. |
| Credential issuance | GREEN | High-risk DB permission boundary prevents unauthorized registry issuance; HTTP runtime acceptance covers permission denial, issuance, activation and non-synthetic production response. |
| Credential transfer/retirement | GREEN | High-risk DB permission boundary applies to registry events; HTTP runtime acceptance covers denied transfer, governed transfer and retirement. |
| Registry auditability | GREEN | Registry events are protected as append-only/auditable state; runtime fixtures are isolated rather than deleting immutable events during teardown. |
| Settlement authorization | GREEN | Explicit high-risk settlement authorization is required and HTTP runtime acceptance covers the transition. |
| Settlement finalization | GREEN | External reference + confirmation + reconciliation are required by database controls and HTTP runtime acceptance; premature direct `SETTLED` transition is rejected. |
| Settlement evidence immutability | GREEN | Database guard and HTTP runtime acceptance prevent clearing/changing confirmation/reconciliation evidence. |
| AI/intelligence | GREEN | Advisory boundary; authoritative state is not delegated to AI and runtime acceptance verifies non-mutation. |
| UI truthfulness | GREEN | UI consumes backend-authorized data and distinguishes authoritative state; frontend production build/typecheck and smoke checks pass through the workspace test chain. |
| Regulatory source catalog | AMBER | Current catalog is PostgreSQL-backed and exact BEE source provenance corrections are recorded; maintained real regulatory/reference data still requires operational provisioning and ongoing verification. |
| External carbon-market submission | AMBER | Must remain manual/controlled until an official external interface is actually connected and tested. |
| Physical instrumentation | RED | Current deployed measurement intake does not require an approved instrument ID and parameter binding. PR #51 contains the full PR #49 hardware approval stack plus evidence-vault binding and exact instrument-bound parameter specifications; exact-head CI #2199 passed. PR #47's separate register/site-evidence documentation passed CI #2193. The changes remain draft/unmerged and no actual site instrument is certified. |
| External trust rails | NOT_VERIFIED | Legacy Hedera/VC capabilities are not assumed in the current repository without current implementation and live acceptance evidence. |
| Production identity/role provisioning | AMBER | Requires controlled deployment-time provisioning with real identities and explicit permissions. |
| Production PostgreSQL/TLS acceptance | RED | The service is reachable, but authoritative database mapping, runtime/migration role separation, and the actual target TLS chain are not verified. Focused PRs #55/#56 individually passed exact-head CI. Integrated draft PR #57 combines verified TLS, distinct migration identity, advisory locking/inventory preflight, runtime least-privilege checks, security headers, and production acceptance-seed isolation. The latest commit additionally permits the Node system trust store when no custom CA is provided, while retaining certificate/hostname verification. Exact-head CI #2230 passed for commit `5056debedc937143cd230f073cbad61f78873881`, including dependency audit, startup guard, migration validation/execution, typecheck, build, browser smoke, disposable PostgreSQL acceptance/concurrency tests, and production container build. PR #57 is not merged/deployed; the actual target host/roles and required credentials remain unmapped. Broad PR #46 remains draft. |
| Runtime CORS policy | GREEN | Production entrypoint validates HTTPS origins and the authoritative Fastify runtime uses the explicit allowlist; CI run #315 executes the HTTP runtime regression. |
| Production acceptance-fixture isolation | RED | The deployed Docker command and API start script invoke the acceptance-seed entrypoint. The script is opt-in, but the current production entrypoint does not itself forbid it if the opt-in environment variable is set. PR #53 removes the invocation and adds a production fail-closed guard; exact-head CI run #2172 for current head `10ca7d8b623b85fd0cd3340f956ae4b8f620de41` passed, but the PR remains draft/unmerged/undeployed. |
| Baseline browser security headers | RED | Live responses omit HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy and Permissions-Policy. PR #52 passed its reported exact-head CI but is not deployed. |
| Historical Render data recovery | NOT REQUIRED FOR CURRENT SCOPE | The user confirmed RupayKg is a new application not yet proven in a real operating environment. No irreplaceable real-world business records have been identified for recovery; do not incur billing to recover the suspended Render database. Reassess only if an inventory later identifies specific required records. |
| Backup/restore for selected runtime database | RED | Before real traffic, identify the actual database target and runtime role, create a permitted no-billing logical backup/export, and verify an isolated restore. The expiring Neon snapshot protects only an unconfirmed candidate, is not a verified production backup, and expires 2026-11-02. |
| Real-world pilot and methodology | RED | No real-site end-to-end acceptance has been demonstrated. The Kathonda WtE evidence does not establish active landfill-methane recovery under BM WA03.001; site boundary and methodology eligibility remain unverified. |
| Live endpoint verification | PARTIAL | Read-only checks on 2026-10-26: `/health`, `/api/v1/status`, and `/api/v1/regulatory/sources` returned HTTP 200; status reports PostgreSQL and `syntheticData=false`; 26 regulatory sources are returned. The live service still omits HSTS, `X-Content-Type-Options`, and `X-Frame-Options` response headers, confirming PR #57 is not deployed. Authenticated overview returns 401 without credentials, as expected. |\n| Render deployment/release | BLOCKED | Render currently serves the application, but release remains held until authoritative database identity, runtime least privilege, backup/restore for the selected target, startup safety, security headers, hardware/methodology and real-pilot acceptance gates pass. Historical Render-data recovery is not a current-scope requirement. A live service is not production certification. |

## Required production acceptance

Before declaring the platform production-ready, execute the following against the actual target environment:

1. Apply and validate all migrations on clean PostgreSQL.
2. Confirm readiness fails when authoritative PostgreSQL is unavailable.
3. Authenticate with a real provisioned identity and verified organization membership.
4. Confirm out-of-scope geography is rejected for reads and writes.
5. Confirm a pending field device cannot submit authoritative envelopes.
6. Confirm duplicate envelope replay is idempotent and cross-identity reuse is rejected.
7. Execute the activity → measurement → evidence → verification lifecycle.
8. Confirm carbon calculation rejects missing/mismatched evidence and records deterministic provenance hashes.
9. Confirm a methodology cannot be marked `PRODUCTION_ELIGIBLE` without source provenance, implementation mapping, independent numerical-reconciliation evidence and independent regression evidence required by database controls.
10. Confirm unauthorized registry issuance/transfer/retirement fails at the database boundary.
11. Confirm settlement cannot reach `SETTLED` without external confirmation and reconciliation.
12. Confirm settlement confirmation/reconciliation evidence cannot be cleared or mutated.
13. Confirm AI/intelligence operations cannot mutate authoritative lifecycle state.
14. Confirm UI displays only backend-authorized organization/geography data.
15. Confirm no demo/simulated record is represented as real production activity.
16. Where a regulatory methodology or external provider is used, independently verify the exact source/version and preserve its provenance.
17. Confirm the target managed PostgreSQL TLS certificate chain is trusted by the production runtime with `DATABASE_SSL=require`; do not weaken certificate verification to make deployment pass.
18. Confirm production identity/session provisioning uses real identities and explicit PostgreSQL permissions; no bundled client session token or development authentication fallback is permitted.
19. Confirm the production web origin is the exact HTTPS origin allowlisted in `RUPAYKG_ALLOWED_ORIGINS` and non-allowlisted origins receive no CORS authorization.

## Carbon methodology discipline

Legacy AI Studio documents contain useful examples such as BM WA03.001 and BM WA03.002. They must be treated differently:

- A mathematical reconciliation is a reference case, not evidence that a current adapter is legally or regulatorily approved.
- A source-locked implementation mapping is required before production methodology claims.
- Missing required parameters or evidence must fail closed.
- Deterministic intermediate values should be preserved so an auditor can reproduce the final result.
- Official issuance must remain externally confirmed; internal `ISSUED` state must not impersonate government/registry issuance.

The current methodology governance lifecycle is:

`SOURCE_LOCKED → IMPLEMENTATION_MAPPED → NUMERICALLY_RECONCILED → REGRESSION_VERIFIED → PRODUCTION_ELIGIBLE`

Database controls prevent a methodology from claiming `PRODUCTION_ELIGIBLE` without source provenance, independent reconciliation evidence and independent regression evidence. This is a readiness control, not a regulatory approval claim.

## Release gate

The correct progression is:

`CODE READY → CONFIGURATION READY → RUNTIME ACCEPTANCE → EXTERNAL ACCEPTANCE → CLOUD RUN DEPLOYMENT`

Cloud Run deployment must remain the final step, not a substitute for unresolved application or production-readiness work.
