# RupayKg route-to-data authorization inventory — 2026-11-02

Status: engineering audit draft; not a policy approval and not a production change.

## Scope and method

Static inspection of the canonical backend branch at application code head `3b34b10a7277d3aaecfb1883d2f36924dc530635`, plus latest docs-only checkpoint. Reviewed the 15 route-bearing modules in `apps/src` and selected security/tenant migrations. Route/table extraction is lexical and must be reconciled against every helper, dynamic SQL statement, database function, trigger and worker before it is called complete.

The inventory found 90 registered HTTP route declarations across these modules:
- `auth-routes.ts` (8)
- `bwg-routes.ts` (1)
- `cpcb-swm-routes.ts` (3)
- `epr-return-routes.ts` (4)
- `evidence-vault-routes.ts` (4)
- `intelligence-routes.ts` (1)
- `mrv-routes.ts` (4)
- `onboarding-hierarchy-routes.ts` (3)
- `platform-admin-routes.ts` (15)
- `registry-routes.ts` (8)
- `statutory-routes.ts` (5)
- `sync-routes.ts` (7)
- `value-routes.ts` (9)
- `workspace-routes.ts` (8)
- `server.ts` (10; includes health/status/overview/catalog/geography/operations routes and static fallback)

## Route cohort → principal data objects → authorization scope

| Route cohort | Primary data objects observed | Expected authorization dimensions | Main assurance work still required |
|---|---|---|---|
| Native auth/session | identities, identity_sessions, identity_password_credentials, organization_memberships; auth_private functions | Identity/session validity; credential lifecycle; auth runtime only | Confirm every function owner, execute grant, search_path, token hashing, rate limits, revocation and transaction isolation |
| Onboarding applications | stakeholder_applications, organizations, organization_verification_evidence, stakeholder_application_approvals, organization_statutory_profiles; auth_private functions | Applicant identity; reviewer role + organization type + verified geography; staged approval hierarchy | Verify all SECURITY DEFINER functions and trigger side effects, applicant read/withdraw scope, and dual-control boundaries |
| Platform administration | identities, roles, organization_memberships, identity_sessions, platform_access_change_requests, audit_events | Platform authority capability; distinct requester/approver; reserved-role restrictions | Confirm every mutation is SECURITY DEFINER or tightly scoped; test no direct admin table grants; ensure audit chain atomicity |
| CPCB/SWM workspaces | cpcb_swm_stakeholder_workspaces, cpcb_swm_status_history, organization_memberships, audit_events | Active organization; verified membership; geography; actor provenance | Current routes use pool queries and route-local BEGIN/COMMIT. Integrate tenant context on the same checked-out client; audit append-only history and ownership |
| BWG/EPR obligations and returns | epr_schemes, epr_obligations, obligations, epr_returns, geography, evidence, activities, verifications | Obligated organization; scheme/period binding; evidence ownership; approved verification; geography | Ensure every lookup locks and scopes organization before mutation; no unscoped returnId-only reads; preserve atomic obligation balance |
| Evidence vault and review | evidence, activities, evidence_artifact_series, evidence_artifact_versions, evidence_artifact_reviews, verifications | Activity organization; uploader/reviewer identity; geography; immutable artifact provenance | Blob bytes and metadata must share one tenant-bound transaction; review must bind evidence and activity owner; inspect content access and storage retention |
| MRV and provenance | activities, measurements, evidence, verifications, mrv_observations, mrv_provenance_events | Activity organization; geography; verified evidence; authorized verifier; external anchor state | Validate all state transitions, external consensus callbacks, append-only provenance and organization-scoped reads |
| Registry/credentials | credentials, registry_events, evidence, verifications, activities, organizations | Issuer/current owner; activity scope; high-risk permissions; transfer recipient | Multi-party ownership must be modeled separately from single-org RLS context; validate lock ordering and event-chain integrity |
| Settlements | settlements, settlement_events, credentials, registry_events, organizations | Payer and payee separately; credential current owner; authorization from both parties; dual approval | Existing signed request transaction helper rejects bilateral context. Do not force settlements into a single-organization context. Define and test a dedicated bilateral claim/policy contract first |
| Field device and sync | field_devices, field_sync_envelopes, field_sync_conflicts, audit_events | Device enrollment identity; verified device; organization binding; idempotency and replay state | Ensure worker/apply path is equally scoped; device identity and tenant must be enforced at DB boundary; check replay/conflict transitions |
| Carbon, value, ESG, BWG | carbon_calculations, methodology_versions, obligations, epr_credits, esg_reporting_periods, esg_metrics, bwg_* | Organization ownership; source activity/evidence; methodology governance; geography | Audit JSON input/output ownership, evidence/verification references, period ownership and cross-table joins |
| Workspace/read models | resource_flows, activities, measurements, evidence, verifications, obligations, credentials, settlements, ESG metrics | Active organization set; geography; current registry ownership; bilateral settlement visibility | Verify all aggregate joins constrain every row by a valid ownership path; avoid scope widening through arrays of organization IDs |
| Public catalog/system | regulatory_sources, geography, /health, /status | Explicitly public/read-only where intended; operational health only | Confirm no private notes or unverified sources leak; geography routes should use active org scope consistently |

## Concrete structural observations

1. `withRlsRequestTransaction` exists and correctly binds a signed short-lived identity + one verified active organization claim to a transaction-local setting. It rejects absent active organization, unverified membership and bilateral context. This is a safe foundation, not a complete integration.
2. The route modules still contain route-local `pool.query` and `pool.connect` paths. Several mutation handlers manage their own BEGIN/COMMIT/ROLLBACK. Blindly wrapping them in a second transaction would be unsafe. The route must acquire one client, set tenant context on that client, and execute every protected statement on it; nested transaction behavior must not be assumed.
3. Settlement routes are intentionally not covered by the single-organization helper. A separately designed bilateral scope must bind both parties and current credential ownership and must not permit a forged party header.
4. Migration `20261101_signed_request_context_verifier.sql` provisions the `app_security` verifier foundation and a restricted SECURITY DEFINER function, but contains **zero ENABLE/FORCE ROW LEVEL SECURITY statements and zero CREATE POLICY statements**. It does not itself protect application tables.
5. Selected migrations `004_security_auth.sql`, `012_geography_authorization.sql`, `033_field_sync_tenant_integrity.sql`, `047_settlement_party_integrity.sql`, `20261102_platform_authority_bootstrap.sql`, `20261104_identity_bound_hierarchical_onboarding.sql` and `20261105_geography_scope_search_path_hardening.sql` also contain no RLS enable/force or policy statements. They establish identity, geography, triggers, function ownership and governance controls, which are not substitutes for RLS.
6. The geography helper in migration `012_geography_authorization.sql` intentionally returns true when an organization has no verified geography roots. This compatibility behavior must be explicitly reviewed for a national production policy; it must not silently become an assumption that all organizations are geographically unrestricted.
7. The production baseline previously read from the authoritative Neon branch reported 67 public tables, zero RLS and zero FORCE RLS, with no production `auth_private`/`app_security` schemas. The production DB owner has BYPASSRLS and elevated role privileges. Production cannot safely enable policies until runtime roles, owner roles, grants, policies and every route/worker access path are reconciled.

## Priority findings

- **P0 — no production tenant RLS:** verified baseline is 0/67 public tables protected by RLS. App-side checks alone are not an adequate national multi-tenant isolation boundary.
- **P0 — privileged production role posture:** current production owner/runtime identity has BYPASSRLS and elevated privileges. A policy cannot constrain a BYPASSRLS role.
- **P0 — route integration incomplete:** signed request-context helper is not yet the universal path for tenant data. Direct pool queries remain.
- **P0 — bilateral settlement model unresolved:** must have explicit two-party authorization and separate policy design.
- **P1 — route transaction refactor risk:** route-local transactions and pooled helper calls can split tenant context from protected statements.
- **P1 — geography compatibility default:** unscoped organizations currently pass geography helper checks; production needs a deliberate onboarding/coverage rule.
- **P1 — JSON/polymorphic ownership:** carbon calculations, ESG metrics, metadata, evidence and registry links require explicit authoritative owner mapping before policy generation.
- **P1 — background/async paths:** static HTTP route scan is not proof that every scheduled, worker, webhook, queue or external callback is covered. Each must be separately inventoried and bound to tenant/actor provenance.

## Required next artifacts and gates

1. Machine-readable endpoint inventory with HTTP method/path, auth mode, SQL call site, tables + operation, client/pool, transaction boundary, organization owner column, geography path, function/trigger side effects, and negative tests.
2. Complete 67-table ownership classification: single-org, bilateral, platform-global, reference/catalog, append-only evidence, derived/JSON-linked, or explicitly public.
3. Complete function/trigger/grant inventory with owner role, SECURITY DEFINER, fixed search_path, execute grants, dynamic SQL and side effects.
4. Disposable PostgreSQL test matrix using the exact proposed app/auth runtime roles: two tenants, cross-tenant SELECT/INSERT/UPDATE/DELETE, geography ancestor/descendant, membership revocation, session revocation, pool reuse, rollback and concurrency.
5. Dedicated bilateral settlement policy and tests.
6. Independent security + DBA review, backup/restore and rollback rehearsal.

## Release boundary

No production database DDL/DML, grants, role changes, secrets, RLS enablement, migration, branch deletion, merge or deployment was performed by this audit. Keep PR #192 and PR #203 draft. Production remains HOLD, certification OFF and TRL 9 not established.
## Follow-up code change — EPR mutation authorization transaction binding

During this audit, both `POST /api/v1/epr/returns/:returnId/submit` and `POST /api/v1/epr/returns/:returnId/external-reference` were found to lock and mutate the return on a checked-out client while evaluating `epr:manage` through the pool (a separate connection). The permission read could therefore run outside the row-locking transaction and observe a different snapshot.

Commit `0b06f342290d3b8fa9444db5038b4d90854c4899` changes both checks to use the same `PoolClient` as the mutation. This is a targeted transaction-consistency correction, not full tenant RLS integration. Exact-head CI run `41436296516` is in progress; keep the finding open until CI and independent review pass.
## Initial data-ownership classification — schema/migration-derived draft

The following is a policy-design starting point, not a complete inventory of all 67 production tables. It is derived from the foundational migration DDL and route references. Each table must be checked against live constraints, foreign keys, triggers, JSON columns and actual production schema before a policy is authored.

| Classification | Tables / table families | Proposed ownership key / policy boundary | Required exception handling |
|---|---|---|---|
| Identity and credentials | identities, identity_credentials, identity_password_credentials, identity_sessions | Actor identity; sessions only visible to the authenticated identity or tightly scoped auth routines | Auth/session verification routines need minimal dedicated grants; never expose password material |
| Organization membership and governance | organizations, organization_memberships, roles, stakeholder_applications, stakeholder_application_approvals, organization_verification_evidence, organization_statutory_profiles, organization_geography_scopes, platform_access_change_requests | organization_id and/or identity_id; platform reserved capabilities separate from tenant roles | Platform authority and two-custodian access changes require narrow function-only access and separation of duties |
| Geography/reference | geography, geography_sources, epr_schemes, regulatory_sources, methodology_versions | Explicitly public/read-only catalogue where approved; organization scope assignment remains controlled | Do not allow unverified catalogue writes or expose sensitive source metadata |
| Operational activity and MRV | activities, activity_assignments, measurements, evidence, verifications, mrv_observations, mrv_provenance_events, evidence_verification_requirements | organization_id via activity; geography_id checked against verified org scopes | Cross-activity evidence links require same-tenant validation; external anchors append-only |
| Resource flow and chain of custody | resource_flows, chain_of_custody_links | organization_id; source/destination geography both validated | Inter-organization transfer may require explicit bilateral ownership rather than source-org-only scope |
| Carbon / methodology / environmental claims | carbon_projects, carbon_calculations, environmental_attribute_allocations, environmental_attribute_claims and reporting references | Organization owner through project/activity/claim references; methodology catalog is governed reference data | Derived rows and JSON metadata must not infer ownership from caller-supplied JSON |
| EPR / statutory compliance | epr_obligations, epr_credits, epr_returns, organization_epr_applicability, organization_bwg_assessments, bwg_profiles, bwg_reporting_periods, bwg_waste_reports, bwg_epr_reports, bwg_esg_reports | Organization owner; statutory applicability and geography scope | Scheme catalog is shared; returns, credits, evidence and reporting periods tenant-owned |
| ESG / reporting | esg_reporting_periods, esg_metrics, brsr_* | organization_id via reporting period and evidence/activity | Aggregate read models must constrain every join to the same authorized org |
| Registry and environmental attributes | credentials, registry_events, environmental_attribute_* | Current owner and issuer organization; immutable event history | Transfers require recipient membership; platform registry oversight distinct from tenant visibility |
| Settlement / reconciliation | settlements, settlement_events, settlement_reconciliations | Explicit payer + payee party scope; current credential owner and both authorizations | Never treat as single-tenant by default; separate multi-party RLS claim/policy and tests required |
| Devices and field sync | field_devices, operation_sync_envelopes, field_sync_envelopes, field_sync_conflicts, field_sync_cursors | Device identity + owning organization; verified enrollment | Service/worker role must be restricted; replay/idempotency and conflict audit remain append-only |
| Evidence vault | evidence_artifact_series, evidence_artifact_versions, evidence_artifact_reviews | Organization via evidence/activity; immutable artifact lineage | Object storage access must enforce same tenant as metadata; reviewer access must be separately authorized |
| Audit / governance event log | audit_events, platform_audit_chain_heads | Tenant-scoped events plus separate platform-governance events | Append-only insert via narrow functions; prevent tenants from reading platform-only events or rewriting history |

### Critical design rules before policy generation

- Do not generate generic `USING (organization_id = current_org())` policies for every table. Several tables have no direct organization_id, are identity-owned, are shared catalogues, or are genuinely bilateral.
- Define a stable owner path for each child table (for example `evidence → activities → organization_id`) and enforce that parent linkage with FK/trigger constraints as well as RLS.
- Do not treat an organization with zero verified geography roots as nationally authorized by default. Decide whether it is onboarding-only, restricted to an explicitly approved default scope, or blocked from regulated writes.
- Separate API runtime, auth function owner, verifier function owner, migration principal, bootstrap owner and worker roles. Runtime must be NOBYPASSRLS and have no owner/function-owner membership.
- Security-definer routines need fixed search_path, explicit schema qualification, minimal EXECUTE grants, no untrusted dynamic SQL, and documented actor/tenant derivation.
- Bilateral settlement, registry transfer and inter-organization chain-of-custody are separate authorization products, not incidental exceptions to single-organization scope.
- Reference/catalog rows are read-only for tenants. All mutation authority remains in approved governance functions with audit provenance.


## Live production table register — complete name coverage (provisional)

The following 67 rows enumerate every base table returned by the live Neon production table inventory. This is a machine-readable *provisional* authorization register. Classification and scope paths are hypotheses from names, existing route/migration evidence and domain semantics; they are not approved RLS expressions. Every row must be reconciled to live columns, foreign keys, unique constraints, triggers, API/worker call sites and business ownership before policy design.

```csv
table_name,provisional_class,proposed_scope_path,open_review
"activities","TENANT_OPERATIONAL","activity.organization_id","PENDING FK/column verification"
"activity_assignments","TENANT_OPERATIONAL","activity → organization","PENDING FK/column verification"
"audit_events","AUDIT_GOVERNANCE","tenant actor/organization; platform events separate","PENDING event visibility split"
"bwg_epr_reports","TENANT_STATUTORY","BWG report/profile organization","PENDING FK/column verification"
"bwg_esg_reports","TENANT_STATUTORY","BWG report/profile organization","PENDING FK/column verification"
"bwg_profiles","TENANT_STATUTORY","organization applicability/profile","PENDING FK/column verification"
"bwg_reporting_periods","TENANT_STATUTORY","BWG profile / applicability","PENDING FK/column verification"
"bwg_waste_reports","TENANT_STATUTORY","BWG profile / reporting period","PENDING FK/column verification"
"carbon_calculations","DERIVED_TENANT_CLAIM","project/activity/evidence owner path","JSON/link ownership review required"
"carbon_market_mechanisms","SHARED_GOVERNED_CATALOG","platform-governed reference","Confirm public read fields"
"carbon_projects","TENANT_CARBON","organization/project owner","PENDING FK/column verification"
"ccts_methodology_registry","SHARED_GOVERNED_CATALOG","platform-governed methodology registry","Confirm public read fields"
"chain_of_custody_links","BILATERAL_OR_INTERORG","source + destination organizations","Dedicated bilateral scope required"
"cpcb_swm_stakeholder_workspaces","TENANT_STATUTORY","workspace organization","PENDING FK/column verification"
"cpcb_swm_status_history","TENANT_AUDIT_HISTORY","workspace organization via parent","Append-only and tenant history review"
"credentials","REGISTRY_MULTI_PARTY","issuer/current owner organization","Transfer/current-owner scope required"
"environmental_attribute_claims","REGISTRY_MULTI_PARTY","claimant/current owner + source attribute","Double-claim guard; bilateral transfer review"
"epr_credit_allocations","TENANT_STATUTORY","credit owner / obligation organization","PENDING FK/column verification"
"epr_credit_transfers","BILATERAL_OR_INTERORG","source + recipient organizations","Dedicated bilateral scope required"
"epr_credits","TENANT_STATUTORY","credit owner organization","PENDING FK/column verification"
"epr_obligations","TENANT_STATUTORY","obligated organization","PENDING FK/column verification"
"epr_returns","TENANT_STATUTORY","returning organization","PENDING FK/column verification"
"epr_schemes","SHARED_GOVERNED_CATALOG","platform-governed reference","Read-only tenant access"
"esg_metrics","DERIVED_TENANT_REPORTING","reporting period organization","JSON/source linkage review"
"esg_reporting_periods","TENANT_REPORTING","reporting organization","PENDING FK/column verification"
"evidence","TENANT_EVIDENCE","activity organization / uploader","Blob storage access must match metadata scope"
"evidence_artifact_reviews","TENANT_EVIDENCE_AUDIT","artifact/evidence owner; reviewer actor","Append-only review record"
"evidence_artifact_series","TENANT_EVIDENCE","evidence/activity organization","PENDING FK/column verification"
"evidence_artifact_versions","TENANT_EVIDENCE_AUDIT","artifact series organization","Immutable lineage"
"evidence_verification_requirements","SHARED_GOVERNED_CATALOG","governed requirement catalogue","Verify any tenant-specific overrides"
"field_devices","TENANT_DEVICE","enrolled organization + device identity","Worker/service identity also required"
"field_sync_conflicts","TENANT_DEVICE_AUDIT","device/envelope organization","Append-only resolution audit"
"field_sync_cursors","TENANT_DEVICE","device + organization","Worker/service scope required"
"field_sync_envelopes","TENANT_DEVICE_AUDIT","device/envelope organization","Append-only/replay protections"
"geography","SHARED_REFERENCE","approved public geography catalogue","Tenant writes prohibited"
"geography_sources","SHARED_REFERENCE","approved public source catalogue","Tenant writes prohibited"
"identities","IDENTITY_OWNED","identity_id","No tenant-wide visibility"
"identity_credentials","IDENTITY_OWNED","identity_id","Credential material restricted"
"identity_password_credentials","IDENTITY_OWNED_SECRET","identity_id","Auth-only access; never tenant-readable"
"identity_sessions","IDENTITY_OWNED_SECRET","identity_id","Auth-only access; revocation-sensitive"
"measurements","TENANT_OPERATIONAL","activity organization","PENDING FK/column verification"
"methodology_governance_evidence","PLATFORM_GOVERNED_AUDIT","methodology version / governance actor","Immutable governance evidence"
"methodology_versions","SHARED_GOVERNED_CATALOG","approved methodology registry","Tenant read-only; governed mutation"
"mrv_observations","TENANT_OPERATIONAL","activity organization","PENDING FK/column verification"
"mrv_provenance_events","TENANT_AUDIT_HISTORY","observation/activity organization","Append-only provenance"
"obligations","TENANT_OPERATIONAL","organization/activity owner","PENDING FK/column verification"
"operation_sync_envelopes","TENANT_DEVICE_AUDIT","device/organization binding","Worker path must use same scope"
"organization_bwg_assessments","TENANT_STATUTORY","organization_id","PENDING column/FK verification"
"organization_epr_applicability","TENANT_STATUTORY","organization_id","PENDING column/FK verification"
"organization_geography_scopes","TENANT_GOVERNANCE","organization_id + verified geography","Unscoped org must not gain national access"
"organization_memberships","TENANT_GOVERNANCE","organization_id + identity_id","Identity sees own memberships; org admins constrained"
"organization_statutory_profiles","TENANT_GOVERNANCE","organization_id","PENDING column/FK verification"
"organization_verification_evidence","TENANT_GOVERNANCE_AUDIT","organization_id + evidence","Verification authority separately scoped"
"organizations","TENANT_GOVERNANCE","organization_id","Self/admin/regulator visibility distinct"
"platform_access_change_requests","PLATFORM_GOVERNANCE","platform requester/approver","Two-custodian; no tenant direct write"
"platform_audit_chain_head","PLATFORM_AUDIT","platform audit chain","Platform-only, narrow append/update routine"
"registry_events","REGISTRY_MULTI_PARTY_AUDIT","issuer/current owner/recipient organization","Append-only; transfer parties distinct"
"regulatory_requirements","SHARED_GOVERNED_CATALOG","approved public regulatory catalogue","Public read only"
"regulatory_sources","SHARED_GOVERNED_CATALOG","approved public source catalogue","Public read only"
"resource_flows","BILATERAL_OR_INTERORG","source + destination org/geography","Do not infer single owner without business rule"
"roles","GOVERNED_AUTHORIZATION","platform defaults + org-specific role assignments","Reserved roles platform controlled"
"schema_migrations","PLATFORM_OPERATIONS","migration principal only","Never expose to tenant runtime"
"settlement_events","BILATERAL_AUDIT","payer + payee + credential owner","Append-only, bilateral claims"
"settlements","BILATERAL_FINANCIAL","payer + payee + current credential owner","Dedicated bilateral scope; no single-org default"
"stakeholder_application_approvals","GOVERNANCE_WORKFLOW","applicant org + reviewer authority/geography","Hierarchy + separation of duties"
"stakeholder_applications","GOVERNANCE_WORKFLOW","applicant identity/org + reviewer scope","Hierarchy + applicant privacy"
"verifications","TENANT_OPERATIONAL","activity/evidence organization + verifier","Verifier independence and geography"
```

### Coverage and acceptance rule

- Register row count: 67; live base-table count: 67.
- No table is authorized for a policy merely because its name appears here.
- `BILATERAL_*`, `REGISTRY_MULTI_PARTY*`, `IDENTITY_*`, `PLATFORM_*`, `SHARED_*` and `DERIVED_*` classes require bespoke access semantics; do not collapse them into `organization_id = active_org`.
- Before generating any policy, add verified columns, parent-FK path, insert/check semantics, update/delete semantics, actor/role restrictions, geography rule, background-service principal and negative test IDs.
- A table may require separate SELECT/INSERT/UPDATE/DELETE policies rather than one symmetric predicate. Reference catalogues should be read-only for tenant roles; secrets and auth material should be function-only or auth-runtime-only.
