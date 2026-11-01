# RupayKg Engineering Checkpoint — 2026-11-01

## Stakeholder approval geography integrity (PR pending)

- Branch: `security/stakeholder-approval-geography-integrity-2026-11-01`
- Scope: database-level consistency between each hierarchical stakeholder approval and its parent application geography.
- No production or staging database changes.

### Controls proposed
- Before insert/update, lock and read the parent application geography and compare using null-safe `IS DISTINCT FROM`.
- Preserve null geography as a valid global/platform scope; do not rely on a composite FK with MATCH SIMPLE semantics.
- Prevent changing an application's geography after its approval chain exists, avoiding a parent/child drift window.
- Integration tests cover scoped approvals, null/global approvals, forged geography, and parent geography rewrite.

### Release posture
- Migration and test are proposal-only until CI and independent review pass.
- No merge, deployment, production DDL/DML, role/grant or RLS changes.
- This closes only the approval/application geography relationship; onboarding authorization, control-plane scoping and full tenant isolation remain separate gates.
