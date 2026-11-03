# Migration History Reconciliation Gate — Shakti Standards

Status: **BLOCKED pending read-only evidence from each deployed environment**.

## Scope

The ICVCM integration candidate currently contains the numbered migrations `088_cpcb_swm_stakeholder_workspaces.sql` through `107_credential_registry_eligibility_guard.sql`. The four date-prefixed counterparts previously identified are not present in this candidate branch:

- `20261018_cpcb_swm_stakeholder_workspaces.sql` → `088_cpcb_swm_stakeholder_workspaces.sql`
- `20261019_cpcb_bwg_workflow_tracking.sql` → `089_cpcb_bwg_workflow_tracking.sql`
- `20261020_ccts_methodology_registry.sql` → `090_ccts_methodology_registry.sql`
- `20261021_evidence_artifact_vault.sql` → `091_evidence_artifact_vault.sql`

The candidate's clean-install CI is green, but that does **not** establish upgrade safety for databases that may already have recorded one or both filename families. The migration runner sorts filenames lexicographically and stores both `version` and `filename`; the numeric prefix is the version. The deployed ledger must be inspected before approving any production upgrade.

## Required read-only evidence

Run the following against each environment using a read-only account and approved change window. Do not include credentials in tickets, logs, or this document.

```sql
SELECT version, filename
FROM schema_migrations
WHERE filename IN (
  '088_cpcb_swm_stakeholder_workspaces.sql',
  '089_cpcb_bwg_workflow_tracking.sql',
  '090_ccts_methodology_registry.sql',
  '091_evidence_artifact_vault.sql',
  '20261018_cpcb_swm_stakeholder_workspaces.sql',
  '20261019_cpcb_bwg_workflow_tracking.sql',
  '20261020_ccts_methodology_registry.sql',
  '20261021_evidence_artifact_vault.sql'
)
ORDER BY version, filename;
```

Also capture a read-only inventory of the relevant schema objects and definitions (tables, indexes, constraints, triggers, and functions) for the four migration families. `CREATE INDEX IF NOT EXISTS` or similar idempotency clauses alone are not proof that existing objects have the expected definition.

## Reconciliation rules

1. Preserve the original migration files and recorded history until every environment's ledger and object definitions are known.
2. Build a per-environment matrix: filename/version recorded, schema objects present, definitions match candidate, and whether the numbered migration would execute on upgrade.
3. Test at least two disposable PostgreSQL paths: (a) empty database to latest candidate; (b) a database fixture that reproduces each observed deployed ledger state to latest candidate.
4. Verify dependency ordering for all migrations 088–107 and assert required objects/constraints/triggers after each path.
5. If deployed history differs, prepare a reviewed forward-only reconciliation migration or a documented, tested compatibility strategy. Never rewrite a migration that may already have been applied.
6. Have a second engineer review the SQL, migration ledger evidence, test output, rollback/restore plan, and production change plan.
7. Keep production certification **HOLD** until all gates pass and the owner authorizes the change.

## Acceptance criteria

- [ ] Read-only ledger evidence captured for every environment.
- [ ] Duplicate filename-family status classified per environment.
- [ ] Schema object definitions compared, not just object names.
- [ ] Clean-install test passes.
- [ ] Upgrade test passes for every observed ledger state.
- [ ] Migration order and dependency assertions pass.
- [ ] Independent review completed.
- [ ] Approved backup/restore and deployment plan exists.

This document is a gate/checklist, not evidence that any production database was inspected or changed. No production database was accessed as part of this audit.
