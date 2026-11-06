# RupayKg — Runtime Role Privilege Model & Disposable Acceptance Plan
Date: 2026-11-06

## Status

ENGINEERING DESIGN — derived from the reconciled 67-table policy register and disposable runtime-role rehearsal. Production remains READ-ONLY/HOLD.

## Evidence baseline

- Authoritative Neon project: `steep-mud-79906940`.
- Rehearsal branch: `br-dry-base-b42zrepz`.
- Live/rehearsed schema inventory: 67 public base tables.
- Current inspected baseline: application tables are owned by `rupaykg`; RLS is disabled on the inspected rehearsal branch.
- Disposable probe role demonstrated that a runtime identity can operate without SUPERUSER, CREATEROLE, CREATEDB, REPLICATION, or BYPASSRLS.
- CI #5796 passed all 20 validation gates on commit `14c8cc9368cc7f41b3796f718f5f098c6e7d0891`.

## Target role architecture

Three identities must remain distinct:

1. **Schema owner** — NOLOGIN; owns application objects; never used by request-serving application code.
2. **Runtime role** — LOGIN; least privilege; no SUPERUSER, CREATEROLE, CREATEDB, REPLICATION, or BYPASSRLS; receives only application privileges required by the runtime access inventory.
3. **Protected migrator role** — separate privileged identity used only by the protected migration job; never exposed to the web/API runtime.

The current `rupaykg` role is not acceptable as the final runtime identity because existing evidence shows elevated role capabilities and object ownership. This is an architectural blocker, not a cosmetic hardening item.

## Privilege model derived from policy classes

### TENANT — 23 tables

Runtime access is permitted only through transaction-scoped tenant context and corresponding RLS policies. Direct table grants do not constitute tenant authorization.

Required database privilege shape:
- SELECT/INSERT/UPDATE/DELETE only where application access-path inventory proves the operation is required.
- No ownership.
- No ALTER/DROP/TRUNCATE.
- No grant-option privileges.
- RLS must be enabled and forced before production runtime cutover.
- Policies must bind `app.rupaykg.identity_id` and `app.rupaykg.organization_id`; service-mode exceptions must be explicit and separately tested.

### BILATERAL — 8 tables

Runtime privileges must be paired with explicit bilateral visibility/write policies.

Required policy dimensions:
- participating organizations;
- directionality (from/to, issuer/recipient, payer/payee, processor/actor, etc.);
- whether bilateral scope is explicitly enabled;
- service-mode behavior;
- mutation authority versus read visibility.

A bilateral table must never be treated as ordinary single-tenant data.

### INHERITED — 22 tables

Runtime authorization is inherited from the authoritative parent chain. The principal chain currently established for the core MRV path is:

`organization → activity → evidence → verification`

Other inherited tables require source-level relationship review before their policy is frozen.

No inherited table receives an independent tenant key merely to simplify RLS. The policy must follow the actual ownership lineage.

### SHARED/ROOT — 14 tables

These are not tenant-filtered by default. Access must therefore be narrowed by operation and sensitivity.

Examples of expected posture:
- reference/catalog reads may be runtime-readable;
- identity/session/credential/control-plane data requires explicit access-path authorization;
- `schema_migrations` is migration-control data and must not be runtime-writable;
- regulatory/reference write authority must remain outside ordinary tenant runtime paths.

## PUBLIC privilege review

Before production cutover, inspect and explicitly record:
- schema PUBLIC privileges;
- table PUBLIC privileges;
- sequence PUBLIC privileges;
- function EXECUTE privileges;
- default privileges;
- ownership dependencies;
- SECURITY DEFINER functions and their owner/search_path safety.

The final runtime role must not depend on accidental PUBLIC privileges.

## Required disposable acceptance sequence

The next disposable-only gate must prove, in order:

1. Create a non-login schema owner and a non-privileged runtime login role.
2. Transfer ownership of representative disposable application objects to the schema owner.
3. Grant runtime privileges only to the runtime role.
4. Enable and FORCE RLS on representative TENANT, BILATERAL, and INHERITED tables.
5. Verify organization context is transaction-local.
6. Verify cross-tenant SELECT/INSERT/UPDATE/DELETE denial.
7. Verify inherited Activity → Evidence → Verification isolation.
8. Verify bilateral visibility with scope disabled/enabled.
9. Verify service-mode behavior is explicit and cannot be entered by ordinary tenant requests.
10. Verify runtime role cannot bypass RLS or modify schema/roles.
11. Verify runtime role cannot alter migration ledger/control-plane tables.
12. Verify sequence/function privileges required by real INSERT paths.
13. Verify PUBLIC privileges are not silently supplying access.
14. Verify a connection returned to the pool has no previous tenant context.
15. Run the full CI engineering gate.

## Production cutover remains blocked until all of these are independently evidenced

- exact 67-table access-path inventory;
- complete policy review for all 23/8/22/14 classifications;
- disposable least-privilege role rehearsal;
- disposable adversarial RLS acceptance;
- restore/rollback rehearsal;
- migration chronology/ledger reconciliation;
- independent release review;
- explicit founder approval for any production DDL/role/grant/ownership change.

## Non-negotiable safety boundary

This document authorizes no production mutation. No production RLS enablement, role creation, grant change, ownership transfer, migration replay, deployment, merge, certification, or TRL 9 declaration follows from this design alone.
