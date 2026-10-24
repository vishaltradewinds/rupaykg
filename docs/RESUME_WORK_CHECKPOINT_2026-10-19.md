# RupayKg Resume Checkpoint â€” 2026-10-19

**Checkpoint captured:** 2026-10-19 15:28 UTC
**Repository:** `C:\Users\Vishal\Documents\GitHub\rupaykg`
**Branch:** `main`
**HEAD at checkpoint:** `0ddcf6087620880e21ea60f954c9f05d6b759469`
**Release posture:** **HOLD â€” engineering work only; no production acceptance**

## Why this checkpoint exists
Resume the RupayKg Carbon OS work without repeating prior steps or treating local implementation as official Government of India approval or issued Carbon Credit Certificates (CCC).

## Work in the working tree
The working tree is dirty. Changes are uncommitted and unpushed. No deployment or production migration was performed.

Major files/features present at checkpoint:
- CPCB SWM evidence links and related API/UI/tests.
- BM WA03.001 Guardian policy artifacts, schemas and structural validator.
- Persisted baseline records and baseline review routes:
  - `migrations/20261023_bm_wa03001_baseline_records.sql`
  - `apps/src/bm-wa03001-baseline-routes.ts`
- Append-only methane reconciliation records and API:
  - `migrations/20261024_bm_wa03001_reconciliations.sql`
  - `apps/src/bm-wa03001-reconciliation-routes.ts`
- Additional files now present and requiring review/validation before relying on them:
  - `apps/src/bm-wa03001-baseline-attestation-routes.ts`
  - `apps/src/bm-wa03001-baseline-attestation.ts`
  - `apps/src/bm-t-011-assessment-routes.ts`
  - `migrations/20261025_bm_wa03001_baseline_attestations.sql`
  - `migrations/20261026_bm_t011_assessments.sql`
  - corresponding tests and `packages/carbon/src/bm-t-011.ts`
- Documentation and checkpoint artifacts under `docs/` and `artifacts/`.

## Latest recorded validation results
These results were reported for the previous implementation pass; newly observed baseline-attestation and BM-T-011 files were not confirmed as covered by that validation and must be checked on resume:
- API suite: 107 tests, 96 passed, 0 failed, 11 skipped (DB/config-gated).
- Carbon package suite: 27 passed, 0 failed.
- Disposable PostgreSQL 16: all 94 migrations applied; baseline/reconciliation DB integration test 1/1 passed.
- Migration validation: 94 migrations and 76 schema objects validated.
- Guardian policy structural validator passed; this is **not** Guardian runtime validation.
- Root build, lint, `git diff --check`, and ecosystem checkpoint reconciliation passed.
- Temporary test PostgreSQL container was removed.

## Implemented BM WA03.001 flow (local engineering only)
- Baseline records bind an activity/org, methodology/version, evidence UUIDs and canonical SHA-256; submitted baselines can be independently approved/rejected; baseline inputs are immutable.
- Reconciliation route checks activity/org scope, approved baseline and hash integrity, VERIFIED/content-addressed evidence, and methodology/version. It calculates Equation 5 project methane and Equation 4 using pinned GWP 29.8, then persists append-only provenance as `RECONCILED_PENDING_VERIFICATION`.
- The API explicitly states that internal review/reconciliation is not independent verification, BEE/registry approval, or CCC issuance.
- Important remaining limitation: flow/emissions/leakage values are supplied in the API payload; evidence references are checked, but raw readings are not yet independently ingested/verified by trusted telemetry. Equation 6 energy-generation pathway is not implemented.

## Blocking production-acceptance gates
1. **Guardian runtime:** authorized session and actual import/validation/execution of the candidate policy are not proven. Structural policy validation is not runtime proof. Earlier demo/test login attempts returned HTTP 401.
2. **Trusted credentials:** W3C Verifiable Credential asymmetric issuer signing/verification bridge is not confirmed end-to-end.
3. **Hedera:** require a verified HCS write with `CONSENSUS_CONFIRMED`, transaction ID and consensus time; then Mirror Node confirmation and persisted `mirror_node_verified_at`. Do not expose or change keys. Existing account/key choice must be verified as a pair before any write.
4. **Production stakeholder/data:** production org/identity/membership/activity/evidence/credential/MRV data and authorized pilot activity are not verified. A prior health endpoint response alone is not acceptance proof.
5. **Negative tests:** fail-closed behavior must be proven for missing/invalid credentials, mismatched activity/org, unverified evidence, duplicate monitoring period, altered baseline hash and absent Guardian/Hedera confirmation.

## Next actions on resume
1. Inspect the current dirty diff and newly present BM-T-011/baseline-attestation files; verify route registration, migration order, authorization/scope, append-only behavior and tests.
2. Run current API/carbon tests, migration validation, policy structural validation, build, lint and diff checks after reviewing the new files. Use a disposable database only; do not migrate production.
3. Investigate local Guardian/MRV sender and existing `executeGuardianMrv` adapter contract without displaying secrets or inventing credentials. Use only an authorized existing session/config.
4. Add/complete authenticated end-to-end route tests where feasible.
5. Resume trusted Guardian credential bridge and actual runtime validation. If no authorized issuer/session exists, document the exact blocker and keep release **HOLD**.
6. Do not commit, push, deploy, publish a Guardian policy, write to Hedera, or run production migrations without explicit authorization and the required gates.

## Official-methodology reference
BEE BM WA03.001 PDF: https://beeindia.gov.in/sites/default/files/BM%20WA03.001.pdf

Equation 4 used by the implementation:
`ERy,calculated = (FCH4,PJ,y - FCH4,BL,y) * GWPCH4 * (1 - OX) - PEy - LEy`

**Golden rule:** local tests passing â‰  trusted Guardian execution â‰  Hedera consensus confirmation â‰  Government/registry approval â‰  CCC issuance.
