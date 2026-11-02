# RupayKg stakeholder pilot demonstration readiness plan

**Status:** Demonstration planning baseline — NOT a pilot certification, production approval, or TRL 9 claim.  
**Canonical application:** this repository.  
**Data posture:** synthetic/demo tenant and synthetic evidence only until a separately approved pilot site, organizations, lawful data-sharing basis, and live integrations are validated.

## 1. Demonstration objective

Present one coherent end-to-end waste-to-carbon operating journey to national/state/district authorities, ULBs, waste generators and producers, collection/processing organizations, independent verifiers, carbon-market/registry stakeholders, and finance/settlement stakeholders.

The demo must distinguish:
- **Operationally demonstrated:** screens and workflows that execute against the demo environment.
- **Simulated:** explicitly labelled synthetic records, mock external responses, or sandbox-only integrations.
- **Not yet proven:** live statutory acceptance, actual field-device evidence, Guardian policy execution, Hedera consensus and Mirror Node verification, independent validation, issuance eligibility, or external bank settlement.

No synthetic record may be presented as a real government approval, verified environmental outcome, issued credit, or settled payment.

## 2. Stakeholder dashboard and capabilities

| Stakeholder | Dashboard must show | Demonstration actions | Authority boundary |
|---|---|---|---|
| National/platform administrator | National portfolio, state/district coverage, organization onboarding, exception queue, audit trail, integration health | Configure demo tenant, view national roll-up, inspect audit evidence | Platform administration is not statutory approval |
| State regulator | State-level activity, district coverage, pending reviews, compliance exceptions | Review in-scope applications and inspect district evidence | Only authorized verified state authority can act within its verified scope |
| District authority | District facility/ULB coverage, application queue, field exceptions | Inspect local evidence and progress eligible review chain | No cross-district action without verified scope |
| ULB / local body | Ward/zone collection, weighbridge receipts, processing destinations, service-level exceptions | Register collection batch, record transfer, reconcile weights | Local-body authority must match verified geography and organization type |
| Waste generator / producer / PRO | Waste obligations, EPR returns, evidence completeness, acknowledgements, exceptions | Create a sample return, attach evidence, inspect status | No claim of CPCB portal acceptance unless real integration receipt exists |
| Collector / aggregator | Pickup schedule, source/destination, material category, weight, custody events | Record pickup, weigh-in/out, chain-of-custody handoff | Field data is not independently verified until review |
| Processor / facility | Incoming/outgoing material, recovery/reject streams, process evidence, mass balance | Accept transfer, record processing output and rejects | Facility membership and geography must be verified |
| Independent verifier | Assigned evidence, source traceability, conflicts, review decisions | Review sample evidence, approve/reject within scope | Verifier cannot verify own activity; independent authorization required |
| Carbon / methodology reviewer | Methodology version, applicability, parameters, calculation trace, exclusions and uncertainty | Inspect calculation and evidence lineage | Calculation preview is not a credit or statutory emission reduction |
| Registry / market participant | Credential eligibility, provenance, ownership history, transfer restrictions | Inspect simulated credential lifecycle | No real issuance/transfer until all MRV, Guardian, HCS and registry gates pass |
| Finance / settlement counterparties | Settlement lifecycle, payer/payee consent, external reference, reconciliation evidence | Walk through sandbox settlement and failed-state handling | No real payment or settled state without external authority confirmation |
| Auditor / assurance | Immutable evidence, event history, approvals, exceptions, data lineage | Export/read audit pack and trace one record end-to-end | Audit visibility does not confer operational approval rights |

## 3. One end-to-end demo scenario

Use a clearly labelled synthetic scenario with one district, one ULB, one collection organization, one processing facility, one producer/PRO, one independent verifier, and one sandbox settlement counterparty.

1. Platform administrator opens the demo tenant and selects the district.
2. ULB records a collection batch with source geography, material category, timestamp, measured weight and responsible organization.
3. Collector records custody handoff; processor acknowledges receipt and records recovered/rejected quantities.
4. System presents mass-balance and evidence-completeness checks; missing/invalid evidence remains an exception.
5. Producer/PRO creates a sample EPR return and links supporting records; status is labelled DEMO/SANDBOX.
6. Independent verifier sees only assigned, in-scope evidence and records a sample review decision; actor/verifier separation is enforced.
7. Carbon module displays methodology version, applicability, parameter inputs, calculation trace, uncertainty/exclusions and evidence references. The result is labelled estimate/demo until independent validation and applicable programme requirements are met.
8. Registry view demonstrates eligibility gates and append-only provenance. A simulated credential remains clearly labelled as non-production.
9. Settlement view demonstrates payer/payee authorization, external reference and reconciliation evidence using sandbox-only data.
10. Auditor opens a single trace from source batch through custody, processing, verification, calculation, registry and settlement, including rejected/exception states.

## 4. Required dashboard/navigation inventory

The UI acceptance checklist must verify that every role sees:
- Role-appropriate landing dashboard and navigation.
- Current organization, verified role and verified geography scope.
- Pending tasks, completed actions, exceptions and audit history.
- Empty, loading, unavailable, denied and error states with actionable explanations.
- Clear separation of statutory status, internal workflow status, sandbox state and external integration confirmation.
- Responsive layouts for desktop presentation and mobile field use.
- Keyboard navigation, visible focus, accessible labels, contrast, zoom and screen-reader semantics.

A dashboard is not considered functional merely because its route renders. Each action must have an authenticated backend handoff, authorization check, persisted state transition, audit event and negative-path test.

## 5. Release gates before stakeholder presentation

### Gate A — Demo environment isolation
- Dedicated demo tenant and isolated database/credentials; no production writes.
- Synthetic identities, organizations, geography and records visibly labelled.
- No production secrets, live payment actions, or unapproved external callbacks.
- Reset/seed script is deterministic and repeatable.

### Gate B — Role and data isolation
- Verified role + organization + geography scope required for every protected action.
- Cross-tenant and out-of-scope reads/writes denied.
- Verifier independence and two-custodian administrative controls tested.
- Bilateral settlement authority is tested independently from single-organization permissions.
- Audit and append-only provenance paths verified.

### Gate C — Stakeholder workflow completeness
- All roles in section 2 have a tested dashboard and at least one demonstrable workflow.
- No dead-end CTAs, inert controls, fake success messages or hidden errors.
- Every mutation has loading/success/failure feedback and a persisted result.
- Demo walkthrough can be repeated from a clean seed.

### Gate D — Evidence and integration truthfulness
- Each external integration has a real/sandbox/unavailable state label.
- Guardian, Hedera HCS, Mirror Node, CPCB/EPR portals, weighbridge/IoT and banking claims are backed by actual environment evidence.
- Mock responses are visibly labelled and cannot satisfy production issuance/settlement gates.
- Methodology and statutory mappings identify source, version, effective date, applicability and unresolved interpretation.

### Gate E — Operational presentation
- Desktop and mobile smoke tests; role-by-role walkthrough.
- Performance, error logging, backup/reset, support contact and incident fallback documented.
- Demo operator runbook and stakeholder-specific scripted journeys available.
- Known limitations and non-production boundaries disclosed in the presentation.

## 6. Current known blockers (must not be hidden)

- Production Neon baseline previously audited at 67 tables with 0/67 RLS enabled and no policies; production role posture is elevated. This blocks production certification until a reviewed tenant-isolation architecture, role split, migration, independent review and rollback plan are complete.
- Auth/tenant context integration is a foundation, not proven across all routes, workers, callbacks, database functions and linked objects.
- PR #192 CI remains failing in PostgreSQL acceptance: settlement credential guard setup fails on missing explicit ISSUE_CREDENTIAL authority; settlement reconciliation setup fails on verifier lacking VERIFY_EVIDENCE. Do not weaken database guards to pass tests.
- The new activity-scoped verifier migration is not yet fully assured until all fixture suites pass and positive/negative scope regression tests are present.
- UI parity PR #203 is draft. Its prior browser interaction check passed on the then-tested head, but backend sign-in/register handoff, accessibility and end-to-end role workflows remain open.
- Live pilot site onboarding, actual device/scale evidence, external statutory portal receipts, real Guardian/Hedera consensus proof and external settlement confirmation must be independently evidenced.
- Therefore production certification remains OFF/HOLD and TRL 9 is NOT established.

## 7. Immediate execution order

1. Restore CI acceptance without weakening security: repair settlement fixtures against actual role permissions and use the same canonical membership fixture helper; ensure helper is idempotent and does not bypass or claim to test the real dual-control onboarding path.
2. Add dedicated verifier-scope positive/negative PostgreSQL tests and complete migration compatibility checks.
3. Complete route-to-data authorization inventory and tenant-isolation design; do not enable RLS indiscriminately on all tables.
4. Establish an isolated demo environment and deterministic synthetic seed; do not reuse production Neon for demo data.
5. Map every stakeholder dashboard route to backend API, permission, data source, mutation, audit event and test.
6. Implement/verify the missing workflow actions, starting with onboarding, collection/custody, processing/mass-balance, EPR return, evidence review, MRV calculation, registry and sandbox settlement.
7. Run role-by-role end-to-end browser walkthroughs, accessibility and responsive checks.
8. Produce demo operator runbook, stakeholder-specific scripts, evidence pack and limitations slide.
9. Only after independent review, founder-approved release checklist and a real pilot site/data basis, consider any live pilot activation. Production database migrations and deployment require separate explicit approval.

## 8. Acceptance criteria for “pilot demonstration ready”

- All stakeholder roles listed in section 2 can sign in using demo identities and land on the correct dashboard.
- At least one complete synthetic end-to-end journey is persisted and auditable.
- Every demonstrated mutation is backed by an API authorization check and a passing test.
- Cross-organization and cross-geography access denial is demonstrated.
- All external/sandbox boundaries are visible in the UI and presentation.
- No P0/P1 security finding is open in the demo surface; no production secret or real personal data is used.
- Clean reset and repeatable rehearsal pass.
- The demo is explicitly described as a controlled demonstration, not a certified national platform or TRL 9 system.
