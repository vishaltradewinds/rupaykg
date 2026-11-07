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