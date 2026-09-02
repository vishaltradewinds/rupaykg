# RupayKg production target

RupayKg is India's circular-economy operating system for urban and rural resource flows. The production target is one authoritative national data model with geography-aware authorization, offline field capture, evidence-backed MRV, compliance, carbon accounting, environmental credentials, registry operations, governed settlement and reporting.

## Non-negotiable truth model

`LOCAL_CAPTURED -> SYNC_RECEIVED -> AUTHORITATIVE -> VERIFIED -> VALUE_ELIGIBLE`

A local/offline record is not authoritative. Authoritative persistence is not verification. Verification is not financial settlement. The UI must expose these states distinctly.

## End-to-end lifecycle

`GENERATE -> AGGREGATE -> MEASURE -> TRANSPORT -> PROCESS -> EVIDENCE -> VERIFY -> CALCULATE VALUE -> CERTIFY/ISSUE -> REGISTRY -> TRANSFER/RETIRE -> SETTLE -> REPORT`

Every value-bearing transition requires the appropriate upstream evidence, authorization and authoritative persistence.

## Offline operating contract

Field devices may capture activities, measurements, evidence and resource-flow events without connectivity. Each envelope carries a stable device identity, monotonic client sequence, capture timestamp and idempotency key. Synchronization is replay-safe and conflict-aware.

Offline clients must never:

- approve verification;
- declare regulatory compliance;
- issue or transfer a credential;
- claim carbon/EPR value as verified;
- mark money as settled; or
- bypass organization/geography authorization.

The server remains the source of truth. Conflicts remain explicit until resolved by an authorized workflow.

## Geography

The authoritative hierarchy supports India -> State/UT -> District -> Sub-district -> ULB or Gram Panchayat/cluster -> Ward/locality or village/cluster. Urban and rural operating workflows share the same underlying lifecycle while allowing different collection and processing patterns.

Organizations are expected to operate within configured geography scopes. No UI or API should infer authorization from a client-selected geography.

## Settlement truth

Internal workflow state is never proof that funds moved. A settlement can become `SETTLED` only after an external settlement reference, external-authority confirmation timestamp and reconciliation reference are present. Confirmation data is retained and cannot be cleared.

## AI and reporting

AI findings are advisory and source-grounded. They cannot mutate authoritative operational state. Reports must distinguish authoritative, verified, pending, unavailable, simulated and demo information.

## UI/UX target

The operating UI is designed for national/state/district administration, ULBs, Gram Panchayats, field workers, generators, collectors, processors, MRV/verifiers, EPR/compliance teams, carbon teams, registry/settlement operators, auditors and enterprise reporting users. Desktop consoles and low-connectivity mobile workflows consume the same API contracts.

Google Stitch is used for design exploration and developer handoff through `DESIGN.md`; it is not treated as an authoritative backend or account integration.
