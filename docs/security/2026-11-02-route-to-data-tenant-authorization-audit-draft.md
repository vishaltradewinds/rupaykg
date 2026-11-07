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


## 2026-11-02 bounded migration-DDL reconciliation — bilateral and device cohorts

Source-reviewed the exact branch migrations below. This is migration-source evidence, not proof of production schema parity: production's applied ledger ends at 20261021, while these branch migrations are later/older source files. No production catalog or data was changed.

| Table | Verified source facts | Authorization implication | Remaining uncertainty |
|---|---|---|---|
| `settlements` | `047_settlement_party_integrity.sql` trigger reads `NEW.credential_id`, `NEW.payer_id`, `NEW.payee_id`; rejects missing current registry owner, requires one settlement party to be current credential owner, rejects payer=payee. | Bilateral payer/payee scope is mandatory; additionally bind the current credential owner and authorized actor. | Full column/FK/unique/check constraints, SELECT visibility, settlement state transitions, party consent/approval, and current-owner derivation correctness remain unverified. Trigger is an integrity check, not row isolation. |
| `resource_flows` | `012_geography_authorization.sql` trigger uses `NEW.organization_id`, `NEW.source_geography_id`, `NEW.destination_geography_id`; both geography endpoints are checked against the same organization scope. | Existing source models a single organization owner for the flow, with both endpoints geographically constrained. Do not silently reinterpret this as two-party transfer ownership. | Actual FK/columns and route semantics need confirmation; no recipient organization field is evidenced by this migration. No-root organizations pass the geography helper by compatibility design. |
| `chain_of_custody_links` | No direct table DDL or trigger definition was established in the bounded source set reviewed in this pass. | Keep bilateral/inter-org classification provisional; no policy predicate may be authored. | Locate authoritative CREATE TABLE/FK/trigger source and reconcile activity, flow, source/destination actor and organization ownership. |
| `field_sync_envelopes` | `033_field_sync_tenant_integrity.sql` trigger binds `NEW.identity_id` to enrolled `field_devices.identity_id`, requires device status VERIFIED, and prevents processed envelope provenance fields being changed after terminal status. | Device identity is a separate principal dimension; tenant scope must be derived from verified device enrollment, not caller-supplied organization data. | Device organization FK, envelope parent FK, cursor/conflict ownership and worker execution context remain to be mapped. |
| `organization_memberships`, `identity_sessions` | `004_security_auth.sql` defines membership identity_id + organization_id + role_id and uniqueness across that triple; sessions bind identity_id and include expiry, revocation and unique token_hash. | Membership visibility must distinguish identity-self from org-admin; session/token material is identity/auth-only and must not be tenant-readable. | Later migration replacements, all column constraints, exact function grants and session lifecycle callsites remain to be reconciled. |

### New high-priority design observations

1. The resource-flow geography trigger validates both endpoints against one `organization_id`. That is a geographic constraint, not a bilateral authorization model. The business rule must explicitly decide whether a flow is tenant-owned by an operator, jointly owned, or has source and destination parties; RLS must follow that decision.
2. The settlement integrity trigger's `coalesce(re.to_owner_id, re.from_owner_id)` chooses the latest qualifying registry event's recipient when non-null, otherwise its sender. This is only sound if the event ordering and event-type semantics guarantee that the latest ISSUED/TRANSFERRED event is the authoritative current-owner event. Require a deterministic registry-current-owner invariant and tests for issuance, successive transfers, malformed/duplicate events and concurrent settlement/transfer before relying on it for authorization.
3. `organization_has_geography_scope` returns true when no VERIFIED geography roots exist. Until onboarding guarantees a verified root, regulated write operations should be denied or limited to an explicit onboarding-only path; this compatibility default must not be treated as national authorization.
4. The field-sync trigger protects identity/device binding and terminal provenance, but does not prove a background worker exists or that its database principal is tenant-restricted.

### Evidence status

- Source-verified migration-level semantics: settlements (party columns/current-owner integrity trigger), resource_flows (single organization + two geography endpoints), field_sync_envelopes (device identity binding), memberships/sessions (identity/org/role and revocation fields).
- Still provisional: chain_of_custody_links, credentials, registry_events and environmental_attribute_claims ownership/policy semantics; all 67 production table FK paths; production parity for migrations newer than 20261021.
- No RLS policies generated; no production roles/grants/migrations or data changed. PR #192 remains draft and release remains HOLD.


## 2026-11-02 registry/settlement source audit — second bounded batch

Reviewed exact branch source files: `migrations/006_registry_settlement_guardrails.sql`, `008_verification_integrity.sql`, `014_registry_settlement_idempotency.sql`, `047_settlement_party_integrity.sql`, and `20261020_ccts_methodology_registry.sql`. These are source-level findings only; they do not establish production parity for migrations newer than the production ledger cutoff (20261021).

### Verified source semantics

- `credentials`: migration 006 adds `verification_id`, `methodology_version_id`, positive `quantity` and `unit`; issuance/value-bearing states (ISSUED, ACTIVE, TRANSFERRED, RETIRED) require a linked APPROVED verification. A partial unique index on (activity_id, verification_id) prevents duplicate credential issuance for the same pair.
- `registry_events`: migration 006 adds `verification_id` and `recorded_by_identity_id`; migration 008 makes registry events append-only for UPDATE/DELETE and computes an event hash on INSERT from id, credential, event type, from/to owner, external reference, verification, recorder and created_at. This protects event mutation but does not by itself prove event sequence validity or current-owner correctness.
- `settlement_events`: migration 006 creates the child table with FK to settlements and optional actor identity; migration 008 makes events append-only and hashes settlement id, event type, actor, external reference and timestamp. Append-only hash anchoring is not a substitute for tenant row visibility or cryptographic external anchoring.
- `settlements`: migration 006 requires verification + authorization reference before EXECUTING/RECONCILING/SETTLED. Migration 014 makes non-empty external_reference unique and prevents changing an assigned reference or confirmed timestamp. Migration 047 adds party/credential integrity and current-owner checks. These are mutation-integrity controls, not bilateral SELECT/UPDATE authorization.
- Verification approval: migration 008 requires the verifier identity to have a VERIFIED membership and a verifier/auditor/validator role or verification permission; it prevents an activity actor from approving their own activity/evidence. The function's permission query is global across memberships and is not, by itself, organization/geography scoped.
- `ccts_methodology_registry`: migration 20261020 creates a global reference catalogue keyed by code, with item kind, sector, source status, implementation status, official version, source URL and source snapshot/check dates. Registry presence explicitly does not mean the methodology/tool is implemented, validated or applicable. This is shared reference data, not tenant-owned data.

### Authorization contract decisions required before policies

1. Credentials should be protected by a verified activity/project organization ownership chain plus approved verification and methodology reference. Do not infer tenant ownership from the credential's current registry owner alone.
2. Registry event visibility needs a policy decision for issuer, current owner, prior owner, recipient and regulator/auditor. Append-only triggers alone do not prevent unauthorized SELECT or INSERT.
3. Settlement and settlement-event access must be party-scoped (payer, payee, credential owner) with operation-specific state transitions. A generic single-organization RLS predicate is incorrect for bilateral settlement.
4. Verification approval must require the verifier's verified authority in the same organization/geographic scope as the subject activity/evidence, not merely any verified verifier membership. Add cross-organization and cross-geography negative tests.
5. Hash values are currently generated using SHA-256 over concatenated fields, but source reviewed here does not establish a previous-hash chain or external anchoring for these event tables. Do not describe this as immutable cryptographic proof or tamper-evident external consensus.
6. The methodology catalogue must be read-only to ordinary tenant roles; edits require controlled platform/regulatory source governance with provenance. Its `implementation_status` and `source_status` must remain distinct.

### Remaining gaps

- Exact full CREATE TABLE/FK definitions and all later replacements for `credentials`, `registry_events`, `environmental_attribute_claims`, `chain_of_custody_links`, and settlement parent tables still need full migration-chain reconciliation.
- Need tests for credential transfer ownership sequence, issuer/recipient visibility, verifier cross-tenant denial, settlement payer/payee isolation, duplicate external reference, state-transition matrix, and concurrent transfer/settlement.
- Need full per-function EXECUTE ACL and trigger/function owner inventory; migration source scan cannot prove live production ACLs.
- No RLS policies generated, no production schema/role/grant/data changed. Keep PR #192 draft and release HOLD.


## 2026-11-02 forward-only verifier-scope migration added — validation pending

Added `migrations/20261106_verifier_same_org_geography_scope.sql` on the PR #192 branch (commit `c15726971ffb57b96c25573bd5f0f6107b6011ad`). The migration:

- Adds `public.has_verification_permission_for_activity(identity_id, activity_id)` with restricted `search_path = pg_catalog, pg_temp` and schema-qualified relations.
- Requires a VERIFIED membership in the exact activity organization, a verifier-capable role/permission, a non-null activity geography, at least one VERIFIED organization geography root, and activity geography inside the verified scope.
- Replaces the approval trigger to resolve the activity from `NEW.activity_id` or `NEW.evidence_id`, reject mismatched activity/evidence pairs, require the scoped helper, and retain the self-verification prohibition.
- Leaves the older global helper in place for compatibility; the approval trigger no longer calls it.

**Important validation status:** this migration has been committed but has NOT yet been run against a disposable PostgreSQL instance, and no regression suite has been added or run. Column/table assumptions (including `activities.actor_identity_id`, `activities.geography_id`, `evidence.activity_id`, `organization_memberships.status`, and `roles.permissions` JSONB) must be confirmed against the complete migration chain and a disposable schema before merge. In particular, confirm whether `verifications.decision` is the exact approval state value and whether all verifier roles/permissions are represented by the predicates above. Migration validator and full CI are still required.

Required test matrix remains: same-org/in-scope success; unrelated-org denial; out-of-scope geography denial; NULL geography denial; no verified geography root denial; evidence-only activity resolution; activity/evidence mismatch denial; self-verification denial; non-APPROVED workflow compatibility; restricted search-path/runtime-role bypass denial.

No production migration was applied. PR #192 remains draft and production release remains HOLD. TRL 9 is not established.


## 2026-11-02 schema compatibility review of verifier migration

Compared the new migration against the available source definitions:

- `migrations/004_security_auth.sql`: `organization_memberships.status` is `record_status`; it has `identity_id`, `organization_id`, `role_id` and VERIFIED membership semantics.
- `migrations/012_geography_authorization.sql`: `organization_geography_scopes` has `organization_id`, `geography_id`, `status record_status`; `organization_has_geography_scope(uuid,uuid)` returns true when there are no VERIFIED roots. The new helper explicitly checks for a VERIFIED root first, so that compatibility branch cannot grant verifier approval when no root exists.
- `migrations/008_verification_integrity.sql`: existing trigger confirms `verifications.decision`, `verifier_identity_id`, `activity_id`, `evidence_id`, and the `activities.actor_identity_id` reference are already used by the existing trigger. This supports replacing that trigger function without changing its trigger name.
- `apps/src/mrv-routes.ts`: activity geography is explicitly read from `activities.geography_id`, with organization binding and non-null checks.
- `migrations/20261026_auth_scoped_onboarding_mutations.sql`: role permissions are JSONB arrays and verified memberships use `record_status`; onboarding initially creates membership and geography scope as PENDING, consistent with the proposed fail-closed requirement.

### Remaining schema uncertainty and hardening

The migration has not yet been applied to a disposable database, so PostgreSQL compilation remains unproven. The subject organization itself should also be required to have `organizations.status='VERIFIED'` before approval; the committed migration currently requires verified membership and verified geography root but does not yet explicitly require verified organization status. Treat this as a required correction before merge. Check whether `verifications.activity_id` and `evidence.activity_id` are nullable and whether all rows can be resolved as expected. Confirm all role aliases and permissions from the authoritative role catalogue.

### Validation execution status

- Static source compatibility review: completed for the five files above.
- Migration validator: not executed in a checked-out runtime.
- PostgreSQL migration apply/rollback: not executed.
- Regression tests: not implemented or executed.
- CI: no workflow run was returned for migration commit `c15726971ffb57b96c25573bd5f0f6107b6011ad`; no green status is claimed for the new migration.
- Production: unchanged; no DDL, grants, role or data changes.


## Follow-up source-level finding and targeted remediation — activity geography binding

A deeper read of `apps/src/value-routes.ts` found that `assertActivityGeographyScope` originally accepted `(geographyId, identityId)` and queried for any verified membership belonging to the identity whose organization passed the geography helper. It did not bind the membership to the `organization_id` returned by `activityAccess`. For multi-organization identities, a geography scope held in Organization A could therefore satisfy the geography check for an activity owned by Organization B. This is a cross-organization authorization defect in the carbon-calculation route's geography check; actual production reachability remains subject to the current production role/schema and route exposure, but the source-level predicate was insufficient.

Targeted fix committed on this PR branch:
- `assertActivityGeographyScope` now requires the activity's `organization_id` and constrains `organization_memberships.organization_id` to that exact organization.
- The carbon-calculation callsite passes `access.organization_id` from the activity lookup.
- New unit tests assert the exact organization binding, missing-geography denial and failed-scope denial.
- New migration `20261108_geography_scope_fail_closed.sql` removes the shared helper's compatibility `THEN true` path. An organization with no VERIFIED geography root now fails the helper check.
- Existing registry/settlement PostgreSQL runtime acceptance now asserts that a verified scoped organization passes while an unscoped counterparty organization fails. This exercises the helper against the disposable CI database after migration application.

Exact code branch head at time of note: `9d6664ba06f8264655606eaa8853062e518fadd1`. Exact-head CI run `41456990898` is QUEUED. No production migration or database change was made. This remediation remains unaccepted until exact-head CI passes and independent review confirms the national onboarding path provisions verified geography roots before geography-bound operations.

**Operational consequence:** existing organizations without verified geography roots will be blocked from geography-bound actions after this migration is deployed. A controlled backfill/onboarding process is required; do not apply this migration to production until all legitimate organizations are classified and a rollback/restore plan is approved.


## Additional transaction-boundary reconciliation — 2 November follow-up

### Evidence vault upload
The upload route previously resolved activity organization/geography and checked `evidence:upload` through the pool before acquiring its write client. A membership/role change between preflight and mutation could make the authorization decision stale. The route now repeats activity context and permission checks through the same checked-out client after BEGIN and before creating the evidence series, evidence row and artifact version. Read/list/download paths still require separate query-level review; they are not certified as RLS-context-bound.

### Registry issuance and bilateral settlement
- Credential issuance now evaluates `ISSUE_CREDENTIAL` on the same transaction client that locks the verification/evidence/activity and inserts the credential.
- Settlement creation evaluates `settlement:authorize` for both payer and payee on the write transaction client.
- Settlement authorization, execution and confirmation require the corresponding high-risk permission for both payer and payee on the transaction client.
- Missing bilateral creation authority now returns 403.
- These changes do not by themselves implement the signed bilateral RLS context. The single-organization RLS helper explicitly rejects bilateral contexts, so production RLS design must include a separately validated two-party transaction contract, not bypass that rejection.

### MRV submit — unresolved critical boundary
The submit route holds a session advisory lock using a checked-out client but issues most activity/evidence/measurement/provenance queries through the pool. This splits the lock, authorization reads and final provenance write across database connections. It is not yet a single tenant-context transaction. Do not simply wrap Guardian/Hedera network calls in a long-running DB transaction. Implement a durable idempotent claim/outbox → external execution → authenticated finalize flow, with actor/org/geography binding on both claim and finalize and uniqueness/replay protection.

### CI regression caused by stricter geography invariant
Exact-head CI run `41457065615` passed 155/156 tests. The only failure was the evidence-vault integration fixture inserting a geography-bound activity before seeding its VERIFIED organization geography scope. The fail-closed trigger correctly rejected it. Fixture ordering was corrected in `apps/src/evidence-vault.integration.test.ts` to create the verified scope first. Exact-head CI run `41457553245` was queued after subsequent code fixes; acceptance is pending.

Production remains unchanged. This audit is a source-level draft, not an independent security certification.


### MRV submit connection consistency correction — follow-up
The MRV submit route previously acquired a session advisory lock on a checked-out `PoolClient` but performed the authorization reads, payload reads, replay lookup and final provenance write through `pool.query` on potentially different connections. It now keeps the lock and all those submit-path database operations on the same checked-out client. The authorization and geography helper functions accept that client as well. This removes the lock/query connection split and keeps the serialized submit path on one DB session.

**Important limitation:** this is not yet a transaction-local signed RLS context. Queries remain autocommit while the session advisory lock is held, including across Guardian/Hedera network calls. A durable claim/outbox → provider execution → actor-bound finalize design remains the preferred next architecture to avoid long-running transactions while maintaining crash recovery, lease expiry, idempotency and authorization revalidation. Do not claim tenant RLS coverage from this change.


## 2026-11-02 source-DDL reconciliation — activity, evidence, MRV and field-device cohorts

This pass reads the canonical migration source at PR #192 code head `2edd251ef404d88b00e4c7f994d89e42ae38e04b`. It is source evidence only; it does not prove that every migration is applied to production or that production columns match. The authoritative production migration ledger still ends at `20261021`.

| Table / relationship | Source-verified columns and constraints | Authorization / integrity consequence | Status |
|---|---|---|---|
| `activities` | `001_core.sql`: PK `id`; required `organization_id`; optional `actor_identity_id`, `geography_id`; status and metadata. | Natural tenant root for measurements, evidence, observations and calculations. Geography is a separate required check for regulated writes; activity actor is not equivalent to organization authority. | Source verified |
| `measurements` | PK `id`; required `activity_id`; value/unit/method/source/measured_at and quality status. | Tenant and geography scope derive through activity. Every join must retain the same activity; do not accept caller-supplied organization ownership. | Source verified |
| `evidence` | PK `id`; nullable `activity_id` and `measurement_id`; evidence type/status/capture time/content URI/hash. | Evidence may be unbound at schema level; regulated MRV submission must require a non-null exact activity binding and validate any measurement belongs to that same activity. | Source verified; cross-link policy open |
| `verifications` | PK `id`; nullable `evidence_id` and `activity_id`; required verifier identity; decision/scope/rationale. | Both evidence and activity links must be exact; approval requires independent verifier authority and actor independence. Nullable source columns mean an FK alone does not establish valid MRV scope. | Source verified; cross-link policy open |
| `activity_assignments` | Composite PK `activity_id, identity_id`; optional role; no direct organization column. | Derive tenant through activity and bind identity; no generic organization_id policy can be applied. | Source verified |
| `field_devices` | PK `id`; unique `device_id`; optional identity and organization; status and metadata. | Derive authority from verified device enrollment and its organization binding. Device identity must not be substituted with caller-supplied tenant ID. | Source verified |
| `operation_sync_envelopes` | PK `id`; unique idempotency key; optional actor identity and device ID; JSON payload; replay/status fields; no organization column. | Scope through authenticated actor + verified device enrollment. Every referenced business object inside payload requires independent tenant validation; payload JSON is not an ownership source. | Source verified; payload ownership open |
| `resource_flows` | Required single `organization_id`; source and destination geography IDs; quantity/material/status. | Existing DDL models one owning organization and two geography endpoints, not necessarily two party ownership. Both geography endpoints must be authorized for the owner. | Source verified |
| `chain_of_custody_links` | Required parent `resource_flow_id`; sequence; optional `actor_organization_id`, `activity_id`, `evidence_id`; from/to geography; unique parent+sequence. | Child scope must inherit flow owner and additionally bind the actor organization, activity owner and evidence owner. It can represent a different actor organization; keep multi-party review bespoke. | Source verified; cross-parent consistency open |
| `mrv_observations` | Required `activity_id`; optional `measurement_id`; observed parameter/value/unit/method/time and quality metadata. | Measurement must belong to the same activity. Tenant/geography derive through activity; instrument ID and JSON metadata are not principals. | Source verified; same-activity guard review open |
| `evidence_verification_requirements` | Required `activity_id`; optional satisfied evidence and verification IDs; unique activity+requirement. | Satisfied evidence and verification must be linked to the same activity. A status boolean alone is not proof of the related evidence/verification chain. | Source verified; cross-parent consistency open |
| `mrv_provenance_events` | Required activity, verification and evidence FKs; Guardian/HCS result fields; integrity hash. | Three independent FKs do not themselves prove that evidence and verification belong to the same activity. Credential issuance gate checks exact evidence binding in migration 045, but a complete tenant read/write policy remains required. | Source verified; relationship invariant needs broader review |
| Evidence vault series/version/review | `20261021_evidence_artifact_vault.sql`: series has direct organization+activity; versions point to series and unique evidence; reviews point to evidence+version+reviewer. | Must enforce series organization equals activity organization, version evidence equals series activity, review evidence equals version evidence, and reviewer authority separately. Blob bytes and metadata must share the same tenant boundary. | Source verified; cross-parent guards and storage policy review open |
| `methodology_governance_evidence` | References methodology version; evidence kind/reference/hash/independent party; immutable content trigger. | Platform-governed evidence, not tenant-owned evidence. Restrict write to governed methodology process and read according to approved public/oversight fields. | Source verified |

### Durable MRV job ledger — new branch-only tables, not part of production's 67-table baseline

The proposed `mrv_submission_jobs` and `mrv_submission_job_events` tables are introduced by branch migration `20261109_durable_mrv_submission_jobs.sql`; they are not included in the existing 67-table production count and are not deployed.

A new source-integrity correction in commit `7c5ce75e5eea683416d0ae79e5cd7fef307e1836` adds composite unique indexes and foreign keys so a job cannot independently combine:
- an activity with a different organization or geography;
- evidence from a different activity; or
- a verification for different evidence/activity.

The insert guard also requires a COMPLETED activity, VERIFIED evidence, APPROVED verification by an identity independent of the activity actor, and verified organization geography scope. Negative integration cases were authored in commit `5a924a40f93f165a85de9cf70cb3c9a2d792e960` for wrong-organization, wrong-geography, unverified-evidence and rejected-verification paths. **They have not passed CI.** The migration CI failed on PL/pgSQL body quoting, and the follow-up repair attempt was blocked by the repository write safety gate. Treat the composite FK/trigger changes and these tests as unaccepted branch work until a valid migration runs and the exact-head disposable PostgreSQL test passes.

**Important residual control:** these constraints preserve the identity relationships, but evidence/verification status may later be revoked or changed. A future worker must re-check current evidence, verification, organization membership and geography authority before each irreversible provider stage and again before final provenance persistence. The enqueue API must derive the requester from the authenticated signed context and check a specific MRV submission permission; the database trigger currently validates evidence/verification bindings, not requester authorization.

### Required policy design consequences

1. Keep `IDENTITY_OWNED`, `SHARED_GOVERNED_CATALOG`, `PLATFORM_GOVERNANCE`, `BILATERAL_OR_INTERORG`, `REGISTRY_MULTI_PARTY` and `DERIVED_TENANT_*` policies bespoke.
2. For every child table, policy generation must identify both the ownership path and same-parent consistency constraints. RLS on a child alone does not repair inconsistent FKs.
3. Add negative tests for evidence/activity mismatch, measurement/activity mismatch, verifier/evidence/activity mismatch, artifact-series/activity mismatch, and device payload references crossing tenant boundaries.
4. For the MRV worker, use a dedicated non-owner, NOBYPASSRLS role with narrowly scoped access and actor-bound enqueue/finalize functions. Do not grant direct broad table mutation as a shortcut.
5. Do not deploy this branch migration or create production policies until the complete live-schema reconciliation, role/grant inventory, two-tenant tests, backup/restore and rollback rehearsal are independently reviewed.

No production database, role, grant, migration, data, deployment or external provider was changed in this pass.


## 15:24 UTC update — live schema recheck and MRV worker authorization fence

The prior paragraph above is a historical checkpoint and has been superseded where it says the migration is unaccepted because of SQL quoting. Exact-head PR #192 commit `6c13b492016cb7820d2df32243a6790586b75165` completed CI `41470418440` successfully, including migration validation, disposable PostgreSQL execution, binding negative tests, typecheck, build, browser smoke, full test suite and production-container build. This is branch CI only; no production rollout.

A fresh read-only query against the authoritative Neon production branch reconfirmed 67 public base tables, 0 RLS-enabled, 0 FORCE-RLS-enabled, and all 67 owned by login `rupaykg`. The 67-table policy matrix remains a first-pass structural map, not an approved predicate set. The route/data audit must remain open until all route, function, trigger, background worker, device and bilateral call paths are reconciled.

### New fail-closed worker gate added on PR #192

- Added `isMrvSubmissionJobStillAuthorized(client, jobId)` in `apps/src/mrv-submission-jobs.ts`.
- It re-reads the immutable job binding and requires: activity COMPLETED; organization VERIFIED; requester identity VERIFIED and not suspended; requester membership still VERIFIED in that exact organization; requester role still has `guardian:operate`; evidence still VERIFIED; verification still APPROVED and bound to that same evidence/activity; verifier distinct from activity actor; and organization geography scope still valid.
- Integration coverage now asserts the check passes for a valid synthetic requester, then fails closed when that requester's membership is moved to PENDING. The fixture explicitly grants `guardian:operate`.
- This is a reusable pre-provider-stage authorization predicate, not yet wired into a live worker loop. A production worker must call it before Guardian submission, before HCS submission/reconciliation, and before final provenance persistence, using the same non-owner worker connection and current lease.
- Current exact-head tests are running for commits `76ba515e5afd4312631bb661ef8e6b3ce1aef9cc` and `b690a5ec19ccc6b38c8d8a2ffc77f142b17af8bf`; do not claim these new authorization tests passed until the latest run completes.

### Sequencing constraint confirmed for Hedera

`createHcsTransactionId()` already generates a transaction ID before the provider side effect, and `submitHcsAnchor(payload, persistedTransactionId)` can submit using that exact ID. The worker sequence must therefore be: generate ID → persist ID under current lease → commit → submit with the persisted ID → reconcile that same ID through Mirror Node. Never call Hedera before durable ID persistence.

### Remaining hard gates

1. Wire the authorization predicate into a real durable worker orchestration and test lease expiry between every provider boundary.
2. Revalidate again before final provenance insert; persist the provenance and job state atomically.
3. Build authenticated enqueue that derives requester/org from verified request context and requires `guardian:operate`; caller-supplied identity/org IDs must not grant authority.
4. Finish exact per-table RLS predicates, app/auth/worker/migrator separation and two-tenant tests on disposable PostgreSQL.
5. Independent security/DBA review, restore/rollback rehearsal and explicit production release approval.

Production remains unchanged: no RLS, grants, roles, migrations, provider writes or deployment were applied.


### 15:30 UTC — exact-head MRV reauthorization tests passed

- Commit `b690a5ec19ccc6b38c8d8a2ffc77f142b17af8bf`, workflow `41471858495`: **SUCCESS**.
- Verified migration execution, typecheck, production build, synthetic two-custodian bootstrap, browser smoke, full integration suite including disposable PostgreSQL acceptance, and production-container build.
- The new `isMrvSubmissionJobStillAuthorized` positive and revoked-membership negative assertions passed as part of that exact-head run.
- The audit documentation update is commit `69748f8549500df56d4f9648370087266d5f31b3`, now the current PR #192 head. It is a documentation-only successor to the tested code commit; no code changed after the green run.
- This function is not yet called by a real worker loop. It is a security primitive only. No claim of durable provider orchestration or production authorization closure is made.


## Evidence Vault route audit — 2026-11-02

Scope reviewed: `apps/src/evidence-vault-routes.ts` and `apps/src/evidence-vault.integration.test.ts`.

### Verified positive controls
- Upload validates UUID inputs, bounds base64 before decoding, enforces a 5 MiB cap, restricts declared media types, checks file signatures/content, and stores SHA-256 with byte length.
- Upload uses one checked-out client and transaction for activity/geography ownership, permission, series binding, evidence row, artifact version, and final content URI update.
- Existing-series upload takes a transaction advisory lock before calculating the next version number.
- Review uses one checked-out client for row lock, geography, `evidence:review`, verifier eligibility, self-review denial, review record, verification record and evidence status mutation.
- Download verifies stored byte length and SHA-256 before returning content; response includes `nosniff` and version/hash headers.
- Existing integration test covers tenant outsider list denial, uploader self-review denial, independent reviewer approval, immutable second review, version increment, content integrity and media spoofing.

### Open security gaps — do not mark tenant-RLS complete
1. Authentication is resolved before the route transaction using `authenticate()` and ordinary pool queries; it is not yet bound to the signed request-context verifier transaction.
2. `activityContext()` and the evidence list/download routes use pool-level reads for ownership, geography and permission, then later queries. These checks are application-side only until the exact protected statements run through the canonical checked-out-client tenant transaction and the production RLS policy set exists.
3. The list/download endpoints do not share a single transaction across ownership, geography, permission and artifact bytes. A future refactor must use one client and recheck tenant scope in the same transaction as the artifact query; download must bind the artifact's evidence/activity/organization in one statement or transaction.
4. Upload creates a new series without a series-level lock (safe from same-series version races because each new series has a new ID, but concurrent duplicate logical uploads can create separate series). Decide whether this is intended idempotency behavior; if not, add an explicit idempotency key/unique business key.
5. Integration tests use the legacy auth resolver and ordinary privileged fixture pool. They prove application checks, not runtime-role/RLS isolation. Add two-tenant tests using the exact proposed restricted runtime role and verify no cross-tenant row or blob access when app checks are bypassed.
6. Review path inserts a verification row and updates evidence status but does not itself prove a complete independent evidence-review workflow against the production verifier policy; confirm role/org/geography and reviewer qualification against the approved hierarchy before production.

### Required remediation
- Migrate every evidence-vault read/write endpoint to the canonical signed tenant transaction; remove pool fallback for protected data.
- Introduce least-privilege upload/read/review database functions or narrowly scoped grants after the production table ownership/RLS matrix is approved.
- Add two-tenant negative tests for guessed evidence UUIDs, series IDs, artifact IDs, query/header org spoofing, revoked membership, geography revocation, pool reuse and concurrent review/upload.
- Add duplicate-upload idempotency semantics and test them.
- Keep evidence vault production use behind the same RLS/tenant-isolation gate as MRV and EPR.

This is a static code and test review, not a production penetration test. No production database changes, role/grant changes, storage migration or deployment were made.
