# RupayKg Master Positioning & Evidence Reconciliation Charter

**Effective date:** 3 November 2026  
**Status:** Adopted strategic reference; technical and regulatory claims remain subject to evidence reconciliation.  
**Repository:** `vishaltradewinds/rupaykg`

## 1. Controlling strategic position

**RupayKg — India's Sovereign Digital MRV & Circular Economy Infrastructure.**

RupayKg is being developed as a pan-India digital operating infrastructure connecting waste and resource flows, material traceability, evidence management, regulatory-compliance workflows, deterministic measurement/reporting/verification (MRV), circular-material commerce and environmental accountability.

It is not to be positioned merely as a waste-management marketplace or carbon-credit platform. It is intended to complement, not replace, competent government authorities, statutory portals, authorised registries, municipal infrastructure and independent verification bodies.

## 2. Governing evidence hierarchy

For every claim, use the following source of truth in order:

1. **Live repository at an identified commit:** establishes implemented engineering.
2. **Reproducible test, CI and deployment evidence:** establishes what has been tested and in which environment.
3. **Current official legislation, rules, notifications, procedures and regulator publications:** establishes legal and regulatory requirements.
4. **Signed/authoritative integration evidence:** establishes whether an external system is genuinely connected and functioning.
5. **Field records and independent assessment:** establishes operational performance in the intended environment.
6. **This charter and the master white paper:** establish strategic intent, scope and terminology; they do not prove implementation, approval, certification or operational readiness.

Where sources conflict, do not silently harmonise them. Record the discrepancy, source, date, impact, owner and resolution evidence.

## 3. Claim-state vocabulary

Use these states precisely and separately:

- **Proposed:** an idea or intended capability.
- **Specified:** requirements or design are documented.
- **Implemented:** relevant code/configuration exists at a named commit.
- **Tested:** defined tests passed; cite test name, run and commit.
- **Integrated:** an external dependency is connected and its contract has been exercised.
- **Validated:** requirements or results have been checked against defined acceptance criteria by an appropriate independent or authorised party.
- **Operational:** running in its intended live environment with operating evidence.
- **Approved / Certified / Registered / Issued:** only when the competent authority, authorised body or registry has provided the applicable formal evidence.

A successful build, unit test, CI run, deployment, ledger write or application-generated credential does not by itself prove field performance, regulatory approval, independent verification, carbon-credit issuance or TRL 9.

## 4. Mandatory reconciliation workstreams

Maintain one consolidated claim-and-evidence register covering:

1. Product scope, modules and user journeys.
2. Architecture, APIs, services and authoritative database/deployment topology.
3. Database migrations, tenant isolation, RLS, privileged roles and organisation-scoped access.
4. Authentication, authorisation and every protected read/write path.
5. Evidence vault: upload, download, mutation, retention, provenance and audit history.
6. MRV methodologies, deterministic registry, baselines, factors, calculation reproducibility, uncertainty and version control.
7. EPR and waste-stream workflows, separated by applicable waste rules and material categories.
8. Regulatory mappings, each linked to current official source, provision, effective date, applicability and competent authority.
9. Hedera Guardian/HCS, W3C Verifiable Credentials, signing, consensus and independent verification; distinguish implemented code from verified external operation.
10. IoT/edge, weighbridge, sensors, calibration, device identity, connectivity and field acceptance.
11. Marketplace, transaction, ownership, settlement and environmental-attribute controls.
12. Security, dependency remediation, rate limiting, secrets, backup, recovery, monitoring and incident response.
13. Deployment, CI, release provenance and environment parity.
14. Jabalpur SITE-JBP-01 Kathonda pilot permissions, boundaries, baseline, source records, measurement, reconciliation, independent review and operational results.
15. TRL evidence and independent assurance.

## 5. Required evidence-register fields

Each claim must have, at minimum:

| Field | Required content |
|---|---|
| Claim ID | Stable unique identifier |
| White-paper section | Where the claim appears |
| Claim statement | Exact, testable statement |
| Claim state | One of the defined states |
| Repository evidence | Path, commit SHA, PR or deployment reference |
| Test evidence | Test name, run URL/ID, result and date |
| External evidence | Official source or integration proof |
| Field evidence | Site, event, record and independent reviewer where applicable |
| Applicable limitations | Assumptions, exclusions and uncertainty |
| Gap / risk | What remains unproven |
| Owner and next action | Accountable workstream and acceptance action |
| Last verified | Date and evidence snapshot |

No claim is complete merely because a document says it is complete.

## 6. Regulatory integrity rules

- Indian statutory and regulatory requirements take precedence for Indian compliance decisions.
- Use current official primary sources and record publication/effective dates.
- Distinguish law, rules, notifications, regulator guidance, voluntary standards and commercial methodology requirements.
- CPCB/SPCB, BEE, municipal, registry and other authority workflows must not be represented as approved integrations without evidence.
- EPR records do not automatically establish carbon-credit eligibility.
- Waste diversion or recycling does not automatically establish avoided emissions, additionality or credit issuance.
- ICVCM Core Carbon Principles and international standards are complementary benchmarks, not substitutes for Indian law or competent-authority decisions.
- Environmental attributes, ownership, claims, transfer and retirement require explicit legal, contractual and registry controls.

## 7. Pilot and TRL 9 guardrails

The current designated field-validation target is **SITE-JBP-01 — Kathonda Municipal Solid Waste Processing and Disposal Facility, Jabalpur, Madhya Pradesh**. It must remain labelled a target / pre-validation site until permissions, access, operational boundaries, baseline records and field evidence are established.

TRL 9 is an objective, not an asserted achievement. The assurance case must include successful operation in the intended real-world environment, sustained performance evidence, operational resilience, security, validated interfaces and independent assessment. Software tests and cloud deployment alone are insufficient.

## 8. Release and publication gates

Before external publication or institutional circulation:

1. Freeze the repository commit and evidence-register snapshot being assessed.
2. Reconcile every material white-paper claim against repository, CI, regulatory and field evidence.
3. Mark unsupported claims as proposed, planned or unverified; remove or qualify unsupported completion language.
4. Have regulatory claims reviewed against current official sources.
5. Have security, tenant isolation and production claims reviewed against exact-head evidence.
6. Disclose pilot status and unresolved dependencies.
7. Record independent review and approval for the publication version.

Do not describe this charter's adoption or a documentation PR as proof that the reconciliation itself is complete.

## 9. Strategic document family

Derive, and keep consistent with this master position:

- Government & Institutional White Paper.
- Technical Architecture & Digital MRV Paper.
- Investment & Commercial White Paper.
- TRL 9 Assurance Dossier.

All derivative documents must inherit the claim-state vocabulary, evidence hierarchy and regulatory disclaimers in this charter.

## 10. Operating rule

**The repository establishes engineering reality; official regulatory sources establish legal reality; test and deployment records establish technical verification; field evidence establishes operational reality; independent assurance establishes the strength of the TRL claim.**

**Evidence before claims. Measurement before monetisation. Compliance before certification. Independent verification before environmental-value issuance.**
