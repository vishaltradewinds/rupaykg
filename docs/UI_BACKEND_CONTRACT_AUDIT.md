# RupayKG UI / Backend Contract Audit

## Purpose

This document records the current contract audit between the authoritative backend and the stakeholder UI. The current `main` application is the source of truth for UI behavior; the older `rupaykg-aistudio` repository remains contextual reference only.

## Authoritative lifecycle

The UI must represent this dependency chain without allowing downstream states to be asserted independently:

`Onboarding -> Activity -> Measurement -> Evidence -> Verification -> Compliance/EPR -> Calculation -> Environmental Claim -> Registry -> Transfer/Retirement -> Settlement/Reconciliation -> ESG/Regulatory Reporting`

The frontend currently models the lifecycle as generation, aggregation, measurement, transport, processing, evidence, verification, value eligibility, certification, registry, transfer, settlement and reporting. Backend responses remain authoritative for whether each stage is actually complete.

## Current UI/API contract

The main application currently consumes organization-scoped workspace APIs:

- `/api/v1/workspaces/resource-flows`
- `/api/v1/workspaces/mrv`
- `/api/v1/workspaces/compliance`
- `/api/v1/workspaces/carbon`
- `/api/v1/workspaces/registry`
- `/api/v1/workspaces/settlement`
- `/api/v1/workspaces/esg`
- `/api/v1/workspaces/intelligence`

It also consumes `/api/v1/auth/me`, `/api/v1/auth/exchange`, `/api/v1/auth/logout`, `/api/v1/overview`, and `/health`.

The UI must continue to treat the API as authoritative and must not derive regulatory, registry, settlement, Guardian, Hedera, or carbon certification claims from client-side counters alone.

## Governance integrity

Organization-owned legal-verification and statutory-applicability records are tenant data. Their foreign keys preserve organization lifecycle cleanup through `ON DELETE CASCADE`; this is a persistence-integrity rule and does not grant operational access or imply statutory approval.

## MRV / Guardian / Hedera boundary

The authoritative MRV routes expose:

- `/api/v1/mrv/status`
- `/api/v1/mrv/activities/:activityId/submit`
- `/api/v1/mrv/provenance/:activityId`
- `/api/v1/mrv/hedera/verify/:consensusTimestamp`

Guardian submission is accepted only after the backend verifies the activity, approved verification, VERIFIED evidence, organization permission, geography authorization, and required observations. Guardian must return `VERIFIED` with an authoritative execution ID. Hedera anchoring is then persisted as provenance.

Registry eligibility requires persisted provenance satisfying both:

- `guardian_status = VERIFIED`
- `hcs_status = CONSENSUS_CONFIRMED`

The UI must display these as **external trust/provenance states**, never as CPCB approval, CPCB certificate issuance, statutory authorization, or legal environmental-credit certification.

## Fail-closed UI rules

1. `NOT_CONFIGURED`, `UNAVAILABLE`, timeout, malformed provider response, missing execution ID, missing HCS transaction/consensus data, or failed verification must remain visibly unverified.
2. The UI must never manufacture Guardian execution IDs, Hedera transaction IDs, consensus timestamps, signatures, certificates, or regulatory acceptance.
3. Empty provenance means **not confirmed**, not success.
4. Local verification is distinct from Guardian verification and Hedera consensus.
5. EPR/ESG outputs must identify whether they are internal evidence/reporting artifacts or actually accepted/issued by the relevant authority.

## Stakeholder scope

The UI stakeholder model currently covers household/citizen, farmer, Safai Mitra, FPO/rural enterprise, ULB/municipal authority, municipal/bulk generator, collector/aggregator/transporter, processor/recycler/MRF, industrial/commercial/institutional generators, carbon project owner, MRV/assurance user, carbon/ESG buyer, EPR partner, CSR/ESG partner and regulator/public authority.

Server-side organization membership, permission, and geography checks remain the security boundary. Client-side role labels are presentation only.

## EPR / regulatory boundary

The UI may prepare and expose evidence-backed EPR obligations, quantities, certificates/transactions received from an actual external authority, and reporting readiness. It must not label an internal RupayKG record as a CPCB certificate or regulatory acceptance unless the external authority actually issued or accepted it.

For plastic EPR, source evidence and processor-side records must remain traceable to the applicable CPCB process and the relevant registered parties.

## Acceptance gates before deployment

1. Guardian provider contract tests pass.
2. CI for the latest `main` commit is green.
3. UI build/typecheck is green against the real backend contracts.
4. Stakeholder workspace authorization is verified for every domain.
5. MRV UI exposes local verification separately from Guardian/Hedera provenance.
6. EPR/ESG UI does not overstate statutory status.
7. Container/runtime verification is green.
8. Live Guardian + Hedera + required external authority acceptance is completed where applicable.
9. Cloud Run deployment is performed only after all preceding gates pass.
