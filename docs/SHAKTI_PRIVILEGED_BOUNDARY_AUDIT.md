# Shakti Privileged Boundary Audit

## Purpose

RupayKg has two different database authorization domains:

1. **Tenant execution** — an authenticated organization member operates only inside the active verified organization and geography scope.
2. **Privileged platform execution** — an explicitly authorized Super Admin performs cross-organization platform administration.

These domains must not be collapsed into one generic RLS bypass.

## Tenant execution

Tenant application paths use:

- `withTenantTransaction(pool, auth, fn)`
- transaction-local `app.set_request_context(identity_id, organization_id)`
- verified membership validation
- same-`PoolClient` authorization and data access

Production RLS/runtime activation remains blocked until all tenant-sensitive application paths satisfy this contract and representative cross-tenant negative tests pass.

## Platform execution

Platform administration uses:

- `authorize(...)` for authenticated Super Admin + permission validation
- `withPlatformTransaction(pool, identityId, fn)`
- transaction-local `app.set_platform_context(identity_id)`
- explicit `app.execution_scope = PLATFORM`

The platform context is intentionally separate from tenant context because platform administration legitimately spans organizations.

## Onboarding hierarchy

`onboarding-hierarchy-routes.ts` is **not** treated as ordinary tenant execution.

Its authority model is hierarchical:

- PLATFORM: Super Admin / Platform Admin
- STATE: State Admin / Regulator
- DISTRICT: Regulator / State Admin
- LOCAL: Municipal Admin / Regulator

The review queue currently performs application-level eligibility filtering after reading pending applications. It therefore requires a dedicated hierarchy-aware RLS/context design before production RLS is enabled. It must not be granted a broad PLATFORM context merely to make RLS pass.

## External integrations

Guardian MRV and Hedera HCS are external anchoring/integration boundaries. They carry activity/verification/evidence identifiers but do not themselves establish PostgreSQL tenant authorization. Database authorization must occur before invoking them.

## Production gate

Do not enable production RLS or switch the live runtime to the non-BYPASSRLS role until:

- tenant routes are transaction-context complete;
- privileged platform routes use explicit platform context;
- onboarding hierarchy receives a least-privilege context design;
- business-route cross-tenant negative tests pass;
- authoritative runtime DB identity is proven;
- RLS policies are validated against the live schema;
- rollback/restore and operational evidence are recorded.
