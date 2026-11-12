# Asia Society Policy Institute (ASPI) — Policy-to-Engineering Crosswalk

**Control ID:** SHAKTI-REF-ASPI-001  
**Reviewed:** 2026-11-12  
**Repository:** `vishaltradewinds/rupaykg`  
**Status:** Research reference; adaptation decisions are proposals until regulatory and engineering validation.

## 1. Classification and boundary

Asia Society Policy Institute (ASPI) is a policy research and policy-engagement reference. It is not an Indian regulator, statutory registry, accredited validation/verification body, carbon-credit issuer, technical certification authority, or software standard.

ASPI material may inform policy intelligence, risk analysis, institutional engagement and requirements discovery. It cannot override Indian legislation, rules, notifications, BEE/CPCB/MoEFCC/SEBI directions, approved methodologies, or competent-authority decisions.

## 2. Primary ASPI source reviewed

**Nishtha Singh, Alistair Ritchie and Yi Chen, _Financing Just Transition through Emission Trading Systems: Challenges & Opportunities for India_, Asia Society Policy Institute, September 2024.**

Canonical source: https://asiasociety.org/sites/default/files/2024-08/ASPI_ClimateFinanceIndia_web.pdf

The paper discusses India's Carbon Credit Trading Scheme (CCTS), compliance and offset mechanisms, emissions trading system design, carbon-cost pass-through, auctioning and climate-finance revenue allocation. Its India recommendations identify four policy design pillars: effective CCTS design, conducive power-market conditions, robust fund governance, and effective revenue earmarking. The paper also discusses the importance of MRV within emissions trading systems.

**Temporal qualification:** This is a September 2024 policy paper. Treat it as historical policy analysis, not a current statement of law or current CCTS implementation status.

## 3. Current Indian official-source snapshot

Checked **12 November 2026**. The following official sources supersede older ASPI observations wherever they address current scheme operation, approved methodologies or institutional roles. This is a dated source snapshot, not a legal opinion; re-check the competent authority's latest publication before each product or customer commitment.

| Official source | Current verified point | RupayKg control consequence |
|---|---|---|
| BEE Carbon Market page: https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=116 | CCTS has separate compliance and offset mechanisms; BEE administers the scheme; compliance is tied to notified GHG-intensity targets and obligated entities; offset participation is project/methodology based | Keep compliance and offset eligibility/lifecycle separate. Never infer obligated status or offset eligibility from waste activity alone |
| BEE Detailed Procedure and Methodologies: https://beeindia.gov.in/show_content.php?lang=1&level=2&lid=640&ls_id=737 | Published offset methodologies include BM WA03.001 (landfill methane recovery) and BM WA03.002 (flaring or use of landfill gas), alongside methodologies in other sectors | A waste-sector label does not establish eligibility. Gate any project workflow on the exact current approved methodology, scope, baseline, monitoring plan, validation and competent-authority process |
| BEE Methodologies and Tools page: https://beeindia.gov.in/view_content.php?lang=1&lid=571 (page states last updated 07 Jul 2026) | The page lists 12 approved offset methodologies, including three under Waste Handling and Disposal: BM WA03.001 (landfill methane recovery), BM WA03.002 (flaring or use of landfill gas), and BM WA03.003 (Production of Compressed Bio-gas (CBG)) | Include WA03.003 only for project activities within its published CBG methodology scope and applicability conditions; do not infer eligibility for general collection, sorting, recycling, composting or all MSW operations |
| BEE Accredited Carbon Verification Agency register: https://beeindia.gov.in/view_content.php?lang=1&lid=568 (page states last updated 21 Oct 2026) | BEE maintains the register of accredited carbon verification agencies and their mechanism/sector accreditation | Verification eligibility must be checked against the current BEE register and relevant sector/mechanism scope. RupayKg must not present itself as an accredited verifier |
| Ministry of Power / PIB statement, 05 Feb 2026: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2223703&lang=2&reg=3 | Describes the CCTS institutional arrangements: NSC-ICM, Grid Controller of India Limited as Registry, BEE as Administrator, and CERC regulatory support for trading | Keep platform registry/ledger functions distinct from the statutory Indian Carbon Market Registry and trading-regulation roles |
| Ministry of Power / PIB statement, 04 Dec 2025: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2198780&lang=2&reg=48 | Describes the two CCTS mechanisms and the then-transitioned PAT sectors; thermal power plants were not transitioned in that statement | Do not infer obligated-entity status or sector coverage; use the latest applicable Gazette notification and entity-specific official record |

**Source hierarchy:** Gazette notifications and applicable legislation; current competent-authority procedures, approved methodologies and registers; official Ministry/PIB statements for institutional context; ASPI and other policy research for non-binding analysis. If sources conflict, escalate for legal/regulatory review and follow the controlling legal instrument.

**Specific limitation for RupayKg:** The current BEE inventory reviewed here lists three waste-sector offset methodologies: BM WA03.001 (landfill methane recovery), BM WA03.002 (flaring or use of landfill gas), and BM WA03.003 (Production of Compressed Bio-gas (CBG)). WA03.003 is a defined project methodology for eligible CBG production activities; it is not a blanket approval for all waste processing. Ordinary collection, sorting, recycling, composting, RDF production, material recovery or general SWM operations are not automatically eligible. Record and report those activities under their applicable environmental/circular-economy regimes, but do not convert them automatically into CCC claims.

## 4. Research-to-platform crosswalk

| ASPI policy theme | RupayKg implication | Proposed platform control | Validation required |
|---|---|---|---|
| CCTS design and long-term policy evolution | Regulatory rules and scheme parameters change over time | Versioned regulatory source catalogue; effective dates; change-impact records | Current BEE/MoEFCC notifications and approved procedures |
| Compliance and offset pathways | Distinct eligibility and lifecycle paths must not collapse into a generic carbon workflow | Preserve mechanism separation and fail-closed eligibility gates | Current Indian scheme rules, entity notifications and methodology |
| MRV as an ETS integrity mechanism | Activity, measurement, evidence, calculation and verification must be traceable | Reuse existing evidence vault, methodology source-lock, verification freeze and provenance controls | Existing tests plus external/field evidence |
| Carbon-cost pass-through and competitiveness | Financial impact is contextual and must not be inferred from emissions data | Keep financial scenario data separate from measured environmental facts | Customer/sector data, legal review and explicit assumptions |
| Auction revenue and climate-finance allocation | Public revenue allocation is a policy/governance matter, not a platform-issued carbon asset | Optional auditable finance-allocation reporting, only for an authorized programme/customer | Programme authority, fund mandate, allocation rules and source records |
| Robust fund governance | Funding decisions require authorization, auditability and transparent allocation | Role-separated approvals, immutable event history and reconciliation reports where in scope | Authority-approved control design and security tests |
| Just transition and vulnerable stakeholders | Impact reporting may require disaggregated, inclusive evidence | Optional stakeholder/outcome indicators with privacy and data-minimization safeguards | Defined programme indicators, consent/legal basis and field validation |

## 5. Engineering decisions

### Adopt as design inputs
- Versioned policy and regulatory source tracking.
- Explicit separation of environmental measurement, calculated results, verification outcomes, registry events and financial records.
- Auditable authorization and change history for any programme-level fund-allocation workflow.
- Evidence-backed reporting with source, period, unit, methodology version and provenance.

### Adapt only when justified
- Climate-finance allocation and just-transition indicators as optional reporting modules.
- Carbon-cost and competitiveness scenario analysis as a separately labelled decision-support capability.
- Policy-change impact assessment linked to regulatory source versions.

### Do not implement from ASPI research alone
- No auctioning or allowance market functionality absent a confirmed Indian legal/authority requirement.
- No automatic conversion of waste tonnage, emissions estimates or MRV results into Carbon Credit Certificates.
- No assumption that RupayKg manages, receives or allocates government auction proceeds.
- No inferred obligated-entity status, methodology approval, verifier accreditation or issuance authority.
- No adoption of international ETS mechanisms as Indian legal requirements.

## 6. Relationship to existing repository controls

This crosswalk extends, and does not replace:
- `docs/CARBON-MARKET-MECHANISM-CONTROL.md`
- `docs/CARBON_METHODOLOGY_IMPLEMENTATION_STANDARD.md`
- `docs/CCTS_METHODOLOGY_REGISTRY_FOUNDATION.md`
- `docs/CCC_ISSUANCE_EVIDENCE_GATE.md`
- `docs/reference-ecosystem/shakti-reference-register.json`
- `docs/reference-ecosystem/shakti-reference-implementation-reconciliation.json`

The existing carbon-market control remains authoritative for platform boundaries: compliance and offset mechanisms are distinct; MRV is shared; external issuance and registry status require competent-authority evidence. The ASPI paper is not a substitute for these controls.

## 7. Work batches and acceptance criteria

| Batch | Work | Acceptance evidence | Priority |
|---|---|---|---|
| ASPI-01 | Regulatory freshness check for CCTS claims used in product requirements | Official-source URL, title, publication/effective date, hash/version and reviewer decision | P0 before any implementation change |
| ASPI-02 | Trace MRV requirements to existing evidence and methodology controls | Requirement-to-code/test/evidence traceability; no duplicate MRV subsystem | P0 |
| ASPI-03 | Review finance/fund-governance reporting use cases | Explicit customer/authority mandate, data model, authorization and audit tests | P2 / conditional |
| ASPI-04 | Assess just-transition indicator requirements | Defined indicator dictionary, privacy review, data provenance and field feasibility | P2 / conditional |
| ASPI-05 | Institutional engagement brief | Factual capability statement, evidence pack and no implied ASPI endorsement | P2 |

## 8. Common assurance gates

Any implementation arising from this crosswalk must pass the repository's existing CI and applicable controls:
1. Source and legal applicability review.
2. Typecheck, build and unit tests.
3. Migration validation; no production database writes during this research integration.
4. Tenant isolation and authorization tests for any new data path.
5. Evidence provenance, versioning and audit tests.
6. API/browser/integration tests as applicable.
7. External authority or consumer acceptance where claimed.
8. Field validation before operational or TRL claims.

A green CI run proves only the tests that actually ran. It does not prove legal eligibility, regulatory acceptance, external verification, field performance or TRL 9.

## 9. TRL and claim discipline

This policy crosswalk is a research and requirements artifact. It does not increase the platform's TRL by itself. Any TRL assessment must be supported by the relevant integrated-system, operational, field and assurance evidence. Label all unvalidated capabilities as proposed or in progress.

## 10. Source and review record

- ASPI policy paper (September 2024): https://asiasociety.org/sites/default/files/2024-08/ASPI_ClimateFinanceIndia_web.pdf
- BEE Carbon Market: https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=116
- BEE Detailed Procedure and Methodologies: https://beeindia.gov.in/show_content.php?lang=1&level=2&lid=640&ls_id=737
- BEE Methodologies and Tools (last updated 07 Jul 2026): https://beeindia.gov.in/view_content.php?lang=1&lid=571
- BEE Accredited Carbon Verification Agency register (last updated 21 Oct 2026): https://beeindia.gov.in/view_content.php?lang=1&lid=568
- Ministry of Power / PIB (05 Feb 2026): https://www.pib.gov.in/PressReleasePage.aspx?PRID=2223703&lang=2&reg=3
- Ministry of Power / PIB (04 Dec 2025): https://www.pib.gov.in/PressReleasePage.aspx?PRID=2198780&lang=2&reg=48

**Decision:** Record ASPI as `OBSERVE / ADAPT-AS-POLICY-INTELLIGENCE`. Do not create a new standalone product or duplicate carbon/MRV implementation.
