# Recovered worker/crosswalk migration source manifest

**Status:** exact source recovered from historical Git branches; archived as branch-only proposed migrations, not as staging/production-applied migrations.

## Source refs and original blob identities

All five files were fetched from:
- `ci/enable-worker-integration-pr-validation-2026-10-30`
- `ci/enable-worker-postgres-pr-validation-on-feature-base-2026-10-30`
- `ci/worker-lease-validation-v5-2026-10-31`

All three refs returned identical blob SHAs and byte lengths.

| Original migration | Original blob SHA | Bytes |
|---|---|---:|
| `20261031_government_jurisdiction_crosswalk.sql` | `f9510969465d59fc3273d40455156a009087a55e` | 10758 |
| `20261101_async_mirror_unresolved_crosswalk.sql` | `4f9776bc449025e795cb0d5c93e8bace9dea280b` | 635 |
| `20261102_government_crosswalk_evidence_binding.sql` | `e8e96df5f90cf9bd181450e882cdbeab2479ae6e` | 2063 |
| `20261105_crosswalk_snapshot_binding.sql` | `025a20e86e43a6de0613d8584e6627b95eff3e7c` | 2865 |
| `20261108_crosswalk_request_expiry_immutability.sql` | `37417e74dae986ca6dc2c3b34c30094a447bd733` | 1090 |

Archived copies use the suffix `.recovered.sql` and are stored under `docs/audit/evidence/recovered-worker-migrations/`, outside the active migration directory.

## Application status evidence

Read-only ledger inspection of production Neon main and the separate staging branch returned **zero** rows for all five filenames. The required `government_jurisdiction_crosswalks` and `authoritative_source_snapshots` tables were absent on both inspected branches. These are not confirmed applied migrations.

The worker branch's source code and its documented operational boundary are summarized in `worker-integration-branch-compatibility.md`. The worker cannot be assumed compatible with the 20261020 staging schema snapshot.

## Safety
Do not add these files to active `migrations/`, replay them, or treat their presence in a feature branch as deployment evidence. Review the complete dependency chain and source evidence in a disposable database first. Production remains read-only; worker scheduler remains disabled.
