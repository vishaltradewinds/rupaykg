# Shakti Tenant Isolation Gate

## Purpose

RupayKg must enforce organization isolation at the database boundary, not only in application authorization code.

## Runtime contract

Before production RLS is enabled:

1. The web/API process must use a dedicated runtime database role that does not have BYPASSRLS.
2. Authentication must resolve a verified identity and active organization.
3. The request must establish app.identity_id and app.organization_id transaction-locally.
4. RLS policies must use app.current_organization_id() and fail closed when no context exists.
5. Auth/administrative operations must use explicit privileged paths.
6. Cross-tenant negative tests must prove that tenant A cannot read/write tenant B.
7. Production must remain HOLD until all six conditions are evidenced.

## Current implementation

Migration 20261107_tenant_isolation_runtime_contract.sql establishes:

- app.current_identity_id()
- app.current_organization_id()
- app.set_request_context(identity_id, organization_id)
- a non-login rupaykg_app_runtime role

It deliberately does not enable RLS or create production credentials. That is intentional: enabling RLS before the application runtime is transaction-context aware could break legitimate requests or create a false security posture.

## Completion evidence required

The gate is complete only when repository code, migration state, deployment configuration and runtime tests all demonstrate:

request authentication -> verified membership -> transaction context -> non-BYPASSRLS role -> RLS policy -> tenant-isolated result

A passing unit test alone is insufficient.

## 2026-11-08 engineering update

The canonical repository now contains the Shakti RLS policy foundation in `migrations/20261108_shakti_rls_policy_foundation.sql` and the activation/rollback procedure in `docs/SHAKTI_TENANT_ISOLATION_ACTIVATION_RUNBOOK.md`.

The policy foundation is intentionally not the final production acceptance: RLS enablement remains behind the runtime-role and transaction-context deployment gate. This prevents the current application owner/BYPASSRLS path from being mistaken for tenant-isolated production security.


## 2026-11-13 context-authenticity hardening

A live read-only production test established that custom GUCs `app.identity_id` and `app.organization_id` are directly settable by the runtime database login. Membership-aware RLS rejects a mismatched identity/organization pair, but a caller that can set a known valid pair could impersonate that membership if the runtime SQL session is compromised.

Migration `103_shakti_nonforgeable_request_context.sql` now introduces:
- opaque, short-lived grants minted by the SECURITY DEFINER bearer-session bootstrap;
- a three-argument `app.set_request_context(identity_id, organization_id, context_token)` that validates the grant against the live session and current verified membership;
- SECURITY DEFINER RLS context readers that return NULL unless the transaction-local identity, organization and opaque grant match;
- no direct runtime-role SELECT/INSERT/UPDATE/DELETE access to the private grant table.

The API authentication path carries the grant internally and `withTenantTransaction` must pass it to the setter. A direct GUC pair without the opaque grant must see zero tenant rows. The rollback-only SQL and disposable PostgreSQL integration tests assert this negative case.

**Important:** migration 103 and the associated code are repository candidate changes only until the current-head CI run passes and a controlled production change is separately authorized. Production Neon remains unchanged. The remaining 50 RLS-disabled tables still require per-table classification and policy/negative-test coverage; this migration does not complete full-platform tenant isolation.
