# Tenant-isolation integrity findings — 2026-11-01

**Status:** Source-level security findings and proposed controls; no schema change  
**Related:** PR #180 tenant ownership inventory  
**Review level:** Engineering discovery; independent security review still required

## 1. Executive conclusion

The current application has useful authorization checks and several database triggers, but some relationships that must be tenant-consistent are represented as separate foreign keys rather than composite ownership constraints. That means PostgreSQL can accept cross-organization parent/child combinations if a future route, privileged integration, or direct SQL path supplies mismatched IDs.

This is a concrete reason not to enable RLS yet: a row's declared organization key can disagree with the organization of its parent. RLS on the child row would then enforce the wrong tenant boundary.

No exploit against the live production database is claimed. These are source-level integrity gaps confirmed by the migrations inspected on `main`.

## 2. Confirmed integrity gaps

### Finding TSI-001 — Evidence artifact series can name an organization different from its activity

**Severity:** High — cross-tenant evidence association risk  
**Source:** `migrations/20261021_evidence_artifact_vault.sql`

- `evidence_artifact_series.organization_id` independently references `organizations(id)`.
- `evidence_artifact_series.activity_id` independently references `activities(id)`.
- There is no composite FK proving that the activity belongs to the declared organization.
- `evidence_artifact_versions.series_id` and `evidence_id` are independent FKs.
- `evidence_artifact_reviews.evidence_id` and `artifact_version_id` are independent FKs; no database constraint proves that the selected artifact version belongs to that evidence.

The API route does validate the series against organization + activity and loads versions through evidence. Those application checks are valuable, but they do not close the database integrity gap for every caller.

**Required design:** establish unique parent keys suitable for composite FKs, then enforce:
- series `(activity_id, organization_id)` matches `activities(id, organization_id)`;
- each version's evidence belongs to the same activity as its series (either a constrained activity_id on the version or a narrow database operation/trigger with a fixed, reviewed search path);
- each review's `(artifact_version_id, evidence_id)` pair is the exact version/evidence pair.
Preserve append-only/immutable version and review semantics.

### Finding TSI-002 — CPCB status history can carry a different organization from its workspace

**Severity:** High — tenant attribution and audit-history integrity  
**Source:** `migrations/20261019_cpcb_bwg_workflow_tracking.sql`

- `cpcb_swm_status_history.workspace_id` references the workspace ID.
- `cpcb_swm_status_history.organization_id` separately references an organization.
- There is no composite FK tying `(workspace_id, organization_id)` to the same organization-owned workspace row.

A row can therefore be structurally valid while its organization attribution differs from its parent workspace. If a later RLS policy filters on the history row's organization_id, this mismatch could produce incorrect tenant visibility.

**Required design:** add a unique key on `cpcb_swm_stakeholder_workspaces(id, organization_id)` and a composite FK from `cpcb_swm_status_history(workspace_id, organization_id)`; validate existing rows before applying it. Also verify actor authority and append-only behavior at the database boundary.

### Finding TSI-003 — Stakeholder approval geography is not constrained to application geography

**Severity:** Medium/High — approval-scope integrity  
**Source:** `migrations/029_stakeholder_onboarding.sql`, `migrations/077_hierarchical_stakeholder_onboarding.sql`

- The application stores `stakeholder_applications.geography_id`.
- Each `stakeholder_application_approvals` row independently stores `application_id` and `geography_id`.
- The approval table's FKs prove that both records exist, not that the approval geography is the application's geography.

The seed trigger currently copies the application geography, and the route checks authority against application/approval geography. The database does not make this relationship immutable/consistent.

**Required design:** add a composite uniqueness key on the application ID + geography and a matching composite FK from approvals; define explicit behavior for null/global geography and ensure platform-level approvals cannot be forged by changing the child geography.

### Finding TSI-004 — Field-device identity/organization relationship is enforced procedurally, not by a relational membership key

**Severity:** High — device attribution and future RLS scope  
**Sources:** `migrations/003_identity_geography_operations.sql`, `migrations/009_field_sync.sql`, `migrations/033_field_sync_tenant_integrity.sql`

- `field_devices` has independent FKs to identity and organization.
- The field-device enrollment route checks that the enrolled identity has verified membership in the organization.
- The schema does not bind `(identity_id, organization_id)` to an organization membership row.
- The sync envelope has separate `device_id` and `identity_id`; the trigger checks identity equality and verified device status, but not an immutable organization binding or active membership at every transition.
- `field_sync_conflicts` inherits organization through envelope → device, rather than storing a tenant key.

**Required design:** add a composite membership relationship for device identity/organization, with a database trigger or narrow enrollment operation to require membership status VERIFIED at enrollment and to define behavior on membership revocation. Add a unique device key suitable for `(device_id, identity_id)` envelope FK. Treat organization ownership as immutable after enrollment or require a controlled re-enrollment/transfer event. Ensure cursor/conflict rows inherit the exact device ownership.

### Finding TSI-005 — Legacy operation-sync envelope is identity/device-bound but has no explicit tenant key

**Severity:** Medium/High — legacy queue ambiguity  
**Sources:** `migrations/003_identity_geography_operations.sql`, `migrations/034_operation_sync_device_binding.sql`

- `operation_sync_envelopes` stores actor identity and a text device identifier, plus arbitrary JSON payload.
- Migration 034 verifies that the device is enrolled, VERIFIED and bound to the actor identity.
- It does not persist an immutable organization identifier or relationally bind the envelope to a specific device row.
- Organization ownership is therefore indirect through the mutable device lookup; target entity ownership is interpreted from the payload by application code.

**Required design:** first establish whether this legacy path is still used. If retained, replace the text device reference with a stable FK and immutable organization binding, and ensure each payload operation is applied through a narrow database operation that checks the target entity's organization. If unused, deprecate only after usage and data-retention evidence.

### Finding TSI-006 — Activity assignments are not organization-constrained

**Severity:** Medium — actor assignment integrity  
**Source:** `migrations/003_identity_geography_operations.sql`

- `activity_assignments` has FKs to activity, identity and role.
- It does not prove that the assigned identity is a verified member of the activity's organization or that the role belongs to that organization.

**Required design:** establish a composite activity/organization key and a membership/role consistency check. Define whether assignments may be made to external verifiers; if so, represent that as an explicit, scoped grant rather than a tenant membership assumption.

## 3. Cross-organization workflow boundaries

### Credentials and registry events

The route correctly checks issuer membership, binds credential issue to activity organization and approved verification, and checks current owner for transfer/retirement. The database has a set of registry/settlement guard triggers across migrations 006, 045, 047, 051, 074 and 075.

Before RLS, verify in a disposable database:
- all credential/verification/activity references resolve to the same project;
- registry event from/to owners form a valid transition chain;
- transfer destination is verified and differs from source;
- only the current owner can transfer/retire;
- a credential cannot transfer while a settlement is open;
- direct INSERT/UPDATE attempts cannot bypass the transition rules.

Registry history is multi-party provenance. Do not collapse issuer, project organization, current owner and transfer counterparty into one tenant_id.

### Settlements

The API currently requires access to both payer and payee for authorization/execution/confirmation and applies the high-risk action permission check to the payer organization. Database guardrails enforce that the payer is the current credential owner and that the payee differs from payer in earlier migration logic.

**Design question requiring explicit policy:** should the payee's authorized representative also consent/approve before settlement authorization or only be able to read/reconcile? The present route-level permission model should be compared with the business/legal contract before RLS policy is authored. No assumption of bilateral consent is made here.

### Platform onboarding and audit

- The onboarding review queue intentionally spans organizations for authorized local/district/state/platform reviewers. It needs a narrow, auditable control-plane query and stage/geography filtering; ordinary tenant policies must not grant broad queue access.
- The platform-admin audit endpoint returns global audit events under a platform security permission. Preserve this as an explicit platform-control path, not as a tenant-wide RLS bypass.
- The normal tenant audit trail must be organization-filtered and append-only; the platform security log needs a separate privilege boundary.

## 4. Required implementation pattern

Prefer declarative composite FKs wherever the ownership relation is stable. Use triggers only for state-dependent rules (e.g. membership must be VERIFIED at enrollment) and ensure triggers:
- use schema-qualified object names and fixed `search_path`;
- are not executable by untrusted principals where SECURITY DEFINER is used;
- reject mismatched parent/tenant references;
- do not permit changing tenant ownership after creation without a controlled transfer workflow;
- have tests for direct SQL writes as well as API paths.

For tenant RLS:
- derive tenant context from a validated identity/session/membership operation; do not trust a caller-settable custom GUC alone;
- use a least-privilege runtime role with no BYPASSRLS and no table ownership;
- use FORCE RLS only after owner, migration, backup/restore and emergency roles are deliberately designed;
- use dedicated narrowly-scoped control-plane operations for bilateral, registry and onboarding tasks;
- preserve shared reference catalogs as read-only rather than applying tenant filters to them.

## 5. Disposable-branch validation matrix

For every finding:
1. Create two organizations A/B, identities and memberships.
2. Create parent records under A and B.
3. Attempt every mismatched child combination (A organization + B activity; A evidence + B series; B workspace + A history; application A + geography B; device identity A + organization B; assignment identity B + activity A).
4. Prove invalid rows fail at the database constraint/trigger, not only at the HTTP route.
5. Prove legitimate same-tenant operations still pass.
6. Prove bilateral settlement/registry transfer flows continue to work under explicit party policies.
7. Run the full application regression suite and inspect query plans/policy performance.
8. Rehearse migration on a disposable Neon branch and validate existing data before adding constraints.

## 6. Release decision

- Findings TSI-001 to TSI-006: source-confirmed; remediation not implemented.
- RLS rollout: BLOCKED until ownership consistency and query inventory are complete.
- Production/staging mutation: NOT PERFORMED.
- Worker/scheduler: OFF.
- Production: HOLD.
- TRL 9: NOT ESTABLISHED.

This document is not an approved production migration, security certification, legal opinion or authorization to change live databases.


## 7. Read-only production catalog/data preflight — 2026-11-01

Read-only inspection was performed against the previously identified Neon production project `steep-mud-79906940`, branch `br-restless-base-b44cip2h`, database `rupaykg`, using catalog SELECTs only.

### Catalog confirmation
- The relevant production tables and columns exist, including the organization keys and parent IDs described above.
- The inspected FK definitions are independent single-column constraints for the key relationships; no composite ownership FKs were present for the evidence series/activity, version/evidence, review/version, CPCB history/workspace, or approval/application geography pairs.
- `field_devices` has independent identity and organization FKs; `field_sync_envelopes` has independent device and identity FKs; `activity_assignments` has independent activity and identity FKs.
- `operation_sync_envelopes.device_id` remains text and has no FK to `field_devices`.

### Existing-data mismatch preflight
The following read-only anti-join checks returned zero rows in the inspected production snapshot:

| Check | Mismatches |
|---|---:|
| Evidence series organization vs activity organization | 0 |
| Artifact version evidence activity vs series activity | 0 |
| Artifact review evidence vs referenced version evidence | 0 |
| CPCB history organization vs workspace organization | 0 |
| Approval geography vs application geography | 0 |
| Field device identity/organization without verified membership | 0 |
| Activity assignment without verified organization membership | 0 |
| Legacy operation-sync actor/device mismatch or missing device | 0 |

**Interpretation:** current sampled production data did not contain mismatches for these specific predicates at the time of inspection. This does not prove that constraints are unnecessary, that no other mismatch exists, or that future writes are safe. The gap is that PostgreSQL does not declaratively enforce several of these relationships.

### Safety
Only catalog/data SELECT statements were run. No production or staging data, schema, roles, grants, RLS, secrets or deployments were changed. The live branch remains on the previous release posture.
