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
2. FORCE ROW LEVEL SECURITY remains enabled on all 13 source, job, event and provenance tables before any production use.
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
