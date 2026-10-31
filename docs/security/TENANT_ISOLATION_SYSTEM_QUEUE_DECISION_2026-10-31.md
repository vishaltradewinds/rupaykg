# Tenant isolation and system-queue security decision — 2026-10-31

**Status:** Proposed architecture; release-blocking design gate  
**Scope:** RupayKg national government inbox / asynchronous mirror worker  
**Evidence:** Read-only Neon catalog inspection on 2026-10-31  
**Production project:** `steep-mud-79906940`  
**Production branch:** `br-restless-base-b44cip2h`  
**Staging branch:** `br-spring-hill-b4544vz5`  
**No database changes were made.**

## 1. Verified facts

### Production main
- The inspected public application tables have row-level security disabled and no policies.
- The existing `rupaykg` login has `BYPASSRLS`, `CREATEDB`, `CREATEROLE`, and `REPLICATION` privileges; it is not a least-privilege application or worker principal.
- The production main branch does not contain the candidate async inbox/event schema at the time of inspection.

### Staging
- `async_mirror_inbox` and `async_mirror_inbox_events` exist.
- The inspected inbox columns include authority code, municipal code, batch ID, payload, status, attempts, lease and validation fields. There is no `organization_id` or `tenant_id`.
- The inspected event table records inbox ID, authority/municipal codes, batch ID, status transition, attempt, payload hash, error code and timestamp. There is no tenant key.
- Both queue tables were found with RLS disabled and no policies.
- The inspected staging branch did not contain the full worker dependency graph required by the candidate runner.
- No separate least-privilege worker login was found in the inspected branch role inventory.

These findings apply to the named branch snapshots and inspection time; they are not a claim about any uninspected branch or later change.

## 2. Security consequence

The candidate worker claims from a shared queue without a tenant predicate. Its crosswalk resolution checks organization geography scope, but that is not equivalent to a database-enforced tenant boundary for queue reads, claims, payload access, retries, events, and terminal updates.

A role with `BYPASSRLS` would defeat row-level policies. A role without it is not sufficient by itself if the queue has no tenant key/policies and worker queries can read all tenant records. Therefore the current candidate is not ready for production activation.

## 3. Recommended target architecture

Use a platform-owned orchestration queue with explicit tenant ownership and narrow worker capabilities:

1. Every tenant-owned inbox row carries a non-null `organization_id` (or canonical tenant key) referencing the authoritative organization registry. Define immutable ownership at ingestion; do not infer it later from user-supplied payload fields.
2. Every append-only event row carries the same tenant key and a foreign key to its inbox row. Database constraints/triggers enforce tenant-key consistency between parent and event.
3. Tenant-facing API paths use a dedicated application principal and explicit tenant authorization. Enable and FORCE RLS only after table-by-table policy design, application query review, negative cross-tenant tests, backup/recovery rehearsal and role migration rehearsal.
4. The worker has no `BYPASSRLS`, no role memberships, no table ownership, no schema CREATE, and no direct broad access to tenant business tables.
5. Do not give the worker unrestricted direct access to all tenant rows merely because it is a platform process. Prefer narrow database operations (e.g. claim, resolve and finalize functions) owned by a non-login, non-application owner with reviewed SECURITY DEFINER behavior, fixed search_path, explicit tenant validation, constrained arguments and audited transitions.
6. A trusted control-plane scheduler enumerates eligible tenant scopes from an authoritative registry. Each work operation names one tenant; the database verifies that scope before claiming or resolving rows. The worker cannot choose arbitrary tenant context or set an unchecked session variable to bypass policies.
7. Keep reference-data reads separate from tenant data. Expose only approved/versioned source snapshots and crosswalks needed for a given tenant/authority/geography, preferably through narrowly scoped functions or views.
8. Keep append-only event insertion behind a database-owned transition mechanism. The worker must not directly INSERT/UPDATE/DELETE event rows.
9. Apply concurrency limits, leases, fencing tokens, idempotency, retry/quarantine controls and tenant-level fairness/quotas so one tenant cannot starve the national queue.
10. Prove the design with positive and negative tests across at least two synthetic tenants, including forged tenant IDs, cross-tenant reads, claims, updates, retries, event writes, cancellation and concurrent workers.

## 4. Non-goals / prohibited shortcuts

- Do not grant worker `BYPASSRLS`.
- Do not enable RLS globally in one migration without table-by-table ownership and policy mapping.
- Do not rely solely on a caller-settable custom GUC as proof of tenant identity.
- Do not treat authority/municipal codes as a tenant key.
- Do not let the worker mutate authoritative MRV records, accept official submissions, submit to Hedera/Guardian, or issue/retire credits as part of this queue validation path.
- Do not activate a production worker or create production credentials before independent security review and explicit release approval.

## 5. Required implementation sequence

1. Inventory every tenant-owned production table, its ownership key, joins, write paths, background jobs, storage objects and API routes.
2. Define canonical organization/tenant ownership and map the queue ingestion source to that identity.
3. Design the queue/event schema and controlled database operations; produce an ERD, threat model and privilege matrix.
4. Build the migration chain and test it on a disposable production-shaped Neon branch; include migration 096 provenance/ledger reconciliation.
5. Implement tenant RLS policies and controlled worker operations in isolation; use two or more synthetic tenants.
6. Run cross-tenant positive/negative integration tests with the exact proposed application and worker roles.
7. Rehearse backup/restore, rollback, credential rotation, deployment identity and runtime attestation.
8. Obtain independent security review; only then propose a staged rollout for explicit approval.

## 6. Release gate

- Tenant ownership on queue rows: **NOT IMPLEMENTED**
- Tenant ownership on event rows: **NOT IMPLEMENTED**
- Production RLS/policies: **NOT IMPLEMENTED**
- Tenant-aware queue claims and fairness: **NOT IMPLEMENTED**
- Narrow worker database operation boundary: **NOT IMPLEMENTED**
- Two-tenant negative isolation tests: **NOT YET EVIDENCED**
- Worker activation: **OFF**
- Production release: **HOLD**
- TRL 9: **NOT ESTABLISHED**

This ADR records a design direction and a release blocker. It does not certify the proposed architecture or authorize any database mutation.
