# RupayKg India Regulatory Applicability Register

**Status:** Initial controlled source register; not a complete legal opinion or production-approved ruleset.  
**Review date:** 2026-10-27  
**Owner:** RupayKg Carbon OS / Shakti Standards  
**Applicability:** Pan-India platform; activity-, waste-stream-, jurisdiction- and effective-date-specific.

## 1. Mandatory operating rule

Indian statutory and regulatory obligations take precedence over voluntary carbon-market integrity frameworks. This register identifies official starting points; it does not by itself establish that a law applies to a particular user, facility, project or transaction.

Before enabling any compliance claim, calculation eligibility, certificate workflow or production release, the activity must be mapped to the exact operative instrument, jurisdiction, responsible stakeholder and effective date. If applicability or current status is unresolved, record `REQUIRES_REGULATORY_REVIEW` and fail closed for claims or value eligibility.

Never infer:
- that all waste activities are eligible for a carbon credit;
- that every entity is a CCTS obligated entity;
- that an EPR certificate and a carbon credit are interchangeable;
- that national rules remove state/local permits or consent requirements;
- that a voluntary ICVCM control is statutory law;
- that an AI assessment or internal software status constitutes legal advice, regulator approval, verification or certificate issuance.

## 2. Official source register

| ID | Regulatory area | Official source | Use in RupayKg | Required follow-up before production |
|---|---|---|---|---|
| IN-SWM-2026-001 | Solid Waste Management Rules, 2026 | [CPCB SWM portal](https://swmp.cpcb.gov.in/en); [CPCB-hosted rules PDF](https://swm.cpcb.gov.in/images/solid-waste-management-rules-2026.pdf) | Map roles, source segregation, collection, transport, processing, disposal, facility and local-body reporting requirements where applicable. CPCB portal states the rules were notified 27 January 2026 and effective 1 April 2026. | Confirm operative rule text, amendments/corrigenda, relevant rule and stakeholder duties, facility type, state/ULB/RLB and applicable registration/reporting workflow. |
| IN-SWM-2026-002 | Official explanatory release | [MoEFCC / PIB release](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2219676&lang=1&reg=3) | Discovery aid for the SWM Rules, 2026 and stated policy changes. | Use notified rule text—not a press release summary—as controlling authority. |
| IN-CCTS-001 | Indian Carbon Credit Trading Scheme | [BEE Carbon Market portal](https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=116) | Maintain distinct compliance and offset pathways; reference official procedures, approved sectors, methodologies and verification arrangements. | Lock the exact current procedure, notification, mechanism, sector, methodology/version and eligibility evidence for the activity. |
| IN-CCTS-002 | CCTS institutional summary | [PIB CCTS update, 5 February 2026](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2223703&lang=2&reg=3) | Orientation to institutional roles and the Indian Carbon Market. | Verify current requirements against operative Gazette instruments and BEE procedures; do not treat summary prose as the full rule. |
| IN-METH-001 | Waste carbon methodology source | [BEE BM WA03.001 — Landfill Methane Recovery](https://beeindia.gov.in/sites/default/files/BM%20WA03.001.pdf) | Existing methodology-specific source lock for the applicable landfill methane pathway. | Confirm version/status, project scope, referenced tools, monitoring feasibility, source artifact hash and all methodology-specific eligibility evidence. |
| IN-METH-002 | Waste carbon methodology source | [BEE BM WA03.002 — Flaring or use of landfill gas](https://www.beeindia.gov.in/WriteReadData/RTF1984/RTF-PDF-a0e3f856720a5c57_1776061241.pdf) | Existing methodology-specific applicability screen where the project activity matches the methodology. | Confirm current version/status, scope, combination restrictions, baseline and monitoring evidence before any value eligibility. |

### Additional official instruments to register by activity

This initial register is intentionally not exhaustive. Before a particular workflow is production-enabled, add and verify the relevant current primary sources for:

- each applicable EPR stream, such as plastic packaging, e-waste, batteries or other specifically regulated categories;
- water abstraction/discharge, air emissions, environmental clearance, facility consent/authorization and hazardous/special waste, where relevant;
- State Pollution Control Board / Pollution Control Committee requirements and state-specific rules or notifications;
- local Urban Local Body / Rural Local Body registration, by-laws, reporting, facility permissions and contracts;
- land, construction, fire, worker safety, transport and other facility-specific approvals where relevant;
- personal-data, cybersecurity, electronic-record, retention and access obligations relevant to the platform and its users.

Do not create a generic rule that every item in this list applies to every project. Resolve applicability from the actual activity and authoritative source.

## 3. Required source metadata

Each machine-readable source entry should carry at minimum:

- stable source ID and title;
- issuing authority and instrument type (Act, Rule, Gazette notification, procedure, methodology, order, consent, guidance or voluntary standard);
- official canonical URL and retrieval date;
- publication date, commencement/effective date, amendment/repeal status and version;
- applicable jurisdiction, activity, waste stream and stakeholder class;
- controlling provisions / clauses and applicability rationale;
- source artifact hash when the document is retained;
- reviewer, review date, unresolved interpretation and next review trigger;
- links to the controls, evidence requirements and tests affected by the source.

Where the source is a draft or consultation, label it as draft and prohibit it from silently changing production behavior.

## 4. Decision states and fail-closed rules

Use explicit states, not a boolean “compliant” flag:

- `NOT_ASSESSED` — applicability has not yet been evaluated.
- `APPLICABLE` — a reviewer has linked the activity to an operative instrument and documented rationale.
- `NOT_APPLICABLE_WITH_RATIONALE` — documented rationale and source support exist; reviewer identity and date are retained.
- `REQUIRES_REGULATORY_REVIEW` — ambiguity, source conflict, missing amendment status or legal interpretation remains unresolved.
- `EVIDENCE_INCOMPLETE` — applicability is established but required evidence is missing or invalid.
- `INTERNAL_EVIDENCE_COMPLETE_PENDING_REVIEW` — evidence package is assembled but required independent or authorized review remains.
- `REVIEWED_WITH_FINDINGS` — reviewer findings and corrective actions remain recorded.
- `EXTERNAL_AUTHORITY_CONFIRMED` — only when a verifiable authority/registry response or formal record establishes the relevant external state.

Do not let an internal evidence-complete state imply legal compliance, methodology approval, third-party verification, ICVCM CCP eligibility or credit issuance. Any eligibility or release gate must require the exact relevant states and source/version evidence.

## 5. Separation of decisions

Maintain separate linked but non-interchangeable records for:

1. Indian statutory/regulatory applicability and evidence;
2. CCTS mechanism and methodology eligibility;
3. MRV calculations and monitoring evidence;
4. independent validation/verification and findings;
5. voluntary ICVCM CCP internal readiness;
6. external authority/registry issuance, transfer or retirement;
7. EPR certificates and waste-flow records;
8. financial settlement and reconciliation.

A single activity may support multiple records only where each framework independently permits it and attribution, ownership, allocation and double-counting controls are satisfied.

## 6. Shakti Standards gates

- **Discovery:** current official source and applicability identified.
- **Regulatory review:** rule mapping and unresolved issues independently reviewed.
- **Design:** source version and jurisdiction-specific control model approved.
- **Engineering:** automated rules are versioned, testable and fail closed.
- **Verification:** tests cover missing, conflicting, expired and superseded sources.
- **TRL:** state the demonstrated technology readiness with evidence; do not infer live readiness from unit tests.
- **Live acceptance:** validate against authorized real-world workflows and evidence.
- **Release:** production certification remains OFF until security, legal/methodology, independent review, live acceptance and release authorization gates are satisfied.
- **Continuous assurance:** re-review on amendments, new notifications, source changes, authority feedback or methodology revision.

## 7. Existing implementation reuse and current limitations

Repository inspection found existing regulatory structures and controls in `packages/domain/src/regulatory.ts`, `migrations/039_india_regulatory_requirements.sql`, `migrations/042_india_regulatory_requirement_catalog.sql`, `migrations/053_authoritative_regulatory_baseline.sql`, `migrations/064_statutory_applicability_controls.sql`, and the EPR catalog/lifecycle migrations. Do not create a second regulatory-source or EPR applicability database.

The domain source gate now checks source status, required source metadata, valid effective dates, whether the rule is effective on the requested date, optional end date, and jurisdiction matching. It deliberately answers whether a source record is eligible for rule evaluation; it does **not** decide whether a particular organization/activity is legally covered. Regression tests cover future-effective, expired, missing-date, invalid-metadata and jurisdiction-mismatch cases.

Migration `088_epr_portal_provenance_guardrails.sql` reconciles the plastic packaging catalogue's portal entrypoint to CPCB's Common EPR Portal, preserves the prior portal URL as metadata, and marks external authority confirmation as required. It explicitly does not generalize this portal change to other streams.

### Remaining work



This file is a controlled starting register, not a complete pan-India legal rules engine. The next implementation batch must:
1. enumerate existing regulatory-source/catalogue models and reuse them rather than create a competing registry;
2. add the missing EPR and state/local official sources only after verifying their current status and activity scope;
3. connect each applicable source to explicit controls and evidence schemas;
4. add tests for effective dates, superseded sources, jurisdiction mismatch, unknown applicability and fail-closed behavior;
5. obtain independent regulatory/methodology review before production use.

No production certification, automatic legal determination or credit issuance is enabled by this document.

## 7. Shakti Standards closure matrix — 2026-10-28

This matrix is a work-control register, not a claim that the listed reviews have passed. A row can move to CLOSED only when the referenced evidence is attached to the relevant activity/version and a named reviewer records the decision.

| Priority | Workstream | Minimum closure evidence | Responsible decision-maker | Gate while open |
|---|---|---|---|---|
| P0 | Operative SWM Rules, 2026 | Retained official rules artifact; checksum; effective-date/amendment check; rule-by-rule applicability map for the actual facility and stakeholder roles; reviewer/date | Qualified Indian regulatory reviewer, with product owner recording implementation | No legal-compliance claim for affected workflow |
| P0 | CCTS mechanism and eligibility | Current Gazette/BEE procedure and methodology/version; mechanism and sector eligibility; activity boundary; approved validation/verification path; evidence of relevant authority/registry state | Qualified carbon-market/regulatory reviewer | No credit-eligibility or issuance representation |
| P0 | BM WA03.001 / BM WA03.002 pathway | Current official methodology files and hashes; scope/combination check; all referenced BM-T tool versions; parameter-to-evidence mapping; reproducible calculation reconciliation; independent methodology review | Qualified methodology reviewer | REQUIRES_REGULATORY_REVIEW or EVIDENCE_INCOMPLETE; block value eligibility |
| P0 | EPR, where applicable | Waste-stream classification; operative stream-specific rules/notifications; producer/processor/registered-entity roles; portal/registration evidence; separate EPR certificate and carbon-credit ledgers | Qualified EPR reviewer / competent authority evidence | No EPR-compliance claim or certificate substitution |
| P0 | State / SPCB / PCC / ULB / RLB / facility permissions | State and local jurisdiction; permits/consents/registrations/contracts as applicable; validity dates and conditions; responsible authority; source and evidence references | Qualified local regulatory reviewer / relevant authority | Block affected facility/workflow claims |
| P0 | Guardian → Hedera → Mirror Node | Authorized non-production execution; real Guardian response and policy identity; persisted provenance digest; Hedera transaction/topic and consensus evidence; Mirror Node retrieval; digest equality; negative/retry tests; sanitized evidence bundle | Independent technical reviewer plus authorized environment operator | No live acceptance or production certification |
| P1 | ICVCM CCP readiness | Evidence for each applicable CCP; versioned control mapping; independent verification and findings; safeguards and double-counting evidence; explicit statement that internal readiness is not ICVCM approval | Independent carbon-integrity reviewer | Internal readiness only; no CCP label/approval claim |
| P1 | Privacy, cybersecurity and records | Data-flow and retention map; access controls; applicable Indian privacy/cyber obligations reviewed; incident response, secret rotation, audit-log and deletion/retention tests | Security/privacy reviewer | Block affected production data processing if unresolved |
| P1 | Operations and resilience | Monitoring/alert tests; backup and restore exercise; rollback evidence; environment separation; rate-limit/abuse tests; incident ownership and runbooks | Operations owner plus independent reviewer | No production release approval |
| P1 | TRL and product claims | Evidence ledger mapping each TRL criterion to observed test, environment, result, reviewer and date; software and hardware assessed separately | Technical assessor independent of implementation where feasible | Keep software TRL 4 provisional; do not claim TRL 5; hardware unassessed |

### Required per-activity evidence packet

Every activity seeking a compliance or carbon-value decision must have a versioned packet containing:

1. Activity ID, facility/site, state/UT, local jurisdiction, waste stream, activity dates, operator and role classification.
2. Applicable instruments with official URLs, source artifacts/hashes, publication and effective dates, amendment status, exact clauses and applicability rationale.
3. Distinct decisions for statutory applicability, facility permits, EPR, CCTS mechanism/methodology eligibility, MRV calculation, independent verification, ICVCM internal readiness, external issuance/transfer/retirement, and settlement.
4. Evidence inventory with immutable IDs, origin/custody, capture time, units, quality flags, transformations, calculation version and content digests.
5. Reviewer identity/authority, conflict/independence declaration where required, decision, findings, remediation owner and review date.
6. Explicit unresolved items and fail-closed state; no AI-generated interpretation may silently become a legal decision or external-authority confirmation.

### Operational rule for source changes

When an official source changes, do not silently mutate prior decisions. Create a new source version, identify affected jurisdictions/activities and effective dates, run regression tests against the affected controls, preserve historical decision lineage, and require review before the new rule version becomes active. If retroactivity, transition provisions or applicability are unclear, set REQUIRES_REGULATORY_REVIEW.

**Current status:** These closure requirements are defined; they are not evidence that the outstanding reviews have been completed. The register remains an initial controlled register and is not a complete legal opinion or production-approved ruleset.