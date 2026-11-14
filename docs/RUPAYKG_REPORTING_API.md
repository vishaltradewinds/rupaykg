# RupayKg reporting API contract

## Scope

The common reporting engine provides an internal SWM 2026 preview, immutable saved report runs, and CSV/PDF/XLSX exports. It reads existing PostgreSQL records and does not create a statutory filing, certification, assurance opinion, or external portal submission. Preview requests are not persisted until the caller explicitly saves the exact preview snapshot.

## Endpoints

### JSON preview

`GET /api/v1/reports/swm-2026/preview`

Required query parameters:

- `periodStart`: inclusive ISO date (`YYYY-MM-DD`)
- `periodEnd`: inclusive ISO date (`YYYY-MM-DD`), on or after `periodStart`
- `context`: `urban` or `rural`

Optional query parameter:

- `geographyId`: UUID inside the active organization's verified geography scope

### Preview CSV

`GET /api/v1/reports/swm-2026/preview.csv`

Uses the same query parameters as JSON preview. Requires `reports:export`. The response includes a CSV attachment plus `x-rupaykg-report-status` and `x-rupaykg-report-hash` headers.

### Save and retrieve immutable runs

- `POST /api/v1/reports/swm-2026/runs` saves a preview only when the caller supplies the exact `snapshotHash` and `generatedAt`. The server rebuilds the snapshot in the same tenant scope and returns `409 REPORT_PREVIEW_STALE` if source data changed.
- `GET /api/v1/reports/runs?reportType=CPCB_SWMP_2026&limit=20` lists recent saved runs for the active organization.
- `GET /api/v1/reports/runs/:runId` retrieves the immutable stored snapshot.

### Saved-run exports

- `GET /api/v1/reports/runs/:runId.csv`
- `GET /api/v1/reports/runs/:runId.pdf`
- `GET /api/v1/reports/runs/:runId.xlsx`

All three exports use the original saved snapshot, not a recalculation of current source data. They require `reports:export`, return the snapshot status/hash headers, and use private/no-store caching.

## Authentication and tenant boundary

- Requires the authenticated RupayKg session and a verified active organization membership.
- Preview, save, history and saved-snapshot retrieval require `reports:read` or `swm:read`.
- CSV, PDF and XLSX exports require `reports:export`.
- All database reads/writes run inside `withTenantTransaction`, which establishes the non-BYPASSRLS runtime role and authenticated request context.
- Optional geography filters are checked with the organization's geography-scope predicate.
- The active organization header is `X-RupayKG-Organization-Id`; the server remains authoritative for membership and permissions.

## Source records

The preview reads:

- `activities` and their `geography` relationships
- `measurements` attached to those activities
- `evidence` attached to those activities or measurements
- latest `verifications` for each evidence record
- `resource_flows` in the same organization, reporting period and Urban/Rural geography rail
- `chain_of_custody_links` attached to those flows, including sequence, actor organization reference, quantity, handover geographies, linked evidence and latest verification

The preview is capped at 500 activities, 500 declared material flows and 500 custody links. The response sets `truncated: true` when any cap is exceeded. Narrow the date range or geography before treating the extract as complete.

## Data quality and stakeholder attribution

- `BLOCKED`: at least one missing value or disputed value.
- `DRAFT`: declared or estimated values, missing evidence, missing verification references, unverified evidence, unmapped stakeholder attribution or unavailable source revision remain unresolved.
- `READY_FOR_REVIEW`: required source, evidence, verification and stakeholder attribution checks pass. This means internal review-ready only; it is not external approval or an assurance result.

Activity stakeholder attribution is resolved only when the activity actor has exactly one recognized role through a `VERIFIED` organization membership and the organization-local role record. Canonical role names map to Generator, Aggregator, Transporter, Recycler, Processor, BWG, ULB or Gram Panchayat. Multiple or unknown roles remain `OTHER`/`UNMAPPED`.

Resource-flow rows remain `OTHER`/`UNMAPPED` because `origin_type` is not a verified stakeholder-role relationship. Custody rows remain `OTHER`/`UNMAPPED` because `chain_of_custody_links` stores `actor_organization_id` but not `actor_identity_id`. An individual stakeholder role is not inferred from an organization ID alone.

Evidence is not considered verified solely because a client supplies a status. The snapshot requires evidence ID, content hash, verification record ID and an accepted verification decision/status. Declared `resource_flows.declared_quantity` and custody quantities remain explicitly declared; they are not represented as independently measured.

## Provenance and export formats

Every snapshot includes schema version, report type, organization, reporting period, Urban/Rural mode, internal methodology version, source revision, generation timestamp, source record IDs, evidence hashes, data-quality issues, assumptions and a deterministic SHA-256 snapshot hash.

- CSV preserves row, stakeholder, attribution, field, value, unit, quality, source, evidence and verification fields. Text values are escaped against spreadsheet formula injection.
- PDF includes report metadata, stakeholder attribution, report rows, evidence/verification references, data-quality issues, assumptions and the snapshot hash. It embeds the OFL-licensed Noto Sans Devanagari font for Latin and Devanagari text.
- XLSX is an OOXML workbook with Summary, Report Rows, Provenance and Data Quality sheets. It uses inline text cells and no executable formulas.

The methodology code/version identifies an internal reporting template, not an official CPCB-approved calculation methodology.

## Immutable report-run history and migrations

- `report_runs` stores the complete immutable snapshot and its hash.
- Migration `108_reporting_run_history.sql` creates `report_runs` with forced RLS, organization/creator checks and runtime SELECT/INSERT privileges only. The runtime role has no UPDATE/DELETE grant.
- Migration 108 is excluded from the baseline migration runner and applied by the controlled Shakti DDL runner. The runner supports a contiguous pending suffix, so deployments with 101-107 already recorded can apply 108 without replaying earlier migrations.
- Migration `109_circular_stakeholder_role_defaults.sql` extends the baseline role-default function with least-privilege reporting/evidence permissions for Recycler, Transporter, Collector/Transporter, Generator, BWG, ULB and Gram Panchayat onboarding roles.
- Custody-link reads are scoped to the verified owner of a resource flow while preserving the actor-organization policy.

## Not yet included

- Authoritative cross-organization Generator -> Aggregator -> Transporter -> Recycler handover binding and mass-balance reconciliation. Activity role attribution does not, by itself, prove a transfer between organizations.
- A verified acting-identity reference on custody links; unresolved custody actor attribution remains explicit.
- EPR and BRSR adapters.
- External CPCB submission, receipt, acceptance, certification or assurance integrations.

Migrations 108 and 109 are proposed on PR #358 and have been exercised in disposable CI PostgreSQL only. No production Neon migration, Render configuration change, merge or deployment has occurred.
