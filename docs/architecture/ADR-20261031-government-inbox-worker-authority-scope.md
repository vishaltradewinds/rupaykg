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
