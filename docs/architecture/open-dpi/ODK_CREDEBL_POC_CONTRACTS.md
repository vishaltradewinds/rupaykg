# RupayKg Open Digital Infrastructure POC Contracts — ODK and CREDEBL

**Status:** Design-only; no runtime integration approved  
**Baseline:** main at 934062ef8af2ca47bbcbf5e37c12de12a4f9f743 (2026-11-04)  
**Scope:** ODK field capture and CREDEBL verifiable credentials  
**Environment:** disposable/non-production only  
**Production posture:** HOLD

## 1. Non-negotiable architecture rules

1. RupayKg remains the system of record for organisations, tenants, facilities, activities, evidence, MRV calculations, approvals, compliance submissions and audit history.
2. Neon remains the single authoritative RupayKg database. Neither ODK nor CREDEBL may become a second RupayKg source of truth.
3. External platforms are bounded providers behind RupayKg-owned adapters. No external service receives direct database credentials.
4. No cross-tenant access; every imported object is resolved to an existing RupayKg tenant and authorised facility using server-side verified mappings.
5. Ingestion is untrusted until validated. External submission, credential issuance or signature validity never implies statutory approval, MRV acceptance or carbon-credit issuance.
6. Production migrations, production credentials, RLS changes, deployment, worker activation and certification remain prohibited under this POC.

## 2. POC objectives and exclusions

### ODK objective
Demonstrate offline-capable field capture for SITE-JBP-01 (Kathonda) covering facility inspection, waste/material observations, equipment checks, geolocation and photo evidence. The trial must prove export/import integrity, duplicate handling, evidence provenance and human review.

### CREDEBL objective
Demonstrate issuance, presentation and verification of a narrowly scoped test credential for a facility or field operator. The trial must prove issuer trust configuration, holder binding, signature verification, status/revocation handling and auditable verification output.

### Explicit exclusions
- No real personal Aadhaar data or unnecessary personal data.
- No direct write into RupayKg production.
- No automatic approval of evidence, organisations, facilities, validators or projects.
- No carbon-credit issuance or statutory certification.
- No new authoritative identity, organisation or facility registry.
- No ledger/blockchain requirement for this POC.
- No assumption that public demo endpoints are secure or production-grade.

## 3. Trust boundaries

| Boundary | Trusted for | Not trusted for |
|---|---|---|
| ODK Collect/Central | Capturing submitted form payloads and attached files | Correctness, completeness, legal admissibility or MRV approval |
| CREDEBL issuer | Issuing a credential under a configured issuer key | Truth of claims unless backed by independently verified RupayKg evidence |
| CREDEBL verifier | Cryptographic and status verification result | RupayKg tenant authorisation or statutory approval |
| RupayKg adapter | Authentication, mapping, validation, idempotency and audit | Replacing independent review |
| RupayKg reviewer / authority workflow | Explicit decisions within assigned scope | Actions outside verified organisation/geography/permission scope |

## 4. ODK contract

### 4.1 Proposed data flow

1. RupayKg POC administrator creates a dedicated ODK project and test form outside production.
2. Form is versioned and contains a RupayKg-generated opaque capture reference, SITE-JBP-01 facility reference, observation time, observer role reference, structured measurements, GPS where justified, and evidence attachments.
3. Field operator downloads the form and captures data offline.
4. ODK synchronises to the isolated ODK Central instance when connectivity is available.
5. RupayKg ODK adapter authenticates to ODK Central using a dedicated least-privilege service identity and retrieves only the configured project/form submissions.
6. Adapter stores the raw source payload and attachment digests in a quarantine/import staging area, not in approved MRV records.
7. Schema, facility mapping, units, timestamps, coordinates, attachment hashes, duplicates and required fields are validated.
8. A RupayKg reviewer inspects the submission and explicitly accepts, rejects or requests correction.
9. Only accepted evidence is linked to the appropriate RupayKg activity under existing tenant and evidence controls.

### 4.2 Canonical RupayKg import envelope

The following is a logical contract, not an existing API or database schema. Map it to existing RupayKg types after repository review; do not create duplicate tables or migrations merely to match these names.

```json
{
  "source": {
    "system": "odk",
    "instance_id": "configured-instance-id",
    "project_id": "external-project-id",
    "form_id": "external-form-id",
    "form_version": "immutable-version",
    "submission_id": "external-submission-id",
    "submitted_at": "RFC3339 timestamp",
    "source_payload_sha256": "hex digest"
  },
  "mapping": {
    "rupaykg_tenant_id": "server-resolved-id",
    "facility_id": "server-resolved-facility-id",
    "site_code": "SITE-JBP-01"
  },
  "capture": {
    "capture_reference": "opaque-rupaykg-reference",
    "observed_at": "RFC3339 timestamp",
    "observer_reference": "pseudonymous-reference",
    "form_schema_version": "controlled-version",
    "measurements": [],
    "location": {
      "latitude": null,
      "longitude": null,
      "accuracy_m": null,
      "captured_at": null
    },
    "attachments": [
      {
        "source_file_id": "external-file-id",
        "sha256": "hex digest",
        "media_type": "validated-media-type",
        "byte_length": 0
      }
    ]
  },
  "ingestion": {
    "idempotency_key": "stable-source-submission-key",
    "received_at": "RFC3339 timestamp",
    "validation_status": "quarantined",
    "review_status": "pending"
  }
}
```

The adapter must resolve tenant and facility references from a RupayKg-controlled mapping. It must reject client-supplied tenant IDs as authority. The example is illustrative; do not persist the literal nulls or placeholder strings as accepted data.

### 4.3 ODK API interaction rules

- Use the supported ODK Central API documented for the exact deployed release; do not guess or hard-code undocumented routes.
- Pin the Central release and API contract used by the POC.
- Use a dedicated API identity/token, secret manager storage and rotation; never embed credentials in mobile forms, browser bundles, repository files or logs.
- Restrict access to the single POC project and required forms/submissions.
- Prefer incremental retrieval where supported, but periodically reconcile source submission IDs and digests to detect missed updates.
- Fetch attachments through documented APIs, enforce size/type limits, scan files, compute SHA-256 independently and retain source identifiers.
- Treat edited/finalised submission semantics and server timestamps according to the pinned ODK version; preserve original source timestamps and ingestion timestamps separately.
- Apply rate limits, bounded retries with exponential backoff and dead-letter/manual reconciliation for permanent failures.
- Use a unique idempotency identity based on ODK instance + project + form + submission ID. A repeated delivery must not create a second evidence record.
- Never assume GPS is accurate merely because a coordinate is present. Preserve accuracy and capture time; flag implausible or missing values for review.

### 4.4 ODK acceptance tests

- Offline capture, app restart, delayed sync and successful eventual sync.
- Same submission imported twice produces one logical import.
- Changed/revised submission is detected and versioned without overwriting immutable prior evidence.
- Wrong project/form, unknown facility, cross-tenant reference and malformed payload are rejected.
- Missing units, invalid ranges, stale timestamps and impossible coordinates are flagged.
- Attachment digest mismatch, oversized file, unsupported media and malware test are rejected/quarantined.
- Token expiry/revocation, Central outage, timeout, rate limit and retry exhaustion behave safely.
- Audit trail identifies source, import attempt, validation result, reviewer and final decision.
- No ODK credential can access unrelated projects.

## 5. CREDEBL contract

### 5.1 POC credential type

Use a synthetic test credential with minimal claims:

- credential type: `RupayKgFacilityTestCredential`
- issuer: POC-controlled test issuer identifier
- subject: opaque RupayKg facility reference
- claims: credential schema version, facility reference, issuer reference, issued-at, valid-from, expiry and a reference/digest to the independently approved evidence package
- status: revocation/status mechanism supported by the pinned CREDEBL profile

Do not place sensitive personal data, raw evidence, exact operational measurements or confidential tenant information in the credential. Prefer a signed reference and digest to RupayKg-held evidence.

### 5.2 Issuance eligibility

RupayKg must authorise issuance before calling CREDEBL. The adapter must require:
- authenticated and non-suspended issuer identity;
- verified issuer organisation membership;
- explicit credential-issuance permission scoped to the relevant organisation/facility;
- an existing RupayKg facility record in an eligible state;
- a completed, immutable approval decision by an authorised reviewer;
- a policy version and evidence digest captured in the issuance audit.

CREDEBL must not decide RupayKg membership, tenant scope, facility eligibility or statutory approval.

### 5.3 Verification contract

A verification response must distinguish:
- cryptographic proof valid/invalid;
- issuer trusted/untrusted;
- credential schema supported/unsupported;
- holder binding valid/invalid/not applicable;
- credential status active/revoked/suspended/unknown;
- validity period valid/expired/not-yet-valid;
- RupayKg facility mapping found/not found;
- RupayKg authorisation allowed/denied;
- RupayKg evidence/approval current/stale/unknown.

A successful cryptographic verification is not an approval decision. RupayKg must independently check its current facility status, tenant, permissions, approval snapshot and evidence state.

### 5.4 CREDEBL integration rules

- Pin exact CREDEBL release, deployment manifest, credential format, DID method, cryptographic suite and API specification.
- Verify the actual licence for every deployed component. The inspected root LICENSE is Apache-2.0 while root package metadata says MIT; resolve this discrepancy with maintainers/legal review before adoption.
- Prefer standards-based W3C VC Data Model 2.0 and a supported proof format. Do not treat draft standards as final.
- Test issuer key custody, rotation, backup, recovery and revocation. Private keys must never be stored in RupayKg application tables or source control.
- Verify credentials locally or through a controlled verifier endpoint using pinned trust configuration. Do not accept an arbitrary issuer or DID document.
- Bind credentials to a subject/facility using the selected format's supported holder-binding method. Document privacy and correlation risks.
- Store credential ID, issuer, schema/version, status reference, digest, issuance/revocation timestamps and verification audit in existing RupayKg structures where suitable. Do not create a parallel identity registry.
- Fail closed when issuer trust, status, key resolution, schema, tenant mapping or approval status is unavailable.
- Do not write to a public ledger or enable HCS as part of this POC.

### 5.5 CREDEBL acceptance tests

- Valid credential from approved test issuer passes cryptographic verification.
- Tampered payload, altered proof, wrong issuer and untrusted key fail.
- Revoked, expired, not-yet-valid and unknown-status credentials fail closed or return an explicit indeterminate state.
- Unsupported schema/format and invalid holder binding are rejected.
- Credential for a facility in another tenant cannot disclose or authorise access.
- Revoked RupayKg issuer membership or withdrawn facility approval blocks issuance and any RupayKg-authorised action.
- CREDEBL outage, DID/key resolution outage and status service outage do not produce a positive approval.
- Key rotation and compromise/revocation procedures are tested.
- Credential contains no prohibited personal or confidential data.
- Full issuance and verification audit is reproducible.

## 6. Security and privacy controls

| Control | Required behaviour |
|---|---|
| Tenant binding | Resolve from authenticated server-side context and verified mapping; reject caller-selected tenant scope |
| Authentication | Separate service identities for ODK and CREDEBL adapters |
| Authorisation | Explicit permission keys; no role-name fallback |
| Secrets | Secret manager, rotation, least privilege, no logs or client exposure |
| Network | TLS; egress allowlist to pinned service endpoints |
| Payloads | Schema validation, size limits, media validation, malware scanning |
| Integrity | SHA-256 for raw payloads and attachments; preserve source IDs |
| Idempotency | Stable external source key; duplicate/replay-safe ingestion |
| Audit | Append-only event history for import, verification, issuance and human decisions |
| Privacy | Data minimisation, retention policy, purpose limitation and access logging |
| Failure | Fail closed for trust and authorisation; quarantine uncertain evidence |
| Operations | Health checks, metrics, bounded retries, alerting and manual reconciliation |

## 7. POC deployment topology

- Isolated ODK Central and CREDEBL instances, preferably disposable and separate from production.
- RupayKg adapter runs in a non-production environment using test credentials.
- Dedicated test organisation and SITE-JBP-01 synthetic records; do not use live personal data.
- Network policy permits only required adapter-to-provider connections.
- No shared production database credentials and no provider access to Neon.
- Synthetic key material and test issuer only.
- Export test evidence and logs for independent review; destroy test secrets and data under a documented teardown plan.

## 8. Exit criteria and decision gates

A POC may pass only when all of the following are evidenced:
1. Exact source versions, licences, deployment manifests and API contracts recorded.
2. All acceptance tests above pass with reproducible logs.
3. No cross-tenant access or unauthorised issuance path exists.
4. Duplicate, replay, outage and recovery cases pass.
5. Field users can complete offline capture and safely synchronise.
6. Evidence provenance and human review are retained end-to-end.
7. Security, privacy, data retention, hosting cost and support responsibilities are reviewed.
8. Independent security reviewer signs the POC report.

A POC pass authorises only a separate integration design review. It does not authorise production rollout, production schema changes, RLS changes, worker activation, statutory claims, carbon-credit issuance or TRL advancement.

## 9. Open questions to resolve before implementation

- Which ODK Central version and supported authentication model will be pinned?
- Does the deployed ODK release expose all required form, submission, attachment and revision metadata through documented APIs?
- Which CREDEBL release and credential profile will be selected, and is the Apache-2.0/MIT metadata discrepancy resolved?
- Which W3C VC 2.0 proof format and status mechanism are supported end-to-end by that release?
- Which existing RupayKg evidence and facility entities can represent the import envelope without schema duplication?
- What are the field retention, consent/notice, location precision and photo redaction requirements for the Kathonda pilot?

## 10. Source repositories

- ODK Central: https://github.com/getodk/central
- ODK Collect: https://github.com/getodk/collect
- ODK documentation: https://docs.getodk.org/
- CREDEBL platform: https://github.com/credebl/platform
- CREDEBL documentation: https://docs.credebl.id
- W3C VC Data Model 2.0: https://www.w3.org/TR/vc-data-model-2.0/

---
**Shakti Standards disposition:** design baseline only. Engineering, independent security review, operational validation, regulatory acceptance and field validation remain separate gates.
