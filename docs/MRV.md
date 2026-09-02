# Digital MRV

MRV records the chain from measured physical activity to a verifiable environmental claim.

## Required chain
`Activity -> Measurement -> Evidence -> Verification -> Calculation -> Credential`

Every material quantity used in an MRV calculation must identify:
- source activity
- measurement method and unit
- measurement timestamp
- actor/device/source
- geography where applicable
- evidence references
- quality/review state

Verification decisions must be attributable to an authorized verifier and include scope, decision, timestamp and rationale.

Audit records should be tamper-evident and cryptographically anchored where configured. Do not describe a record as immutable unless the implementation actually provides that guarantee.

External sources are labeled as external and unavailable data is never silently replaced by synthetic operational data.
