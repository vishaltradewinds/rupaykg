# RupayKg reporting API contract

## Scope

The first common reporting increment exposes an internal SWM 2026 preview and CSV export. It reads existing PostgreSQL records and does not create a statutory filing, certification, assurance opinion, or external portal submission. Preview requests are not persisted as report runs in this increment.

## Endpoints

### JSON preview

`GET /api/v1/reports/swm-2026/preview`

Required query parameters:

- `periodStart`: inclusive ISO date (`YYYY-MM-DD`)
- `periodEnd`: inclusive ISO date (`YYYY-MM-DD`), on or after `periodStart`
- `context`: `urban` or `rural`

Optional query parameter:

- `geographyId`: UUID inside the active organization's verified geography scope

Example:

`/api/v1/reports/swm-2026/preview?periodStart=2026-04-01&periodEnd=2026-04-30&context=urban`

### CSV download

`GET /api/v1/reports/swm-2026/preview.csv`

Uses the same query parameters and authorization as the JSON preview. The response includes a CSV attachment plus `x-rupaykg-report-status` and `x-rupaykg-report-hash` headers.

## Authentication and tenant boundary

- Requires the authenticated RupayKg session and a verified active organization membership.
- Requires `reports:read` or `swm:read` permission for the active organization.
- All report reads run inside `withTenantTransaction`, which establishes the non-BYPASSRLS runtime role and authenticated request context.
- Optional geography filters are checked with the organization's geography-scope predicate.
- The active organization header is `X-RupayKG-Organization-Id`; the server remains authoritative for membership and permissions.

## Source records

The preview reads:

- `activities` and their `geography` relationships
- `measurements` attached to those activities
- `evidence` attached to those activities or measurements
- latest `verifications` for each evidence record
- `resource_flows` in the same organization, reporting period, and Urban/Rural geography rail
- `chain_of_custody_links` attached to those flows, including sequence, actor organization reference, quantity, handover geographies, linked evidence, and latest verification

The preview is capped at 500 activities, 500 declared material flows, and 500 custody links. The response sets `truncated: true` when any of the caps is exceeded. Narrow the date range or geography before treating the extract as complete.

## Data-quality and report states

- `BLOCKED`: at least one missing value or disputed value.
- `DRAFT`: declared or estimated values, missing evidence, missing verification references, unverified evidence, unmapped stakeholder attribution, or unavailable source revision remain unresolved.
- `READY_FOR_REVIEW`: required source, evidence, verification and stakeholder attribution checks pass. This means internal review-ready only; it is not an external approval or assurance result.

Evidence is not considered verified solely because a client supplies a status. The snapshot requires evidence ID, content hash, verification record ID, and an accepted verification decision/status. Unknown stakeholder roles remain `OTHER`/`UNMAPPED`; the report does not infer Generator, Aggregator, Transporter, Recycler, or Processor identity from free-text activity types or an actor organization ID alone.

Declared `resource_flows.declared_quantity` values remain explicitly `DECLARED`; they are not represented as independently measured quantities. The methodology code/version in this increment identifies an internal reporting template, not an official CPCB-approved calculation methodology.

## Provenance and export

Every snapshot includes a schema version, report type, organization, reporting period, Urban/Rural mode, internal methodology version, source revision, generation timestamp, source record IDs, evidence hashes, data-quality issues, assumptions, and a deterministic SHA-256 snapshot hash. CSV preserves the corresponding row, field, unit, quality, source, evidence, verification, and stakeholder-attribution fields. CSV text fields are escaped against spreadsheet formula injection.

## Immutable report-run history

- POST /api/v1/reports/swm-2026/runs persists a report snapshot only when the caller supplies the exact preview hash and generation timestamp. The server rebuilds the snapshot in the same tenant scope and returns 409 REPORT_PREVIEW_STALE if source data changed.
- GET /api/v1/reports/runs?reportType=CPCB_SWMP_2026&limit=20 lists the active organization's recent saved runs.
- GET /api/v1/reports/runs/:runId retrieves the immutable stored snapshot.
- GET /api/v1/reports/runs/:runId.csv exports the stored snapshot rather than recalculating current source data.
- Migration 108_reporting_run_history.sql creates report_runs with forced RLS, organization/creator checks, and runtime SELECT/INSERT privileges only. The runtime role has no update/delete grant, making saved snapshots append-only through the application.
- Custody-link read policy now allows the verified owner of a resource flow to read its attached custody sequence while preserving the actor-organization policy.

## Not yet included

- PDF and XLSX adapters
- authoritative Generator â†’ Aggregator â†’ Transporter â†’ Recycler relationship resolution and mass-balance reconciliation
- EPR and BRSR adapters
- external CPCB submission, receipt, acceptance, certification, or assurance integrations

These remain separate acceptance-gated increments. No production database migration or deployment is part of this API foundation.
