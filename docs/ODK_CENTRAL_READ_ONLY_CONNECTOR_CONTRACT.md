# ODK Central Read-Only Connector Contract

**RupayKg baseline:** PR #275 branch `infra/open-dpi-odk-credebl-poc-contracts`  
**Purpose:** Specify the first executable ODK integration boundary for synthetic/non-production testing.  
**Status:** Contract and source-backed API review; no connector implementation or live ODK credentials.

## 1. Critical authentication finding

ODK Central distinguishes Users from App Users:

- App Users can list forms, download form definitions and create submissions through OpenRosa endpoints. They cannot use the broader Central REST API to list and retrieve existing submissions and attachments.
- The ODK submission-management REST endpoints are required for RupayKg's pull-based ingestion.
- Therefore an App User token alone is **not** a valid credential for the proposed server-side read-only pull connector.

**PoC credential requirement:** a dedicated non-human ODK Central User account with the minimum project-scoped read permissions required to list submissions, read submission metadata and download expected attachments. Use a short-lived session bearer token obtained through the supported session flow; store the account secret in a secret manager and the session token only in process memory or a bounded secure cache. Do not use a global Central administrator. If Central's permission model cannot provide the required project scope, stop and redesign rather than widen permissions silently.

Do not use Basic auth; ODK discourages it. Do not use the App User URL prefix for the REST pull path. A separate App User may still be used by ODK Collect for its intended OpenRosa collection workflow.

## 2. Read-only API surface

All calls are HTTPS and pinned to a configured Central origin. The connector must reject non-HTTPS origins, redirects to a different host, unexpected content types, oversized responses and untrusted URL/path components.

| Purpose | ODK Central endpoint | Connector use |
|---|---|---|
| Session creation | `POST /v1/sessions` | Obtain bearer token using dedicated integration User credentials |
| List submissions | `GET /v1/projects/{projectId}/forms/{xmlFormId}/submissions` | Read submission metadata; request `X-Extended-Metadata: true` |
| Submission metadata | `GET /v1/projects/{projectId}/forms/{xmlFormId}/submissions/{instanceId}` | Read a specific submission's metadata |
| Submission attachments | `GET /v1/projects/{projectId}/forms/{xmlFormId}/submissions/{instanceId}/attachments` | Enumerate expected attachment files and whether Central has each |
| Attachment bytes | `GET /v1/projects/{projectId}/forms/{xmlFormId}/submissions/{instanceId}/attachments/{filename}` | Download bytes only after metadata validation |
| Revoke session | `DELETE /v1/sessions/current` | Revoke current integration session at end of run when appropriate |

The listing resource documents `limit` and `offset` parameters, while the same page's prose says submissions are returned as a complete set rather than offering normal incremental filtering. The connector must not assume a stable incremental cursor or change feed. Use bounded pages where supported, persist source identifiers and hashes, and periodically reconcile the full configured form inventory to detect edits/deletions.

ODK API reference: https://docs.getodk.org/central-api/  
Authentication: https://docs.getodk.org/central-api-authentication/  
Submission management: https://docs.getodk.org/central-api-submission-management/

## 3. Fixed configuration allowlist

Each connector instance must be bound to an administrator-approved immutable configuration record:

- Central base origin.
- Numeric Central project ID.
- Exact `xmlFormId`.
- Allowed form version(s), not a wildcard.
- RupayKg organization ID.
- RupayKg site/facility ID.
- Optional RupayKg activity mapping rule, reviewed and versioned.
- Allowed attachment MIME types and maximum bytes.
- Geospatial site boundary and approved tolerance.
- Effective-from / disabled-at timestamps.
- Configuration owner and approval reference.

Never take Central origin, project ID, form ID, organization ID, site ID, activity ID, tenant, or attachment URL from a submission body. Values in an ODK submission are untrusted content. The server resolves RupayKg organization/site/activity only from the fixed approved mapping.

## 4. Polling and reconciliation

1. Authenticate with the dedicated Central User; verify HTTPS and expected Central origin.
2. Enumerate only configured project/form pairs.
3. Request submission metadata with extended metadata enabled.
4. Validate response shape and bounds. Retain original instance ID, current-version instance ID, submitter actor ID/type where supplied, device ID, user agent, server-created timestamp, updated timestamp, deleted timestamp and Central review state.
5. Enumerate expected attachments for each submission. Do not infer attachment existence from form answers or OData media URLs.
6. Download each present attachment from the documented REST attachment route. Stream to bounded quarantine storage; never buffer unbounded content in memory.
7. Compute SHA-256 locally; preserve content length, response content type, filename, source route, fetch timestamp and any Central-provided metadata/hash separately. Never treat a remote hash or ETag as the locally recomputed SHA-256.
8. Create a deterministic source key from Central origin identity + project ID + xmlFormId + original instance ID + version instance ID + attachment filename. Hash canonical source metadata and bytes.
9. Same source key + same payload hash = idempotent replay. Same source key + different payload hash = source-version conflict; retain both source observations and quarantine for explicit resolution. Do not overwrite an existing evidence object.
10. Track deleted submissions and changed versions as tombstone/version events. Never silently erase prior RupayKg evidence or history.
11. Reconcile after interruptions; retry 429/5xx/network failures with bounded exponential backoff and jitter. Do not retry permanent 400/401/403 as if transient. On 401, refresh the session once; on repeated failure stop and alert. On 403 stop and flag permission drift.
12. End the run by revoking the current session where operationally appropriate. Rotate account secrets and review access regularly.

## 5. Quarantine record (logical contract only)

This is a transport/staging object, not a Neon table definition and not a proposed production migration.

```json
{
  "sourceSystem": "ODK_CENTRAL",
  "centralInstanceKey": "central-origin/project/form/original-instance/version-instance",
  "projectId": 42,
  "xmlFormId": "site_inspection_v1",
  "formVersion": "1.0.0",
  "originalInstanceId": "uuid:synthetic-submission-id",
  "versionInstanceId": "uuid:synthetic-version-id",
  "submitterActorId": 12,
  "submitterActorType": "user",
  "deviceId": "self-reported-device-reference",
  "userAgent": "ODK Collect",
  "centralCreatedAt": "2026-01-01T10:00:00Z",
  "centralUpdatedAt": null,
  "fetchedAt": "2026-01-01T10:05:00Z",
  "mappedOrganizationId": "approved-server-side-mapping",
  "mappedSiteId": "approved-server-side-mapping",
  "attachments": [
    {
      "filename": "photo.jpg",
      "centralPresent": true,
      "mediaType": "image/jpeg",
      "sizeBytes": 123456,
      "sha256": "locally-computed-64-character-hex",
      "quarantineObjectRef": "opaque-quarantine-reference"
    }
  ],
  "sourceReviewState": "approved",
  "rupayKgState": "QUARANTINED"
}
```

All values above are illustrative synthetic placeholders. The Central review state is provenance only and never sets RupayKg evidence to VERIFIED.

## 6. Quarantine security controls

- Dedicated read-only project-scoped Central User; separate Collect App User if needed.
- No public route to the quarantine store; access through authenticated RupayKg operator permissions.
- Tenant/site mapping is server-side and configuration-controlled.
- Attachment streaming with strict per-file and per-submission aggregate limits, MIME allowlist, extension-independent file signature checks, malware scanning before reviewer access, and archive/decompression protections.
- Treat XML, JSON, filenames, metadata, form labels and attachments as hostile input; escape rendered content and prevent path traversal, SSRF and XML external entity processing.
- Do not follow arbitrary URLs supplied by ODK payloads. Construct requests only from validated route segments and the configured Central origin.
- Encrypt in transit and at rest; record access and download audit events; minimize personal data and device identifiers.
- Define retention, deletion/tombstone, backup/restore and data-residency rules before any real-person data.
- Fail closed on unknown configuration, permission changes, malformed payload, missing attachments, hash mismatch, oversized content or unavailable malware scan.

## 7. Promotion boundary to existing Evidence Vault

Do not write directly to the current Evidence Vault from the initial connector.

Before promotion is implemented, RupayKg must add and test a reviewed machine-to-machine identity with:
- one integration principal bound to an approved tenant and source configuration;
- only quarantine-ingest/promotion capabilities, no general user impersonation;
- revocation, expiry, rotation and audit;
- transaction-bound tenant context and existing organization/geography permission checks;
- explicit source idempotency and payload-hash conflict handling;
- no ability for the connector to set review/verification status;
- reviewer identity distinct from integration principal and original uploader.

Promotion must use the existing Evidence Vault's canonical upload/version and review paths after independent reviewer action. The integration must not insert directly into Neon or bypass API authorization.

## 8. Connector test matrix

| Test | Expected result |
|---|---|
| Valid scoped user session | Read-only configured project/form metadata |
| App User token used against REST submission list | Denied; test documents that App User is not sufficient |
| Wrong Central origin / redirect to other host | Rejected before credential forwarding |
| Unconfigured project or form | No request / fail closed |
| Malformed listing response | Quarantined error; no evidence promotion |
| Deleted submission | Tombstone event; prior evidence retained |
| Edited submission/version | New source-version observation; prior version retained |
| Attachment missing on Central | Incomplete package; quarantine, no promotion |
| MIME mismatch or hash mismatch | Reject attachment and quarantine submission |
| Oversized file / aggregate payload | Abort safely; bounded resource usage |
| Filename traversal or malicious XML | Reject safely; no path write or XXE |
| Same source key and same hash | Idempotent replay |
| Same source key and changed hash | Conflict; no overwrite |
| 401 once | Refresh once; bounded retry |
| 401 repeated / 403 | Stop and alert |
| 429 / 5xx / network interruption | Bounded retry, resumable reconciliation |
| Cross-tenant mapping attempt | Fail closed; no data disclosure |
| ODK reviewState=approved | RupayKg remains QUARANTINED |
| Missing malware scanner result | No reviewer exposure or promotion |
| Connector credential revoked | Further reads fail; no cached authorization |

## 9. Exit criteria before live data

- Exact ODK Central version and hosting topology pinned.
- Dedicated least-privileged read User and separate Collect App User policy reviewed.
- Synthetic project/forms created; no live personal or site data.
- Connector threat model, data-flow, privacy, retention and residency review approved.
- Quarantine storage, malware scan, size limits, audit and incident handling tested.
- Idempotency, versioning, deletion reconciliation and outage recovery tests pass.
- Independent security review completed.
- Explicit founder approval for any pilot using real field data.

No runtime code, database migration, credentials, deployment or production change is part of this contract.
