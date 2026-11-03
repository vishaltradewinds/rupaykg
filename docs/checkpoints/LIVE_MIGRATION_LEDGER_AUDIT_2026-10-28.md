# Live Migration Ledger Audit — 2026-10-28

Status: **BLOCKED — evidence collected read-only; no schema or ledger writes performed.**

## Environments inspected

Read-only catalog and ledger queries were executed against the connected production primary branch and staging branch. The audit did not read application records or secrets. It captured migration metadata, targeted object inventories, and aggregate row counts only.

## Ledger findings

### Production

- Numbered migrations 001–087 are recorded.
- Numbered migration 096_verification_authorization_provenance.sql is recorded.
- Legacy date-prefixed migrations 20261018–20261021 are recorded:
  - 20261018_cpcb_swm_stakeholder_workspaces.sql
  - 20261019_cpcb_bwg_workflow_tracking.sql
  - 20261020_ccts_methodology_registry.sql
  - 20261021_evidence_artifact_vault.sql
- Numbered replacements 088–091 are not recorded; numbered migrations 088–095 are not represented as a contiguous applied sequence in the ledger.
- Targeted schema objects for the four legacy migration families exist.

### Staging

- Numbered migrations 001–087 are recorded.
- Legacy date-prefixed migrations 20261018–20261025 are recorded, including the same four families listed above and:
  - 20261022_async_mirror_inbox.sql
  - 20261023_async_mirror_worker_leases.sql
  - 20261024_ai_intake_rate_limits.sql
  - 20261025_ai_evidence_intake_jobs.sql
- The four date-prefixed async/AI migration families have no numbered equivalents among 092–095 in the current candidate; those candidate migrations have different purposes. **Do not map them by sequence number.**
- Staging contains async_mirror_inbox, async_mirror_inbox_events, ai_intake_rate_limits, and ai_evidence_intake_jobs plus associated indexes. The production branch inspected does not contain those objects.

## Targeted schema inventory

The production and staging catalog results agree for the schema objects associated with the four shared legacy migrations:

| Object family | Columns | Constraints | Indexes | Trigger evidence |
|---|---:|---:|---:|---|
| cpcb_swm_stakeholder_workspaces | 20 | 23 | 3 | — |
| cpcb_swm_status_history | 9 | 13 | 3 | — |
| ccts_methodology_registry | 14 | 17 | 2 | — |
| evidence_artifact_series | 6 | 10 | 2 | — |
| evidence_artifact_versions | 14 | 24 | 4 | 1 immutable-version trigger |
| evidence_artifact_reviews | 7 | 13 | 2 | 1 append-only trigger |
| evidence | Existing base table | — | — | 1 vault-pointer immutability trigger |

The three evidence-vault trigger function definitions returned matching MD5 fingerprints across production and staging. The schema inventory is a useful consistency check, **not yet a complete canonical-definition diff** against every constraint/index/function in the SQL source. The CCTS registry has 29 rows in each environment; the workspace, status-history, and evidence-vault artifact tables queried have zero rows in both environments.

## Safety conclusions

1. PR #107's orphan guard will correctly halt on the four missing legacy filenames in production and on at least eight missing legacy filenames in staging unless an explicit reviewed compatibility strategy is implemented.
2. Re-running migrations 088–091 naively is unsafe: the corresponding tables already exist; 089 would re-add existing columns; and 090 inserts seed rows whose primary keys already exist.
3. A single four-file alias mapping is insufficient for staging because its async/AI legacy migrations are not represented by candidate migrations 092–095, and production/staging histories diverge further at migration 096.
4. Do not delete ledger rows, rename history, restore and replay legacy files blindly, or weaken the fail-closed guard.
5. Keep production certification **HOLD**. No PR is approved for merge by this evidence alone.

## Required next engineering batch

- Build an explicit per-environment legacy migration compatibility matrix based on exact filename and schema fingerprint, not date/version proximity.
- Decide whether the staging-only async/AI functionality is intentionally retired or must be preserved; if preserved, restore it through reviewed forward-only migrations.
- Add runner support for a reviewed legacy-to-canonical migration mapping only where exact schema fingerprints and seed-data expectations validate. The runner must record canonical numbered versions without re-executing already-applied DDL/DML, and must still fail closed on unknown legacy records.
- Test disposable PostgreSQL fixtures reproducing the observed production and staging ledger states, including production's existing 096 record and staging's extra four legacy migrations.
- Compare full canonical constraints, index definitions, triggers, function bodies, and CCTS seed rows against expected definitions; obtain independent review before any production change.
