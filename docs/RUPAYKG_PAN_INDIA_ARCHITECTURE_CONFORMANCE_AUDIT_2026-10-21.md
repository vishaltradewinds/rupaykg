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
