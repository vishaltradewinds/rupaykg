# RupayKG Guardian / Hedera Integration Contract

## Purpose

RupayKG treats Hedera Guardian as a trust and policy execution rail for MRV evidence and environmental-asset lifecycle workflows. Guardian anchoring does not replace RupayKG's authoritative operational database, statutory reporting systems, verifier decisions, or CPCB/other regulator acceptance.

## Required provenance chain

`Activity -> Measurement -> Evidence -> Verification -> Calculation -> Guardian policy/evidence record -> Hedera anchoring -> Credential/claim -> Registry -> Settlement/Reporting`

Every Guardian-bound record must retain a RupayKG correlation identifier and the underlying evidence references. The UI must distinguish local authoritative state from externally anchored state.

## State rules

- `LOCAL_CAPTURED`: captured by field/operational workflow; not externally anchored.
- `SYNC_RECEIVED`: received by the authoritative backend; validation pending.
- `AUTHORITATIVE`: accepted by backend validation and persisted.
- `VERIFIED`: authorized verification decision recorded.
- `VALUE_ELIGIBLE`: all configured eligibility rules satisfied.
- `CERTIFIED/ISSUED`: credential/claim created by the appropriate authority or configured issuance service.
- `REGISTERED`: recorded in the applicable registry.
- `TRANSFERRED/RETIRED`: lifecycle event recorded with beneficiary/retirement evidence.
- `SETTLED`: financial/environmental-value reconciliation completed.
- `REPORTED`: included in an applicable stakeholder/statutory report.

Guardian/Hedera status is a separate dimension and must never be used to silently promote an operational record between these states.

## Fail-closed integration

If Guardian/Hedera credentials or the configured external service are unavailable, RupayKG must not fabricate transaction IDs, consensus timestamps, policy execution results, VC signatures, or immutable claims. External state must be labelled unavailable/pending and remain retryable.

## Indian compliance boundary

RupayKG may prepare evidence and reporting data for EPR/ESG/statutory workflows, but a platform-generated record must not be described as a CPCB certificate, statutory filing, regulator approval, or legal environmental credit unless the applicable authority has actually issued/accepted it.

For Plastic EPR, registry/reporting identifiers, processor evidence, transaction documents, quantities, and category information must remain traceable to the source evidence and the applicable CPCB process.

## Implementation acceptance gates

1. Canonical server-side Guardian adapter/provider boundary exists.
2. Every outbound request has a RupayKG correlation ID and idempotency key.
3. Responses are persisted with provider, policy/workflow identifier, external record/transaction identifier, status, timestamps, and evidence hash/reference where available.
4. Retries are bounded and idempotent; failures remain visible to operators.
5. Tests cover unavailable credentials, timeout, duplicate submission, malformed response, tampered evidence, and successful anchoring.
6. UI exposes provenance and external trust status without claiming statutory acceptance.
7. Live Guardian/Hedera acceptance remains a deployment gate and is not represented as complete by unit tests alone.

## Design principle

Guardian/Hedera is the verifiable trust rail; RupayKG remains the domain system of record for operational activity, evidence, verification, compliance orchestration, reconciliation, and reporting.
