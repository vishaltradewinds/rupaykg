# MRV Worker Function Privilege Matrix

Status: DESIGN / REVIEW INPUT ONLY. This is not a grant script, RLS policy, production authorization decision, or proof of catalog state.

## Principals

| Principal | Login | Required authority |
|---|---:|---|
| Migration/deployment owner | No runtime login | Owns schema/functions and performs reviewed migrations only |
| `rupaykg_mrv_worker_api_owner` | NOLOGIN | Owns only the eight SECURITY DEFINER functions; receives the minimum table/function privileges needed by their bodies and triggers; NOINHERIT, NOSUPERUSER, NOBYPASSRLS, no memberships |
| `rupaykg_mrv_worker_runtime` | Yes | USAGE on `mrv_worker_api` and EXECUTE on the eight exact functions only; no table privileges, no memberships, no schema CREATE, no elevated role attributes |

The runtime login must satisfy `current_user = session_user` outside SECURITY DEFINER calls. Inside each SECURITY DEFINER function, `current_user` is expected to be the dedicated function owner; the function must not trust caller-controlled role/session settings for tenant scope.

## Function-to-table access proposal

| Function | Source reads | Job ledger | Event ledger | Provenance |
|---|---|---|---|---|
| `claim_next_job` | None | SELECT + UPDATE one due row under SKIP LOCKED | INSERT indirectly through existing update trigger when status/attempt changes | None |
| `authorize_job` | SELECT organizations, identities, organization_memberships, roles, activities, evidence, verifications, geography scope, mrv_observations, measurements | SELECT one job and its immutable snapshot | None | None |
| `persist_guardian_binding` | None | SELECT + UPDATE one lease-fenced row; immutable key only | No expected event for key-only update under current trigger column list | None |
| `persist_hedera_binding` | None | SELECT + UPDATE one lease-fenced row; immutable network/topic/transaction tuple only | INSERT indirectly if current trigger observes transaction-id update | None |
| `renew_lease` | None | SELECT + UPDATE one live lease expiry | None under current trigger column list | None |
| `advance_job` | None | SELECT + UPDATE one lease-fenced row with strict status/patch allow-list | INSERT indirectly through existing status/field update trigger | None |
| `release_job` | None | SELECT + UPDATE one live lease; bounded retry/error metadata | INSERT indirectly through existing update trigger when watched fields change | None |
| `finalize_provenance` | SELECT authorization source rows again | SELECT + UPDATE one live job | INSERT indirectly through existing update trigger | SELECT + INSERT exact provenance tuple |

All eight functions must reject null, malformed, conflicting or out-of-stage inputs and must be atomic. No function needs DELETE or TRUNCATE. No runtime login receives any direct table access.

## RLS design constraints

1. The function owner is not a table owner and has no BYPASSRLS.
2. FORCE ROW LEVEL SECURITY must be enabled and independently verified on all 14 source, job, event and provenance tables before any production use: organizations, identities, organization_memberships, roles, activities, evidence, verifications, geography, organization_geography_scopes, mrv_observations, measurements, mrv_submission_jobs, mrv_submission_job_events and mrv_provenance_events.
3. The queue claim is system-level work selection. Its cross-tenant scope must be isolated inside the reviewed SECURITY DEFINER claim function; it must not be implemented by a broad policy for PUBLIC or the application runtime.
4. Source authorization reads must be derived from the locked job row. The caller must never supply organization, geography, identity, activity, evidence or verification scope.
5. Each function must establish/derive a narrow job scope before source reads or writes. Do not trust a custom GUC or other caller-set session variable as proof of tenant scope.
6. Policies must not grant the API owner arbitrary source access through PUBLIC/application roles. The exact policy predicate and whether a transaction-local scope is safe must be proven with adversarial PostgreSQL tests before authoring the policy migration.
7. Trigger side effects are part of the effective privilege boundary. Confirm the execution identity and RLS behavior of `record_mrv_submission_job_event`, `guard_mrv_submission_job_update`, and all called helper functions under SECURITY DEFINER execution.
8. Fixed `search_path = pg_catalog` is required for each SECURITY DEFINER function; every non-catalog object must be schema-qualified. Revoke EXECUTE from PUBLIC and grant only the exact signatures to the runtime login.

## Required catalog evidence before grants

- Exact attributes and memberships for both worker roles.
- Exact owner of each function, SECURITY DEFINER flag, pinned `proconfig` search_path and function ACL.
- Table ACLs proving zero runtime table privileges and no owner DELETE/TRUNCATE.
- RLS and FORCE RLS state plus all policies for every source/job/event/provenance table.
- Trigger function ownership, SECURITY DEFINER state (if any), ACL and effective privileges.
- Existing helper function ACLs and dependency graph.
- Proof that hostile caller schemas, temp objects and caller-set custom GUCs cannot alter function resolution or tenant scope.

## Acceptance matrix

| Test | Expected result |
|---|---|
| Runtime SELECT/INSERT/UPDATE/DELETE/TRUNCATE on each protected table | Denied |
| Runtime EXECUTE on each of eight functions | Allowed |
| PUBLIC or unrelated role EXECUTE | Denied |
| Two concurrent claimers for one due job | At most one active lease |
| Expired/stale token for renew/release/bind/advance/finalize | No mutation |
| Cross-tenant job/source IDs or caller-supplied tenant scope | Denied; no source-row details returned |
| Revoked identity/membership/permission or changed evidence/measurement | Authorization false; no provider action |
| Same provider binding repeated | Idempotent success without status transition |
| Conflicting provider binding | Rejected/quarantined; no overwrite |
| Binding persistence | Does not change status or clear lease |
| `advance_job` | Sole state-transition owner; existing event trigger records change atomically |
| Provenance conflict with different evidence/Guardian/HCS/Mirror tuple | Rejected |
| Provenance exact retry | Idempotent verification of the complete tuple |
| Event/provenance UPDATE or DELETE | Denied / append-only invariant preserved |

## Blocking evidence

The existing repository baseline and current branch do not yet provide a complete catalog-derived RLS/policy matrix for all 13 tables, an implemented API-owner policy model, or disposable PostgreSQL results. Prior production inspection found RLS disabled on inspected core tenant tables. Therefore this document intentionally does not generate role grants, enable RLS, or create SECURITY DEFINER functions. Those actions remain blocked until the policy matrix is reconciled against the authoritative Neon catalog and independently reviewed.


## Reconciliation findings — 2026-11-03

This section records source-derived blockers found while reconciling the proposed eight-function boundary against the current migration chain. It is design evidence only; it does not authorize role grants or schema changes.

### 1. Protected relation count and geography helper

The complete protected relation set is **14**, not 13. The geography authorization helper `public.organization_has_geography_scope(uuid, uuid)` reads both `public.geography` and `public.organization_geography_scopes`. Both must be included in the function-owner policy review and in runtime RLS/FORCE RLS preflight. The restricted server and SQL acceptance lists now include both.

### 2. Trigger side effects are part of the function privilege boundary

`migrations/20261109_durable_mrv_submission_jobs.sql` attaches `record_mrv_submission_job_event()` to INSERT and selected UPDATEs on `mrv_submission_jobs`. It inserts into `mrv_submission_job_events`. Consequently, claim, advance and release operations can require event-table INSERT rights and an applicable event-table RLS policy even though the API function body does not explicitly insert events. The event row records actor kind/reference and lease token from OLD/NEW values; this behavior must be tested under the actual SECURITY DEFINER execution identity and FORCE RLS.

The same migration attaches `guard_mrv_submission_job_update()` as a BEFORE UPDATE trigger and `reject_mrv_submission_job_event_mutation()` as an append-only guard. The API owner must not be granted event UPDATE/DELETE merely to make writes work. The trigger's effective privileges, policy evaluation, and immutable event semantics must be proven in PostgreSQL.

### 3. Provenance schema reconciliation

The authoritative provenance table is created in `migrations/015_guardian_hedera_mrv.sql`, then extended by `migrations/083_mrv_mirror_node_registry_gate.sql`. Its persisted tuple includes `activity_id`, `verification_id`, `evidence_id`, `guardian_policy_id`, `guardian_execution_id`, `guardian_status`, `hcs_status`, `hcs_topic_id`, `hcs_transaction_id`, `hcs_consensus_timestamp`, `integrity_hash`, `methodology_code`, `metadata`, and `mirror_node_verified_at`. The proposed finalizer must map the worker's `mirror_verified_at` and `mirror_verification_digest` to the existing provenance model without assuming identically named columns. It must verify every field on idempotent conflict; a matching unique key alone is insufficient evidence that the complete provenance tuple matches.

The current schema's unique key is `(activity_id, verification_id, integrity_hash)`. Finalization must reject a conflict whose evidence, Guardian execution, HCS network/topic/transaction/consensus or Mirror verification evidence differs. The migration's `clear_mrv_mirror_verification_on_anchor_change()` trigger also means finalization must not subsequently mutate anchored provenance fields in a way that silently clears the Mirror gate.

### 4. Queue/RLS design decision remains unresolved

A global queue claim needs to discover due jobs across tenants, but the API owner is explicitly NOLOGIN, NOINHERIT, NOSUPERUSER and NOBYPASSRLS and is not a table owner. A tenant-scoped policy that depends on a caller-supplied organization or custom GUC is not acceptable: the worker has no trusted tenant context at claim time, and caller-set session values are not authorization proof. A broad policy for PUBLIC or application roles is also prohibited.

Do not implement the eight SECURITY DEFINER functions until an independently reviewed queue isolation design exists. Acceptable design work must prove, using a two-tenant disposable PostgreSQL fixture with FORCE RLS enabled, that the claim operation can lock one due row without exposing other tenant data, while every returned job is subsequently authorized from its locked job-derived organization/geography and live source records. Consider a separate narrowly scoped queue broker/claim ledger or an explicitly reviewed policy mechanism; do not silently grant BYPASSRLS, weaken FORCE RLS, or grant broad source-table access.

### 5. Authorization read consistency

The worker's legacy source reads are separate queries for observations, evidence and latest measurement. The restricted API contract requires one consistent database snapshot and deterministic comparison against the immutable enqueue payload. The eventual `authorize_job` implementation must perform the full comparison in a single SQL statement or an explicitly consistent transaction, including deterministic ordering and null/empty handling. Missing, changed, ambiguous, revoked or geographically out-of-scope records must return false and must never leak source-row data to the runtime caller.

### Release consequence

The source review is sufficient to reject an unsafe grant/function implementation at this time. It is not sufficient to invent a safe RLS policy or claim live catalog validation. Keep the worker disabled, do not apply the migrations, and require disposable PostgreSQL two-tenant adversarial tests plus independent DBA/security approval before implementation or deployment.
