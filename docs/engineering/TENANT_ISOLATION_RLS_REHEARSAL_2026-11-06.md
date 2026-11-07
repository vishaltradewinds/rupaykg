# RupayKg — Shakti Batch C RLS Rehearsal

Date: 2026-11-06

Status: **ENGINEERING REHEARSAL ONLY**. Production remains READ-ONLY/HOLD.

## What was executed

This batch converts the live FK evidence into concrete disposable PostgreSQL RLS predicates and proves the core tenant boundary with two distinct runtime identities.

The rehearsal:
- derives tenant ownership from actual FK paths rather than assuming every table has `organization_id`;
- uses non-owner, `NOBYPASSRLS`, non-superuser runtime roles;
- enables and forces RLS only in the disposable CI database;
- proves SELECT/INSERT/UPDATE/DELETE isolation on direct and indirect tenant data;
- proves transaction-local organization context does not leak across a connection reuse boundary;
- proves invalid organization context fails closed;
- deliberately leaves ambiguous multi-party tables out of this candidate-policy set.

## Candidate single-owner FK paths

| Table | Authoritative tenant path |
|---|---|
| activity_assignments | activity_assignments → activities → organizations |
| bwg_epr_reports | bwg_epr_reports → bwg_reporting_periods → organizations |
| bwg_esg_reports | bwg_esg_reports → bwg_reporting_periods → organizations |
| carbon_calculations | carbon_calculations → activities → organizations |
| esg_metrics | esg_metrics → activities → organizations |
| evidence | evidence → activities → organizations |
| evidence_artifact_reviews | evidence_artifact_reviews → evidence → activities → organizations |
| evidence_artifact_versions | evidence_artifact_versions → evidence_artifact_series → organizations |
| evidence_verification_requirements | evidence_verification_requirements → activities → organizations |
| field_sync_conflicts | field_sync_conflicts → field_sync_envelopes → field_devices → organizations |
| field_sync_cursors | field_sync_cursors → field_devices → organizations |
| field_sync_envelopes | field_sync_envelopes → field_devices → organizations |
| measurements | measurements → activities → organizations |
| mrv_observations | mrv_observations → activities → organizations |
| mrv_provenance_events | mrv_provenance_events → activities → organizations |
| stakeholder_application_approvals | stakeholder_application_approvals → stakeholder_applications → organizations |
| verifications | verifications → activities → organizations |
| epr_obligations | epr_obligations → organizations |

## Ambiguous / multi-party tables intentionally excluded

These require explicit business semantics before an RLS predicate is approved:

- `bwg_waste_reports` — processor organization plus reporting-period organization path.
- `chain_of_custody_links` — actor organization plus activity/resource-flow ownership.
- `credentials` — issuer organization plus activity/verification ownership.
- `epr_credit_allocations` — credit and obligation paths can represent different organizational parties.
- `epr_credit_transfers` — from/to organizations are both first-class parties.
- `epr_credits` — issuer and recycler are distinct organizational parties.
- `registry_events` — from/to owners are both first-class parties.
- `settlements` — payer and payee are both first-class parties.
- `settlement_events` — inherits the multi-party settlement boundary.

These tables are **not** safe candidates for a blanket single-`organization_id` policy.

## Security result

The rehearsal is designed to fail closed for:
- missing organization context;
- malformed organization context;
- cross-organization SELECT;
- cross-organization UPDATE;
- cross-organization DELETE;
- cross-organization INSERT via `WITH CHECK`;
- connection/transaction context leakage.

The runtime roles are deliberately:
- non-owner;
- `NOBYPASSRLS`;
- non-superuser;
- no role/database creation privileges.

## Next gate

1. Reconcile the 18 single-owner candidates against application authorization paths.
2. Design explicit multi-party policies for the 9 ambiguous tables.
3. Extend CRUD fixtures to each policy family.
4. Add pool-reuse and worker/system-actor tests against the actual request-context implementation.
5. Independently review policy predicates and privilege boundaries.
6. Only after those gates, prepare a production RLS migration package.

No production RLS, grants, role, ownership, deployment, certification or TRL 9 decision is authorized by this batch.
