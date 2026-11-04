# RupayKg Engineering Checkpoint — 2026-11-01

## Stakeholder application role ownership (PR #184)

- Pull request: https://github.com/vishaltradewinds/rupaykg/pull/184
- Branch: `security/stakeholder-application-role-tenant-integrity-2026-11-01`
- Status: draft proposal; CI pending.
- Scope: prevent an onboarding application from pairing an organization with a role owned by a different organization.

### Proposed database control

- Add a composite unique key on `roles(id, organization_id)`.
- Add a composite foreign key from `stakeholder_applications(role_id, organization_id)` to the exact owning role.
- Validate existing rows; migration must fail closed if any application references a role owned by another organization.
- Add disposable PostgreSQL acceptance coverage for valid same-organization applications and rejected cross-organization role pairing.

### Safety

- Additive migration only; no production or staging database mutation.
- No merge, deployment, RLS or role/grant changes.
- This is a narrow relational integrity fix, not full tenant isolation.
