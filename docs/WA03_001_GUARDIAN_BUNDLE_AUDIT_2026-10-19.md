# RupayKg WA03.001 Guardian Bundle Audit — 2026-10-19

## Verified runtime recovery

- Docker Engine 29.8.0 client/server responds; WSL2 `docker-desktop` is Running.
- The existing `guardian-quickstart` Compose project reports 15 running containers.
- Guardian UI at `http://127.0.0.1:3000` returns HTTP 200.
- The local MRV sender container is running and its root UI at `http://127.0.0.1:3005` returns HTTP 200. The root UI is not proof of an MRV adapter contract.
- `https://rupaykg.onrender.com/health` returned `READY`, database `AVAILABLE`, and `syntheticData=false`.
- No container/data reset, production deployment, database migration, Guardian policy publication, or Hedera submission was performed in this audit.

## Bundle repair performed

Original inputs preserved:
- `artifacts/RupayKg-WA03.001-v1-import.zip`
- `artifacts/RupayKg-WA03.001-v1.policy`

New local-only artifacts:
- `artifacts/RupayKg-WA03.001-v1-repaired.zip`
- `artifacts/RupayKg-WA03.001-v1-repaired.policy`

The repaired copy adds explicit Guardian policy navigation for Project Proponent, Verification Body, NO_ROLE, and OWNER. The seven navigation steps resolve to existing block tags. Structural checks passed: policy JSON parses; five schema JSON files are present; all five schema/input/output references resolve; all navigation block tags exist; Equation 4 is `(E_FCH4_PJ-E_FCH4_BL)*E_GWP*(1-E_OX)-E_PE-E_LE`.

This is a **structural bundle repair only**, not a Guardian validation, Dry Run, policy publication, or regulatory approval.

## Acceptance blockers still open

1. The current Guardian database has a historical `PUBLISH` policy record, but that record has zero navigation entries; `policy_test` and `dry_run` collections have zero records. A published status alone is not usable-policy evidence.
2. The bundle's workflow still needs explicit fail-closed conditional validation/rejection, evidence collection/lineage, independent verifier approval/signature, and final verification/provenance transition blocks. The current form and calculation blocks do not prove these gates.
3. No authenticated Guardian API session was available to this remote terminal. The saved StandardRegistry test token returned HTTP 401, and the demo login attempt returned HTTP 401. No import, validation, Dry Run, or publication was attempted.
4. The native MRV sender expects a signed Verifiable Credential and uses its configured issuer DID/private key. No verified authorized issuer configuration or deployed adapter implementing `rupaykg:guardian-mrv:v1` has been proven.
5. No real non-synthetic activity has completed Guardian `VERIFIED`, Hedera HCS `CONSENSUS_CONFIRMED`, persisted provenance, and Mirror Node verification.

## Code verification

- `npm ci --no-audit --no-fund` completed successfully.
- Root `npm run build` completed successfully after dependencies finished installing.
- The CORS runtime test initially exposed Windows URL path handling: using URL `.pathname` produced an invalid `C:\\C:\\...` path. The test now uses `fileURLToPath(new URL("../..", import.meta.url))`; the focused CORS test passes.
- Root `npm test` exited successfully after the fix. Database-dependent integration tests remain skipped when `DATABASE_URL` is not configured; this does not prove production database acceptance.
- `npm run validate:migrations` exited successfully.

## Next gate

Complete the Guardian-native WA03.001 workflow and required block families; use an authorized Guardian UI/API session to import the repaired bundle, confirm both stakeholder journeys, run Guardian validation and Dry Run, and preserve evidence. Only then may publication be considered. Keep the RupayKg adapter and live Guardian/Hedera acceptance fail-closed until a valid signed VC issuer and the full authoritative acceptance tuple are demonstrated.


## Official BEE source cross-check (2026-10-19)

The controlling source was re-opened at the official BEE PDF:
https://beeindia.gov.in/sites/default/files/BM%20WA03.001.pdf

- The source identifies BM WA03.001, Landfill Methane Recovery, Version 1.0, publication date 27 March 2025.
- Equation (4) is ERy,calculated = (FCH4,PJ,y - FCH4,BL,y) * GWPCH4 * (1 - OX) - PEy - LEy.
- The source explicitly specifies GWPCH4 = 29.8 t CO2e/t CH4 from IPCC AR6.
- The methodology names BM-T-001, BM-T-002, BM-T-003, BM-T-004, BM-T-006, BM-T-011 and BM-T-012 as referenced approved tools.

## Additional material conformance gaps found

- The policy's top-level `tools` list is empty; BM-T-011 appears only in a form title/field label. There is no demonstrated execution or versioned evidence lineage for the seven referenced tools.
- The calculation block declares the monitoring schema as its input schema, but its input mapping also requires `fch4BL`, which is only present in the separate baseline schema. No cross-form or approved baseline-result binding is demonstrated. A structural JSON reference check cannot establish that Guardian will resolve the baseline value correctly.
- The monitoring schema does not yet represent the full official parameter set and conditional measurement procedures, including `LFGi,y`, `wCH4,y`, methane density `DCH4,y`, temperature, pressure, and the conditional electricity-generation/efficiency pathway (`EGy`, `EEy`). The policy must model the official monitoring paths and their source evidence rather than rely on a free-form aggregate.
- The current `policyNavigation` repair is therefore not enough to promote the bundle to `IMPLEMENTATION_MAPPED`, let alone validated or production-eligible. These gaps require reviewed schema/calculation changes and Guardian validation/Dry Run evidence.


## Code implementation increment — 2026-10-19 13:10 UTC

The RupayKg carbon calculation package was extended after the initial bundle audit:

- Equation 4 source text corrected to the official mathematical expression.
- BM WA03.001 v1.0 GWP is pinned to 29.8 tCO2e/tCH4; other values fail closed pending approved methodology revision.
- Equation 5 flow/composition calculation now aggregates period-level LFG volume × methane volume fraction × methane density, with unique period IDs, valid timestamps, valid numeric ranges, consistent humidity basis, flow-meter/analyser IDs, raw flow and methane evidence references, and calibration evidence references. Results remain CALCULATED_PENDING_VERIFICATION.
- Added an explicit dictionary for all ten official monitoring parameter rows and the seven referenced BM-T dependencies.
- Carbon workspace build passed; all 26 carbon tests passed.

This closes a code-level gap only. It does not implement the BM-T tools themselves, derive methane density from T/P, implement the electricity-generation alternative, resolve Guardian cross-schema bindings, or make the Guardian bundle publishable. Root build/test verification is being rechecked separately. No production deployment or official system write occurred.


## 2026-10-19 13:50 UTC — Guardian calculation block syntax cross-check

The official Guardian documentation for `calculateContainerBlock` / `calculateMathAddonBlock` was checked in the upstream `hashgraph/guardian` repository:
https://github.com/hashgraph/guardian/blob/main/docs/guardian/workspace/policies/policy-creation/introduction/calculatecontainerblock-and-calculatemathaddonblock.md

- Guardian's documented `equations` property is an array of objects with `variable` and `formula` fields, evaluated sequentially.
- The ZIP candidate already had the explicit `E_GWP = 29.8` and Equation 4 expression in that structure. The companion `artifacts/RupayKg-WA03.001-v1-repaired.policy` had a stale blank math-addon expression; it has now been synchronized to the same documented formula array.
- This is a local structural correction only. The calculation block still requests `fch4BL` from the monitoring schema, while the baseline form stores it in a separate schema. No documented, validated cross-form binding has been demonstrated, so this candidate remains **not validated and not publishable**. The policy's top-level Guardian `tools` list is still empty; the seven BEE BM-T dependencies are methodology tool references, not invented Guardian tool IDs.
- No authenticated Guardian API session is available from the remote terminal (previous test/demo login attempts returned HTTP 401). No import, validation, Dry Run, publication, or Hedera write was attempted.


## 2026-10-19 14:05 UTC — Baseline-to-monitoring reconciliation contract implemented in carbon core

- Added typed `BmWa03001BaselineLink`, `BmWa03001MonitoringLink`, and `BmWa03001ReconciledEquation4Input` contracts and `reconcileBmWa03001Equation4Inputs` in `packages/carbon/src/index.ts`.
- The function fails closed unless baseline and monitoring records have the same activity ID; baseline status is APPROVED with approver and timestamp; baseline evidence refs exist; a SHA-256 hash recomputed over the baseline record matches; monitoring uses the evidence-backed Equation 5 flow/composition method with input/output hashes; monitoring evidence refs exist; and physical inputs are valid. It then constructs Equation 4 inputs with fixed GWP 29.8 and deterministic provenance hash, labelled `RECONCILED_PENDING_VERIFICATION`.
- Added tests for the success path and for changed baseline values/hash mismatch, unapproved baseline, cross-activity mismatch, and missing monitoring evidence.
- Scope limitation: this is a fail-closed domain contract, not yet wired to a persisted baseline-record table or the Guardian external-data/VC issuer. The function only provides trustworthy reconciliation when its baseline object is loaded from an authorized, immutable, database-backed approved record; caller-supplied objects alone do not prove approval. Do not change Guardian candidate to claim a verified cross-form link until this data source is integrated and its VC trust chain is validated.
- Validation: full repository build passed; carbon tests 27/27 passed; API tests rerun separately 93 passed, 0 failed, 10 skipped (DB/config-gated); lint exit 0; migration validation passed 92 migrations / 74 schema objects; `git diff --check` passed. One concurrent root-suite attempt had a transient CORS test server startup failure; the API workspace rerun passed. No production deployment or Guardian policy import/publication occurred.


## 2026-10-19 14:20 UTC — Persistent baseline record workflow added

- Added migration `20261023_bm_wa03001_baseline_records.sql` creating an activity/organization-scoped baseline record table with fixed methodology/version, non-negative methane value, evidence UUID references, canonical SHA-256, submitter, submission time, and explicit review decision metadata. PostgreSQL trigger prohibits deletion and mutation of baseline inputs and allows only a one-time SUBMITTED -> APPROVED/REJECTED transition; the approver must differ from the submitter.
- Added `apps/src/bm-wa03001-baseline-routes.ts`, registered from `apps/src/server.ts`: submit baseline (requires verified evidence belonging to same activity and organization scope), list scoped records, and independent approve/reject (requires verification permission, no self-review, rechecks evidence and recomputes the baseline hash inside a transaction). Responses explicitly state that internal approval is not BEE/registry approval or credit issuance.
- Added source-contract tests in `apps/test/bm-wa03001-baseline-contract.test.ts`.
- Validation: migration validator passed with 93 migrations / 75 schema objects; full build passed; API tests 95 passed, 0 failed, 10 skipped. The skips include DB/config-gated tests. No production migration was applied, no real baseline record was created, and no Guardian policy import/publication or Hedera write occurred.
- Remaining integration gap: Guardian candidate and `reconcileBmWa03001Equation4Inputs` still need to consume this persisted approved record and its verified evidence refs through a trusted integration path. Baseline evidence refs are UUID references; BEE BM-T-011-specific evidentiary sufficiency and underlying raw measurements remain subject to methodology-specific review. This is not yet end-to-end Guardian acceptance.


## 2026-10-19 14:25 UTC — Database guard verification and reconciliation hash alignment

- Verified the baseline record migration is present in a disposable local PostgreSQL 16 container. A transaction-scoped DB guard test successfully inserted a baseline, performed a valid independent approval, confirmed input mutation is rejected, confirmed a second decision is rejected, and rolled back all fixture data. Output: `BASELINE_DB_GUARDS_PASS`.
- Updated the carbon `BmWa03001BaselineLink` contract to include organization, fixed methodology/version, baseline period, and submitter identity. `reconcileBmWa03001Equation4Inputs` now recomputes the same canonical baseline payload used at API submission and rejects a submitter/approver identity match. The carbon suite passed 27/27 after rebuilding the carbon package.
- The disposable full-migration attempt encountered a pre-existing duplicate-constraint error at `021_methodology_governance.sql`; the database had already acquired later objects during the initial background run, so this attempt is not treated as a clean full-migration pass. The dedicated baseline trigger test did pass. No production DB was touched.
- Guardian integration remains HOLD: approved database records are not yet fetched by a trusted Guardian-side bridge, and the local Guardian policy has not been imported, validated, dry-run, or published with authorized credentials. No Hedera writes occurred.


## 2026-10-19 14:31 UTC — Guardian cross-schema baseline consistency gate added

- Inspected the running local Guardian container: `guardian-service` reports version `3.7.1-rc`. Upstream Guardian 3.7.0 release notes describe cross-schema source validation in `documentValidatorBlock`; upstream 3.7.1-rc notes include additional document-validator fixes. This establishes a supported feature candidate, not successful policy execution.
- Updated the reproducible source builder `scripts/build-wa03-guardian-policy.mjs` and regenerated `guardian-policies/WA03.001/`, `guardian-policies/RupayKg-WA03.001-v1.policy`, `artifacts/RupayKg-WA03.001-v1-repaired.policy`, and `artifacts/RupayKg-WA03.001-v1-repaired.zip`.
- Monitoring schema now requires `baselineRecordId`, `baselineRecordSha256`, and `fch4BL`. A new `wa03_baseline_reconciliation_validator` queries baseline VCs by same `activityId` and `baselineRecordId`, and compares `fch4BL` and SHA-256 against the monitoring document. Monitoring -> validator -> Equation 4 events and navigation are wired. `allowEmptySource=false` ensures no matching baseline fails closed.
- Structural validation of the regenerated archive passed: five schema files, all referenced navigation blocks exist, source-validation schema exists, baseline value/hash conditions exist, and both event edges are present. This remains a cross-document consistency gate only: it does not prove that a baseline is approved in RupayKg, that the hash is authentic, or that BM-T-011 evidence is sufficient. Field descriptions and policy description explicitly disclose this limitation.
- The live Guardian policy has NOT been imported or executed: there is no authorized session in this run. No dry-run, publish, HCS write, or Hedera confirmation occurred. Next gate: import only after backup/authorized login, run Guardian validation and negative tests (missing baseline, wrong activity, wrong record ID, changed FCH4,BL, changed hash), then implement a trusted signed RupayKg baseline credential/bridge before any production certification.


## 2026-10-19 14:35 UTC — Final test update

- Added `scripts/validate-wa03-guardian-policy.mjs` and `npm run validate:guardian-policy`; validator passed against the generated source bundle. `npm run validate:migrations` passed (93 migrations / 75 schema objects), `git diff --check` passed, and lint passed in the prior run.
- Added `apps/test/bm-wa03001-baseline.integration.test.ts`, gated on `RUPAYKG_TEST_DATABASE_URL`. Executed this exact test against a disposable PostgreSQL 16 database with the new migration applied: 1 passed / 0 failed. It proves one independent approval is accepted, mutation after approval is rejected, second decision is rejected, self-approval on INSERT is rejected by the table check constraint, and deletion is rejected. Test data rolled back; disposable DB removed.
- Latest API suite: 106 tests, 95 passed, 0 failed, 11 skipped (DB/config-gated cases included). Carbon suite: 27/27. Full workspace build log shows domain, carbon, compliance, ESG, intelligence, API TypeScript builds and web Vite production build completed without errors.
- No production migration or deployment. Guardian structural validation remains distinct from live Guardian validation; no import, dry-run, publish, or Hedera write occurred.


## 2026-10-19 14:47 UTC — Persisted BM WA03.001 reconciliation path

- Added migrations/20261024_bm_wa03001_reconciliations.sql: immutable, append-only reconciliation records linked by a composite foreign key to the exact activity/organization baseline; unique monitoring period per activity; explicit RECONCILED_PENDING_VERIFICATION status; persisted Equation 5 result, Equation 4 inputs/result, evidence references, creator, and provenance SHA-256.
- Added apps/src/bm-wa03001-reconciliation-routes.ts and registered it in the API. The endpoint requires an approved baseline in the same activity and organization, recomputes its canonical hash, rechecks baseline and monitoring evidence are VERIFIED/content-addressed and activity-scoped, computes Equation 5 server-side from supplied measured-flow records, pins GWP to 29.8, calculates Equation 4, and stores an immutable provenance record. Duplicate activity/period submissions are rejected. Response explicitly says the calculation is not verified reductions, registry approval, or issued CCC.
- Added apps/test/bm-wa03001-reconciliation-contract.test.ts; after correcting its compiled test root, it passed. Migration validator passed with 94 migrations / 76 schema objects. Disposable PostgreSQL 16 applied all 94 migrations; the baseline/reconciliation integration test passed (1/1), covering the append-only reconciliation row, deletion/update rejection and duplicate-period uniqueness, along with baseline independent approval and mutation guards. The disposable database was removed.
- Important limit: the flow values and emissions are still submitted as an input payload. The API verifies their linked evidence records and preserves them as pending verification; it does not independently ingest meter telemetry or certify raw readings. No trusted Guardian execution, signed credential bridge, Hedera consensus write, Mirror Node confirmation, production migration, deployment, commit, or push occurred. Overall acceptance remains HOLD.


## 2026-10-19 15:05 UTC — Signed BM WA03.001 baseline-attestation bridge

- Added `apps/src/bm-wa03001-baseline-attestation.ts`: Ed25519 `vc+jwt` baseline attestation generation and signature verification helpers, deterministic canonical signing input, explicit issuer DID/key ID, 90-day expiry, baseline record hash, baseline/evidence identifiers, approval identity/time, and a public JWK export. It fails closed unless `RUPAYKG_BASELINE_SIGNING_ISSUER_DID`, `RUPAYKG_BASELINE_SIGNING_KEY_ID` (must be a fragment of the issuer DID), and `RUPAYKG_BASELINE_SIGNING_PRIVATE_KEY_PEM` are configured with an Ed25519 private key.
- Added `migrations/20261025_bm_wa03001_baseline_attestations.sql`: append-only signed attestation records, one per baseline, composite activity/organization integrity link, issuer/key ID, public JWK, JWT digest and expiry. Added API endpoints to issue an attestation only for independently approved baselines with a recomputed canonical hash and still-verified/content-addressed evidence, and to expose the corresponding public JWK at `/.well-known/rupaykg-baseline-jwks.json`. Issuance requires both `guardian:write` and verification permission. No signing secret is hardcoded.
- Added Ed25519 signature/tamper/wrong-issuer/wrong-key/expiry tests and source contract tests. The API suite passed 99/99 runnable tests (110 total; 11 DB/config-gated skipped). Full workspace build, lint and migration validation passed; 95 migrations / 77 schema objects validated. Disposable PostgreSQL 16 full migration and baseline/attestation/reconciliation integration test passed (1/1), and the disposable container was removed.
- Critical integration boundary: this is a RupayKg-signed VC-JWT attestation, not yet a Guardian-native Ed25519Signature2018 JSON-LD VC. Inspection of the local Guardian MRV sender 3.7.1-rc confirms it signs Guardian VCs with its configured DID document/key and posts them to the configured Guardian external-ingest URL. The sender UI and Guardian UI are reachable, but this environment exposes no `GUARDIAN_*` or RupayKg signing environment variables; no issuer credential was found/configured here. A trusted adapter must verify this JWT against the externally trusted DID/JWKS, map the verified subject into the appropriate Guardian policy schema, and use the authorized Guardian sender signer, then confirm Guardian processing before monitoring submission. No live Guardian policy import/verification, HCS write, production migration or deployment occurred. Production acceptance remains HOLD.


- Scope safeguard added to the signed credential subject: `attestationScope=INTERNAL_RECORD_ONLY` and `methodologyEligibility=NOT_ASSESSED`. This is deliberate: the current internal baseline form does not yet capture or validate the complete BM-T-011 input dataset, methodology-specific assumptions, versioned tool output and independently reconciled reference fixtures. Do not use this attestation as the BM-T-011 baseline VC required by Guardian's WA03.001 policy until that dependency is implemented and independently validated.

## 2026-10-19 15:22 UTC — BM-T-011 engineering and trusted-bridge blocker reconciliation

- Added the BM-T-011 v1.0 annual Application A FOD calculation engine and persisted, activity/geography-scoped annual assessment and independent decision routes. Results remain an internal methane-emissions-potential calculation in tCO2e; the code and API explicitly do not equate this result with BM WA03.001 FCH4,BL, methodology eligibility, BEE/ACVA approval, verified emission reductions, or CCC issuance.
- Latest tests: API suite 110 total, 99 passed, 0 failed, 11 DB/config-gated skipped; carbon suite 30/30 passed. The Guardian policy structural validator passed. Migration validator passed with 96 migration files and 78 schema objects. A fresh disposable PostgreSQL 16 database applied all 96 migrations, exposed 71 public tables, and the baseline/reconciliation DB integration test passed 1/1; the disposable container was removed. Full workspace build and lint had passed in the preceding validation run; no production migration/deploy occurred.
- Re-inspected local Guardian MRV sender 3.7.1-rc source. Its `POST /mrv-generate` takes a browser-supplied config containing the issuer DID/DID document/key, creates a Guardian-native VC, and POSTs it to the configured external-ingest URL. It is not a verifier for RupayKg's Ed25519 `vc+jwt` and does not implement the `rupaykg:guardian-mrv:v1` response contract. The browser UI's HTTP 200 is only reachability.
- Checked only presence/absence of configuration (no secret values read or displayed): RupayKg baseline signer issuer DID, key ID, private-key PEM, Guardian MRV submit URL, Guardian API token and Guardian MRV policy ID are not configured in this local process environment. No credential was invented, no unrelated Hedera key was reused, and no external policy import, HCS write, production migration or deployment occurred.
- Checkpoint next gate is now the trusted credential bridge, conditional on authorized issuer/sender configuration. After that: Guardian policy import/runtime validation and negative tests, authoritative Guardian VERIFIED execution, Hedera consensus confirmation, persisted provenance and Mirror Node confirmation. Overall production acceptance remains HOLD.
