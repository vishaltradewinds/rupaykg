# ADR: Government inbox worker authority scope

- Status: PROPOSED — NOT APPROVED
- Date: 2026-10-31
- Applies to: RupayKg government inbox ingestion and jurisdiction crosswalk worker
- Safety posture: FAIL-CLOSED; production worker OFF

## Context and authoritative observations

Read-only inspection of Neon project `rupaykg-production-fresh` (PostgreSQL 18.6) found:

- Production main currently has no `async_mirror_inbox`, inbox event, government crosswalk or authoritative source snapshot relations.
- Staging contains `async_mirror_inbox` and `async_mirror_inbox_events`, both owned by `rupaykg`, with RLS disabled, FORCE RLS disabled and no policies.
- Staging's current `record_async_mirror_inbox_event()` is not SECURITY DEFINER and is owned by `rupaykg`; the proposed NOLOGIN event-writer capability role is absent.
- The observed `rupaykg` database-owner login has CREATEROLE, CREATEDB, REPLICATION and BYPASSRLS. It owns the staging inbox/event tables and has CREATE on public. This role is not acceptable as the long-running worker identity.
- The current worker claim algorithm is global across the inbox; it does not constrain claim by organization or tenant. This may be correct for a national authority-ingestion queue, but it is a deliberate system-wide scope and must not be represented as tenant isolation.

No live schema, policy, role, grant, credential or worker changes were made.

## Decision required

Two materially different models remain:

### Option A — National system queue

Treat the inbox as a platform-operated government integration queue. A dedicated worker identity may process all rows in the designated queue and read only the minimum approved crosswalk/source-snapshot metadata required to resolve jurisdiction.

If selected:
- Grant global row scope only on the named internal queue/reference relations.
- Keep the worker identity separate from API, database-owner and application identities.
- Worker login must be non-superuser, NO CREATEROLE, NOCREATEDB, NOREPLICATION, NOBYPASSRLS and NOINHERIT.
- Do not grant evidence, credentials, settlements, user profiles, general organization data or arbitrary tenant-table access.
- Prefer a narrowly scoped SECURITY DEFINER resolver for complex organization/activity scope checks over broad SELECT grants.
- The worker may have an explicit all-rows RLS policy on the internal queue only; that policy is not a tenant-isolation control.
- Keep event-table INSERT behind the separate NOLOGIN event-writer function capability.

### Option B — Tenant/organization-scoped queue

Require each inbox row to carry a verified organization scope and only claim rows inside the worker's assigned tenant/organization partition.

If selected:
- Add and validate immutable organization scope on ingest.
- Claim and lease queries must be scoped by that organization.
- Add tenant-specific RLS policies and cross-tenant negative tests.
- Define national authority feeds that cannot be naturally assigned to one organization before ingest; do not silently route them through a global bypass.

## Recommendation for review

Option A is the more natural fit for a single national government-source ingestion queue, but only if it is explicitly approved as a system-level service with narrow relation-level grants. It must not use the current `rupaykg` owner/BYPASSRLS credential. A separate dedicated login role and explicit internal-queue RLS policy should be engineered and independently tested.

No option is approved by this ADR. Until the owner approves the scope and security model, production stays HOLD and the worker remains OFF.

## Required release gates

1. Written approval of Option A or Option B by the platform owner and security/compliance reviewer.
2. Dedicated worker identity and exact credential owner/rotation path.
3. Complete table/function/sequence privilege matrix; no broad owner or BYPASSRLS access.
4. RLS enabled/forced where appropriate, with positive and negative tests for worker, API, tenant and anonymous roles.
5. Disposable PostgreSQL and production-derived migration rehearsal under the exact non-superuser migration principal.
6. Queue concurrency, lease expiry, timeout, retry, crash recovery, duplicate delivery and cross-scope isolation acceptance.
7. Operational audit, monitoring, alerting, rollback and incident-response runbooks.
8. Production deployment approval; no automatic activation from migration success.

## Explicit exclusions

This ADR does not authorize a Neon migration, role creation, grant, policy change, secret change, worker deployment, scheduler activation, queue replay, external submission or production certification. TRL 9 remains unclaimed.


---

# Superseding decision addendum — national ingestion, organization-scoped downstream

**Decision date:** 2026-10-31  
**Status:** **ARCHITECTURE BASELINE SELECTED BY PLATFORM OWNER; security/compliance sign-off and production release approval PENDING**  
**Supersedes:** The mutually exclusive Option A / Option B decision framing above. Historical context is retained.

## 1. Decision

Adopt a hybrid model:

**National system-level government-source ingestion + organization-scoped downstream execution.**

This is not a choice between a national queue and tenant isolation. They apply to different layers and both are mandatory.

1. National government-source ingestion is a platform-operated system control plane. It receives, snapshots, validates, deduplicates and resolves public/regulatory source records at national scale.
2. The national worker may access only its named inbox, approved public source snapshots, jurisdiction crosswalk metadata and narrowly scoped resolver capabilities.
3. The national worker must not receive broad SELECT/UPDATE access to private organization evidence, measurements, MRV observations, user credentials, settlements, carbon projects or arbitrary tenant records.
4. Where an authoritative source record affects an organization, the ingestion service emits a minimal, provenance-bound dispatch envelope containing only the verified target organization identifier, source/snapshot references, jurisdiction, event type and correlation/idempotency keys.
5. Organization-scoped downstream workflows execute under a separately verified organization context and tenant authorization boundary. They re-check membership/authority, applicable rule version, evidence and current organization state before making a domain decision.
6. If an incoming source record cannot be safely mapped to a single eligible organization or jurisdiction, it remains unresolved/quarantined for controlled review. It must never be broadcast as an unrestricted tenant query.
7. National authority to ingest and maintain public regulatory data does not confer authority to read or mutate private organizational records.

## 2. Logical operating architecture

```text
CPCB / SPCB / Government registries / approved public sources
                         |
                         v
          NATIONAL SOURCE INTAKE GATEWAY
     signature/source identity, schema, hash, timestamp
                         |
                         v
          NATIONAL SYSTEM-LEVEL INBOX
        atomic claims, leases, retry, quarantine
                         |
                         v
        SOURCE SNAPSHOT + JURISDICTION CROSSWALK
       versioned provenance, approved mapping only
                         |
              minimal dispatch envelope
                         |
                         v
             TENANT DISPATCH BOUNDARY
       verified org ID + source references only
                         |
                         v
          ORGANIZATION-SCOPED WORKFLOW
      membership/authority + RLS + domain checks
                         |
                         v
      BWG / ULB / EPR / MRV / evidence / carbon
                         |
                         v
      independent verification / registry / settlement
```

Cross-cutting: identity, least privilege, audit trail, statutory versioning, data retention, key management, monitoring, backup/restore, incident response and Shakti Standards.

## 3. Worker trust boundaries

The national ingestion worker is a system-level service, not a super-tenant.

Allowed (subject to exact SQL and grant review):
- Claim/lease/retry/quarantine its dedicated national inbox rows.
- Read immutable approved source snapshots and approved jurisdiction crosswalk metadata.
- Execute a narrowly scoped resolver that returns only a mapping decision and minimal dispatch identifiers.
- Append payload-free processing transition events through a restricted event-writer capability.
- Publish a minimal dispatch envelope to the tenant workflow boundary.

Forbidden:
- Direct SELECT or DML on evidence, evidence versions/reviews, measurements, MRV observations/provenance, credentials, settlements, organization profiles, private carbon projects, user credentials/sessions or unrelated tenant tables.
- Arbitrary access to all organizations, identities or activity data.
- DDL, schema ownership, role administration, RLS bypass, table ownership, broad function execution, or use of the database-owner credential.
- Using source ingestion to silently approve statutory status, verify evidence, issue credits or settle payments.

A resolver that needs to validate an organization/jurisdiction relationship must expose only a boolean/decision and minimal identifiers. It must not return private evidence or broad organization rows. Any SECURITY DEFINER function requires a pinned search_path, fixed non-login owner, exact EXECUTE grants, reviewed SQL, and privilege-escalation tests.

## 4. Tenant-context and RLS principles

- API tenant operations use server-verified AuthContext, verified membership, explicit active organization, and transaction-local context.
- A caller-set custom GUC by itself is not a security boundary. RLS predicates must validate the identity/organization relationship against authoritative membership/authority records or use a separately signed/validated capability path.
- Child tables without organization_id inherit scope through reviewed FK/ownership paths; policies must fail closed if the parent cannot be resolved.
- Multi-organization dashboards use an explicit verified set-valued authorization contract; they must not silently select an arbitrary organization.
- Registry/credit transfer/settlement policies are bilateral: issuer, current owner, payer, payee, obligation, actor and credential lifecycle must be evaluated. A single organization_id predicate is insufficient.
- Device sync uses a device-specific identity and organization binding; submitted payload cannot select its own scope.
- Global reference catalogs are readable according to a separate public/reference-data policy and have tightly restricted write governance.

## 5. Architecture decisions

| Area | Decision |
|---|---|
| National source queue | System-level, globally claimed within the named internal queue only |
| Source snapshots / jurisdiction crosswalk | Platform-governed, versioned, provenance-bound |
| National worker | Dedicated least-privilege identity; no tenant evidence access |
| Tenant dispatch | Minimal event envelope; no private payload replication |
| Downstream workflows | Organization-scoped, membership/authority checked, RLS protected |
| Multi-org views | Explicit verified organization-set contract |
| Device sync | Device principal and device-bound organization scope |
| Registry / settlement | Bilateral party and credential lifecycle policies |
| API / worker / migration / event writer | Distinct identities and credentials |
| Production activation | Blocked until release gates below pass |

## 6. Evidence snapshot and changed risk understanding

Read-only Neon inspection on 2026-10-31 of project `rupaykg-production-fresh`, project ID `steep-mud-79906940`, default production branch `main` (`br-restless-base-b44cip2h`), database `rupaykg` confirmed:
- 67 public base tables.
- 0 tables with RLS enabled, 0 with FORCE RLS, and 0 public policies.
- All 67 public tables are owned by `rupaykg`.
- The observed `rupaykg` role has BYPASSRLS, CREATEROLE, CREATEDB and REPLICATION; it is a member of `neon_superuser`.
- The Neon inspection session reported `session_user=current_user=rupaykg`. This is the Neon administrative/inspection connection, **not proof of the Render runtime identity**.
- The production branch is currently not protected. Project history retention is configured to 21,600 seconds (6 hours). A successful independent backup restore has not been evidenced.
- Production and the production-derived worker rehearsal both report zero RLS-enabled public tables in the inspected catalog; rehearsal schema is not production authority.

The earlier 67-table/92-migration production baseline remains the recorded migration baseline. This addendum's live catalog snapshot did not alter it.

## 7. Approval and release gates

The platform owner has selected the hybrid architecture baseline. Before production use:
1. Security/compliance reviewer approves the concrete access and policy design.
2. Actual Render API database principal is measured through the deployed runtime path without revealing secrets.
3. Distinct API, migration, national worker, event-writer, tenant workflow, device and read-only operations identities are implemented where required.
4. All tables, columns, FK inheritance, views, triggers, sequences, functions, default privileges and SECURITY DEFINER surfaces are inventoried.
5. Table-specific RLS and grants are implemented only after complete route/statement mapping.
6. Exact-role positive/negative tests pass for cross-tenant, multi-org, bilateral settlement, device spoof/replay, worker scope, connection-pool context reuse and revoked membership.
7. Production-derived migration rehearsal preserves production-only migration 096 verifier provenance and reconciles all proposed migration history.
8. Backup/restore, rollback, operational monitoring, incident response, deployment and worker shutdown/recovery are rehearsed.
9. Explicit production change approval and post-change verification are recorded.

## 8. Decision scope

This ADR sets the target architecture. It does **not** authorize production DDL/DML, role/grant/credential changes, branch protection changes, worker service creation/activation, migration application, data replay, deployment, statutory acceptance, carbon-credit issuance or TRL 9 certification.

**Release posture: P0/P1 HOLD.** Worker remains OFF. RLS is not implemented. Actual Render runtime role is not verified. TRL 9 is not established.
