# CCTS Entity Registers and RupayKg Ecosystem Mapping

**Repository:** `vishaltradewinds/rupaykg`  
**Baseline:** `main` at `2be38f944d216f17dc9ca37e5c40e46052c4fa89`  
**Working branch:** `cto/20261112-ccts-register-separation`  
**Prepared:** 2026-11-12  
**Status:** Architecture and source reconciliation specification; named 490-row Gazette extraction is not yet certified.

## 1. Legal mechanism boundary

CCTS has two distinct mechanisms. The official BEE framework says that the Compliance Mechanism is mandatory for entities specified as obligated entities, while the Offset Mechanism is voluntary and project-based for non-obligated entities. The legal status must be derived from the applicable notification and current register, not inferred from an industry label, business role, or activity.

### Register A — obligated entities (Compliance Mechanism)

- Maintain one record per notified obligated installation/facility, not merely one per corporate group.
- Legal status: `OBLIGATED` only where the Gazette schedule and applicable amendments identify the entity/facility.
- Preserve the exact legal name, facility name/address, state, sector, registration/obligated-entity identifier, notification number/date, baseline, product/output unit, GEI target for each compliance year, and effective/superseded status.
- A corporate parent, supplier, transporter, waste generator, aggregator, recycler, municipality or auditor is not an obligated entity merely because it participates in the value chain.
- A single corporate group may have multiple separately notified facilities. Never collapse them into one row.
- Do not infer an obligation for an entity whose facility is absent from the current notified schedule.

**Government baseline:** MoEFCC/PIB announced 282 entities under the October 2025 notification and 208 additional entities under the 13 January 2026 notification, giving 490 notified obligated entities. The January notification is G.S.R. 25(E). The later G.S.R. 794(E), dated 7 September 2026, amends the refinery and textile target schedules; the register must apply that later schedule rather than retaining superseded target values. A draft iron-and-steel schedule is not a final compulsory obligation and must not be merged into the 490 notified register unless a final Gazette notification is located.

**Source hierarchy:** Gazette notification and its schedules/amendments > BEE/Ministry official register or written clarification > PIB summary > secondary compilation. Secondary datasets may be used for extraction assistance only; every row must be reconciled against the Gazette before it is marked `SOURCE_VERIFIED`.

### Register B — offset project proponents and projects (Offset Mechanism)

Keep two related datasets, not one:
1. `CCTS_OFFSET_PROPONENTS`: non-obligated legal entities/organizations participating as project proponents.
2. `CCTS_OFFSET_PROJECTS`: individual project activities, each tied to one approved methodology and methodology version.

An organization can be a project proponent only for an eligible project. Being a municipality, ULB, waste operator, farmer, FPO, company or NGO does not itself establish project eligibility. An obligated entity must not be silently reclassified as a non-obligated offset proponent; any permitted project participation must be checked against the current CCTS procedure and project-specific conditions.

## 2. Current official offset scope versus approved methodology coverage

BEE's approved sector-scope office memorandum identifies the following offset sectors: Energy; Industries; Agriculture; Waste Handling and Disposal; Forestry; Transport; Fugitive Emissions; Construction; Solvent Use; and Carbon Capture, Utilization and Storage (CCUS).

This is the **sectoral scope**, not a declaration that every activity in every sector already has an approved methodology. The BEE methodologies page snapshot last updated 7 July 2026 lists 12 approved methodologies, currently distributed across five methodology sectors: Energy, Industries, Waste Handling and Disposal, Agriculture and Forestry. Do not create an approved methodology for Transport, Fugitive Emissions, Construction, Solvent Use or CCUS until BEE publishes one.

### Approved methodology register (12)

| Code | Sector | Approved methodology | RupayKg relevance |
|---|---|---|---|
| BM EN01.001 | Energy | Grid-connected electricity generation from renewable sources | Renewable electricity project proponents; energy data/evidence |
| BM EN01.002 | Energy | Hydrogen production from electrolysis of water | Electrolyser operators; electricity and hydrogen production MRV |
| BM IN02.001 | Industries | Energy efficiency and fuel switching measures for industrial facilities | Industrial project proponents; process/energy measurement |
| BM IN02.002 | Industries | Hydrogen production using methane extracted from biogas | Biogas/hydrogen project proponents; feedstock, gas and process MRV |
| BM WA03.001 | Waste Handling and Disposal | Landfill methane recovery | ULB/municipal landfill owner, concessionaire or eligible project proponent; landfill gas monitoring |
| BM WA03.002 | Waste Handling and Disposal | Flaring or use of landfill gas | Landfill operator/project proponent; gas flow, composition, flaring/use and energy data |
| BM AG04.001 | Agriculture | Methane recovery from livestock and manure management at households and small farms | Farmer groups, dairy/cooperative aggregators, manure/biogas project proponents |
| BM FR05.001 | Forestry | Afforestation and reforestation of degraded mangrove habitats | Eligible restoration/landholding project proponents; land tenure, survival and carbon-stock evidence |
| BM FR05.002 | Forestry | Afforestation and reforestation of lands except wetlands | Eligible land/restoration project proponents; land eligibility, permanence and carbon-stock evidence |
| BM AG04.002 | Agriculture | Emission reduction through improved management practices in rice cultivation | Farmers/FPOs/implementers; field practice and water/area monitoring |
| BM WA03.003 | Waste Handling and Disposal | Production of Compressed Bio-gas (CBG) | CBG plant/project proponent; feedstock chain, plant input/output, gas quality and energy |
| BM EN01.003 | Energy | Electricity and Heat Generation from Biomass | Biomass power/heat project proponents; sustainable biomass sourcing and generation |

**Control:** This list records methodology approval on the BEE page, not RupayKg calculation-adapter certification or project eligibility. The existing methodology registry remains `REGISTRY_ONLY` until the detailed methodology and tools are implemented and independently reviewed.

## 3. RupayKg stakeholder mapping — Generator + Aggregator + Recycler

The stakeholder model is deliberately wider than BWG. Every waste-sector role is represented, but project ownership and legal eligibility remain separate fields.

| RupayKg stakeholder | Evidence/operational contribution | Potential offset project relationship | Automatic CCC eligibility? |
|---|---|---|---|
| Waste generator (household, commercial, industrial, institutional, BWG) | Waste type/quantity, source, segregation, transfer records | Feedstock source evidence for an eligible project; may participate only if it is an eligible non-obligated proponent | No |
| Aggregator / collection operator | Aggregated weights, routes, custody, receipts and source lots | Feedstock aggregation and chain-of-custody evidence | No |
| Transporter / logistics operator | Weighment, route, vehicle, fuel, transfer and delivery evidence | Supporting activity evidence; transport offset only if a methodology and project eligibility are approved | No |
| MRF / sorting operator | Incoming/outgoing mass balance, material fractions, rejects | Supporting evidence for eligible waste projects; not a standalone methodology unless specifically approved | No |
| Recycler / processor | Input-output mass balance, process energy, residue, product output | May be a project proponent for an eligible methodology (e.g. industrial efficiency) if all criteria are met | No |
| ULB / Gram Panchayat / municipal authority | Landfill ownership/control, waste quantity, site permits, operator contracts, baseline records | Potential landfill/CBG project proponent where project boundary, rights and methodology conditions are satisfied | No |
| Landfill owner/operator | Waste-in-place, gas flow/composition, flaring/use, equipment uptime, monitoring | Direct potential proponent under WA03.001/WA03.002 | No |
| CBG developer/operator | Feedstock, digestate, plant input/output, methane and CBG data | Direct potential proponent under WA03.003 | No |
| Dairy / livestock operator / FPO | Herd, manure, baseline practice, biogas capture and use | Potential proponent under AG04.001 if the methodology's scale and eligibility criteria fit | No |
| Farmer / FPO / rice programme implementer | Plot boundaries, water regime, cultivation practice, crop cycles | Potential proponent under AG04.002 if eligibility criteria fit | No |
| Industrial facility / ESCO | Metered energy, production, fuel and process evidence | Potential proponent under IN02.001/IN02.002 subject to non-obligated status and methodology criteria | No |
| Renewable energy / biomass operator | Metered generation, fuel/source sustainability and plant data | Potential proponent under EN01.001/EN01.003 | No |
| Verification agency (ACVA) | Independent validation/verification records and findings | Assurance provider, not project owner merely by verifying | No |
| Buyer / certificate trader | Purchase, transfer and retirement evidence | Market participant, not mitigation project proponent solely by purchase | No |

### Waste opportunity priority for RupayKg

1. **WA03.001 — Landfill methane recovery:** first priority for SITE-JBP-01 only after the site boundary, landfill status, ownership/operating rights, historical waste baseline, gas generation/recovery design and methodology applicability are evidenced. The site is not assumed eligible.
2. **WA03.002 — Flaring or use of landfill gas:** related but separate methodology and project case; do not combine its calculation with WA03.001 without explicit methodology permission.
3. **WA03.003 — CBG production:** separate project boundary, feedstock eligibility, plant process and gas output evidence.
4. **AG04.001 / AG04.002:** partner-led rural/agriculture pathways; separate monitoring workflows and project proponents.
5. **IN02.001:** recycler/processor energy-efficiency projects only where the facility and proponent meet the methodology and non-obligated-entity rules.

The same physical waste movement may be recorded in RupayKg's operational ledger and used as evidence in an eligible carbon project, but it is not itself a carbon reduction or CCC. Preserve attribute ownership, project boundary, baseline, leakage, additionality, allocation and double-counting controls. EPR certificates, waste processing records, BRSR metrics and CCCs are different instruments and must not be conflated.

## 4. Shared evidence infrastructure; separate regulatory state machines

Shared services:
- organization/facility/project identity and tenant isolation;
- measurement devices, weighbridge/IoT and field operations;
- evidence vault, immutable hashes, source references and time periods;
- mass/energy balance and provenance;
- Guardian policy execution and Hedera anchoring;
- independent reviewer/ACVA workflow;
- reporting and registry reconciliation.

Separate state machines:

**Compliance:** `NOTIFIED_OBLIGATED → TARGET_BOUND → MONITORING → VERIFIED → PERFORMANCE_DETERMINED → CERTIFICATE_ISSUANCE_OR_SHORTFALL → REGISTRY_RECONCILED`

**Offset:** `PROPONENT_SCREENED → PROJECT_SCREENED → METHODOLOGY_BOUND → PROJECT_DESIGN → VALIDATION → REGISTERED → MONITORING → VERIFICATION → ISSUANCE_REQUESTED → CCC_ISSUED_AND_RECONCILED`

Never infer official registration, verification, issuance, transfer or retirement from an internal RupayKg status or Hedera transaction.

## 5. Data model and integrity constraints

Recommended logical entities (reuse existing identity, organization, evidence, activity, methodology and provenance structures where possible; do not duplicate them blindly):

- `ccts_obligated_facilities`: one row per notified facility/installation; unique notification + obligated-entity code; legal name and source schedule reference.
- `ccts_obligation_targets`: one row per facility + compliance year + target/product definition; stores baseline, target, units, effective dates and supersession links.
- `ccts_offset_proponents`: organization identity, non-obligated screening result, legal evidence and status.
- `ccts_offset_projects`: project proponent, project boundary, location, project type, methodology code/version, project cycle and official registration reference.
- `ccts_regulatory_sources`: authority, document number, issue/effective date, URL, retrieval time, SHA-256, supersedes/superseded-by and verification state.
- `ccts_entity_source_links`: row-to-source page/schedule/page/paragraph traceability.
- `ccts_project_methodology_assessments`: criterion, evidence reference, outcome and reviewer.
- `ccts_registry_events`: externally sourced registration, issuance, transfer, surrender or retirement events with registry reference and source evidence.

Required enums/controls:
- mechanism: `COMPLIANCE` or `OFFSET` (no generic default);
- source verification: `UNVERIFIED`, `SECONDARY_EXTRACT`, `GAZETTE_VERIFIED`, `SUPERSEDED`, `DISPUTED`;
- project eligibility: `UNASSESSED`, `ELIGIBLE_FOR_FURTHER_ASSESSMENT`, `INELIGIBLE`, `UNRESOLVED`;
- never use a single `VERIFIED` flag to represent source verification, MRV verification and official registration;
- no certificate value or issuance status without an authoritative registry/authority event;
- all changes append source history; never overwrite an earlier target or schedule.

## 6. 490-row register extraction and acceptance gate

The Government's 490 figure is confirmed by the 22 January 2026 PIB release. The Gazette schedules are the controlling row-level evidence. The September 2026 amendment G.S.R. 794(E) must be applied to refinery and textile target schedules. The official source set to retrieve and reconcile is:

- G.S.R. 739(E), 8 October 2025 — first four-sector schedules.
- G.S.R. 25(E), 13 January 2026 — secondary aluminium, petroleum refinery, petrochemicals and textile schedules.
- G.S.R. 794(E), 7 September 2026 — amended refinery and textile schedules.
- Any subsequent final amendment, corrigendum or withdrawal discovered during retrieval.

The register is accepted only when:
1. each of the 490 facility rows has a unique obligated identifier and Gazette source locator;
2. legal entity/facility names and addresses are transcribed from the final controlling schedule;
3. target values and units reconcile row-by-row to the currently effective schedule;
4. superseded values remain in history and are not shown as current;
5. duplicate facility/parent-company records are resolved without losing separate notified installations;
6. the final row count and sector totals reconcile with the official Government announcement;
7. a second reviewer signs the reconciliation report.

**Do not label the register complete or import secondary-source rows into production before these checks pass.** A draft iron-and-steel schedule must be kept in a separate `DRAFT_NOT_OBLIGATED` watchlist, not in the 490-row compulsory register.

## 7. Current implementation findings and next engineering sequence

The repository already contains:
- `docs/CARBON-MARKET-MECHANISM-CONTROL.md` — mechanism separation controls;
- `docs/CCTS_METHODOLOGY_REGISTRY_FOUNDATION.md` and `migrations/20261020_ccts_methodology_registry.sql` — 12 methodology / 17 tool registry foundation;
- `migrations/20261021_evidence_artifact_vault.sql` — immutable evidence artifacts;
- Guardian MRV and provenance components.

This change is documentation/specification only. It does not modify the production database, create production entity records, claim project eligibility, or certify methodology calculations.

Recommended implementation batches:
1. Gazette source acquisition, PDF hashing and row extraction into a review-only CSV.
2. Two-person reconciliation and approved 490-row source register.
3. Schema design reusing existing organization/facility/regulatory-source/evidence tables; add only missing tables and constraints.
4. Read-only entity search/API and compliance facility profile.
5. Offset proponent/project onboarding with fail-closed methodology applicability.
6. Methodology-specific MRV adapters, beginning with WA03.001 only after its tools and source documents are fully specified.
7. CI: row-count/uniqueness/source-link tests, supersession tests, cross-mechanism isolation tests, tenant/RLS tests, and no-certificate-without-registry-evidence tests.

## 8. Official sources

- BEE, Carbon Market overview and mechanism definitions: https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=116
- BEE, approved offset sector scope (Office Memorandum, 20 September 2024): https://beeindia.gov.in/WriteReadData/RTF1984/RTF-PDF-4edb9be54a4b43e6_1776057028.pdf
- BEE, approved methodologies and tools (page last updated 7 July 2026): https://beeindia.gov.in/view_content.php?lang=1&lid=571
- BEE, detailed procedure for offset mechanism: https://beeindia.gov.in/sites/default/files/Detailed%20Procedure%20for%20Offset%20Mechanism_CCTS.pdf
- MoEFCC/PIB, 208 additional entities and 490 cumulative obligated entities, 22 January 2026: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2217239&lang=1&reg=3
- Gazette, G.S.R. 25(E), 13 January 2026: https://egazette.gov.in/WriteReadData/2026/269375.pdf
- G.S.R. 794(E), 7 September 2026: https://www.simpliance.in/download/file/dXBsb2Fkcy9nb3Z0bm90aWZpY2F0aW9uL05vdGlmaWNhdGlvbiBvZiB0aGUgR3JlZW5ob3VzZSBHYXNlcyBFbWlzc2lvbiBJbnRlbnNpdHkgVGFyZ2V0IChBbWVuZG1lbnQpIFJ1bGVzLCAyMDI2LnBkZg%3D%3D (secondary host of Gazette document; replace with official eGazette copy when retrieved).

**Important:** The BEE offset sector scope contains ten sectors, while the 12 currently listed approved methodologies cover five sectors. These are not contradictory: sectoral scope does not mean a methodology is already approved for every sector.
