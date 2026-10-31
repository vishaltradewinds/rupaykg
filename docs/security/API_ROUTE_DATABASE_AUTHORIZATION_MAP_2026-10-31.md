# API route-to-database authorization map — 2026-10-31

**Scope:** static review of the working-branch API source plus read-only Neon production catalog.  
**Repository:** `vishaltradewinds/rupaykg`  
**Branch:** `shakti/atomic-inbox-claim-2026-10-31`  
**Purpose:** identify the route families and their database execution patterns before designing tenant isolation.  
**Not a certification:** route inventory is a first-pass source map, not yet a complete SQL/table/operation/principal/tenant proof.

## Verified runtime architecture

- Fastify API in `apps/src/server.ts`; PostgreSQL `pg.Pool` is created from `DATABASE_URL`.
- Shared authentication is in `apps/src/auth.ts`.
- `authenticate()` hashes a bearer token, checks a live session and verified/non-suspended identity, loads verified memberships, validates the optional active-organization header, and rejects multi-organization identities without explicit selection.
- `canActForOrganization()` and `hasOrganizationPermission()` provide application-level membership/permission checks.
- `apps/src/database-context.ts` derives the tenant context from server-verified `AuthContext` and sets `rupaykg.identity_id` and `rupaykg.organization_id` with transaction-local `set_config(..., true)`.
- The helper itself documents that it is infrastructure only and that callers must not assume RLS is enabled. The custom GUC values are not a non-forgeable identity boundary against a direct database client with the same privileges.
- Server-level `query()` and direct `pool.query()` remain available, so every route family and SQL statement must be mapped; use of the helper is not universal.

## Route family inventory (working-branch source)

| Source file | Routes found | Tenant transaction helper reference | Direct Pool / manual client patterns | Initial review classification |
|---|---:|---|---|---|
| `server.ts` | 10 | Yes | Direct `pool.query` and shared query helper | Mixed: public health/status/catalog; authenticated overview/geography; operational mutations require per-handler review |
| `auth-routes.ts` | 8 | No | Direct pool queries and manual clients | Identity/session/onboarding; identity-private and workflow-authority scopes |
| `workspace-routes.ts` | 8 | Yes | No direct pool query in source scan | Tenant-bound read projections and evidence verification |
| `bwg-routes.ts` | 1 | Yes | No direct pool query in source scan | Tenant-bound BWG/EPR obligation |
| `cpcb-swm-routes.ts` | 3 | Yes | No direct pool query in source scan | Tenant-bound SWM workspaces/status history |
| `epr-return-routes.ts` | 4 | Yes | No direct pool query in source scan | Tenant-bound EPR return lifecycle |
| `evidence-vault-routes.ts` | 4 | Yes | No direct pool query in source scan | Tenant-bound evidence vault/review |
| `mrv-routes.ts` | 4 | Yes | One manual client path | Tenant-bound MRV plus external anchoring read path |
| `registry-routes.ts` | 8 | No | One manual transaction helper/client | Bilateral organization/credential/settlement scope; not safe to blanket-bind to a single organization |
| `statutory-routes.ts` | 5 | Yes | No direct pool query in source scan | Tenant-bound applicability and reporting; public reference reads must be distinguished |
| `sync-routes.ts` | 7 | No | Multiple manual clients and transactions | Device/identity/organization-bound offline sync; requires its own signed device/tenant capability model |
| `value-routes.ts` | 9 | Yes | No direct pool query in source scan | Tenant-bound carbon/EPR/ESG/BWG workflows |
| `onboarding-hierarchy-routes.ts` | 3 | No | Direct pool reads and manual transactions | Cross-organization governance workflow; hierarchical authority/geography checks |
| `intelligence-routes.ts` | 1 | No | Direct pool reads | Aggregated tenant intelligence; review query scoping and disclosure boundaries |
| `platform-admin-routes.ts` | 16 | No | Direct pool reads and manual transactions | Platform-control-plane operations; separate platform authority, break-glass and audit model |

Source scan counts are syntactic counts of route registrations in the named files and helper-name occurrences. They do not imply all routes in a family have identical behavior or that no indirect query path exists.

## Confirmed implementation patterns and gaps

### 1. Authentication is application-layer, not database RLS
The authentication module validates the bearer session and membership before producing `AuthContext`. This is useful application authorization, but the production catalog still shows RLS disabled on all 67 public tables. A direct SQL connection using the current elevated inspection role is not constrained by these route checks.

### 2. Tenant transaction context is transaction-local but forgeable as a GUC
The shared helper uses a checked-out connection, begins a transaction, sets two custom GUC values transaction-locally, executes the callback, then commits/rolls back and releases. This protects against stale pooled values. It does not, by itself, prevent a client with SQL access from setting the same custom GUC values. Do not write RLS policies that trust those values as the only proof of identity or membership.

### 3. Routes outside the shared helper require dedicated classification
The static scan identifies manual/direct execution in auth, registry, sync, onboarding hierarchy, intelligence and platform-admin route families, plus selected server/MRV paths. These are not automatically vulnerabilities: some are intentionally public, identity-private, device-bound, bilateral or platform-admin operations. They cannot safely be assigned a single-organization policy without modeling their authority boundary.

### 4. Registry and settlement are bilateral
Authentication explicitly marks settlement paths as bilateral organization scope. A simple `organization_id = current_org` policy would incorrectly block or mis-handle payer/payee and credential-owner semantics. Model payer, payee, issuer, holder, transferee, verifier and settlement authority separately.

### 5. Offline sync is device-bound and replay-sensitive
Sync source uses manual transactions and checks device organization, identity and activity relationships in SQL. The eventual database policy must bind envelope → device → identity → organization → activity and preserve idempotency/cursor/replay semantics. Do not make sync a generic tenant-GUC-only path.

### 6. Platform admin and onboarding are distinct control-plane paths
Platform-admin and hierarchical onboarding workflows intentionally inspect or mutate records across organization boundaries under role/geography authority. They require narrowly scoped privileged capabilities, strong separation of duties and complete audit evidence, not blanket tenant-wide visibility.

## First-pass authorization matrix

| Data class | Examples | Read boundary | Write boundary | RLS design direction |
|---|---|---|---|---|
| Organization-owned operational | activities, resource_flows, obligations, BWG profiles/periods, SWM workspaces | Verified membership + permission + geography | Same plus operation-specific permission | Tenant policies anchored to verified organization context |
| Child-of-organization | measurements, evidence, verifications, BWG reports, SWM status history | Derive owner through parent FK; reject orphan/ambiguous joins | Same parent ownership plus lifecycle authority | Policy via stable parent relationship or carefully reviewed denormalized owner |
| Identity-private | identity credentials, sessions, password credentials | Exact authenticated identity or narrowly privileged auth service | Auth/session lifecycle only | Identity-specific policy; no broad tenant access |
| Multi-party / bilateral | credentials, registry events, transfers, settlements, settlement events | Party-specific role: issuer/holder/payer/payee/verifier | Distinct authority per lifecycle transition | Multi-party policy predicates; no single-org shortcut |
| Device/offline sync | field devices, sync envelopes, conflicts, cursors, operation envelopes | Bound device + identity + org | Enrollment/verification/apply/resolve permissions | Device capability and tenant binding; preserve replay fencing |
| Governance/onboarding | stakeholder applications, approvals, legal evidence, memberships | Applicant self-view and authority/geography-scoped reviewers | Hierarchical approval, legal verification, separation of duties | Dedicated control-plane policies and narrowly scoped reviewer capabilities |
| Platform control plane | roles, platform access requests, audit chain head | Platform admin or explicitly authorized service | Privileged, approved, audited operations | Separate role/capability; no ordinary tenant access |
| Global reference | geography, regulatory sources, methodologies, EPR schemes | Public/reference read or scoped snapshots | Controlled governance publisher | Explicit global read and publisher write; no tenant ownership inferred |
| Append-only provenance/audit | audit_events, registry_events, settlement_events, MRV provenance | Tenant/party/authority scoped | Append-only authorized actor/worker | Read policy by owner/party; insert policy by verified capability; deny update/delete |

The table is a design classification, not a final per-table approval. Every table and FK path still needs an explicit row in the master matrix.

## Live Neon catalog facts cross-linked to this source review

- Neon project `rupaykg-production-fresh`, project ID `steep-mud-79906940`.
- Sole authoritative branch `main`, branch ID `br-restless-base-b44cip2h`; database `rupaykg`.
- 67 public base tables, 0 RLS-enabled, 0 public policies.
- 92 migration ledger rows; maximum version `20261021`.
- Inspection principal `rupaykg` has BYPASSRLS, CREATEDB, CREATEROLE and REPLICATION and is a member of `neon_superuser`. It is not a suitable assumed application/worker principal.
- Prior catalog scan reported no public views. Trigger inventory contains many integrity/lifecycle guards. Trigger and function bodies, execution privileges, ACL/default privileges and sequence permissions still need detailed review.

## Required next gates

1. Generate an exhaustive route-handler → SQL callsite → table → operation → principal → context register, including indirect helper calls and dynamic SQL.
2. Read each manual transaction helper and prove whether it establishes tenant/device/platform context; do not infer from helper names.
3. Build the complete FK ownership graph and classify all 67 tables, including multi-party and global semantics.
4. Review all trigger/function definitions and their execution security; specifically inspect any SECURITY DEFINER function and search paths.
5. Inventory table/sequence/schema ACLs, default privileges, ownership and grants for each database principal.
6. Design separate least-privilege API, auth, migration, worker, event-writer and operations roles.
7. Design a non-forgeable tenant-context mechanism. GUCs may carry context but cannot be the sole authority proof.
8. Build a production-derived disposable Neon rehearsal and table-specific RLS policies; test forged GUCs, cross-tenant reads/writes, pooling, membership revocation, bilateral access, platform-admin separation and offline sync replay.
9. Independent review and explicit approval before any production migration, role/grant change or RLS activation.

## Safety status

No production database writes, migrations, role/grant/policy changes, branch promotions, deployments or worker activation were performed. Production remains HOLD; tenant isolation NOT ESTABLISHED; TRL 9 NOT ESTABLISHED.
