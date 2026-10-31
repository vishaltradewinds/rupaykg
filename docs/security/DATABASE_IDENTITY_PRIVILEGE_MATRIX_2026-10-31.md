# RupayKg Database Identity and Privilege Matrix

**Date:** 2026-10-31  
**Status:** Target design — no role or credential changes performed  
**Authority:** Hybrid national-ingestion / organization-scoped-downstream ADR

## 1. Current production identity evidence

Neon project `rupaykg-production-fresh`, branch `main`, database `rupaykg`:
- Only application login role found: `rupaykg`.
- `rupaykg` owns all 67 public tables.
- Role attributes: LOGIN, BYPASSRLS, CREATEROLE, CREATEDB, REPLICATION; not PostgreSQL SUPERUSER.
- `rupaykg` is a member of `neon_superuser`.
- No non-owner table ACL entries or PUBLIC table ACL entries were found.
- No RLS policies exist on the 67 public tables.
- Render runtime role remains NOT VERIFIED; the Neon catalog session is not proof of Render's actual role.

**Do not reuse `rupaykg` as a long-running API or worker login.** It is a privileged database owner identity.

## 2. Target identity matrix

The role names below are proposed logical names, not created PostgreSQL roles. Naming can be finalized with the migration owner. Each login must have its own secret, rotation path, deployment binding and observability.

| Identity | Login? | Intended access | Explicitly forbidden | Scope / gate |
|---|---|---|---|---|
| `rupaykg_owner` (existing owner to be renamed/replaced only via approved plan) | Break-glass / migration owner only | Object ownership and controlled DDL; no routine app traffic | Routine API, worker, device or dashboard queries | P0; preserve Neon platform requirements and test ownership transfer carefully |
| `rupaykg_api` | Yes | Tenant API DML under RLS; identity operations only through narrow identity functions/queries; approved reference SELECT | DDL, CREATEROLE, CREATEDB, REPLICATION, BYPASSRLS, queue claiming, broad admin bypass | P0; exact Render runtime test |
| `rupaykg_identity` | Optional separate login or tightly scoped API capability | Self identity, credential, session and membership bootstrap operations | Arbitrary organization evidence, measurements, settlements or queue access | P1; decide if separate service boundary is operationally justified |
| `rupaykg_national_ingest` | Yes | Named national inbox claim/lease/retry/quarantine columns; approved source snapshots/crosswalk; exact resolver EXECUTE; minimal dispatch enqueue | Tenant evidence, measurements, MRV, credentials, settlement, profiles, DDL, role admin, RLS bypass | P0 before worker deployment |
| `rupaykg_tenant_workflow` | Yes or service capability | Process a single authorized tenant dispatch under verified organization capability and tenant RLS; re-check membership and current state | Arbitrary cross-tenant reads; accepting org ID from untrusted payload | P0/P1 before tenant dispatch activation |
| `rupaykg_device_ingest` | Yes if separate process; otherwise service capability | Device enrollment/sync envelope/cursor/conflict operations for device-bound organization; narrow functions | Changing device organization scope, arbitrary organization reads, human identity/session access | P1 before field sync production scale |
| `rupaykg_event_writer` | **NOLOGIN capability role** | INSERT-only append path to named inbox/transition/audit event relations through a reviewed function | SELECT, UPDATE, DELETE, TRUNCATE, DDL, role admin | P0; function owner and SECURITY DEFINER review required if used |
| `rupaykg_migrator` | Ephemeral login | DDL and migration ledger operations during approved maintenance window | Routine API/worker use; long-lived application secret | P0 before migration release |
| `rupaykg_ops_readonly` | Yes | Minimum operational metadata, health and non-sensitive diagnostics | PII, credentials, evidence payload, write/DDL, secrets | P1; row/column masking required |
| `rupaykg_platform_admin` | Prefer no standalone DB login; application privilege/capability | Narrow audited control-plane functions after platform-admin authorization | General BYPASSRLS, unrestricted data-plane reads/writes | P1; two-person approval for sensitive changes |

The exact number of roles is not fixed prematurely. A separate login is justified only where the trust boundary and deployment boundary are genuinely separate. Application roles must never be given superuser or BYPASSRLS.

## 3. Grant design principles

### National ingestion worker
- Queue: SELECT required claim fields; UPDATE only lease, status, attempts, retry, quarantine and processing-result columns actually written by the worker.
- Source snapshots/crosswalk: SELECT only approved, current, non-revoked records.
- Scope resolver: EXECUTE on one or a small number of reviewed functions returning only eligibility/mapping result and minimal dispatch identifiers.
- Dispatch: INSERT only minimal tenant dispatch envelope; no arbitrary tenant table access.
- Event writer: append only; no update/delete of prior events.
- No schema CREATE, table ownership, sequence ownership, migration ledger write, broad EXECUTE, or access to `evidence`, `measurements`, `mrv_observations`, `credentials`, `settlements`, `identity_password_credentials` or `identity_sessions`.

### API
- No object ownership and no schema-level CREATE.
- RLS is enabled/forced as appropriate only after the policy matrix is complete.
- Tenant data access is transaction-bound and validated against active, verified membership.
- Identity/bootstrap functions are separated from tenant domain queries.
- Multi-organization views require a verified organization-set authorization context, not an arbitrary organization ID array from the client.

### Migration owner
- Short-lived credentials and explicit maintenance window.
- Migration runner must use a different secret/role from `DATABASE_URL` used by the web runtime.
- Production migration process validates the exact ledger and schema baseline before any DDL.
- Migration owner is not used for runtime or CI tests against production.

### Tenant workflow and device services
- Dispatch messages are untrusted until verified against server-side dispatch/job records.
- One transaction handles one organization scope at a time.
- RLS must validate organization membership or a trusted, non-forgeable job capability; custom GUC alone is insufficient.
- Device identity and organization binding come from server enrollment records, never from payload claims.

## 4. Role attribute baseline

For every application login:
- `NOSUPERUSER`
- `NOBYPASSRLS`
- `NOCREATEROLE`
- `NOCREATEDB`
- `NOREPLICATION`
- `NOINHERIT` unless a reviewed role-membership design requires otherwise
- No table ownership
- No schema CREATE
- No default privileges that grant future tables/functions broadly

For the event-writer capability role:
- `NOLOGIN`
- No membership granted to general API/worker roles unless only via a narrow reviewed function ownership pattern.
- Only the minimal append capability.

For the migration owner:
- DDL capability only for controlled migration; credentials not present in web/worker runtime.

## 5. Database object inventory that must be completed before DDL

The production catalog snapshot has 67 public tables, 115 public functions, 0 SECURITY DEFINER public functions, and 92 migration ledger rows through `20261021`. All 67 public tables are owned by `rupaykg`.

Before generating final GRANT/REVOKE/RLS SQL, capture and review:
- Every column, primary/unique/check constraint and FK.
- FK inheritance chains for all 39 tables without direct organization_id or identity_id.
- Views/materialized views and view-owner behavior.
- All triggers and trigger functions.
- All sequences and sequence privileges.
- Function signatures, volatility, EXECUTE grants, search_path and dynamic SQL.
- Schema/database ACLs and default privileges.
- Role memberships, owner dependencies and Neon platform role requirements.
- Application query graph for every active route, worker, script, seed, scheduled job and operational command.

## 6. Mandatory identity acceptance tests

1. API role cannot read or mutate another organization's root or child records.
2. API role cannot bypass RLS or create schema objects.
3. Revoked/suspended membership loses access immediately, including reused pooled connections.
4. Multi-org user sees only the explicitly authorized organization set.
5. National worker can claim the national queue but cannot SELECT private evidence, measurements, MRV, credentials or settlements.
6. National worker cannot choose or widen tenant scope from payload.
7. Tenant workflow executor can process only a valid signed/recorded dispatch for one organization and cannot reuse the capability for another.
8. Device principal cannot change its organization binding, replay a stale cursor or submit as another device.
9. Event writer can append the required event but cannot read/update/delete previous events.
10. Migrator can perform approved DDL but is absent from runtime configuration.
11. Read-only ops cannot read sensitive payloads or mutate any table.
12. Pool reuse clears transaction-local identity/organization context on commit, rollback, timeout and exception.
13. Settlement party A cannot inspect party B's unrelated records; payer/payee/credential transitions remain bilateral and state-checked.
14. Platform-admin operations are audited and cannot silently bypass two-person controls.

## 7. Rollout gate

This matrix is a design, not an executable migration. No roles, passwords, grants, ownership, RLS policies or Render secrets were changed. Production remains HOLD pending actual Render identity verification, final query/object inventory, disposable production-shaped tests, independent review, backup/restore and explicit change approval.
