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

Every review requires `decision` (`VERIFIED`, `HOLD`, `EXPIRED`, or `REJECTED`) and a non-empty `note`. The review permission is organization-scoped and is required even if the requester registered the candidate.

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


## Evidence-vault binding (required for VERIFIED)

The review payload must include exact evidence artifact-version IDs from the reviewed evidence vault:
- `meityEvidenceArtifactVersionId` — required for every VERIFIED instrument.
- `calibrationEvidenceArtifactVersionId` — required when calibration is required; must be absent when calibration is formally not applicable.
- `securityEvidenceArtifactVersionId` — required for firmware-enabled instruments; must be absent when firmware is formally not applicable.

The supplied SHA-256 value must match the referenced artifact version. PostgreSQL recomputes SHA-256 from the stored bytes, verifies byte length, checks the evidence row is VERIFIED, checks an APPROVED independent review exists, and requires the artifact to belong to the instrument's organization. A free-text reference or syntactically valid hash is not sufficient. Any mismatch fails closed.

## Parameter specifications (required before measurement instruments can be VERIFIED)

While an instrument is in HOLD, use `POST /api/v1/mrv/instruments/{instrumentId}/parameter-specs` with an organization-authorized reviewer. Example:

```json
{
  "specs": [
    {
      "parameterCode": "gas_flow",
      "unit": "m3/h",
      "minimumValue": 0,
      "maximumValue": 500,
      "resolution": 0.1,
      "accuracyAbsolute": 0.5,
      "accuracyBasis": "Manufacturer datasheet accuracy at stated operating conditions",
      "uncertaintyUnit": "m3/h",
      "sourceReference": "Reviewed manufacturer datasheet artifact",
      "sourceEvidenceArtifactVersionId": "<reviewed-evidence-artifact-version-uuid>"
    }
  ]
}
```

Each supported measurement parameter must have at least one structured specification containing an exact canonical unit, minimum and maximum values, resolution, accuracy metadata, accuracy basis and a sourceEvidenceArtifactVersionId referencing a reviewed/approved same-organization vault artifact. Absolute accuracy and uncertainty are expressed in that exact unit; if uncertaintyUnit is supplied, it must exactly equal unit. Read the saved specifications with `GET /api/v1/mrv/instruments/{instrumentId}/parameter-specs`. No implicit unit conversion is performed. A verified instrument's specifications are immutable; a changed model or measurement specification requires a new instrument record and review.

Direct and field-sync measurement ingestion, plus the MRV submission path, check the exact parameter/unit specification, range, resolution and accuracy metadata. PostgreSQL repeats the critical range/unit/resolution check at write time. Missing specifications, unit mismatch, out-of-range values or unsupported precision fail closed. These controls do not replace physical calibration, site acceptance, methodology eligibility or independent verification.


## Evidence review revocation and replacement

Evidence-vault reviews are append-only. An authorized independent reviewer may submit a later `REJECTED` decision for an artifact that was previously `VERIFIED` when new information invalidates the evidence. The API updates the evidence status to `REJECTED` and appends the decision; instrument eligibility checks consult the latest review, so linked instruments fail closed on subsequent use. A rejected artifact version is terminal: upload a new immutable version and obtain a new independent review rather than re-approving the rejected version. A `VERIFIED` artifact cannot receive another `APPROVED` decision on the same version.

Review ordering uses a monotonic database sequence after the timestamp so later decisions remain authoritative even when multiple review records share the same PostgreSQL transaction timestamp. Revocation does not rewrite historical measurements or prove that past credits should be reversed; it blocks subsequent eligibility and requires an authorized audit/reconciliation decision for any affected historical claim.


## Physical-unit identity additions — 2026-10-31

Instrument registration now requires:
- `manufacturerSerialNumber` for every measurement instrument;
- `manufacturerSerialNumber` or an organization-controlled `assetTag` for non-measuring hardware.

When a measuring instrument is approved with `calibrationRequired: true`, the reviewer must supply `calibrationSerialNumber` and it must exactly match the registered `manufacturerSerialNumber`. When calibration is declared not required, `calibrationSerialNumber` must be absent and the existing written rationale remains mandatory.

The database enforces organization-scoped manufacturer/serial uniqueness, asset-tag uniqueness, calibration-certificate serial equality, immutable physical identity after first VERIFIED decision, and physical-unit identity on measurement insert/update. This proves data consistency only; a human reviewer must still inspect the actual instrument nameplate and calibration certificate. No synthetic test serial is a real hardware record.
