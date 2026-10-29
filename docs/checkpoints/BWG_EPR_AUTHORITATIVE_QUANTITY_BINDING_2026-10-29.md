# BWG EPR Authoritative Quantity Binding — 2026-10-29

## Status

- Engineering status: mitigation committed; authoritative reconciliation remains unimplemented.
- Latest verified code commit before this checkpoint: `136664d3a6a13e4ae2f0e201f0dd197df8b8388d`.
- CI run `40860616084` passed all configured checks, including production container build.
- PR #118 remains draft/unmerged. Production certification remains **HOLD**.
- This checkpoint records the design boundary; it does not claim statutory acceptance or independent assurance.

## Confirmed schema and workflow facts

1. `bwg_epr_reports` stores a reporting period, EPR scheme, free-text `category_code`, declared `obligated_quantity`, `fulfilled_quantity`, evidence/verification references, status, and metadata.
2. The BWG EPR write route accepts caller-provided category and quantities. Presence of evidence and an approved verification reference is not proof that the quantity is bound to an eligible source measurement, obligation, allocation, or regulatory category.
3. The route now leaves report status `PENDING` and responds with `reportAssessment: DECLARED_UNASSESSED`, `quantityBasis: USER_DECLARED_UNRECONCILED`, `complianceStatus: NOT_ASSESSED`, `productionGate: HOLD`, and `externalSubmission: NOT_SUBMITTED`.
4. EPR return quantity guards in migrations 070/071 constrain quantities against obligation balances and can bind a return to an obligation, but they do not by themselves prove measurement eligibility, scheme/category/unit compatibility, allocation uniqueness, or external acceptance.
5. Existing methodology reconciliation evidence in migration 025 establishes that methodology sources, versions, applicability, parameters, numerical reconciliation, and regression evidence must be governed before production eligibility.
6. No approved, source-linked scheme/category/unit/conversion catalogue has yet been demonstrated in the reviewed schema. Do not invent statutory category identifiers, conversion factors, target-basis semantics, or methodology IDs.

## Required authoritative design before enabling fulfillment claims

- Versioned scheme/category/unit catalogue, with source URL/document, source hash, effective dates, jurisdiction, approval actor, approval time, and supersession history.
- A typed, immutable link from each report line to its reporting period, organization, EPR scheme, approved category, applicable obligation, source measurement/resource-flow record, evidence and verification decision.
- Eligibility rules for measurement method, instrument/calibration where relevant, custody/processor receipt, geography, period overlap, material identity, units, uncertainty, and quality state.
- A transactional allocation ledger preventing the same source quantity or certificate allocation from being used twice; concurrency-safe reservation/commit semantics.
- Separate quantities/states for user-declared, derived-eligible, allocated, submitted, and externally accepted values. Never silently copy a declaration into verified fulfillment.
- Idempotent submit/retry and explicit rejection, correction, reversal, and resubmission lineage.
- Independent review of the applicable statutory scheme and regulatory submission interface before enabling any live submission or compliance certificate claim.

## Safe implementation sequence

1. Keep BWG report entry available only as a clearly labelled declaration; keep assessment and compliance state pending/unassessed.
2. Discover and approve source-linked category/unit mappings with the relevant scheme owner and legal/compliance reviewer. If no authoritative source is available, fail closed.
3. Add a forward-only migration for declared-versus-derived/allocated quantities and immutable allocation provenance, after confirming existing UI/API consumers and historical data semantics.
4. Implement transaction-safe allocation service and authorization/geography checks.
5. Add adversarial tests: forged metadata, mismatched organization/scheme/category/unit, out-of-period evidence, missing or unapproved verification, duplicate evidence/source quantity, concurrent allocations, rejected/corrected returns, idempotent retries, and cross-organization access.
6. Verify with disposable PostgreSQL tests and full CI; obtain independent compliance review; only then reconsider production certification.

## Explicit release gate

**HOLD** until the authoritative mapping catalogue, measurement-to-obligation reconciliation, anti-double-counting allocation ledger, governed assurance decisions, and external submission/acceptance evidence are implemented and independently validated. CI success is engineering evidence only, not legal certification.
