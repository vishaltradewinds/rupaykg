# RupayKG Resume Work Checkpoint — 2026-10-17

## Resume rule
Start by reconciling current state against `docs/ECOSYSTEM_STATE.json`. Do not repeat verified work. Continue the first unfinished item, verify every result, then update the checkpoint. Do not mark production certification complete without live evidence.

## Source of truth
- Repository: `vishaltradewinds/rupaykg`
- Connected PC repo: `C:\Users\Vishal\Documents\GitHub\rupaykg`
- Local branch at checkpoint: `fix/guardian-hedera-gate-20261010`
- Local HEAD: `b304158`
- Local Git status at checkpoint: clean
- Production: `https://rupaykg.onrender.com`
- Render service: `srv-daki4d7qj5pc73b8qksg`
- Existing continuity manifest: `docs/ECOSYSTEM_STATE.json`

## Verified at checkpoint
- Production health endpoint returned HTTP 200, READY, database AVAILABLE, syntheticData=false.
- Render's latest production deployment was reported LIVE at commit `9d93382`; deployment/health evidence should be refreshed at resume rather than treated as permanently current.
- Guardian quickstart Docker stack is running locally.
- Guardian local UI at `http://localhost:3000` returned HTTP 200.
- Local Guardian MongoDB has a published policy record:
  - Name: `RupayKg BM WA03.001 Landfill Methane Recovery_1790589447521`
  - ID: `6aba3a07e76c0b08fdd9d8d2`
  - Status: `PUBLISH`
  - Version: `1.0.0`
  - Topic: `0.0.10757557`
- The local Guardian DB also contains two other policy records, one DRAFT and one more recent DRAFT. Do not delete or modify them without a clear need and validated evidence.
- Repository reconciliation script ran successfully: `npm run ecosystem:reconcile`. It reported checkpoint valid, 10 verified-done items, 1 blocked item, next item `guardian-policy-id`.
- Existing `.github/workflows/guardian-live-acceptance.yml` defines the live acceptance sequence.
- `apps/src/guardian-mrv.ts` implements RupayKG contract `rupaykg:guardian-mrv:v1`.
- `docs/PRODUCTION_IDENTITY_PROVISIONING.md` and `docs/GUARDIAN_LIVE_ACCEPTANCE.md` define required production gates.

## Production database and access state
- Production DB tables/migrations exist (87 migrations were previously observed).
- Read-only counts in production DB at checkpoint: identities=0, organizations=0, roles=0, organization_memberships=0.
- `GET /api/v1/mrv/status` without a valid session returned HTTP 401 / AUTH_REQUIRED. This is expected for an unauthenticated request and does not establish MRV readiness.
- Super-admin identity/membership/session has NOT been provisioned.
- A database credential was exposed in the earlier conversation and has NOT been rotated. Never repeat or copy that credential into files, logs, or replies.
- Attempts to use available direct production database write and credential-rotation controls were blocked. No production identity was created and no database password was changed.
- Do not bypass platform access controls or fabricate identity-provider subjects, credentials, sessions, role approvals, evidence, policy IDs, Guardian execution IDs, Hedera timestamps, or acceptance outcomes.

## Remaining work — exact order
1. Reconcile live state on resume: production health/deployment, DB counts, local repo status and manifest. Only refresh stale evidence; do not redo completed setup.
2. Resolve and prove the real published Guardian policy/workflow identifier and the production mapping to `GUARDIAN_MRV_POLICY_ID`.
3. Verify `GUARDIAN_MRV_SUBMIT_URL` points to an actual adapter implementing `rupaykg:guardian-mrv:v1`. Native Guardian `mrv-sender` API alone is not the same contract; do not assume compatibility.
4. Complete credential rotation through an authorized Neon operation, then update Render `DATABASE_URL` with the newly rotated value. Do not change Render DB URL before rotation is confirmed. Re-check health after the update.
5. Follow `docs/PRODUCTION_IDENTITY_PROVISIONING.md`: create/reconcile an identity with a real external identity-provider subject, verified organization and membership, least-privilege role permissions, bounded opaque session, and geography authorization. Use a controlled approved bootstrap path; do not assign reserved roles through ordinary membership routes.
6. Prepare or identify a real, non-synthetic RupayKG activity with completed status, approved verification, verified evidence, measurements, and authorized geography. Do not use acceptance fixtures as registry evidence.
7. Run `.github/workflows/guardian-live-acceptance.yml` with the real base URL, organization/activity/verification/evidence/policy IDs and authorized `RUPAYKG_SESSION_TOKEN` secret.
8. Verify authoritative Guardian `VERIFIED` + execution ID; Hedera `CONSENSUS_CONFIRMED` + transaction ID + consensus timestamp; persisted provenance; exact Mirror Node verification and persisted `mirror_node_verified_at`.
9. Run the negative/fail-closed tests, update `docs/ECOSYSTEM_STATE.json` and this checkpoint with actual evidence, then close the acceptance issue only if every gate passes.

## Current status
**NOT COMPLETE — production acceptance is blocked.** Last checkpoint reconciliation: 10 VERIFIED_DONE, 1 BLOCKED, next item guardian-policy-id. Production admin provisioning and credential rotation are still blocked; Guardian/Hedera/Mirror Node live acceptance has not passed.

## Safety and continuity rules
- Never repeat verified work unless fresh evidence contradicts it.
- Never claim an earlier status as current without rechecking it.
- Never include secrets or plaintext session tokens in checkpoint artifacts.
- Do not mark production certification complete from CI or local container status alone.
- After each verified change, update the continuity manifest and this checkpoint together.


## Resume update — 2026-10-18

### Freshly verified
- Desktop Commander is online on `DESKTOP-AGPFFLB` and remote execution is working.
- Local checkout synchronized safely: switched from the merged feature branch to `main`, fast-forwarded to `9d93382aa0e7460c2e91b0af1bcbf641c0f80d28`; no tracked working-tree changes. The checkpoint file itself remains untracked and was preserved.
- `https://rupaykg.onrender.com/health` returned HTTP 200 with `status=READY`, `database=AVAILABLE`, and `syntheticData=false`.
- Render reports deployment `dep-db9l5ve7bikc73dr9cb0` for commit `9d93382aa0e7460c2e91b0af1bcbf641c0f80d28` as `live`.
- PR #17 is merged. Its verification notes report CI run #1170 passed, including dependency audit, migration validation, typecheck, builds, browser smoke test, 105 tests across six suites, PostgreSQL acceptance, and production container build.
- `npm run ecosystem:reconcile` completed: checkpoint valid, 10 VERIFIED_DONE, 1 BLOCKED, next item `guardian-policy-id`.

### Current blocker — do not treat as acceptance
- Local Guardian is not reachable at `http://localhost:3000`; no Guardian-related local ports are listening.
- Docker Desktop was launched, but the Docker Engine named pipe remains unavailable and the `docker-desktop` WSL2 distribution is stopped. The local Guardian policy database therefore could not be revalidated during this resume.
- A historical local record for policy `6aba3a07e76c0b08fdd9d8d2` was documented at the prior checkpoint as `PUBLISH`, version `1.0.0`, topic `0.0.10757557`; do not treat that historical record as fresh proof of the currently deployed/published policy or its production mapping.
- No live Guardian `VERIFIED` execution, Hedera consensus confirmation, persisted provenance, or Mirror Node verification was obtained in this resume.

### Next action
Restore Docker Desktop's WSL2 engine, verify the actual Guardian policy/workflow through its authenticated UI/API, then prove the production mapping for `GUARDIAN_MRV_POLICY_ID` and confirm `GUARDIAN_MRV_SUBMIT_URL` targets an adapter implementing `rupaykg:guardian-mrv:v1`. Keep production certification and registry eligibility fail-closed until the live acceptance sequence passes.


## Guardian recovery attempt — 2026-10-18 08:01 UTC

- Reconfirmed Desktop Commander connectivity by ping (`pong`).
- Attempted to start Docker Desktop using its installed executable and Docker Desktop CLI. The CLI reported Docker Desktop already running, but `docker info` could not open `npipe:////./pipe/dockerDesktopLinuxEngine`; WSL continued to report `docker-desktop` stopped.
- A subsequent Docker Desktop CLI status/restart diagnostic stalled before reaching the restart step; no successful engine recovery is claimed.
- Re-read `docs/WA03_001_GUARDIAN_IMPORT_BLOCKER.md`: the prior known blocker is an invalid Hedera operator key/account pairing (`INVALID_SIGNATURE`) for operator account `0.0.10123135` against node `0.0.0.5`. The documented required steps are to validate/correct the real key pair, restart Guardian, confirm DID/random-key registration, import the policy bundle, validate/publish it, and capture the real published policy ID. No private key should be written to Git or the checkpoint.
- Guardian live acceptance remains blocked: no verified published policy/workflow, and no live execution/consensus/Mirror Node evidence obtained. Continue fail-closed; do not replace real identifiers or credentials with guessed values.

## Guardian recovery update — 2026-10-18 08:25 UTC
- Docker Desktop engine is responding. Started existing quickstart containers with Compose `start` (no rebuild/recreation).
- Fresh container inspections confirm `guardian-quickstart-web-proxy-1`, `guardian-quickstart-guardian-service-1`, `guardian-quickstart-api-gateway-1`, and `guardian-quickstart-worker-service-1` are running.
- Guardian logs report service startup; API gateway logs report Nest application startup on port 3002. `http://127.0.0.1:3000` returned HTTP 200.
- The quickstart configuration has Hedera `OPERATOR_ID` and `OPERATOR_KEY` commented out; Compose also warned these variables are unset. Do not attempt signing or policy publication until a valid authorized operator key/account pair is configured.
- No live Guardian execution, Hedera consensus, or Mirror Node verification is claimed. Production certification and registry eligibility remain fail-closed.

## Resume update — 2026-10-19 11:22 UTC

### Fresh checks performed
- Desktop Commander connection is online and remote PowerShell execution works.
- Local repository `C:\Users\Vishal\Documents\GitHub\rupaykg` is on `main` at `0ddcf6087620880e21ea60f954c9f05d6b759469`, synchronized with `origin/main`. Working tree initially had no tracked modifications; untracked `artifacts/` and this checkpoint were preserved.
- Production health `https://rupaykg.onrender.com/health` returned `status=READY`, `database=AVAILABLE`, `syntheticData=false`.
- Docker Desktop is installed at `C:\Users\Vishal\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe`; desktop/backend processes launch, but `wsl --list --verbose` still reports `docker-desktop` as Stopped and `docker info` cannot connect to `npipe:////./pipe/dockerDesktopLinuxEngine`.
- `vmcompute` service is stopped and the current remote session cannot open/start it (permission/access boundary). No admin bypass attempted.
- `http://127.0.0.1:3000` is unreachable; no Guardian acceptance was run. Docker/Guardian statuses in `docs/ECOSYSTEM_STATE.json` were corrected to BLOCKED/UNVERIFIED to avoid stale claims.
- `node_modules` is absent; no npm install, build, test, migration, database write, deployment, key change, or Guardian/Hedera submission was performed.

### Current next action
- Recover the Docker/WSL2 engine through an authorized Windows session with the required service permissions; then verify existing containers with read-only `docker ps` and restart only existing stopped Guardian services if needed (no rebuild/recreation).
- After local Guardian is reachable, authenticate to Guardian and verify the actual published policy/workflow identifier and adapter mapping. Continue with the established live acceptance sequence only when real authorized IDs and credentials are available.

### Status
- Production API health is confirmed, but production acceptance remains BLOCKED. No claim of Guardian VERIFIED, Hedera CONSENSUS_CONFIRMED, persisted provenance, Mirror Node confirmation, or official CCC issuance is made.


## Recovery and acceptance update — 2026-10-19

### Runtime recovery verified
- Docker Engine 29.8.0 responds and WSL2 `docker-desktop` is Running.
- All Guardian Quickstart application services are running; local Guardian UI `http://127.0.0.1:3000` returned HTTP 200. Existing Mongo, cache, NATS, IPFS and MRV sender data containers were left in place. Application containers were recreated using existing images only (no image pull/build).
- Local Guardian Mongo has a fresh PUBLISH policy record: ID `6aba3a07e76c0b08fdd9d8d2`, version `1.0.0`, topic `0.0.10757557`. This resolves the local identifier lookup only; do not assume this ID is the production-configured policy.
- The local MRV sender at port 3005 returns HTTP 200 but serves a browser UI; no evidence establishes it as an adapter for `rupaykg:guardian-mrv:v1`.

### Assurance gaps confirmed
- Local Guardian Mongo currently has zero documents in both `policy_test` and `dry_run`. A separate saved draft screenshot shows `Policy not found` during publish. The existing PUBLISH record is not proof of a successful current Dry Run/schema validation. Do not republish or submit through it until validation evidence is established.
- Both available Neon RupayKg project candidates have zero rows in core organizations, identities, memberships, activities, verifications, evidence, measurements, credentials and MRV provenance tables. Render-managed `rupaykg-db` is suspended by billing. The exact production database mapping and a real authorized activity are unresolved.
- Production health remains a health check only: `https://rupaykg.onrender.com/health` returned READY / database AVAILABLE / syntheticData false. This is not proof of an authorized identity, successful Guardian execution, Hedera consensus or Mirror Node verification.

### Next action
Verify or implement and test a real server adapter for `rupaykg:guardian-mrv:v1` against Guardian’s documented API. Keep the production integration fail-closed until policy schema/Dry Run validation is evidenced, a reachable authorized Guardian endpoint and policy mapping are confirmed, and a real production activity/verification/evidence set plus authorized session are available. No production database write, credential rotation, deployment, Guardian submission, Hedera transaction, or CCC issuance was performed in this update.


## Guardian policy assurance finding — 2026-10-19

- The local Mongo PUBLISH record `6aba3a07e76c0b08fdd9d8d2` is structurally incomplete for acceptance: `policyNavigation` has 0 entries, `schemaTemplates` has 0 entries, and `tools` has 0 entries. The other local WA03.001 drafts also lack schema templates/tools; one draft has navigation entries but remains DRAFT.
- Guardian Mongo `policy_test` and `dry_run` collections both have zero records. Saved UI evidence shows a separate draft displaying `Policy not found` during publish. No current proof establishes that the intended WA03.001 policy passed import, validation and Dry Run.
- Guardian native external ingestion expects a signed VC (`owner`, `policyTag`, `document`), not the raw observations/evidence object sent by RupayKG’s current client. The local mrv-sender generates a signed VC from a `.config` with an issuer DID/private key and posts it to `/external/{policyId}/{blockTag}`. No suitable local config or authorized issuer credential was found. A successful external-ingest HTTP response must not be treated as completed verification.
- Therefore policy validation is the next task; the adapter remains blocked until a valid policy and authorized VC issuer are available. No policy was republished and no external submission was made.


## Resume update — 2026-10-19 12:43 UTC

- Recovered and verified Docker Engine 29.8.0; WSL2 `docker-desktop` is Running. All 15 existing Guardian Quickstart containers are Up; the Guardian UI returns HTTP 200. No container/data reset was performed during this recovery.
- RupayKg production health endpoint returned `READY`, database `AVAILABLE`, `syntheticData=false`.
- Installed lockfile-pinned Node dependencies. Root build completed successfully. Migration validation completed successfully.
- The first test run found a Windows-only path bug in `apps/test/cors-runtime.test.ts`: URL `.pathname` produced an invalid `C:\\C:\\...` path. Fixed the test to use `fileURLToPath(new URL("../..", import.meta.url))`. Focused CORS test passes; the full root test command exited 0 after the fix. Database-dependent integration tests remain skipped without `DATABASE_URL`.
- Created a separate repaired policy bundle at `artifacts/RupayKg-WA03.001-v1-repaired.zip` and matching standalone policy JSON. The original import artifacts were preserved. Structural gate passed: five schema files; seven navigation steps; roles Project Proponent, Verification Body, NO_ROLE, OWNER; all navigation block tags and five schema references resolve; Equation 4 formula present.
- Structural repair is not policy acceptance. The workflow still needs explicit fail-closed conditional validation/rejection, evidence collection/lineage, independent verifier approval/signature, and final verification/provenance transition blocks. The saved StandardRegistry test token and demo login both returned HTTP 401; no authenticated Guardian API session was available to this terminal. No import, Guardian validation, Dry Run, publication, or Hedera submission was performed.
- Next gate: complete the missing Guardian-native workflow blocks, use an authorized Guardian session to import and validate the repaired bundle and run Dry Run, then verify the signed-VC issuer configuration and RupayKg adapter contract. Keep live acceptance and production issuance fail-closed until Guardian VERIFIED, Hedera consensus, persisted provenance, and Mirror Node verification are proven.


## Official methodology reconciliation — 2026-10-19 12:46 UTC

- Re-opened the official BEE BM WA03.001 v1.0 PDF. It confirms Equation (4), GWPCH4 = 29.8 t CO2e/t CH4 from IPCC AR6, and the referenced approved tools BM-T-001, BM-T-002, BM-T-003, BM-T-004, BM-T-006, BM-T-011 and BM-T-012. Source: https://beeindia.gov.in/sites/default/files/BM%20WA03.001.pdf
- Additional substantive policy defects: the bundle's top-level tools list is empty; the calculate block's input schema is the monitoring schema but the input mapping requires `fch4BL`, which exists only in the separate baseline schema; and the monitoring schema omits several official parameters/conditional pathways including LFG volume, methane fraction, methane density, temperature, pressure, and conditional electricity generation/efficiency.
- These defects mean the repaired bundle is structurally coherent but not yet methodology-conformant. Do not import/publish it as an accepted policy without resolving cross-form data binding, the referenced tool dependencies, complete monitoring paths, and the remaining fail-closed/verification/provenance blocks.


## 2026-10-19 implementation continuation (13:18 UTC)

- Updated the carbon package against official BEE BM WA03.001 v1.0: corrected Equation 4 source expression; pinned GWPCH4 to 29.8; recorded seven official BM-T dependencies; added the ten official monitoring parameter definitions; added Equation 5 flow/composition aggregation with raw measurement, calibration and density evidence references, explicit density reference conditions, T/P requirements for measured-condition density, and deterministic SHA-256 input/output hashes.
- Carbon package build and tests pass after these changes: 26 passed, 0 failed, 0 skipped. Migration validation passed (91 migrations, 73 schema objects). The full root test suite previously exited 0; full root build is being rechecked after the last changes.
- Guardian policy is still not accepted or published. The API test login remains unauthorized, and the policy still lacks fully mapped tool execution, conditional measurement pathways, verified cross-form baseline binding, independent verifier gates, and live evidence. Do not deploy or publish based only on structural checks.


## Final verification update — 2026-10-19 13:20 UTC

- Root build completed with exit code 0 after the carbon changes.
- Root workspace test suite completed with exit code 0 after the carbon changes. Database-dependent integration tests were skipped when the required live database configuration was absent; the suite does not establish production acceptance.
- Carbon package build and tests passed: 26 passed, 0 failed, 0 skipped, including Equation 5 evidence checks, density basis/T-P validation, hashes, tool list and GWP pin.
- Lint completed with exit code 0. Migration validator passed: 91 migrations and 73 schema objects. `git diff --check` passed (only Git line-ending normalization warnings remain).
- Final live checks: production `/health` returned `READY`, database `AVAILABLE`, `syntheticData=false`; Guardian UI returned HTTP 200. No deployment, migration execution, Guardian import/publication, Hedera submission, or CCC issuance was performed.
- Current next gate remains Guardian policy validation. The available terminal cannot authenticate (test login returned HTTP 401), so Guardian-native import/validation/Dry Run and signed-VC acceptance remain blocked. Do not mark production acceptance complete until those authority-backed proofs exist.


## Next execution decision — 2026-10-19 13:22 UTC

Repository inspection confirms the CPCB SWM preparation API already persists stakeholder workspaces and keeps portal statuses `USER_REPORTED_UNVERIFIED`. A separate authenticated Evidence Vault already implements bounded file upload (PDF/JPEG/PNG/CSV/TXT/JSON, 5 MiB), content-type signature checks, SHA-256, versioned artifact series, PostgreSQL storage, organization/geography authorization, download integrity verification and independent evidence review.

Therefore, the next implementation should NOT duplicate file-upload/storage. It should add an explicit, tenant-safe, audited relationship between a CPCB SWM workspace and Evidence Vault artifacts, with a canonical server-side document-category registry per stakeholder and workflow step, version history, evidence status propagation that never self-verifies, and route-level cross-organization/geography denial tests. Then expose upload/attach/list/download actions in the CPCB preparation workflow using the existing vault. Keep official CPCB submission, status and certificate claims user-reported/unverified until supported by an authorized source. Validate with tests/build/lint/migration validator; do not execute migrations against production or deploy without the relevant gates.

Guardian policy validation remains a separate blocked gate: local Guardian UI responds HTTP 200, but authenticated policy operations returned HTTP 401. Do not conflate CPCB evidence readiness with Guardian/Hedera acceptance.


## 2026-10-19 13:30 UTC — CPCB SWM evidence-link implementation continuation
- Added migration `20261022_cpcb_swm_evidence_links.sql`: append-only organization-scoped links from CPCB stakeholder workspaces to immutable Evidence Vault versions, with canonical checklist key, link actor, timestamps, uniqueness and mutation-prevention trigger.
- Added API routes in `apps/src/cpcb-swm-routes.ts`:
  - `GET /api/v1/cpcb-swm/workspaces/:workspaceId/evidence` lists linked evidence metadata.
  - `POST /api/v1/cpcb-swm/workspaces/:workspaceId/evidence` links an existing Evidence Vault item only after checking active organization, permissions, workspace ownership, canonical checklist key, vault-backed hash pointer, organization/activity ownership and geography scope; duplicate links fail closed; action is audited.
- Added Evidence Vault link/list controls in `apps/web/src/main.tsx`. User must save a preparation workspace first and provide an existing evidence UUID. UI explicitly states this does not verify CPCB status. Changing stakeholder type resets the checklist target.
- Validation: full root build exit 0; web build exit 0; root workspace test command exit 0; lint exit 0; migration validator reports 92 migrations / 74 schema objects; `git diff --check` passes (only CRLF conversion warnings).
- Root tests show 99 API tests with 91 passing, 0 failing, 8 skipped; carbon 26/26, domain 29/29, compliance 2/2, ESG 1/1, intelligence 2/2. Skipped API tests include DB/config-dependent coverage; this is not proof of live PostgreSQL migration execution.
- No database migration was executed, no production deployment occurred, no commit/push occurred. Guardian authentication/validation remains a separate blocking gate. Evidence linking does not submit CPCB applications, independently verify evidence, or issue certificates.


## 2026-10-19 13:42 UTC — CPCB evidence integrity hardening and regression checks

- Reconnected Desktop Commander and resumed the CPCB SWM evidence-linking task.
- Hardened `migrations/20261022_cpcb_swm_evidence_links.sql` with composite foreign keys: (workspace_id, organization_id) must resolve to the same tenant workspace, and (artifact_version_id, evidence_id) must resolve to the exact immutable artifact version for that evidence. Append-only update/delete trigger remains in place.
- Added `apps/test/cpcb-swm-evidence-contract.test.ts` covering the migration's tenant/version foreign-key contract, uniqueness, append-only trigger, canonical checklist enforcement, organization-scoped reads, geography scope check, and no official CPCB status mutation claim.
- Validation observed: API suite reports 93 passed, 0 failed, 8 skipped (database/config-dependent); carbon 26/26; compliance 2/2; domain 29/29; ESG 1/1. Root build and lint completed without reported errors; migration validator confirms 92 migrations / 74 schema objects; `git diff --check` passes with line-ending warnings only.
- Important limitation: the new regression test is a source-contract test, not a database integration test. No DATABASE_URL / test database environment variables were present in the remote shell; the migration has NOT been executed against any database. Tenant isolation, actual foreign-key behavior, transaction/audit behavior, and API end-to-end behavior remain unverified in PostgreSQL.
- Production remains HOLD. No commit, push, deployment, official CPCB submission/status synchronization, Guardian policy publication, Hedera transaction, or carbon-credit certificate issuance occurred.


## 2026-10-19 13:48 UTC — CPCB evidence-linking PostgreSQL/API integration proof

- Created a temporary local-only PostgreSQL 16 test container bound only to 127.0.0.1:55432, applied all 92 repository migrations successfully (including 20261022_cpcb_swm_evidence_links.sql), and ran tests against the isolated migrated database. The temporary container was stopped and removed after testing; no production/Render database was touched.
- Added `apps/test/cpcb-swm-evidence-links.integration.test.ts`. Against the migrated isolated database, it passed real PostgreSQL assertions that a valid link inserts, cross-tenant workspace/org pairs are rejected, evidence/version mismatches are rejected, and UPDATE/DELETE are rejected by the append-only trigger.
- Added `apps/test/cpcb-swm-evidence-api.integration.test.ts`. Ran it separately against a second disposable migrated database; 1/1 passed. It starts the real API, creates two organizations with separate authenticated identities and geography scopes, verifies successful POST/GET for same-org evidence, duplicate link rejection (409), invalid checklist rejection (400), and cross-organization workspace/evidence isolation (404). It verifies the response explicitly says official CPCB status remains UNCHANGED and checks one persisted link.
- Full root suite against the isolated PostgreSQL DB: API 98 passed / 0 failed / 4 skipped; carbon 26/26; compliance 2/2; domain 29/29; ESG 1/1; intelligence 2/2. The separate CPCB API integration test passed 1/1. The remaining four API skips are unrelated optional/gated cases; no suite failures.
- Root build completed through API compilation and the new API test was executed from compiled output. Lint exit 0; migration validator passed 92 migrations / 74 schema objects; `git diff --check` passed (line-ending warnings only).
- Still not proven: production migration, official CPCB portal submission/status synchronization, Guardian policy validation/Dry Run/publication, authorized signed-VC issuance, Hedera consensus, Mirror Node verification, or CCC issuance. Production remains HOLD. Changes remain local and uncommitted.


## 2026-10-19 13:52 UTC — Guardian policy calculation syntax reconciled

- Cross-checked Guardian's official `calculateContainerBlock` / `calculateMathAddonBlock` documentation in upstream `hashgraph/guardian`. Synchronized the standalone `artifacts/RupayKg-WA03.001-v1-repaired.policy` math-addon array with the ZIP candidate: `E_GWP = 29.8` and `E_ER = (E_FCH4_PJ-E_FCH4_BL)*E_GWP*(1-E_OX)-E_PE-E_LE`.
- Local structural verification passed: ZIP and .policy formula arrays match; all five schema references resolve; all seven navigation entries resolve to existing block tags; five schema files are present.
- Guardian policy remains blocked from validation/publication: `fch4BL` is requested by the calculator but is absent from the monitoring schema and resides in the separate baseline schema; no validated cross-form binding is demonstrated. Top-level Guardian `tools` list remains empty. BEE BM-T dependencies are not fabricated as Guardian tool IDs.
- No authorized Guardian session is available from the terminal (prior test/demo login attempts returned HTTP 401). No import, validation, Dry Run, publication or Hedera write was attempted. This candidate remains not validated/not publishable.


## 2026-10-19 14:05 UTC — BM WA03.001 baseline reconciliation contract

- Implemented `reconcileBmWa03001Equation4Inputs` and typed baseline/monitoring/reconciled-input contracts in `packages/carbon/src/index.ts`. It requires same activity ID, approved baseline with approver/time, baseline evidence refs, a matching canonical baseline record SHA-256, evidence-backed project methane Equation 5 result with input/output hashes, monitoring evidence refs, valid emissions/oxidation inputs, and fixes GWP at 29.8. Output is only `RECONCILED_PENDING_VERIFICATION` with a provenance SHA-256.
- Added carbon regression test proving correct linked baseline value is used and mismatched baseline value/hash, unapproved status, cross-activity records and missing monitoring evidence are rejected.
- Validation: full `npm run build` exit 0; carbon 27/27 passed; API suite rerun separately 93 passed, 0 failed, 10 skipped (DB/config-gated); lint exit 0; migration validator 92 migrations / 74 schema objects; `git diff --check` exit 0. A concurrent full root test attempt initially saw a transient CORS test server startup timeout; the API suite rerun passed. Do not represent the first root run as fully green.
- Guardian remains blocked until this contract is fed from a real immutable DB-backed approved baseline record and signed/trusted Guardian VC/external-data path; a caller-supplied baseline object is not itself authoritative. No Guardian import/validation/Dry Run/publication, HCS write, or production deployment performed.


## 2026-10-19 14:20 UTC — Persistent BM WA03.001 baseline review workflow

- Added `migrations/20261023_bm_wa03001_baseline_records.sql` and registered `apps/src/bm-wa03001-baseline-routes.ts` in `apps/src/server.ts`.
- Routes: `POST /api/v1/mrv/activities/:activityId/bm-wa03001/baselines`, `GET` on the same path, and `POST /api/v1/mrv/bm-wa03001/baselines/:baselineId/decision`. Submit requires activity/organization/geography authorization, permission, non-negative baseline methane, and 1–50 unique verified evidence IDs belonging to the same activity. Independent decision requires verifier permission, separate submitter/verifier identities, still-verified evidence, and a recomputed record hash.
- PostgreSQL guards prevent baseline deletion and mutation of baseline fields; only one SUBMITTED -> APPROVED/REJECTED transition is permitted, and the DB guard prevents self-approval even outside the API.
- Added `apps/test/bm-wa03001-baseline-contract.test.ts`. Validation: `npm run build` passed; API tests 95 passed / 0 failed / 10 skipped; migration validator passed with 93 migrations / 75 schema objects. No production DB migration or deployment occurred.
- Remaining next step: wire the persisted approved baseline record to Equation 4 reconciliation and Guardian via a trusted data/VC path; run disposable PostgreSQL integration tests for the new migration/approval guard; then validate policy and negative cases with authorized Guardian credentials. No claim of official BEE approval, CPCB status change, or carbon-credit issuance.


## 2026-10-19 14:31 UTC — Guardian baseline cross-form gate

- Local Guardian `guardian-service` is version `3.7.1-rc`; upstream release notes indicate `documentValidatorBlock` supports cross-schema source validation. The feature is now represented in the reproducible policy source and generated artifacts.
- Updated `scripts/build-wa03-guardian-policy.mjs`: baseline and monitoring schemas require baseline record ID, SHA-256 and FCH4,BL; monitoring submit routes through `wa03_baseline_reconciliation_validator` before Equation 4; the validator requires an existing baseline VC with the same activity ID and record ID and compares FCH4,BL and hash. Policy navigation includes the validator. Artifacts regenerated at `artifacts/RupayKg-WA03.001-v1-repaired.policy` and `artifacts/RupayKg-WA03.001-v1-repaired.zip`.
- Structural archive validation passed (5 schemas, source validation present, fail-closed on empty source, two matching conditions, both event links, navigation target present). Guardian runtime validation/dry-run remains unperformed due no authorized Guardian session. The source validation only proves equality between two Guardian documents; it is not proof of approved RupayKg DB status, hash authenticity, or BM-T-011 sufficiency.
- Disposable PostgreSQL 16 baseline DB guard test passed: valid independent approval transition accepted, baseline input mutation rejected, second decision rejected; all fixture rows rolled back. Full migration replay attempt encountered a duplicate constraint at `021_methodology_governance.sql` and is not considered a clean full replay.
- Carbon tests 27/27 passed after contract update. API test rerun was launched; retrieve final output from `%TEMP%\rupaykg-api-final-20261019.log` if needed. Lint, migration validator (93 migrations / 75 schema objects), and `git diff --check` previously passed.
- Still HOLD: no production migration/deployment, no Guardian import/publication, no Hedera HCS write/confirmation, and no claim of official CCC issuance. Next: complete API test confirmation, run Guardian validation and negative execution tests with authorized access, then implement signed RupayKg-to-Guardian baseline credential/bridge.


## 2026-10-19 14:35 UTC — Test closure for baseline record and Guardian structure

- `npm run validate:guardian-policy` passed. `npm run validate:migrations` passed: 93 migrations / 75 schema objects. `git diff --check` passed. `npm run lint` passed. Full workspace build log shows all TypeScript workspace builds and Vite production build completed without errors.
- Latest API suite: 106 tests, 95 passed, 0 failed, 11 skipped. Carbon suite 27/27. New DB integration test `apps/test/bm-wa03001-baseline.integration.test.ts` was run against a disposable PostgreSQL 16 database after applying the new migration: 1 passed, 0 failed. It verifies independent approval, immutable inputs, no second decision, no self-approval at insert, and no deletion; test data was rolled back and the disposable database removed.
- Guardian policy source and artifacts regenerated with cross-schema `documentValidatorBlock` and connected event chain. Structural validator confirms 5 schemas and required source validation. Guardian runtime acceptance remains blocked pending authorized session; cross-form equality is not cryptographic proof of RupayKg approval.
- Git worktree remains DIRTY on `main@0ddcf60`; no commit or push. Production deployment, production migration, Guardian import/publication, Hedera HCS write, and CCC issuance were not performed.
