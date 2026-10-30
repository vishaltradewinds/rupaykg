# MRV Instrument Approval API — SHAKTI-HW-01

Status: Engineering implementation on a review branch. Not a production authorization.
Scope: Organization-scoped physical instruments used as sources for MRV observations.

## Core safety behavior

- Registration always creates a candidate in `HOLD`.
- A physical instrument is eligible only when its exact manufacturer/model/SKU revision, intended use, supported parameter-code mapping, MeitY evidence, required calibration evidence, and firmware/security lifecycle review have been independently checked and the record is `VERIFIED`.
- Every observation submitted through the MRV submission path must identify its source instrument. No-observation submissions, missing instrument IDs, unregistered instruments, non-VERIFIED status, expired evidence, or missing provenance fail closed with HTTP 409.
- Field-device identity verification is separate. It is not proof of a gateway, sensor, meter, analyser or weighbridge's product approval.
- The API records the reviewer attestation and evidence reference/hash; it does not independently certify that a MeitY certificate is genuine. The reviewer must verify the exact model and certificate scope against the official authority.

## Endpoints

### List instruments

`GET /api/v1/mrv/instruments?organizationId=<uuid>`

Requires organization-scoped `guardian:read`, `guardian:operate`, or field-device-management permission. Returns registered instruments and current evidence/status fields.

### Register a candidate

`POST /api/v1/mrv/instruments`

Example body (placeholder values only; do not treat them as an approved product):

```json
{
  "organizationId": "<organization-uuid>",
  "instrumentCode": "SITE-DEVICE-001",
  "instrumentType": "GAS_FLOW",
  "manufacturer": "<exact manufacturer from nameplate>",
  "model": "<exact model from nameplate>",
  "skuRevision": "<exact SKU/revision>",
  "intendedUse": "Landfill gas flow measurement",
  "measurementInstrument": true,
  "nonMeasurementReason": null,
  "supportedParameterCodes": ["gas_flow"],
  "interfaceProtocol": "Modbus RTU",
  "firmwareVersion": "<exact firmware version, if present>",
  "firmwareSupportUntil": "<ISO-8601 timestamp, if known>"
}
```

Returns HTTP 201 with `approvalStatus: HOLD`. Registration is not approval. Measurement instruments must declare at least one exact supported parameter code from the approved monitoring plan. Non-measuring hardware (for example, a gateway) must set `measurementInstrument: false`, provide a written `nonMeasurementReason`, and pass an empty `supportedParameterCodes` array; it cannot be used as the source instrument for a physical observation. Duplicate instrument codes within an organization return HTTP 409.

### Review a candidate

`POST /api/v1/mrv/instruments/<instrument-uuid>/review`

Every review requires `decision` (`VERIFIED`, `HOLD`, `EXPIRED`, or `REJECTED`) and a non-empty `note`. The review permission is organization-scoped. A different authorized identity must verify a candidate; self-approval is rejected by both the API and PostgreSQL guard.

To set `decision: VERIFIED`, include:

- `meityCertificateId`, `meityIssuer`, `meityCertificateScope`
- `meityVerificationUrl` — HTTPS official authority lookup or written confirmation
- `meityEvidenceReference` — reference to the immutable stored certificate/verification artifact
- `meityEvidenceSha256` — 64 hexadecimal characters, SHA-256 of that exact stored artifact
- `meityVerifiedAt` — timestamp of the human verification
- `meityValidityBasis` — `VALID_UNTIL` or `NO_EXPIRY_CONFIRMED`
- `meityValidUntil` — future timestamp when validity basis is `VALID_UNTIL`; omit/null for `NO_EXPIRY_CONFIRMED`
- `calibrationRequired` — explicit boolean

If `calibrationRequired: true`, also supply `calibrationStatus: VERIFIED`, `calibrationCertificateId`, `calibrationEvidenceReference`, `calibrationEvidenceSha256`, `calibrationLab`, `calibrationTraceability`, non-negative `calibrationUncertainty`, and future `calibrationValidUntil`.

If `calibrationRequired: false`, supply `calibrationStatus: NOT_APPLICABLE_WITH_JUSTIFICATION` and a written `calibrationNotRequiredReason`. This is only a calibration decision; it does not waive the MeitY requirement.

Firmware/security lifecycle:
- If the instrument has firmware, supply `firmwareVersion`, future `firmwareSupportUntil`, `securityReviewStatus: VERIFIED`, `securityEvidenceReference`, `securityEvidenceSha256` (64 hexadecimal characters), and `securityReviewedAt` (not future-dated).
- If it has no firmware, leave firmware support unset and supply `securityReviewStatus: NOT_APPLICABLE_WITH_JUSTIFICATION` plus a written `securityNotApplicableReason`.
- Missing or expired firmware/security evidence blocks eligibility.

A database guard rejects direct promotion to `VERIFIED` if the mandatory evidence is incomplete, expired, or inconsistent. Once verified, model identity and approval evidence are immutable; register a new instrument record for a model substitution. Status decisions are stored in append-only `mrv_instrument_decisions`.

### Read decision history

`GET /api/v1/mrv/instruments/<instrument-uuid>/decisions`

Requires organization-scoped read permission and returns append-only decision history with evidence snapshots.

## Measurement ingestion

Both the direct `POST /api/v1/activities/<activity-uuid>/measurements` endpoint and the sync `MEASUREMENT_CREATE` operation require `instrumentCode` and `parameterCode` in addition to value/unit/method/source/time. Each path resolves the instrument inside the activity's organization and runs the same exact-model approval, calibration, firmware/security and supported-parameter gate before writing. The measurement row stores `mrv_instrument_id` and `parameter_code`; the free-text `source` is descriptive only and is not proof of approval. An unregistered, expired, non-VERIFIED or out-of-scope instrument returns HTTP 409 with `eligibleForMrv: false`. Existing legacy measurement rows remain unlinked; they are not automatically promoted or backfilled as approved.

Example payload for the existing sync envelope's `MEASUREMENT_CREATE` operation:

```json
{
  "activityId": "<activity-uuid>",
  "value": 123.45,
  "unit": "m3/h",
  "method": "continuous-flow-meter",
  "source": "device telemetry channel 1",
  "measuredAt": "<ISO-8601 timestamp>",
  "instrumentCode": "SITE-DEVICE-001",
  "parameterCode": "gas_flow"
}
```

The sample is illustrative only. The `instrumentCode` and `parameterCode` must match a verified organization-scoped register entry; do not copy the placeholder values into production.

## Operational acceptance

1. Obtain the actual instrument nameplate, manual, interface documentation and site measurement-point details.
2. Verify the exact model and MeitY scope against the current official source; unresolved applicability or missing proof means HOLD.
3. Verify calibration traceability, uncertainty, due date and installation suitability where measurement calibration is required.
4. Preserve the original artifact in the approved evidence store; calculate SHA-256 over the stored artifact and record the immutable evidence reference.
5. Review firmware support and security lifecycle, or document why firmware is not applicable.
6. Execute the instrument-to-gateway, ingestion, replay, offline recovery, quality-flag, MRV reconciliation and negative tests.
7. Only after all gates pass may an authorized reviewer mark the record VERIFIED. No API response alone authorizes purchase or production deployment.

## Official references

- MeitY CRO FAQs: https://www.meity.gov.in/writereaddata/files/Modified-FAQs-CRO.pdf
- BEE BM WA03.001 methodology: https://beeindia.gov.in/sites/default/files/BM%20WA03.001.pdf
- BEE approved methodologies list: https://beeindia.gov.in/view_content.php?lang=1&lid=571
