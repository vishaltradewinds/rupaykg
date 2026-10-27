# RupayKg ICVCM Core Carbon Principles Integration

**Status:** Engineering implementation proposed on branch; not merged, independently reviewed, certified, or production-approved.  
**Review date:** 2026-10-27  
**Owner:** RupayKg Carbon OS / Shakti Standards

## 1. Decision and boundaries

RupayKg will use the Integrity Council for the Voluntary Carbon Market (ICVCM) Core Carbon Principles (CCPs) as a complementary high-integrity benchmark for its MRV evidence, methodology governance, safeguards and carbon-credit lifecycle controls.

**India-first rule:** RupayKg is being built and operated for India. Applicable Indian central and state law, notified rules, competent-authority directions, permissions/consents and applicable methodology requirements are the primary mandatory compliance gates. ICVCM is a supplementary voluntary integrity benchmark only where relevant; it must never override, replace or imply satisfaction of Indian law.

Applicability must be resolved for each activity using the current official source and effective date. The control plane must distinguish: (a) binding statutory obligations; (b) scheme and methodology rules; (c) permit/consent conditions and state/local requirements; and (d) voluntary standards such as ICVCM. Do not infer that all waste activities qualify for carbon credits, that every entity is covered by CCTS, or that one state's workflow applies nationwide. Pan-India means a common platform with jurisdiction- and activity-specific rules, not a single blanket legal configuration.

RupayKg must keep separate compliance decisions for, where applicable:
- Solid Waste Management (SWM) Rules, 2026 and the relevant CPCB/SPCB/PCC and ULB/RLB requirements;
- waste-category-specific EPR rules, registrations, targets, returns and evidence (for example, plastic, e-waste, battery or other regulated streams only where applicable);
- the Indian Carbon Credit Trading Scheme (CCTS), the applicable compliance or offset mechanism, approved sector/methodology, monitoring plan and verification arrangements administered through the relevant Indian institutions;
- state/local permits, consents, land/facility approvals, environmental safeguards and other activity-specific statutory conditions.

If legal applicability or an effective date is unresolved, mark the control **REQUIRES_REGULATORY_REVIEW** and fail closed for claims or release. Record the official instrument, rule/notification number where available, issuing authority, publication/effective dates, jurisdiction, applicability rationale, source URL, version/hash where feasible, last-reviewed date and reviewer. Do not silently turn a draft, consultation, guidance note or voluntary benchmark into a binding rule.

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

## 4. India-first statutory source register and voluntary references

### 4.1 Indian primary sources — mandatory review where applicable

| Source | Platform use and guardrail |
|---|---|
| [CPCB Centralised Online Portal for Solid Waste Management](https://swmp.cpcb.gov.in/en) | The portal states that SWM Rules, 2026 were notified on 27 January 2026 and took effect on 1 April 2026. Use the current official rules and portal instructions to map stakeholder duties, registration/reporting and facility workflows. |
| [Official SWM Rules, 2026 PDF hosted by CPCB](https://swm.cpcb.gov.in/images/solid-waste-management-rules-2026.pdf) | Primary text for rule-by-rule mapping. Validate amendments, corrigenda, applicability and effective dates before release. |
| [Ministry of Environment, Forest and Climate Change — PIB release on SWM Rules, 2026](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2219676&lang=1&reg=3) | Official explanatory release; use the notified rules as the controlling text where summaries differ. |
| [Bureau of Energy Efficiency — Carbon Market](https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=116) | Primary institutional source for CCTS documents, offset mechanism procedures, methodologies, approved sectors and verification-agency procedures. |
| [Press Information Bureau — Carbon Credit Trading Scheme update, 5 February 2026](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2223703&lang=2&reg=3) | Official summary of the Indian Carbon Market institutional framework. Confirm operative requirements against current BEE notifications/procedures and Gazette instruments. |

These are starting points, not an exhaustive legal register. The implementation batch must add the applicable EPR rules and current CPCB/SPCB/PCC, ULB/RLB and state-specific official instruments for each waste stream and activity. No legal applicability should be asserted solely from a news article or general summary.

### 4.2 ICVCM — supplementary voluntary integrity references

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

The code-level source gate is implemented in `packages/domain/src/regulatory.ts` and tested in `packages/domain/src/regulatory.test.ts`; it blocks draft/superseded sources, missing or invalid effective dates, sources not yet effective or no longer effective, invalid metadata, and state-specific jurisdiction mismatches. This gate is intentionally a source-validity check, not an automatic legal applicability ruling. Existing EPR catalogue updates are tracked in `migrations/075_epr_portal_provenance_guardrails.sql`. The maintained starting register is [`docs/INDIA_REGULATORY_APPLICABILITY_REGISTER.md`](./INDIA_REGULATORY_APPLICABILITY_REGISTER.md). It lists official CPCB/MoEFCC and BEE starting sources, required source metadata, fail-closed decision states, and explicit gaps for activity-specific EPR and state/local instruments. It is not yet an exhaustive legal register and must receive independent review before production use. ICVCM does not determine Indian statutory applicability.

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

## 6. India-first decision and release gates\n\n1. **Indian statutory gate first:** no ICVCM evidence status can compensate for a missing or failed applicable Indian legal requirement.\n2. **Applicability before automation:** determine waste stream, activity, jurisdiction, responsible stakeholder, operative instrument and effective date before presenting a requirement as applicable.\n3. **No false coverage:** CCTS participation, an approved offset methodology, EPR applicability and credit eligibility must each be established independently from current authoritative sources.\n4. **Human/legal escalation:** uncertain interpretation is a recorded unresolved item for competent regulatory/legal review, not an AI-generated compliance decision.\n5. **Evidence-backed TRL:** repository tests establish engineering evidence only. They do not prove legal compliance, operational performance, external acceptance or production readiness.\n6. **Fail-closed release:** keep PR #95 draft/unmerged and production certification OFF until independent code review, regulatory/methodology mapping, security review, real-environment acceptance and required approvals are evidenced.\n\n## 7. Change-control rule

Reassess this mapping when ICVCM publishes updated criteria, rule interpretations, assessment procedures or methodology decisions. Store the source/version reviewed and a dated change decision. Do not treat consultation drafts as final requirements unless the official source confirms adoption.
