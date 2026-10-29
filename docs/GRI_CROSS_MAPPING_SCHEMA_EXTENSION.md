# GRI Cross-Mapping Schema Extension — RupayKg

**Status:** Draft engineering foundation; not production-certified.  
**Schema version:** 1.1.0  
**Target repository:** `vishaltradewinds/rupaykg`

## Repository audit and integration boundary

The correct canonical repository is `vishaltradewinds/rupaykg`. It already contains ESG/BRSR structured reporting (`packages/esg`, `docs/ESG.md`, `migrations/060_brsr_structured_reporting.sql`), EPR lifecycle/catalog/evidence controls (`docs/EPR.md`, EPR routes and migrations), CPCB/SWM workflows, and MRV/evidence provenance. This extension must integrate with those existing domains, not create a parallel application or duplicate EPR/ESG data models.

## Governing rule

GRI reporting, Indian statutory compliance, EPR portal acceptance, CCTS obligations, independent assurance, and carbon-credit eligibility are separate determinations. A cross-map documents a relationship between requirements; it does not itself establish equivalence, legal compliance, regulator acceptance, GRI certification, assurance, or credit issuance.

## Initial GRI registry candidates

Store exact standard identifiers, versions, effective dates and authoritative URLs. Confirm applicability and materiality before approving a mapping.

| RupayKg source domain | Candidate GRI disclosure family | Relationship | Non-equivalence guard |
|---|---|---|---|
| Waste flows and processing evidence | GRI 306 Waste 2020 | Supports / partial overlap | Indian regulatory categories and GRI definitions may differ. |
| Materials and recycled content | GRI 301 Materials 2016; GRI 306 Waste 2020 | Supports | A waste receipt alone does not prove recycled content. |
| GHG inventory and carbon MRV | GRI 305 Emissions 2016; transition to GRI 102 Climate Change 2025 by effective date | Supports | GRI disclosure does not establish CCTS eligibility or credit issuance. |
| Energy data | GRI 302 Energy 2016; transition to GRI 103 Energy 2025 by effective date | Supports | Energy records alone do not establish compliance with a CCTS target. |
| Water and effluents | GRI 303 Water and Effluents 2018 | Supports | Preserve withdrawal, consumption and discharge distinctions. |
| Governance and reporting practices | GRI 2 General Disclosures 2021; GRI 3 Material Topics 2021 | Supports | Organization-specific governance and materiality evidence is required. |
| EPR obligations and returns | Relevant GRI waste/material disclosures | Partial overlap | Never treat GRI mapping as a CPCB filing, certificate or authority acceptance. |
| ICVCM Core Carbon Principles | Relevant climate/governance disclosures | Contextual | Voluntary integrity benchmarks do not replace Indian law or crediting-program rules. |

Official GRI sources confirm that GRI 101 Biodiversity 2024 took effect for reporting from 1 January 2026, while GRI 102 Climate Change 2025 and GRI 103 Energy 2025 take effect for reporting from 1 January 2027. Recheck official source/version at release time and implement effective-dated versions; do not rewrite prior reporting periods. See https://www.globalreporting.org/publications/documents/english/gri-101-biodiversity-2024-english/ and https://www.globalreporting.org/standards/standards-development/.

## Record contract

`schemas/gri-cross-mapping.schema.json` defines a mapping record containing:
- Source requirement identity, legal/voluntary authority type, version, official source and effective dates, plus a governed source-register ID, validation state and archived SHA-256.
- Target framework, GRI standard/disclosure identifier, version and effective date.
- Relationship class and documented rationale/limitations.
- Entity-specific applicability, thresholds, period and reviewer.
- Metric units, calculation method, reporting boundary and disaggregation.
- Evidence IDs, provenance, reporting period, integrity and lineage status.
- Separate double-counting, assurance, statutory compliance and credit-eligibility statuses.
- Owner/approver roles and version/change-log references.

## Implemented in this isolated branch

- `packages/esg/src/gri-cross-mapping.ts` adds a standalone, advisory review gate that returns blockers and can only mark a mapping `READY_FOR_HUMAN_REVIEW`; it does not approve the mapping.
- The same module includes a typed adapter from persisted schema snake_case fields to the internal review DTO. The caller must validate the complete record against the JSON Schema before adapting it; the adapter is not a runtime schema validator.
- `packages/esg/src/gri-cross-mapping.test.ts` covers readiness, fail-closed applicability/evidence checks, conflict review, schema-field adaptation and the rule that GRI mapping cannot alter compliance or credit-eligibility conclusions.
- The module is exposed through the isolated `@rupaykg/esg/gri-cross-mapping` package subpath, while the shared root `packages/esg/src/index.ts` and server routes remain unchanged to avoid collisions with parallel ESG verification and production-safety work. No migration, database, production service or existing shared source file was changed in this batch.

## Remaining integration plan — reuse existing architecture

1. Reconcile with the parallel ESG verification and production-safety work before changing the shared `packages/esg/src/index.ts` or adding any further package exports; the isolated `@rupaykg/esg/gri-cross-mapping` subpath export already exists on this branch. Coordinate with draft PR #119's India EPR/ESG/CCTS/CCC source register and consume its governed source records after integration rather than creating a second regulatory source of truth.
2. Bind mapping records to existing `esg_reporting_periods`, `esg_metrics`, EPR obligations/returns, evidence-vault records and MRV provenance by stable identifiers; do not copy authoritative measurements into a new competing source of truth.
3. **Migration is deliberately deferred.** The repository has unresolved production/staging migration-ledger source/chronology differences documented by the parallel migration-compatibility work (PR #108), and PR #120 is concurrently adding numbered migrations `088` and `089`. Do not add a dated or numbered GRI migration until the canonical migration catalog and dual-ledger reconciliation are approved. A proposed schema design may be reviewed separately, but no GRI persistence migration is part of this branch.
4. Expose mapping read/write operations through existing authenticated server routes with organization-scoped RBAC, audit logging and strict validation.
5. Extend existing ESG/reporting panels only after API contracts and stakeholder permissions are confirmed.
6. Export a disclosure index showing mapping version, applicability, source evidence, omissions, estimates, limitations and assurance status.
7. Keep GRI disclosure readiness, EPR statutory state, CCTS state, external authority acceptance and credit issuance as separate state machines.

## Existing-platform integration contract audit (2026-10-29)

The existing interfaces were inspected before designing any GRI integration. This is a contract map, not an assertion that the GRI workflow is already integrated.

| Existing system | Verified interface / behavior | GRI integration rule |
|---|---|---|
| ESG/BRSR metric write | `POST /api/v1/esg/reporting-periods/:periodId/metrics` in the existing value-routes implementation; route derives metric state from persisted evidence, verifier authority, period and methodology checks. | Link a mapping to the existing reporting-period and metric identifiers. Never set a metric to VERIFIED/ASSURED merely because a GRI mapping is ready. |
| ESG workspace read | `GET /api/v1/workspaces/esg`; workspace routes enforce report/EPR/CSR/audit read permissions. | GRI disclosure index must be scoped to the active authorized organization and reuse the workspace's authentication/authorization model. |
| EPR returns | `GET/POST /api/v1/epr/returns`; writes require verified organization membership and `epr:manage`. Submission uses `POST /api/v1/epr/returns/:returnId/submit` and requires verified evidence plus approved verification. | GRI links may reference EPR obligation/return IDs, but cannot submit returns, satisfy obligations, or imply CPCB acceptance. |
| Evidence vault | `POST /api/v1/evidence-vault/upload` validates content, media type, activity/organization/geography scope and `evidence:upload` permission. | Reference evidence-vault IDs and existing provenance/hash data; do not create a second evidence store. |
| MRV provenance | `POST /api/v1/mrv/activities/:activityId/submit` requires evidence and approved verification; MRV status exposes Guardian/Hedera status and registry-eligibility conditions. | Keep MRV provenance and credit eligibility as separate source-of-truth states; GRI is a reporting crosswalk only. |
| Parallel safety work | PR #120 concurrently changes `apps/web/src/esg-panel.ts`, `apps/web/src/epr-return-panel.ts`, `packages/esg/src/index.ts`, `packages/esg/src/index.test.ts`, value/EPR routes, and migration history. | Do not edit these shared files in this branch. Rebase/coordinate after PR #120's disposition and run the complete integration suite. |

### Regulatory source-register integration — PR #119 boundary

The source register in PR #119 was inspected at branch `docs/india-epr-esg-ccts-regulatory-baseline`, commit `4fa786482c84403189cd062e796599f3f1fc8c2c` (research-only). It declares registry ID `RUPAYKG-INDIA-REGULATORY-SOURCES`, schema version `1.0.0`, `registryStatus: RESEARCH_ONLY`, and `activationPolicy: FAIL_CLOSED`. Its required release evidence includes exact-document archival, SHA-256 verification, effective-date and amendment review, actor/stream/jurisdiction/period applicability, independent legal/domain approval, and effective-date boundary tests. The listed sources currently have no archived SHA-256 and show `NOT_ARCHIVED_HASH_PENDING`; therefore they are discovery/research inputs, not activated legal rules.

Integration contract:
- Once PR #119 is reviewed and its source-register contract is accepted, reference stable `source.id` values and immutable source-version/hash records rather than copying regulatory titles, URLs or applicability conclusions into the GRI module.
- Preserve source domains and legal status. Example IDs include `CPCB-SWM-RULES-2026`, `CPCB-PLASTIC-EPR`, `SEBI-BRSR`, `SEBI-VALUE-CHAIN-2025`, `BEE-CCTS-OFFSET-PROCEDURE`, and `ICVCM-CCP`; ICVCM remains supplemental and cannot substitute for Indian law.
- A `DISCOVERY_SOURCE`, `NOT_ARCHIVED_HASH_PENDING`, `CURRENT_VERSION_MUST_BE_RECONFIRMED`, or other unresolved source state must block any mapping that depends on an authoritative legal conclusion. The UI may show a research cross-reference, but must not label the mapping legally approved, compliant, assured, or production-activated.
- GRI source-version validity and Indian regulatory-source validity are separate dimensions. Do not infer that a GRI disclosure standard is an Indian statutory instrument or that an Indian rule applies to every entity/reporting period.
- Do not merge PR #119 or consume its branch as a production dependency automatically. Coordinate after review; pin the accepted source-register version and test compatibility on the final integrated commit.

### Proposed API and record lifecycle — not yet implemented

After the migration ledger is reconciled and the regulatory source register from PR #119 is accepted, add a separately reviewed route module rather than expanding shared routes in this draft:

- Read: `GET /api/v1/esg/reporting-periods/:periodId/gri-mappings`.
- Create/update draft: `POST /api/v1/esg/reporting-periods/:periodId/gri-mappings` with strict JSON Schema validation and organization-scoped `reports:write`/dedicated permission.
- Review decision: `POST /api/v1/esg/gri-mappings/:mappingId/review`, restricted to an explicitly authorized reporting/compliance reviewer; no self-approval where role separation is required.
- Every write must verify period ownership, organization scope, source/target version, effective date, evidence lineage and reviewer authority in the server/database layer. Client-supplied organization IDs are never sufficient authorization.
- Store immutable version history and append-only audit events only after the canonical migration ledger, rollback plan and production/staging ledger reconciliation are approved. Do not add a numbered migration now.
- Response fields must separate `mapping_review_status`, `gri_disclosure_readiness`, `statutory_compliance_status`, `external_submission_status`, `assurance_status`, and `credit_eligibility_status`; the GRI evaluator may only produce `BLOCKED` or `READY_FOR_HUMAN_REVIEW`.
- The disclosure index must preserve reporting-period snapshots, estimates, omissions, boundaries, methodology versions, source URLs and evidence references. Historical periods must not silently inherit a later GRI standard version.

### Integration acceptance gates

1. Contract tests cover unauthorized organization access, missing reviewer role, cross-organization evidence/period IDs, stale source versions, non-HTTPS URLs, invalid/effective-date mismatches, immutable-version rules, and rejected/quarantined evidence.
2. Regression tests prove GRI state cannot mutate EPR obligation/return state, BRSR metric verification, CPCB submission/acceptance, CCTS state, MRV verification or credit issuance.
3. Existing ESG/EPR/MRV route suites, workspace permission tests, migration preflight, build/typecheck and production-container build all pass on the final integrated head.
4. Integration remains non-production until Shakti regulatory, security, operational, rollback and independent-review gates are evidenced.

## Shakti Standards release gates

- **A — Regulatory source:** official source and effective dates checked.
- **B — Applicability:** organization, material/activity, thresholds, jurisdiction and reporting period resolved.
- **C — Mapping review:** clause-level rationale and limitations approved by the relevant reporting/compliance owner.
- **D — Evidence integrity:** lineage, units, boundaries, reconciliation and double-counting controls pass.
- **E — Integration:** existing APIs, migrations, RBAC, UI and exports work without regression.
- **F — Assurance:** external assurance is claimed only when supported by independent evidence.
- **G — Production:** CI, security, regression, rollback and operational readiness gates pass.
- **TRL:** currently **TRL 3 (analytical/experimental proof-of-concept)** for this GRI mapping extension only: schema and isolated evaluator/tests are drafted, but end-to-end integration and validated deployment evidence are absent. This is an engineering estimate, not a certified TRL assessment.

## Minimum acceptance tests

- Reject records without source/target versions or a rationale.
- Do not approve a mapping with undetermined applicability.
- Prevent a GRI mapping from setting EPR/CCTS compliance or credit eligibility automatically.
- Preserve historical mapping versions and reporting-period snapshots.
- Reject evidence that is missing, rejected or quarantined for a required disclosure.
- Detect duplicate physical waste quantities across generator/collector/processor custody events.
- Enforce organization-level authorization and immutable audit events (database schema/trigger guards, authenticated route-level authorization and end-to-end tests remain pending).
- Verify effective-dated GRI 102/103 transitions and report version against official sources.
- Ensure existing BRSR, EPR, CPCB/SWM and MRV tests remain green.

## Official references

- GRI Standards: https://www.globalreporting.org/standards/
- GRI Universal Standards: https://globalreporting.org/standards/standards-development/universal-standards/
- GRI Standards development/effective dates: https://www.globalreporting.org/standards/standards-development/

**Engineering disposition (2026-10-29):** schema, isolated advisory evaluator/adapter/tests are present on this draft branch. ESG package build/typecheck and seven ESG tests passed locally; schema compilation and positive/negative fixtures passed under Ajv Draft 2020-12. The broader local test suite has 90 passes, 8 skips and one unrelated CORS runtime test failure; this must be diagnosed before claiming a green local suite. A proposed GRI registry migration was removed from this branch after the audit identified unresolved production/staging migration-ledger chronology and concurrent numbered migrations in PR #120; do not reintroduce a migration until that gate is reconciled. Authenticated route registration and organization-scoped write APIs, route-level audit-event creation, persistence migration, root-index integration, stakeholder UI/exports, integration with draft PR #119's regulatory source register, independent review and production certification remain open gates. Do not merge or deploy until those gates are evidenced.

**Latest-head CI evidence (2026-10-29):** GitHub Actions run [40945135850](https://github.com/vishaltradewinds/rupaykg/actions/runs/40945135850) completed successfully for commit `98eedcc444496b2636f334dfc38a1a01de01e61f`, including the repository validation job, tests with disposable PostgreSQL acceptance, and production-container build. This confirms CI for that exact draft head only; it does not close the integration, regulatory activation, migration reconciliation, independent review, or production-certification gates listed above.


### Source-register fail-closed enforcement (schema 1.1.0)

The schema requires `source_requirement.source_validation` with a stable source-register ID, explicit validation state and SHA-256 field. The runtime review gate blocks any state other than `VERIFIED_AND_APPROVED`, and blocks a missing or malformed 64-character SHA-256. `DISCOVERY_SOURCE`, `NOT_ARCHIVED_HASH_PENDING`, `CURRENT_VERSION_MUST_BE_RECONFIRMED`, and `UNRESOLVED` cannot reach `READY_FOR_HUMAN_REVIEW`. This local fail-closed contract does not replace independent legal/domain approval. PR #119 remains research-only until its release evidence is complete.

### Source URL trust boundary — explicit pre-production gate

The current evaluator validates URL syntax (HTTPS, a parseable hostname, and no embedded credentials) but does **not** establish that the hostname or URL is controlled by the relevant regulator or standard setter. A syntactically valid HTTPS URL can still point to an impersonation domain. The current schema's `source_url`, `source_id`, validation status and hash are data fields; their presence alone does not prove they came from a trusted registry service.

Therefore:

- Treat URL validation as input hygiene only, never as proof of source authority.
- At integration, resolve `source_id` server-side against the accepted, version-pinned regulatory source register. Require the submitted canonical source URL, source version, archive object/hash and effective-date metadata to match that trusted record; reject mismatches.
- Do not allow client-supplied `VERIFIED_AND_APPROVED` status or SHA-256 values to self-authorize a source. These fields must be derived from server-controlled registry records and independently approved evidence.
- Add adversarial tests for lookalike domains, unexpected subdomains, redirects, URL/userinfo confusion, stale versions and source-ID/URL/hash mismatches. Test redirect destinations at fetch time and avoid fetching arbitrary user-supplied URLs from privileged server environments.
- Until this trusted registry binding exists, the module remains a review-gate prototype and must not be used to issue legal-compliance conclusions or activate production mappings.
