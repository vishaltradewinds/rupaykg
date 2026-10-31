# 2026-10-31 17:21 UTC — verified EPR and ESG evidence-binding extension

- Accepted baseline: implementation SHA `b7f2889813c5f354fec1f40ecc8bab549f0e1389`, CI #4021 / run `41222991003`: SUCCESS on exact SHA, including full production container build.
- New implementation SHA: `452cd4a54e2197b4103539e3279bf60e66625c15`.
- Extended real Evidence Vault integration tests so EPR and ESG each have:
  - Captured/unreviewed evidence rejected with `EVIDENCE_NOT_VERIFIED`.
  - Evidence uploaded through `/api/v1/evidence-vault/upload`.
  - Independent reviewer approves through `/api/v1/evidence-vault/:evidenceId/review`.
  - The exact returned approved verification is bound to the matching evidence ID in the report write.
  - Resulting report status is `VERIFIED`; EPR remains `externalSubmission: NOT_SUBMITTED`.
- CI #4026 / run `41223276559` is queued for exact SHA. No green claim until all gates pass.
- No production data, DDL, roles, grants, deployment, workers, scheduler or certification changes.
