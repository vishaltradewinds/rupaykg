# 2026-10-31 — BWG evidence provenance and verification binding acceptance PASSED

## Verified source and CI
- Repository: `vishaltradewinds/rupaykg`.
- Branch: `shakti/atomic-inbox-claim-2026-10-31`.
- Implementation SHA: `b7f2889813c5f354fec1f40ecc8bab549f0e1389`.
- CI #4021 / run ID `41222991003`: SUCCESS on exact SHA.
- Run URL: https://github.com/vishaltradewinds/rupaykg/actions/runs/41222991003

## Passed gates
Dependency audit; migration validation; exact production migration baseline reconstruction; pre-upgrade schema/verifier capture; migration upgrade chain; idempotency; typecheck; build; browser smoke; disposable PostgreSQL acceptance; migration evidence upload; production container build.

## What the authenticated integration test exercises
- Registers actual BWG value routes and actual Evidence Vault routes against disposable PostgreSQL.
- Uploads PDF evidence through `/api/v1/evidence-vault/upload`; checks SHA-256 and artifact-version creation through production route logic.
- Uses a separate authenticated reviewer identity with `evidence:review` and `VERIFY_EVIDENCE` permissions; review endpoint creates append-only artifact review, approved verification and transitions evidence to VERIFIED.
- Captured/unreviewed evidence is rejected by BWG waste, EPR and ESG report routes.
- A verification belonging to a different independently reviewed evidence item is rejected (`VERIFICATION_INVALID`).
- Correctly matched evidence + its own approved verification is accepted for BWG waste and report status becomes VERIFIED.
- The earlier positive EPR/ESG paths remain tested as PENDING with no evidence; verified EPR/ESG paths are the next extension.
- The audit review rows are append-only; disposable fixtures preserve those rows and their evidence lineage rather than attempting prohibited deletion.

## Prior CI corrections retained as evidence
- CI #4009 exposed fixture cleanup order; corrected before final test pass.
- CI #4012 exposed missing fixture token typing; corrected.
- CI #4015 exposed append-only evidence review cleanup protection; cleanup now preserves audit records.
- CI #4018 exposed an improperly prepared mismatch fixture (second evidence was still CAPTURED); corrected by independently approving both items before testing mismatched verification.
- CI #4021 exact-SHA SUCCESS verifies all changes.

## Boundaries and next gates
- All test writes occur only in disposable CI PostgreSQL. No production schema/data/roles/grants/deployment/worker/scheduler/certification changes.
- A `VERIFIED` report in this test means the evidence artifact was independently reviewed and the approved verification ID was bound to that exact evidence. It does not imply CPCB acceptance, external registry issuance, carbon-credit eligibility, settlement or statutory compliance certification.
- Next: complete positive verified-evidence paths for EPR and ESG, then test cross-tenant evidence rejection, verification scope semantics, replay/idempotency and source/artifact integrity. Continue the separate P0 RLS, tenant isolation, least-privilege runtime identity and geography fail-closed work.
