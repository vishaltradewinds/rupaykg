# RupayKg Pan-India Architecture Conformance Audit

**Audit date:** 2026-10-21  
**Scope:** Current feature branch `intelligence/ai-evidence-intake-middleware`, PR #41; review of platform declaration, government mirror intake, worker validation, CPCB SWM workspace, organization/stakeholder authorization, evidence-vault boundary, and related migrations/runbooks.  
**Decision:** **INTENT DOCUMENTED; PAN-INDIA OPERATIONAL CONFORMANCE NOT YET PROVEN.** This is a focused source review, not an independent legal opinion, exhaustive penetration test, nationwide load test, or certification.

## 1. Binding requirement

[RUPAYKG_FUNDAMENTAL_RULE_PAN_INDIA.md](RUPAYKG_FUNDAMENTAL_RULE_PAN_INDIA.md) is the governing product rule: RupayKg is nationwide digital infrastructure, not a pilot-bound product. A site or pilot may validate a bounded workflow only. It must not determine core product scope or be represented as nationwide readiness.

## 2. Findings

| Area | Evidence observed in reviewed branch | Result |
|---|---|---|
| Product intent | Root README calls RupayKg a nationwide platform for urban and rural resource flows; the fundamental rule now states pan-India by design | **Aligned at intent/documentation level** |
| Geography authorization | Evidence verification uses organization geography scope; CPCB workspace accepts a geography identifier and organization-scoped operations | **Useful control present; hierarchy and national coverage not proven** |
| Government inbox identity | Inbox contract requires `authorityCode` and `municipalCode`; database persists those fields and scopes HMAC credentials/allow-listing | **Fail-closed intake controls present; normalized state/district/ULB hierarchy and crosswalk are not evidenced here** |
| Stakeholder taxonomy | CPCB routes and authorization migrations use a closed list: BWG, waste facility, ULB, district/gram panchayat, collector/transporter and processor | **Extensibility gap**: a new stakeholder class currently appears to require coordinated code/schema changes; no reviewed evidence of an administratively governed taxonomy registry |
| Jurisdiction-specific rules | The reviewed source set does not demonstrate a complete, versioned national/state/local applicability registry for all relevant EPR, statutory, MRV and crediting routes | **Not proven; required architecture work** |
| Official integrations | Bridge is explicitly an asynchronous, untrusted inbox and not a live government production integration; official API contracts/credentials remain a release gate | **Correctly fail-closed; national connectivity not established** |
| Evidence lineage | Evidence-vault persistence binds artifacts to activity, organization and identity and calculates SHA-256; worker validates structure/hash/timestamp but does not make source evidence authoritative | **Useful foundation; full source-to-calculation-to-verification lineage not yet proven end to end** |
| Pilot containment | Jabalpur/Kathonda is described as a validation context in the audit narrative, not as the national product boundary | **Intent aligned; automated anti-hardcoding guard not evidenced** |
| National scale and resilience | Bounded queue and CI acceptance exist, but the reviewed evidence does not establish measured nationwide tenant/traffic/storage capacity, regional connectivity, disaster recovery or support coverage | **Not proven** |

## 3. Concrete corrective requirements

These are release/architecture gates, not claims that the current code already satisfies them:

1. **Canonical jurisdiction model:** Define stable, versioned geography records and parent-child relationships (country/state/district/local body/operational site as applicable), effective dates, external identifier aliases and provenance. Keep source-system identifiers distinct from RupayKg internal IDs.
2. **Approved source crosswalks:** Map each authority's source identifiers to organization, jurisdiction, site and activity only through reviewed, evidence-backed mappings. Reject ambiguous, expired, conflicting or out-of-scope mappings.
3. **Governed extensibility:** Move stakeholder and jurisdiction-specific capabilities toward a versioned registry/configuration model where safe; do not simply remove enum checks without equivalent database constraints, authorization rules, migrations and tests.
4. **Versioned rules catalogue:** Record scheme, authority, jurisdiction, activity/waste stream, effective period, methodology version, evidence requirements, applicability decision and decision provenance. A generic national default must not override a more specific applicable rule.
5. **No pilot coupling:** Add tests or static checks for pilot site IDs/names in reusable business logic and keep pilot fixtures clearly labelled. Configuration and fixtures may contain real pilot values; core decision logic must not branch on the pilot location.
6. **Adapter contracts:** Test each authority adapter against documented official schemas, authentication, rate limits, replay/idempotency, error semantics and sandbox fixtures. Do not call an integration official until authorization and contract are verified.
7. **National readiness evidence:** Produce representative multi-jurisdiction tests, tenant isolation tests, measured load/capacity results, backup/restore and disaster-recovery evidence, low-bandwidth/mobile accessibility tests, and operational support/escalation evidence.
8. **Shakti gate:** Each release records which jurisdictions and workflows were actually tested, what is still untested, approvals required, rollback criteria and evidence owners.

## 4. Release decision

- **PASS:** Pan-India is stated as a permanent product aim and is now recorded as a binding rule on this branch.
- **PARTIAL:** Existing geography scoping, organization boundaries, authority-scoped intake and evidence controls provide reusable foundations.
- **GAP:** The reviewed branch does not yet prove a canonical nationwide jurisdiction/crosswalk service, configurable versioned rule applicability, open-ended governed stakeholder taxonomy, or measured national-scale readiness.
- **HOLD:** Do not describe RupayKg as operationally ready across India, and do not infer statutory compliance, official API authorization, independent verification or credit issuance from code tests or a pilot.

**Required next engineering sequence:** (1) inventory existing geography/organization/site/activity schemas and constraints across the repository; (2) design a backward-compatible jurisdiction and external-identifier crosswalk; (3) design a versioned applicability registry for rules/methodologies; (4) migrate the fixed stakeholder list safely where justified; (5) add multi-jurisdiction, isolation and pilot non-coupling tests; (6) validate in isolated staging; (7) record Shakti approval before any release.


## 5. Expanded schema review — additional evidence and risk (2026-10-21)

A wider tree-based review also inspected `docs/INDIA-GEOGRAPHY.md`, `docs/DOMAIN-MODEL.md`, `docs/STAKEHOLDER-ONBOARDING-HIERARCHY.md`, `packages/domain/src/geography.ts`, migrations `003`, `012`, `042`, `067`, `077`, and `20261020_ccts_methodology_registry.sql`.

### Existing nationwide foundations (credit where supported)

- The domain model already includes a geography hierarchy for country, state/UT, district, sub-district, urban and rural local geographies, and versioned external source metadata.
- The repository documents source-versioned geography and says not to fabricate LGD records.
- Organization geography scopes and recursive ancestry checks exist.
- Hierarchical stakeholder onboarding includes local, district, state and platform approval steps.
- Regulatory requirement catalogues, EPR scheme catalogues and a CCTS methodology registry exist. The methodology migration explicitly warns that registry presence is not implementation or eligibility.

These are meaningful reusable foundations; the platform should extend them rather than create a parallel geography or methodology system.

### High-priority conformance risk: unscoped organization fallback

Migration `012_geography_authorization.sql` currently defines `organization_has_geography_scope` so that when an organization has **no verified geography roots**, the function returns `true`. The migration comment says this preserves legacy tenants. That compatibility behavior can undermine the pan-India rule's explicit jurisdiction-boundary requirement if a high-risk activity or evidence-verification path relies on the function without separately requiring an explicit scope.

**Required correction:** inventory every call site and classify its risk; for high-risk operational writes, evidence verification, government intake and statutory/MRV workflows, require an explicit verified geography scope or a narrowly defined, audited national-level authorization. Do not globally flip the legacy function without migration/backfill analysis and regression tests. Add tests proving unscoped tenants cannot write/verify jurisdiction-bound records by default, and prove explicitly national-scoped tenants work only under a distinct reviewed authorization.

### Remaining confirmed design gaps

- The government mirror envelope currently carries `authorityCode` and `municipalCode`, while the core geography model supports a richer hierarchy. A verified crosswalk from these source identifiers to a versioned geography/site/activity record is not yet evidenced in the worker path.
- Stakeholder type validation is a closed list in route code and authorization schema. The supported list covers important roles, but adding future eligible categories appears to require code/schema releases rather than a governed catalogue.
- Existing regulatory and methodology catalogues are foundations, but this review does not prove complete nationwide, effective-date-aware applicability and executable calculation coverage for every relevant scheme/activity/jurisdiction.

These are explicit architecture tasks, not grounds to claim the entire platform is geographically incorrect. Preserve the existing hierarchy and registries while closing the fail-open scope path and proving the crosswalk.


### Endpoint-level consequence

The source review also found that the CPCB SWM workspace route accepts an omitted `geographyId` (the input validation checks it only when present) and persists it as `NULL`. The evidence-vault route itself rejects activities without geography, but the workspace route's optional geography means a local compliance workspace can exist without an explicit jurisdiction. Combined with the legacy unscoped-organization fallback in migration `012`, this is a concrete conformance gap for jurisdiction-bound workflows.

**Required correction:** for jurisdiction-bound compliance and government workflow records, require a verified geography identifier and organization scope before create/update; reserve geography-free workspaces only for explicitly documented platform/national-level workflows with a distinct permission and audit reason. Add negative tests for missing geography and organizations with no configured scope. Preserve backwards compatibility through a measured backfill/migration plan rather than silently accepting unscoped records.


## 6. Remediation implemented on the feature branch (CI pending)

The CPCB SWM workspace gap identified above has now been addressed in code on this branch:

- `POST` and `PATCH` reject a missing or malformed `geographyId`.
- Both routes require a verified organization membership, at least one explicit verified geography root for that organization, and proof that the requested geography is within that root's ancestry scope. The legacy helper's permissive unscoped fallback is therefore not sufficient to authorize these workspace writes.
- Migration `20261029_cpcb_swm_workspace_geography_required.sql` rejects direct database inserts without geography, without an explicit verified organization geography root, or outside that root; it also rejects explicit attempts to clear a workspace's geography. It does not rewrite existing legacy NULL rows.
- The PostgreSQL integration test now covers missing geography, unscoped organization rejection, unrelated geography rejection, successful creation with an explicit scope, and direct database insertion without geography. It uses the explicitly synthetic acceptance geography fixture and cleans up its temporary scope and unrelated geography.

**Verification state:** changes are committed to PR #41; CI has been triggered but has not yet been confirmed green for the final code/test/migration head. This fix closes the identified CPCB SWM workspace gap only. Other call sites using the legacy geography helper still require inventory and risk-specific tests before a global policy change is safe.

## 7. Second remediation — strict scope for high-impact workflows (2026-10-21)

The legacy helper's no-root compatibility fallback is now isolated from the high-impact workflows reviewed in this pass:

- New migration `20261030_explicit_geography_scope.sql` adds `organization_has_explicit_geography_scope(organization_id, geography_id)`. It requires at least one verified geography root and confirms the requested geography falls under that root; it deliberately leaves the legacy helper unchanged for older, lower-risk flows pending their own backfill and classification.
- MRV activity authorization, EPR return evidence authorization, statutory evidence binding, and value-layer activity/evidence/jurisdiction checks now call the strict helper.
- The PostgreSQL CPCB SWM acceptance test now checks that the strict helper rejects an organization with no roots, accepts an in-scope geography after explicit scope provisioning, and rejects an unrelated geography.

**Status:** source changes and integration assertions are committed to the feature branch. The latest CI run for this expanded set is pending at the time of this edit; no deployment or production migration has been performed. This is a targeted high-impact call-site pass, not yet proof that every repository call site has been classified or that all nationwide geography data and crosswalks are complete.

## 8. Versioned government jurisdiction crosswalk foundation (2026-10-21)

Migration `20261031_government_jurisdiction_crosswalk.sql` now defines an evidence-backed mapping from external authority/municipal identifiers and source version to a RupayKg organization and canonical geography, with an optional activity binding. It is fail-closed by default (PENDING), requires a separate approving identity and evidence metadata before VERIFIED status, validates optional activity/organization/geography consistency, and prevents one source identifier/version from being verified to multiple destinations.

**Important boundary:** this migration intentionally creates no real mappings and does not wire the government inbox worker to the crosswalk yet. The source code/contract and reviewer mandate must be verified first; the worker must later resolve exactly one currently effective VERIFIED mapping or quarantine the record. The core schema reviewed here does not establish a canonical site table, so this change does not fabricate a site identifier or use a polymorphic target ID. The crosswalk is an architecture foundation, not evidence of live CPCB integration or national data completeness.

## 8. Government jurisdiction crosswalk — strengthened existing migration (2026-10-21)

The repository already contained `20261031_government_jurisdiction_crosswalk.sql`; an initial attempted duplicate migration was caught by the migration validator and removed. The existing migration was then strengthened in place on this unmerged feature branch rather than introducing a second migration with the same sequence number.

The canonical crosswalk maps `authority_code`, `municipal_code` and `source_version` to an organization, canonical geography and optional activity. A new request ledger binds the exact mapping tuple, evidence reference and SHA-256 to an explicit approval decision. The request lifecycle is constrained to PENDING creation followed by one APPROVED/REJECTED decision; verified mappings require a matching approved request, distinct requester and approver, verified organization geography scope, a source-versioned geography target, and a matching optional activity.

An authenticated API workflow now creates crosswalk requests for organization members with stakeholder-management permission, requires an active Super Admin for decisions, rejects self-approval, and writes the approval plus crosswalk mapping transactionally with a platform audit-chain event. A PostgreSQL acceptance test covers request creation, self-approval rejection, independent approval, persisted mapping and listing. Request and mapping tables are intentionally synthetic-test-only in CI; no real government identifiers were imported or inferred.

**Important boundary:** the worker does not yet resolve inbox batches through this crosswalk; official source evidence, ambiguity/expiry handling, government adapter integration and end-to-end inbox-to-organization/site/activity binding remain required. An internal crosswalk approval is not official government authorization. An initial duplicate-migration issue and a stale test expectation were caught by CI and corrected; the newest route/test head still requires a green CI run.


## 7. Shakti Standards engineering execution rule (2026-10-21)

The repository now records the mandatory [Shakti Standards engineering batching rule](SHAKTI_STANDARDS_ENGINEERING_BATCHING_RULE.md): audit related dependencies and risks first, implement coherent safe changes together, then run the comprehensive validation suite against the final combined commit. Targeted checks remain permitted or necessary for security-sensitive, destructive, or high-risk changes; they must not become needless full-suite cycles after every minor edit. If the final suite fails, fix root causes in a coherent follow-up batch and rerun the affected checks plus required full gates.

This rule changes the engineering workflow, not the release criteria. It does not authorize production changes, weaken fail-closed controls, or convert green CI into certification. The current known gaps in jurisdiction/source coverage, governed stakeholder taxonomy, worker lifecycle staging evidence, named alert escalation, official integration authorization, live Guardian/Hedera/Mirror Node proof, independent verification and formal release approval remain open until separately evidenced.


## 8. Evidence-vault geography authorization hardening (2026-10-21)

The batch review found that evidence upload/list/download/review paths used the legacy `organization_has_geography_scope` helper. That helper intentionally returns true when an organization has no verified geography roots for backwards compatibility. High-impact evidence operations must not inherit that fallback.

The evidence-vault route is being updated to use `organization_has_explicit_geography_scope` for activity context, evidence download, and evidence review. The PostgreSQL integration fixture now assigns an explicit verified geography root for the positive path and adds negative upload/list assertions for a validly authenticated but unscoped organization. The legacy helper remains unchanged for older workflows.

Validation is pending for the combined commit. This change does not itself prove national geography data coverage, and production remains on hold pending the existing release gates.


## 10. Governed SWM stakeholder taxonomy batch (2026-10-21)

The hard-coded SWM stakeholder list was replaced by a database-backed, effective-dated taxonomy registry. Migration `20261103_swm_stakeholder_taxonomy_registry.sql` seeds the seven existing codes as `BASELINE_SUPPORTED` and replaces duplicated workspace/organization authorization CHECK lists with foreign keys to the same registry. API routes resolve an effective registry row and map it to a supported checklist profile; unknown or retired classes fail closed. The baseline seed is not evidence of official registration or nationwide role equivalence.

Validation is pending for the combined commit. Next connected work remains source-versioned jurisdiction crosswalk coverage and versioned jurisdiction-specific statutory applicability with multi-jurisdiction acceptance. Production release remains on hold.
