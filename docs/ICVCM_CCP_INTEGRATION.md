# RupayKg ICVCM Core Carbon Principles Integration

**Status:** Engineering implementation proposed on branch; not merged, independently reviewed, certified, or production-approved.  
**Review date:** 2026-10-27  
**Owner:** RupayKg Carbon OS / Shakti Standards

## 1. Decision and boundaries

RupayKg will use the Integrity Council for the Voluntary Carbon Market (ICVCM) Core Carbon Principles (CCPs) as a complementary high-integrity benchmark for its MRV evidence, methodology governance, safeguards and carbon-credit lifecycle controls.

ICVCM is not a substitute for applicable Indian law. Statutory and regulatory applicability must remain a separate mandatory gate, including applicable CPCB, EPR, solid-waste-management and Indian Carbon Credit Trading Scheme (CCTS) obligations. The actual requirement set depends on the activity, project, jurisdiction, mechanism and current authoritative rules.

RupayKg supports project evidence, MRV calculations, workflow and external registry/authority evidence. It does not itself issue government or registry carbon credits. A calculation, internal review, complete evidence register or software control must never be represented as external issuance, ICVCM approval or a CCP label.

## 2. Ten CCPs mapped to engineering controls

The machine-readable control catalogue and fail-closed evidence assessment live in `packages/carbon/src/icvcm-ccp-integrity.ts`.

| ID | Principle | Intended RupayKg control |
|---|---|---|
| CCP-01 | Effective governance | Role separation, accountable approvals, controlled changes, audit trails and continuous improvement. |
| CCP-02 | Tracking | Unique activity/project/evidence identifiers and traceable lifecycle/registry references. |
| CCP-03 | Transparency | Accurate electronic disclosures for appropriate public scrutiny, subject to privacy and confidentiality controls. |
| CCP-04 | Robust independent third-party validation and verification | Verifier identity, independence/conflicts, scope, evidence, findings and recorded decisions. AI is not the independent verifier. |
| CCP-05 | Additionality | Methodology-specific test, evidence, assumptions, reviewer decision and unresolved uncertainty. |
| CCP-06 | Permanence | Reversal-risk assessment and applicable monitoring, prevention, buffer or compensation controls. |
| CCP-07 | Robust quantification | Versioned methodology, baseline, factors, units, data lineage, leakage/uncertainty and reproducible equation trace. |
| CCP-08 | No double counting | Duplicate detection, ownership/transfer/retirement tracking and applicable double-issuance/claim/use checks. |
| CCP-09 | Sustainable development benefits and safeguards | Environmental/social safeguards, stakeholder engagement, grievance and remediation evidence. |
| CCP-10 | Contribution to net zero transition | Context-appropriate assessment of long-term transition alignment and emissions-intensive lock-in risk. |

The control assessment reports only internal evidence-register completeness. An `EVIDENCED` status requires at least one evidence reference. Missing evidence, missing assessment, duplicate IDs or unknown principle IDs fail closed. Even a complete register remains **pending independent review** and cannot produce a certification or issuance decision.

## 3. Shakti Standards execution gates

Work must be executed in coherent batches, with evidence retained for each gate:

1. **Reality and source discovery:** capture official source URL, title, publication/update date, version/status, applicability and last-reviewed date. Distinguish binding law, scheme rules, methodology requirements and voluntary benchmarks.
2. **Regulatory applicability:** map Indian legal obligations separately from ICVCM principles; identify competent authority and unresolved legal interpretation.
3. **Repository/architecture fit:** reuse existing carbon, compliance, evidence, audit and registry modules. Avoid duplicate competing registries or parallel policy engines.
4. **Engineering:** maintain versioned controls and source lineage; separate AI recommendations from authorized human/verifier decisions.
5. **Verification:** automated unit/regression tests, typecheck/build, adversarial fail-closed tests, duplicate-evidence tests and independent code review.
6. **TRL and real-world validation:** document the current TRL with objective evidence. A greenfield platform or automated tests alone do not prove operational TRL or live acceptance.
7. **Release authorization:** keep production certification OFF until all relevant evidence, approvals, security gates and live external acceptance tests are verified. Never auto-merge or infer approval from code completion.

## 4. Relevant official online resources

Use official ICVCM pages as the primary reference set. Review for updates before relying on a criterion or making an external claim.

| Resource | Purpose |
|---|---|
| [ICVCM main site](https://icvcm.org/) | Organization and current materials. |
| [Core Carbon Principles](https://icvcm.org/core-carbon-principles/) | Authoritative overview of the ten principles. |
| [Assessment Framework](https://icvcm.org/assessment-framework/) | Detailed program-level and credit-category/methodology criteria and rule architecture resources. |
| [Assessment Status](https://icvcm.org/assessment-status/) | Current public assessment decisions and application-platform status. |
| [How ICVCM assesses carbon-crediting programs](https://www.icvcm.org/how-we-assess-carbon-crediting-programs/) | Program assessment process and application guidance. |
| [How ICVCM assesses methodologies](https://icvcm.org/how-we-assess-carbon-crediting-methodologies/) | Methodology assessment process. |
| [CCP-approved methodologies](https://icvcm.org/knowledge-resources/ccp-approved-methodologies/) | Reference for methodologies/categories actually approved by ICVCM. |
| [Eligible-program resources and tagging guide](https://www.icvcm.org/knowledge-resources/eligible-program-resources/) | Guidance on tagging CCP-approved credits; do not implement a CCP label without the applicable program/category eligibility. |
| [CCP Rule Architecture consultation page](https://www.icvcm.org/consultation/ccp-rule-architecture/) | Rule interpretation and consultation materials; distinguish drafts from final adopted rules. |
| [Application platform update, 18 August 2026](https://icvcm.org/program-application-platform-update-august-2026/) | ICVCM stated the application platform would be closed until April 2027, with an expected April–July 2027 submission window. Recheck the current official status before planning an application. |

Additional Indian primary sources must be recorded separately in the statutory source register, including the Bureau of Energy Efficiency for CCTS/methodologies and CPCB/competent authorities for applicable waste/EPR obligations. ICVCM does not determine Indian statutory applicability.

## 5. Implementation and acceptance checklist

- [x] Add version-controlled catalogue for all ten CCPs.
- [x] Record official ICVCM source URLs in code.
- [x] Add fail-closed internal evidence completeness assessment.
- [x] Reject unknown and duplicate principle IDs.
- [x] Require evidence references for any control marked evidenced.
- [x] State that internal completeness is not ICVCM certification, CCP eligibility, external verification or credit issuance.
- [x] Add unit tests for empty, incomplete, complete, unknown and duplicate assessments.
- [x] Harden runtime validation for malformed evidence-reference payloads and invalid statuses.
- [x] Test whitespace-only evidence references so they cannot satisfy the evidence gate.
- [x] Add authenticated activity-scoped API routes to persist and retrieve versioned internal CCP evidence assessments.
- [x] Reuse the existing PostgreSQL evidence vault; require evidence UUIDs to resolve to VERIFIED evidence bound to the same activity.
- [x] Enforce organization membership, `evidence:review` write permission, activity ownership and geography scope before persistence.
- [x] Persist append-only revisions only as `INTERNAL_DRAFT`; this workflow exposes no approval, certification or issuance action.
- [ ] Add dedicated API-level authorization and persistence regression tests, including cross-organization access and incomplete evidence.
- [ ] Run the updated package tests, TypeScript build/typecheck and repository-wide regression suite.
- [ ] Complete independent regulatory/methodology review and TRL evidence assessment.
- [ ] Verify live external integrations and required human approvals before any production release.

## 6. Change-control rule

Reassess this mapping when ICVCM publishes updated criteria, rule interpretations, assessment procedures or methodology decisions. Store the source/version reviewed and a dated change decision. Do not treat consultation drafts as final requirements unless the official source confirms adoption.
