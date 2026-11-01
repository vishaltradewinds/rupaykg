# RupayKg Engineering Checkpoint — 2026-11-01

## Evidence-vault tenant integrity (PR #183)

- Pull request: https://github.com/vishaltradewinds/rupaykg/pull/183
- Branch: `security/evidence-artifact-tenant-integrity-2026-11-01`
- Latest validated head: `3c54c6c5f2d4190be7950a94dcecbf99f24f7b83`
- CI run: [41289170302](https://github.com/vishaltradewinds/rupaykg/actions/runs/41289170302) — **success, all steps complete**.
- Status: draft, open, unmerged.
- Scope: bind evidence artifact series, evidence versions and reviews to the same canonical activity/evidence chain.

### Implemented controls

- Composite FK: evidence-artifact series activity + organization must match the activity owner.
- Persist canonical activity ID on each artifact version and constrain it to both its series and evidence parent.
- Composite FK: review's artifact-version/evidence pair must be the exact pair represented by that version.
- Backfill existing version activity IDs from the series; migration fails closed if series/evidence activity relationships disagree.
- Evidence upload route now supplies the canonical activity ID for new versions.
- Disposable PostgreSQL integration tests cover valid same-activity creation and rejected cross-activity/version/review combinations.

### Validation evidence

- Production dependency audit passed.
- Migration validator passed.
- Disposable PostgreSQL migration and acceptance tests passed.
- TypeScript, build and browser smoke test passed.
- Production container build passed.
- Initial CI run exposed test-fixture and upload-route defects; both were corrected before the successful run.

### Safety and release posture

- Additive migration proposal only; no production or staging database mutation.
- No merge, deployment, RLS enablement, role/grant changes or production certification.
- Existing evidence artifact rows must pass migration preflight; otherwise migration intentionally aborts.
- This PR addresses only evidence-vault relational integrity. Tenant context, full route/query coverage, RLS and least-privilege production roles remain separate blockers.
