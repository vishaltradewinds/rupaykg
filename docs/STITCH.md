# Google Stitch UI/UX Plan

Use Google Stitch for high-fidelity exploration and interactive prototypes. Stitch is a design/prototyping layer; RupayKg remains authoritative in PostgreSQL and the API. Google describes Stitch as an AI-powered UI design workflow that can generate interfaces and frontend code from natural-language prompts. citeturn0search2

## Priority build order

1. National Command Center
2. ULB Operations
3. Rural Operations
4. Field Capture Mobile
5. MRV Workspace
6. EPR Workspace
7. Carbon Workspace
8. Registry Workspace
9. Settlement Workspace
10. Audit Explorer

## Shared Stitch prompt

> Design a production-grade India-wide Circular Economy Operating System called RupayKg. It serves municipalities, Gram Panchayats, districts, states, industries, generators, aggregators, transporters, processors, recyclers, auditors, MRV participants, EPR obligated entities and authorized institutional users. Support urban and rural workflows in one national data model. Use an institutional/government-grade visual language, excellent accessibility, dense operational tables, clear hierarchy, map-ready geography controls, responsive desktop layouts and a low-bandwidth mobile experience. Every operational metric must display provenance/status: VERIFIED, PENDING, REJECTED, UNAVAILABLE, DEMO or SIMULATED. Never invent live data. Regulated actions must expose evidence, verification, authorization and audit history. Design empty, loading, error, offline and permission-denied states.

## Screen prompts

### National Command Center
> Using the shared RupayKg prompt, create a national command center for India. Provide State/UT and district filters, urban/rural segmentation, resource-flow throughput, measurement and evidence queues, MRV verification workload, EPR obligations, carbon calculation workload, registry activity, settlement reconciliation and regulatory alerts. Make each KPI clickable to an evidence-backed detail view. Show unavailable data explicitly instead of placeholder numbers.

### ULB Operations
> Using the shared prompt, create a municipal operations console for a ULB. Show wards, collection tasks, route/transfer progress, weighbridge measurements, MRF queues, resource-flow exceptions, evidence completeness and unresolved operational incidents. Include a map-ready layout and a side panel for chain-of-custody details.

### Rural Operations
> Using the shared prompt, create a Gram Panchayat/cluster operations console. Optimize for intermittent connectivity. Show villages, aggregation points, SHG/farmer activity, collection and transport tasks, weighing, local processing, offline sync envelopes, evidence pending and district handoff. Make touch targets large and keep critical workflows usable on low-end devices.

### Field Capture Mobile
> Using the shared prompt, design a mobile field workflow: assigned task → identity/device context → location → material → quantity/unit → measurement method → photo/document evidence → review → submit → sync/retry. Clearly distinguish locally captured, uploaded, accepted and verified states. Never imply verification merely because a record was captured.

### MRV Workspace
> Using the shared prompt, create an evidence-review workspace with activity facts, measurements, methodology version, evidence gallery, chain of custody, verifier requirements, previous decisions and an approval/rejection action. Approval must require an explicit verifier identity and rationale. Make the audit trail prominent.

### EPR Workspace
> Using the shared prompt, create an EPR compliance workspace showing scheme, jurisdiction, obligated organization, reporting period, category, target quantity, fulfilled quantity, eligible evidence, recycler/processor records, submissions and authority responses. Separate internally calculated eligibility from externally confirmed compliance.

### Carbon Workspace
> Using the shared prompt, create a carbon project workspace with methodology/version selection, project boundary, baseline inputs, activity data, emission factors, calculation results, uncertainty, evidence coverage and review status. Clearly label methodology-aligned calculations as calculations, not issued carbon credits. Provide a path to validation/verification review.

### Registry Workspace
> Using the shared prompt, create a credential and registry console. Show eligibility, issuer trust root, approved verification, methodology version, quantity/unit, ownership, registry events, external references and retirement state. Transfer and retirement actions require visible authorization and audit context.

### Settlement Workspace
> Using the shared prompt, create a settlement operations console. Show eligible obligations/credentials, payer/payee, amount/currency, authorization reference, verification timestamp, execution, reconciliation, external reference and final outcome. Never show SETTLED unless authoritative persistence confirms it.

### Audit Explorer
> Using the shared prompt, create an audit explorer that reconstructs actor, organization, action, target, request ID, previous hash, event hash, payload summary and timestamp. Provide filters by geography, organization, lifecycle, evidence, verification, registry and settlement. Make the difference between tamper-evident audit records and external-system confirmations explicit.

## Stitch integration rules

- Do not place secrets, passwords, API keys or private integration credentials in prompts or generated frontend code.
- Generated screens must call the RupayKg API rather than embed operational data.
- UI labels must preserve backend truth states.
- Regulatory source records must show authority, instrument, publication/effective dates, status and source URL.
- Demo/simulated data, if used in design prototypes, must be visibly marked and must never be presented as production data.
