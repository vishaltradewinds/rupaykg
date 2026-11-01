# Tenant ownership and route inventory — 2026-11-01

**Status:** Engineering discovery artifact; NOT an approved migration or release authorization  
**Branch:** `shakti/tenant-isolation-inventory-2026-11-01`  
**Baseline inspected:** repository `main` at 2026-11-01  
**Purpose:** establish the table/route ownership map needed before designing database-enforced tenant isolation.

## 1. Executive decision

RupayKg already has an organization-membership authorization model in application code. That is useful, but it is not equivalent to database-enforced isolation. The production snapshot previously inspected had no RLS policies. The application therefore currently relies heavily on every route correctly carrying organization predicates and checking ownership before reads/writes.

**Do not enable RLS globally.** First complete the ownership map, repair ambiguous ownership paths, define a database-verifiable tenant context, and test with at least two synthetic organizations. This document is a first-pass map from migrations and route source, not a claim that every table/query has been exhaustively classified.

## 2. Evidence inspected

The inventory was derived from these repository sources:
- `apps/src/auth.ts`
- `apps/src/auth-routes.ts`
- `apps/src/workspace-routes.ts`
- `apps/src/onboarding-hierarchy-routes.ts`
- `apps/src/sync-routes.ts`
- `apps/src/evidence-vault-routes.ts`
- `apps/src/value-routes.ts`
- `apps/src/bwg-routes.ts`
- `apps/src/epr-return-routes.ts`
- `apps/src/registry-routes.ts`
- migrations `003`, `029`, `033`, `062`, `063`, `066`, `077`, and `20261018`–`20261021`.

This is a source review of the repository's default branch. It does not substitute for a live catalog inventory, query tracing, data profiling, or independent security review.

## 3. Identity and authorization model already present

Observed in `apps/src/auth.ts`:
- Bearer sessions resolve to a verified, non-suspended identity.
- Verified organization memberships are loaded from `organization_memberships`.
- An optional `x-rupaykg-organization-id` header is accepted only if it is a UUID and belongs to one of that identity's verified memberships.
- A multi-organization identity must select an active organization for ordinary routes.
- Settlement paths are marked as bilateral organization scope.
- `canActForOrganization` checks membership and, outside bilateral settlement paths, active-organization equality.
- Permission checks join the verified membership to its role permissions.

**Important boundary:** the selected organization is application context. It is not yet a database-authenticated tenant principal. No current_setting/custom-GUC-only policy should be trusted as an authorization source unless the database operation itself establishes and validates the identity/organization pair through a non-forgeable boundary.

## 4. First-pass ownership classification

### A. Direct tenant-owned records — require a direct organization key and tenant policy

| Tables / families | Ownership basis | Notes / required controls |
|---|---|---|
| `organizations` | The organization row is the tenant root | Organization directory/profile data needs carefully separated member-visible vs platform-private columns. |
| `organization_memberships` | `organization_id` + `identity_id` | Membership visibility and management must be scoped; prevent users from adding themselves or changing roles. |
| `organization_geography_scopes` | `organization_id` + geography | Tenant-owned authorization scope; changes are high-risk and auditable. |
| `organization_statutory_profiles`, `organization_bwg_assessments`, `organization_epr_applicability` | `organization_id` | Direct tenant records; legal/applicability evidence must not be treated as external regulatory approval. |
| `organization_verification_evidence` | `organization_id` | Legal evidence is sensitive; verification decisions need platform-authority separation. |
| `field_devices` | `organization_id`, plus enrolled identity | Device identity must be a member of the same organization; device ID alone is not tenant authority. |
| `resource_flows`, `obligations` | `organization_id` | Direct tenant-owned operational/compliance data. |
| `esg_reporting_periods` | `organization_id` | Child ESG metrics inherit ownership through reporting period. |
| `bwg_profiles`, `bwg_reporting_periods` | `organization_id` | BWG reporting data; preserve geography checks as a separate jurisdiction control. |
| `cpcb_swm_stakeholder_workspaces` | `organization_id` | Local preparation only; CPCB status is explicitly user-reported/unverified. |
| `cpcb_swm_status_history` | `organization_id` and workspace | Add/verify composite consistency so history cannot name an organization different from its parent workspace. |
| `evidence_artifact_series` | `organization_id` and `activity_id` | Require database constraint that activity belongs to the same organization. |
| Audit records such as `audit_events` | `organization_id` where applicable | Append-only visibility and platform audit access need separate policies. |

### B. Tenant-owned by parent relationship — enforce ownership through composite keys/FKs or narrow database operations

| Tables / families | Parent ownership | Required integrity |
|---|---|---|
| `activities` | Direct `organization_id` | Canonical parent for field measurements, evidence, and carbon calculations. |
| `measurements` | `activity_id` → activity.organization_id | No client-provided organization override; tenant access follows parent activity. |
| `evidence` | `activity_id` → activity.organization_id | Evidence bytes/metadata are tenant data; review permission is separate. |
| `verifications` | `evidence_id/activity_id` | Ensure evidence and activity references agree; reviewer is a separate identity actor. |
| `carbon_calculations` | `activity_id` → activity.organization_id | Methodology catalog is shared reference data; inputs/results/provenance are tenant-owned. |
| `evidence_artifact_versions` | `series_id` → series.organization_id and evidence/activity | Composite integrity needed to prevent a version from attaching to another tenant's evidence or series. |
| `evidence_artifact_reviews` | `evidence_id` and artifact version | Must prove both references resolve to the same evidence/tenant. |
| `bwg_waste_reports`, `bwg_epr_reports`, `bwg_esg_reports` | `reporting_period_id` → BWG period.organization_id | Enforce that referenced evidence/verification belongs to the same tenant where required. |
| EPR return/obligation child records | `organization_id` or parent obligation/return | Validate every join and write path; do not rely only on a client-supplied parent ID. |
| Registry events | Credential and transfer parties | See cross-organization section; event history is append-only and not a simple single-tenant child. |

### C. Multi-organization / bilateral / platform-control records — do NOT force into a simplistic single-tenant policy

| Tables / families | Classification | Required policy |
|---|---|---|
| `settlements` | Bilateral: payer and payee organizations; sometimes credential/activity context | Party-specific visibility and action policy. Each operation must prove authority for the relevant party; no general access to both parties' records. |
| `credentials`, `registry_events` | Issuer, current owner, transfer recipient, and activity organization can differ | Model issuer, current owner, transfer parties and underlying project tenant distinctly. Preserve append-only provenance. |
| `stakeholder_applications` | Applicant identity + requested organization + platform workflow | Applicant may see own application; organization approvers see only authorized application; platform review queue is an explicit privileged function. |
| `stakeholder_application_approvals` | Workflow steps tied to application and geography | Scope by application, approval level and authorized geography; no broad tenant read just because an identity has a platform role. |
| Platform admin / dual-control / security audit tables | Platform control-plane data | Separate platform-admin policy and dual-control workflow; never grant ordinary tenant roles. |

### D. Identity-private and global reference data

| Tables / families | Classification | Required policy |
|---|---|---|
| `identities`, `identity_sessions`, `identity_password_credentials`, `identity_credentials` | Identity-private | A person sees only permitted self-profile data; credential/session secrets are never exposed through general tenant RLS. |
| `roles`, permission catalog | Platform-managed shared policy reference | Read-only role metadata as appropriate; only controlled administrators can change permissions. |
| `geography`, `geography_sources` | Shared authoritative reference | Versioned and read-only to tenant roles; organization geography scopes remain tenant-owned. |
| `epr_schemes`, methodology versions / CCTS methodology registry | Shared statutory/methodology reference | Platform-governed source provenance and versioning; tenant writes prohibited. |
| LGD/authority crosswalks and approved government source snapshots | Shared reference/control-plane data | Separate from tenant payload; expose only approved/versioned, least-privilege read paths. |

### E. Field sync and queue records — separate design gate

| Tables / families | Current observed ownership | Required correction |
|---|---|---|
| `field_sync_envelopes`, `field_sync_conflicts` | Current application flow scopes envelope to `identity_id` and device; field device has organization | Add immutable organization ownership or a composite FK path from envelope → device → organization; conflicts inherit envelope ownership. Test reassignment/revocation and identity changes. |
| `operation_sync_envelopes` | Actor identity/device and payload; no direct tenant key in migration 003 | Determine whether still used. If active, add explicit immutable organization binding or prove a safe parent relationship. Do not leave tenant scope hidden inside JSON payload. |
| `async_mirror_inbox`, `async_mirror_inbox_events` | Candidate shared queue; staging inspection found no tenant key | Keep worker OFF. Tenant ownership on both rows, controlled claims, append-only event transitions, per-tenant fairness and narrow DB operations are mandatory before activation. |

## 5. Route-level findings and review targets

### Positive controls already visible
- `auth.ts` rejects an organization header that is not a verified membership.
- `workspace-routes.ts` derives organization IDs from verified memberships/active organization and filters core activities, measurements, evidence, obligations, resource flows and ESG periods accordingly.
- `evidence-vault-routes.ts` resolves activity organization, checks active membership/geography and permission, and validates series against organization + activity before appending a version.
- `sync-routes.ts` verifies device/identity enrollment and binds sync envelopes to the authenticated identity; migration 033 adds a database trigger for device/identity binding.
- `value-routes.ts` resolves parent organization before several value-chain mutations and checks membership/permission.

These are application-level controls; they are not proof that all SQL paths are safe or that RLS is in force.

### High-priority review targets
1. **Cross-organization settlement and registry:** inspect every endpoint for both party visibility and operation-specific authorization; model bilateral relationships explicitly.
2. **Evidence and child records:** ensure all queries join through the correct parent and cannot use mismatched evidence/activity/reporting-period IDs.
3. **Field sync:** make organization ownership explicit in the relational model, not just device identity or JSON payload.
4. **Platform onboarding queue:** platform-wide review access must be narrowly granted and auditable; applicant/organization users must not enumerate other applications.
5. **Audit events:** establish who can append, who can read tenant events, and who can read platform security events; preserve immutability.
6. **Global reference tables:** ensure tenants cannot alter geography, methodology, statutory catalogs, crosswalks, or authoritative snapshots.

### Important query-level risk pattern
Any route that first fetches a row by unscoped ID (for example, `WHERE id=$1`) and only afterwards checks membership can be correct if the response is strictly non-disclosing and no side effect occurs before authorization. For RLS migration, prefer tenant predicates in the same SQL statement or narrow DB functions so unauthorized row existence is not observable and TOCTOU gaps are minimized. Audit every read, lock, update, delete and returned row.

## 6. RLS and database principal design constraints

1. Tenant API principal: no superuser, no BYPASSRLS, no CREATEDB/CREATEROLE/REPLICATION, no ownership of application tables, no public schema CREATE.
2. Worker principal: separate, non-inheriting, no BYPASSRLS, no table ownership, no role membership; narrow queue functions only.
3. Platform control plane: separate from tenant API; privileged review tasks must be explicit, audited and dual-controlled where required.
4. Database tenant context: must be derived from a validated identity-session/membership binding or a narrow SECURITY DEFINER operation that validates inputs. Do not rely on an arbitrary caller-settable custom GUC alone.
5. FORCE RLS only after owner/bypass behavior, migration runner, backup/restore, support and emergency recovery roles are designed and tested.
6. Reference catalogs should use separate read-only grants/policies, not be accidentally hidden by tenant predicates.
7. Cross-tenant workflows (settlement, transfer, platform onboarding) need purpose-built functions/policies, not broad exceptions on the tenant tables.

## 7. Required test matrix before any production rollout

Use at least two synthetic organizations (A and B), identities (member A, member B, dual member, platform reviewer), and devices/evidence/activities owned by each.

- A cannot SELECT/INSERT/UPDATE/DELETE B's direct tenant rows.
- A cannot access B's child records by guessing IDs (measurements, evidence, reviews, calculations, reports).
- A cannot attach B's evidence to A's activity/reporting period or vice versa.
- A cannot enroll, verify, read or reassign B's field device.
- A cannot inspect or resolve B's sync envelope/conflict.
- A cannot read B's onboarding application; platform reviewer can see only the intended review queue and has an auditable reason.
- A party to a settlement sees only permitted settlement fields; unrelated organizations see nothing.
- A credential transfer exposes only authorized parties and preserves immutable issuer/event history.
- Forged organization header, forged tenant ID, null tenant, stale membership, revoked session, role membership inheritance and direct SQL attempts all fail closed.
- Concurrent claims, retries, cancellation and append-only event consistency remain correct.
- Test both table owner and runtime roles; verify FORCE RLS and SECURITY DEFINER search_path/EXECUTE ACL semantics.

## 8. Implementation sequence (no production mutation)

1. Complete catalog inventory and source-to-live table parity; identify unused/legacy tables and all tenant ownership columns.
2. Complete route/query inventory across every route and background worker; record exact SQL statement, parent ownership and authorization check.
3. Resolve ambiguous ownership: settlements, credentials, sync envelopes, audit events, onboarding review and queue.
4. Produce canonical ERD, threat model, data classification and role/privilege matrix.
5. Implement schema ownership constraints and controlled database access functions in a disposable Neon branch only.
6. Implement policies table-by-table with exact runtime principals; no blanket enablement.
7. Run the two-tenant matrix and full application regression suite.
8. Rehearse migration, credential rotation, backup/restore, rollback and deployment identity.
9. Independent security review.
10. Submit a separate explicit production release request; production stays unchanged until approved.

## 9. Current release posture

- This document: first-pass discovery map, not complete audit.
- Tenant table/query inventory: IN PROGRESS.
- Canonical tenant context at database layer: NOT IMPLEMENTED.
- Production RLS/policies: NOT IMPLEMENTED in last inspected snapshot.
- Tenant-aware async queue: NOT IMPLEMENTED.
- Two-tenant adversarial tests: NOT YET EVIDENCED.
- Worker/scheduler: OFF.
- Production: HOLD.
- TRL 9: NOT ESTABLISHED.

**Safety:** No production or staging database changes, role/grant changes, secrets, Render configuration, or deployments are authorized or performed by this document.


## 10. Expanded route-source scan — 2026-11-01

A second pass fetched and scanned every TypeScript file in `apps/src` whose filename is a route module, plus `server.ts`. The scan covered authentication, BWG, CPCB-SWM, EPR returns, evidence vault, intelligence, MRV, onboarding hierarchy, platform administration, registry, statutory, field sync, value and workspace routes. This was a static source scan for query call sites and SQL table references; dynamic SQL, helper calls, multiline SQL and database functions still require manual review.

Additional table families discovered and added to the ownership audit backlog:

| Table family | Initial ownership classification | Follow-up |
|---|---|---|
| `mrv_observations`, `mrv_provenance_events` | Likely tenant/project evidence lineage, but verify schema FKs to activity/project and immutability | Inspect migration and every MRV route; prove parent organization joins. |
| `field_sync_cursors` | Inherits field-device ownership | Enforce cursor device FK and ensure cursor reads/writes cannot cross device/organization boundaries. |
| `settlement_events` | Bilateral settlement ledger | Must inherit settlement parties and be append-only; separate payer/payee visibility. |
| `epr_returns`, `epr_obligations` | Organization-owned statutory preparation/obligation records | Validate organization consistency between return, obligation and scheme; external submission remains distinct. |
| `epr_credits` | Cross-organization value-chain record | Issuer/recycler/obligated organization and evidence provenance must be explicit; do not treat it as single-owner by assumption. |
| `organization_statutory_profiles`, `organization_bwg_assessments`, `organization_epr_applicability` | Direct organization-owned statutory applicability evidence | Separate organization-authored determination from regulator-confirmed status. |
| `audit_events` | Tenant-scoped events where organization_id is present; platform security events may be platform-owned | Confirm append-only enforcement, tenant visibility and platform access boundaries. |
| `platform_admin` governance/audit tables | Platform control plane | Restrict to dedicated platform authority and dual-control operations. |
| `identity_credentials`, `identity_password_credentials`, `identity_sessions` | Identity-private | Ensure no broad tenant query or route returns credential/session material. |

### Query-scan observations

- `workspace-routes.ts` uses organization-ID predicates for core activities, measurements, evidence, obligations, resource flows and ESG periods; several derived records are joined through their tenant-owned parent.
- `evidence-vault-routes.ts` resolves activity organization and validates series against organization + activity; version/review references still need database-level composite consistency.
- `sync-routes.ts` scopes envelopes to identity and enrolled device, and applies operations through organization/geography authorization helpers. The device→organization→identity ownership chain needs explicit relational enforcement for all cursor/envelope/conflict rows.
- `registry-routes.ts` resolves evidence, activity and verification before credential/settlement operations; these are high-risk unscoped-ID lookup paths and require a statement-by-statement disclosure/locking/authorization review.
- `onboarding-hierarchy-routes.ts` has a platform review queue that loads pending applications before deciding which records the reviewer may see. This must become a narrowly scoped database operation/view rather than general tenant access.
- `cpcb-swm-routes.ts` and `value-routes.ts` include organization-specific checks; audit/status events and cross-record references still need composite constraints.
- `auth-routes.ts` includes identity registration/login and returns organization membership/application summaries. Session and password tables remain identity-private.
- `intelligence-routes.ts` and `mrv-routes.ts` contain helper/dynamic query paths that were not fully classified by this lexical scan; inspect manually before policy design.

**No RLS or schema implementation was attempted.** The scan increases coverage but does not establish that all application SQL is tenant-safe.
