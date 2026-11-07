# Tenant-Isolation Database Context Design

Status: **IN PROGRESS — CONTEXT PRIMITIVE + PROTECTED ROUTE MIGRATION + EXPLICIT AUTH BOOTSTRAP INTEGRATED; RLS POLICY MIGRATION PENDING**

## Objective

Move tenant enforcement from application-only authorization toward database-enforced fail-closed isolation without trusting client-supplied tenant identifiers.

## Required request transaction

For an authenticated organization-scoped request:

1. Execute authentication bootstrap reads inside an explicit, organization-neutral PostgreSQL bootstrap context.
2. Resolve verified organization membership and permissions in application code.
3. Open a dedicated PostgreSQL transaction.
4. Set transaction-local authorization context: identity UUID, active organization UUID, and explicit bilateral scope where required.
5. Execute all protected reads/writes through that transaction.
6. Commit or roll back.
7. Release the pooled connection.

The context must use PostgreSQL transaction-local settings (`SET LOCAL` or an equivalent safe parameterized mechanism) so it cannot survive connection release.

## Fail-closed rules

- Missing identity context => protected policy denies.
- Missing organization context => protected policy denies.
- Invalid UUID context => request fails before protected SQL.
- Client `x-rupaykg-organization-id` is an application routing input only; it must never be treated as proof of authorization by RLS.
- Service/migrator access must use a separately controlled database identity/context and must not be reachable through ordinary request headers.
- No session-level tenant setting may be used on pooled API connections.
- Connection release must occur after transaction completion.

## Important implementation constraint

The current API uses a shared PostgreSQL pool and many routes currently call `pool.query()` directly. Therefore enabling RLS before migrating protected data access to transaction-scoped context would risk false denials, partial authorization, or unsafe context leakage.

The current sequence is:

**context abstraction [DONE] -> representative protected-route migration [DONE] -> broader protected-route migration [IN PROGRESS] -> explicit bootstrap context [DONE] -> bootstrap boundary disposable test [DONE] -> authentication integration [DONE ON PR #311] -> complete RLS policy migration [PENDING] -> disposable cross-tenant/RLS rehearsal [PENDING] -> independent release gate -> production proposal.**

### Authentication bootstrap boundary

`identity_sessions`, `identities`, and `organization_memberships` are control-plane records required to establish an authenticated organization context. They cannot depend on the user's tenant context before authentication has completed.

The implemented engineering boundary is an explicit bootstrap transaction with:

- `service_mode=false`;
- `bilateral_scope=false`;
- no organization context;
- pooled connection released after the transaction;
- scope limited to authentication/control-plane bootstrap reads.

This is **not** an unrestricted application service bypass. `authenticate()` is now integrated with this primitive on the tenant-isolation work branch. The remaining gate is disposable PostgreSQL proof that the bootstrap path can read only the intended control-plane records and cannot reach arbitrary tenant data.

No production RLS mutation is authorized by this document.

## Validation requirements

The disposable PostgreSQL suite must prove:

- cross-organization SELECT isolation;
- cross-organization INSERT isolation;
- cross-organization UPDATE isolation;
- cross-organization DELETE isolation;
- revoked membership isolation;
- suspended identity isolation;
- multi-organization active-context switching;
- bilateral workflow semantics;
- pooled-connection context reset;
- service/migrator exception boundaries.

No production RLS mutation is authorized by this document.
