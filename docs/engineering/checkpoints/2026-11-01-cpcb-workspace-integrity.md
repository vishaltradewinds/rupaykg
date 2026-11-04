# RupayKg Engineering Checkpoint — 2026-11-01

## CPCB workspace tenant integrity (PR #182)

- Pull request: https://github.com/vishaltradewinds/rupaykg/pull/182
- Branch: `security/cpcb-workspace-tenant-fk-2026-11-01`
- Reviewed head: `e83daaa53ffe7fb84c96f11cf207c279f14ac694`
- Workflow run: `41282978183`
- Workflow job: `124778506925`
- Result: **PASS** — all 17 workflow steps completed successfully.

### Implemented in the draft

- Added a composite unique key on CPCB stakeholder workspace `(id, organization_id)`.
- Added a composite foreign key from CPCB status history `(workspace_id, organization_id)` to that exact workspace/organization pair.
- Added disposable-PostgreSQL integration coverage: same-organization history insert succeeds; cross-organization attribution is rejected by the named FK.
- Migration uses `NOT VALID` followed by explicit validation.

### Validation evidence

CI passed dependency installation and production dependency audit, migration validation, migration execution against disposable PostgreSQL, TypeScript typecheck, application build, production web browser smoke test, PostgreSQL acceptance tests, and production container build.

A read-only production preflight previously found zero current CPCB status-history/workspace organization mismatches. This is a point-in-time data observation, not proof against future cross-tenant writes.

### Safety and release posture

- Draft PR only; not merged.
- No production or staging SQL/schema/role/grant/RLS/secret/Render/deployment changes.
- No production rollout authorized or performed.
- This is one integrity constraint, not completion of tenant isolation or production certification.

## Next engineering gates

1. Review composite FK semantics and migration compatibility, including existing delete behavior and historical retention requirements.
2. Continue evidence-series/activity organization binding and evidence-version/review cross-reference integrity analysis.
3. Continue remaining tenant ownership constraints from the ownership-route inventory.
4. Design and rehearse table-by-table RLS and least-privilege role changes on an isolated Neon branch; do not blanket-enable RLS.
5. Prove exact Render runtime database/branch identity with a safe non-secret fingerprint before any live migration planning.
6. Keep worker and scheduler disabled until tenant isolation, dedicated least-privilege principals, operational supervision and adversarial acceptance gates pass.

**Status:** engineering evidence improved; production tenant isolation remains a release blocker.