# RupayKg Engineering Checkpoint — 2026-11-01

## Evidence-vault tenant integrity (PR #183)

- Pull request: https://github.com/vishaltradewinds/rupaykg/pull/183
- Branch: `security/evidence-artifact-tenant-integrity-2026-11-01`
- Status: draft engineering proposal; CI evidence pending.
- Scope: bind evidence artifact series, evidence versions and reviews to the same canonical activity/evidence chain.

### Proposed controls

- Composite FK: evidence-artifact series activity + organization must match the activity owner.
- Persist the canonical activity ID on each artifact version and constrain it to both its series and evidence parent.
- Composite FK: review's artifact-version/evidence pair must be the exact pair represented by that version.
- Backfill existing version activity IDs from the series, then fail closed if series/evidence activity relationships disagree.
- Add disposable PostgreSQL tests for valid same-activity creation and invalid cross-activity/version/review combinations.

### Safety

- Additive migration proposal only; no production or staging database mutation.
- No merge, deployment, RLS enablement or production certification.
- Existing evidence artifact rows must pass migration preflight; otherwise migration intentionally aborts.

### Release posture

This addresses only evidence-vault relational integrity. Tenant context, full route/query coverage, RLS and least-privilege production roles remain separate blockers.
