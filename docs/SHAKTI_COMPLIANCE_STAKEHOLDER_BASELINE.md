# RupayKg Shakti Compliance and Stakeholder Implementation Baseline

**Status:** CONTROLLED WORKING BASELINE — NOT A CERTIFICATION OR LEGAL OPINION  
**Prepared:** 2026-10-19  
**Repository baseline:** `main` commit `4dc32d2bca46e6590eda57b17157a5d36b111f87`  
**Related release blocker:** [Issue #33 — restore PostgreSQL and complete evidence-vault acceptance](https://github.com/vishaltradewinds/rupaykg/issues/33)  
**Operating rule:** ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.

## 1. Purpose and non-negotiable boundaries

RupayKg is intended to be a multi-sector environmental compliance and MRV operating platform. BWGs are one stakeholder class, not the platform boundary.

The intended carbon-market outcome is to help eligible project proponents prepare defensible evidence and progress through the official Government of India Carbon Credit Trading Scheme (CCTS) process. RupayKg must not represent its own calculations, internal credentials, Hedera transactions, software tests or workflow states as official Carbon Credit Certificates (CCCs), government approvals, statutory filings or independent verification.

Separate the following outcomes in both data model and user interface:

1. **Internal record created** — data captured in RupayKg.
2. **Evidence complete / reviewed** — only as supported by the platform's defined review rules.
3. **Regulatory filing prepared** — package ready for an authorised submission.
4. **External submission confirmed** — supported by a genuine official receipt or authorised integration.
5. **Authority decision recorded** — source and reference for the real decision retained.
6. **Carbon project validation / verification** — performed by an appropriately accredited independent body where required.
7. **Official registry issuance / transfer / retirement** — shown only after independent evidence of the official registry event.

These statuses are not interchangeable. Missing authoritative evidence must fail closed.

## 2. Authoritative-source register

Every rule and methodology used in a production decision must have a source record with source owner, canonical URL, title, publication/effective date, version, retrieval timestamp, file hash, applicability, supersession status and reviewer.

Initial official sources to reconcile and version-lock:

- **Bureau of Energy Efficiency (BEE), approved methodologies and tools:** https://beeindia.gov.in/view_content.php?lang=1&lid=571
- **BEE, CCTS procedures and notifications:** https://beeindia.gov.in/
- **CPCB Solid Waste Management Portal:** https://swmp.cpcb.gov.in/en
- **CPCB SWM portal user guide:** https://swmp.cpcb.gov.in/en/user-guide
- **Official Gazette / applicable legislation and rules:** use the canonical Gazette or government department publication for the exact instrument and amendment, not a blog or secondary summary.
- **CCTS registry and verification requirements:** confirm current official BEE / Grid Controller of India / ICM Registry documentation and current accredited verification-agency scope before implementing a production decision.

The links above are entry points, not a substitute for collecting the exact applicable instrument. A source is not “locked” until the actual relevant document/version is stored and reviewed. Do not infer that a BEE-listed methodology is automatically applicable to a particular project.

### Source-control statuses

`DISCOVERED → DOCUMENT_CAPTURED → VERSION_VERIFIED → APPLICABILITY_REVIEWED → APPROVED_FOR_IMPLEMENTATION → SUPERSEDED`

Every supersession must preserve the previous source and explain whether existing projects need recalculation or reassessment.

## 3. CCTS methodology coverage register

The BEE register checked for this baseline lists 12 approved methodology codes across waste, agriculture, forestry, energy and industry. The list below is a **coverage checklist**, not a claim that the methodologies are implemented, applicable to every project or approved for production use. Confirm exact titles, versions, tools and current status against the current official documents before enabling any adapter.

| Methodology code | Sector grouping | Required engineering work | Initial status |
|---|---|---|---|
| BM WA03.001 | Waste / landfill methane | Complete source-locked method, parameter and tool mapping; independently reconcile equations and monitoring | Partial implementation; production eligibility unproven |
| BM WA03.002 | Waste / landfill gas | Reconcile applicability and every referenced tool, including BM-T-007 and BM-T-012, against official current sources | Screening exists; production eligibility must remain false until proven |
| BM WA03.003 | Waste / compressed biogas | Capture approved method, feedstock boundary, methane/energy measurements, leakage and monitoring rules | Not yet evidenced as production-ready |
| BM AG04.001 | Agriculture | Capture exact official title, applicability, baseline, activity data, uncertainty and monitoring | Not yet evidenced as production-ready |
| BM AG04.002 | Agriculture | Same controls; separate versioned adapter and test set | Not yet evidenced as production-ready |
| BM FR05.001 | Forestry | Land eligibility, boundary, baseline, monitoring, leakage, permanence/reversal and safeguards as required by the source | Not yet evidenced as production-ready |
| BM FR05.002 | Forestry | Separate source-locked adapter and independent regression suite | Not yet evidenced as production-ready |
| BM EN01.001 | Energy | Exact source capture; eligibility, metering, baseline and monitoring adapter | Not yet evidenced as production-ready |
| BM EN01.002 | Energy | Exact source capture; eligibility, metering, baseline and monitoring adapter | Not yet evidenced as production-ready |
| BM EN01.003 | Energy | Exact source capture; eligibility, metering, baseline and monitoring adapter | Not yet evidenced as production-ready |
| BM IN02.001 | Industry | Exact source capture; boundary, baseline, activity data and independent reconciliation | Not yet evidenced as production-ready |
| BM IN02.002 | Industry | Separate source-locked adapter and regression suite | Not yet evidenced as production-ready |

Do not enable a method merely to increase catalogue coverage. Where the official register or source document is ambiguous, record the ambiguity and obtain authoritative clarification.

### Mandatory methodology acceptance gates

For each methodology version:

1. Official document and all referenced tools are captured and hashed.
2. Exact applicability, exclusions, project boundary and start-date conditions are represented as executable rules.
3. Every required parameter has a unit, source, frequency, responsible party, validation range and missing-data treatment.
4. Baseline, project emissions, leakage, uncertainty, deductions and net reduction are mapped exactly to the source.
5. Calculations are reproducible from immutable input snapshots and a versioned ruleset.
6. Independent numerical reconciliation includes normal, boundary, invalid, missing, zero, extreme and rounding cases.
7. Independent regression tests prove that a rule or source update cannot silently change historical calculations.
8. Monitoring and reporting outputs are checked against the required official reporting structure.
9. A qualified independent reviewer signs the technical review; this is not represented as BEE approval unless BEE actually provides it.
10. Production eligibility is a separate controlled decision and remains false until all internal and external requirements are evidenced.

Required lifecycle:

`REGISTERED → SOURCE_LOCKED → APPLICABILITY_REVIEWED → IMPLEMENTATION_MAPPED → NUMERICALLY_RECONCILED → REGRESSION_VERIFIED → PILOT_ACCEPTED → PRODUCTION_ELIGIBILITY_REVIEWED`

## 4. Stakeholder operating journeys

These journeys are acceptance requirements to validate with real stakeholders. They are not assertions that every integration already exists.

### A. Bulk Waste Generator (BWG)

- Establish organisation identity, site, jurisdiction and applicable obligations from authoritative sources.
- Capture reporting period, waste stream, generated/segregated/channelised/processed quantities and units.
- Link each quantity to source evidence such as weighbridge slips, collection receipts, invoices, facility receipts or approved records.
- Reconcile generated quantity against destinations and flag unexplained variance.
- Prepare reports and a traceable evidence package for the applicable official workflow.
- Show external submission and authority decision only when actual source evidence exists.

**Acceptance:** wrong jurisdiction, invalid units, duplicate records, unsupported quantities and missing evidence are detected. Users can correct records through versioned amendments, not silent overwrites.

### B. Waste collector, transporter, processor, recycler or disposal facility

- Register each site, authorisation and operational boundary with expiry/status tracking.
- Record load identifier, origin, destination, timestamps, measured quantity, vehicle/scale reference and evidence.
- Reconcile incoming material to processed output, rejects, recovered products, inventory change and final disposal.
- Record scale calibration and instrument maintenance where measurements depend on them.
- Identify duplicate receipts, implausible mass balance and conflicting claims across organisations.

**Acceptance:** a reviewer can trace a quantity from origin through custody to destination. A mass-balance mismatch is an exception, not automatically eligible carbon benefit or EPR fulfilment.

### C. ULB/RLB, SPCB/PCC or other competent authority

- Show only the jurisdiction and workflow the user is authorised to review.
- Distinguish draft, prepared, submitted, correction requested, accepted, rejected and closed states according to the real process.
- Preserve reviewer identity, timestamp, reason, supporting evidence and prior decision.
- Do not impersonate the authority or imply the platform's approval has statutory effect.

**Acceptance:** tenant and jurisdiction isolation is tested; an unauthorised user cannot approve, alter or view another jurisdiction's protected records.

### D. Carbon project proponent / facility operator

- Screen project eligibility before calculating creditable reductions.
- Create project boundary, baseline, monitoring plan, equipment/instrument inventory and responsible roles.
- Capture actual source measurements and quality-control records with units, time, location, calibration and source references.
- Run only the exact approved methodology adapter for which the project and method version passed eligibility gates.
- Preserve raw inputs, transformations, exclusions, uncertainty and calculation hashes.
- Produce a monitoring/reporting package suitable for independent review.

**Acceptance:** an independent reviewer can reproduce the result from source records; missing mandatory data or an inapplicable method blocks a creditable result.

### E. Accredited carbon verification agency

- Verify the current accreditation and scope through authoritative evidence.
- Receive controlled access to project records, source documents, calculations, revisions, exceptions and evidence lineage.
- Record findings, corrective-action requests and a signed verification outcome through the agency's real authorised workflow.
- Keep project-proponent preparation separate from independent verification and prevent self-verification.

**Acceptance:** verifier identity/scope and review decision are auditable; the platform cannot fabricate or substitute for the agency's independent conclusion.

### F. EPR obligated entity, producer, importer, brand owner, recycler or authorised processor

- Resolve the exact scheme, category, applicable period, jurisdiction and obligation source.
- Record eligible quantities only against verified source records and scheme rules.
- Link claims to the evidence, certificates, invoices or official portal records actually required by that scheme.
- Detect double counting, reuse of the same evidence across incompatible claims and quantity mismatches.
- Prepare returns and show the actual official receipt/decision when submitted externally.

**Acceptance:** a waste movement by itself never proves EPR fulfilment; scheme applicability and evidence predicates are explicit.

### G. Tribal, rural, agricultural and forestry participants

- Provide mobile-first, low-bandwidth, local-language and assisted capture options.
- Capture producer/land/site authority, consent, location and chain of custody as required.
- For land-based methods, validate project boundary, land eligibility, monitoring, permanence/reversal and safeguards required by the exact method.
- Make evidence capture possible offline with synchronisation, conflict resolution and attributable amendments.

**Acceptance:** real users can complete the intended task on ordinary phones; assisted entry is clearly attributed; no participant's data or consent is assumed.

## 5. Evidence and MRV data contract

Every material MRV claim must have, as applicable:

- Stable record ID and originating organisation/site/activity.
- Reporting period and event time; ingestion time must be separate from event time.
- Measured value, unit, measurement method and instrument/device identity.
- Instrument calibration/maintenance status where relevant.
- Source evidence reference, content hash, uploader/custodian and evidence version.
- Location/geography and authorised scope.
- Transformation history, normalisation, conversion factors and ruleset version.
- Quality flags, uncertainty, duplicate detection and reconciliation results.
- Review decision, reviewer identity, timestamp and decision basis.
- Amendment/supersession link; historical versions must remain reconstructable.
- External authority/registry source, receipt/reference and timestamp when an external event is claimed.

A hash establishes integrity of a captured byte sequence; by itself it does not establish that the underlying measurement is true, legally admissible, authorised or independently verified.

## 6. Official integration policy

### CPCB / SWM portal

Until an official, authorised API or written integration permission is evidenced, classify RupayKg as **preparation, evidence management and reconciliation**. Do not claim official submission, approval, registration or portal integration based only on an internal record. Do not bypass CAPTCHA, OTP, identity checks or officer decisions. If no supported integration exists, provide an export package and a human-controlled official submission workflow with the official receipt captured afterwards.

### CCTS / official registry

Use the current official project registration, monitoring, verification and registry procedures. Confirm current roles, authorised interfaces and document versions before automating any step. Do not assume a public API exists. A human-controlled workflow is preferable to an unauthorised integration.

Official registry issuance, transfer and retirement are external facts and must be reconciled from authoritative registry evidence. Internal credential states must be labelled clearly as internal and must not be represented as CCCs.

### Guardian / Hedera

Record network identity, topic/transaction reference, consensus timestamp and Mirror Node verification as provenance metadata. Testnet events must never satisfy production trust gates. Hedera anchoring supports tamper-evidence; it does not itself prove the correctness of measurements, regulatory approval or CCC issuance.

## 7. Current P0 release blockers

The latest repository issue #33 records the following outstanding release hold:

1. Render PostgreSQL `rupaykg-db` is reported suspended by billing, while the web service is not suspended. The application deployment being live does not resolve this discrepancy.
2. The database owner must use Render's supported billing/recovery process and establish recoverability. Do not drop, recreate or overwrite the database.
3. After the database is restored or otherwise authoritatively resolved, verify the exact database target, certificate-verified TLS connection, migration state and `/health` response.
4. Verify the evidence-vault migration and perform the controlled multi-tenant evidence acceptance test.
5. Run actual Guardian → Hedera HCS consensus → persisted provenance → Mirror Node acceptance with the real configured runtime.
6. Reconcile BM WA03.002 dependencies BM-T-007 and BM-T-012 against current official BEE sources.
7. Establish evidence storage capacity, backup/restore, encryption-at-rest posture, malware scanning and retention policy.
8. Keep production certification and official CCC claims on HOLD until every required gate has evidence.

Further controls to inspect and test: startup configuration validation must precede database mutation; database TLS must validate the server certificate; auth assurance levels must distinguish authenticated users, verified email and legally verified organisations; every consequential mutation must have an attributable audit trail; abuse/rate limits must be tested.

## 8. Prioritised delivery sequence

### Gate 0 — Protect data and establish truth

- [ ] Resolve database billing/suspension through the supported owner process; establish recoverability before mutation.
- [ ] Confirm actual application database target and certificate-verified connection.
- [ ] Confirm `/health` returns READY and database AVAILABLE.
- [ ] Confirm current migrations read-only and evidence-vault schema exists.
- [ ] Reconcile deployed service, `render.yaml`, branch and environment drift.
- [ ] Keep live Guardian acceptance and certification on hold until Gate 0 passes.

### Gate 1 — Compliance source lock

- [ ] Capture current authoritative legislation, amendments, CPCB procedures, BEE methodologies and referenced tools.
- [ ] Create source/version/hash register and named reviewer.
- [ ] Build requirement-level applicability matrix by stakeholder, jurisdiction, sector and reporting period.
- [ ] Mark unsupported or ambiguous requirements UNVERIFIED; do not invent rules.
- [ ] Have a qualified regulatory reviewer confirm interpretation before legal-compliance claims.

### Gate 2 — Internal data integrity and safety

- [ ] Verify all consequential routes have tenant/geography authorisation, validation and transactional audit.
- [ ] Separate internal registry credentials from official CCC state at API, schema, UI and export layers.
- [ ] Enforce production/testnet separation in provenance policy and acceptance tests.
- [ ] Add/verify rate limiting, abuse controls, verified identity assurance and secret management.
- [ ] Prove backup restore, retention, incident response and rollback.

### Gate 3 — One real end-to-end waste-chain pilot

- [ ] Select consenting BWG + collector/transporter + processing/disposal facility participants.
- [ ] Use real, permissioned records and source evidence; identify test records explicitly.
- [ ] Reconcile weights, units, custody, rejects and destination evidence.
- [ ] Run exception, duplicate, amendment, access-control and independent review cases.
- [ ] Capture stakeholder acceptance and unresolved defects.

### Gate 4 — One carbon-methodology pilot

- [ ] Select a real project that appears potentially eligible; obtain project owner consent and actual source data.
- [ ] Lock the exact official methodology/version/tools and establish applicability.
- [ ] Implement the dedicated adapter only after source mapping.
- [ ] Independently reconcile calculation outputs and edge cases.
- [ ] Complete the real monitoring/reporting evidence package.
- [ ] Obtain review from an appropriately accredited independent verification agency through its authorised process.
- [ ] Reconcile official registry outcomes only if and when they actually occur.

### Gate 5 — Sector expansion and production approval

- [ ] Add each methodology/sector only after its own Gate 1–4 evidence.
- [ ] Run security, performance, recovery, accessibility and operational acceptance.
- [ ] Publish a capability register distinguishing implemented, tested, externally accepted and officially approved functions.
- [ ] Require documented Shakti gate sign-off before production certification.

## 9. Traceability record template

Create one row per legal/technical requirement:

| Field | Required content |
|---|---|
| Requirement ID | Stable unique identifier |
| Official source | Canonical URL, instrument, section/clause and version/hash |
| Effective period | Publication/effective date and supersession |
| Applicability | Stakeholder, sector, geography, threshold and exclusions |
| Obligation | Plain-language statement reviewed against the source |
| Platform workflow | Route/UI/process that supports the task |
| Data/evidence | Required fields, units, provenance and retention |
| Control | Permissions, validation, audit and exception behaviour |
| Test | Automated regression and real-world acceptance case |
| Owner/reviewer | Responsible engineer and qualified compliance reviewer |
| Status | UNVERIFIED / MAPPED / IMPLEMENTED / TESTED / PILOT_ACCEPTED / APPROVED_FOR_PRODUCTION |
| Evidence links | Commit, CI run, test output, document hash and signed review |

A requirement cannot be marked `APPROVED_FOR_PRODUCTION` merely because a code path exists or CI passes.

## 10. Release decision rule

**Current decision: HOLD production certification and any representation of official CCC issuance.**

Resume release consideration only after:
- the database and runtime target are verified and recoverable;
- the mandatory P0 gates in issue #33 pass with retained evidence;
- the relevant official requirements are source-locked and mapped;
- the selected real stakeholder workflows pass acceptance;
- methodology-specific calculations are independently reproducible;
- official submission, approval, verification or issuance claims are supported by actual authoritative records.

This document is a working control baseline. It does not replace legal advice, government confirmation, accredited verification or formal approval by a competent authority.
