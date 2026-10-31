# Worker and jurisdiction migration source restoration — 2026-10-31

## Purpose

This draft proposes restoring the historical migration source chain needed to evaluate the asynchronous government inbox worker and its jurisdiction/source-provenance resolver. It is a source-recovery and CI-validation change only. It does not authorize any database application, merge, deployment, scheduler activation, official government integration, or certification.

## Restored migration sequence

The following 19 SQL files were copied byte-for-byte from verified historical Git objects. The SHA values below are Git blob IDs of the historical source and were checked against the restored files.

| Order | Migration | Historical blob SHA |
|---:|---|---|
| 1 | 20261022_async_mirror_inbox.sql | 4d08607e03561b9fbb4ce502b4c4211127237050 |
| 2 | 20261023_async_mirror_worker_leases.sql | 33cb4d5d2e29a4a111340e5a0ac34170a0081895 |
| 3 | 20261024_ai_intake_rate_limits.sql | 87b51fe60a96a4e0752c8b0a9a170c81f9936dbb |
| 4 | 20261025_ai_evidence_intake_jobs.sql | 6a0ae54530b7b756dac33589eaf18df3b071d8f2 |
| 5 | 20261026_organization_stakeholder_authorization.sql | 9c2ac61648b63acd4d2f5dccdd88025d1cb54b22 |
| 6 | 20261027_stakeholder_authorization_dual_control.sql | bfb3a10fe4502d642ab8cbcc5b8a23b3cf6acc16 |
| 7 | 20261028_platform_audit_hash_versions.sql | ecd002354e9f586033259fbd87ab3fec87baf7f3 |
| 8 | 20261029_cpcb_swm_workspace_geography_required.sql | d039f565c5bc557ff918a1cc539272f1b2f4c9d2 |
| 9 | 20261030_explicit_geography_scope.sql | f7cfd12a6709ebee42c9def7819cd2150eeb0dcf |
| 10 | 20261031_government_jurisdiction_crosswalk.sql | f9510969465d59fc3273d40455156a009087a55e |
| 11 | 20261101_async_mirror_unresolved_crosswalk.sql | 4f9776bc449025e795cb0d5c93e8bace9dea280b |
| 12 | 20261102_government_crosswalk_evidence_binding.sql | e8e96df5f90cf9bd181450e882cdbeab2479ae6e |
| 13 | 20261103_swm_stakeholder_taxonomy_registry.sql | 19c13b27659cc1a79ed63521bf483f42d39be0f6 |
| 14 | 20261104_source_snapshot_and_regulatory_rule_versions.sql | a288f83f08a4e384ad60d84c06d1c4bded4178bc |
| 15 | 20261105_crosswalk_snapshot_binding.sql | 025a20e86e43a6de0613d8584e6627b95eff3e7c |
| 16 | 20261106_regulatory_rule_source_gate.sql | 884f71699ed45459100b60ae61164f9a8380a240 |
| 17 | 20261107_approved_source_snapshot_immutability.sql | 267285c8fc6a75f7c52428d1c83e607bbce07b08 |
| 18 | 20261108_crosswalk_request_expiry_immutability.sql | 37417e74dae986ca6dc2c3b34c30094a447bd733 |
| 19 | 20261109_source_snapshot_retirement_terminal.sql | 60496891fad7a6341898252efda605a66fbc7662 |

## Why these dependencies are included

The worker's resolver queries:
- `government_jurisdiction_crosswalks` and verified crosswalk state;
- `authoritative_source_snapshots`, approved status, authority code, source version and effective dates;
- crosswalk-to-source-snapshot binding;
- `organization_has_explicit_geography_scope(uuid,uuid)`;
- organization/activity/geography bindings.

The migration chain also supplies evidence-backed dual-control crosswalk approval, immutable evidence-vault binding, source snapshot provenance and coverage manifests, regulatory-rule source gates, snapshot immutability, request-expiry immutability, and terminal retirement semantics. These are governance controls, not optional test fixtures.

The 20261101 migration adds `UNRESOLVED` only as an internal inbox state for structurally valid intake without one unambiguous currently valid verified crosswalk. It does not mean official acceptance/rejection, MRV determination, credit issuance, or external authority action.

No real nationwide crosswalks, authoritative source snapshots, or regulatory rules are seeded. The source-snapshot migration explicitly leaves those datasets unseeded pending evidence and review.

## Important integration boundary

This chain is not the complete worker implementation. The worker code and real-PostgreSQL acceptance tests still require a focused integration against current `main`, including dependency and feature-flag review. The historical feature branch from which these migrations were recovered is highly divergent (567 commits ahead and 4 behind `main`) and must not be merged or cherry-picked wholesale.

The migrations must be reviewed in order against the actual current-main schema. In particular:
- confirm every referenced table, column, enum/check constraint, trigger and helper function exists at the point of use;
- inspect idempotency and rollback/recovery behaviour;
- reconcile existing production/staging/rehearsal ledgers before any apply;
- preserve production's stronger verifier authorization function and provenance columns;
- keep the rehearsal-only/unledgered schema drift separate until resolved.

## Validation gates

1. Exact source-blob equality for all 19 files.
2. Migration ordering and static validation on the proposed PR head.
3. Full migration application in disposable PostgreSQL, from a clean current-main baseline.
4. Worker acceptance tests with zero skips, covering null/expired leases, attempts exhaustion, retry/backoff, fencing, concurrent claim exclusion, append-only payload-free events, source-version mismatch, missing/ambiguous/expired/revoked crosswalks, and retired snapshots.
5. Prove zero official acceptance, authoritative MRV mutation, or Guardian/HCS side effects.
6. Independent security and migration review before merge consideration.

## Current posture

- Source restoration: completed on this draft branch.
- Historical blob verification: recorded above; must be rechecked at final PR head.
- CI: pending.
- Disposable schema reconstruction: pending.
- Independent review: pending.
- Production DB writes/DDL: prohibited pending explicit release approval.
- Merge/deployment: HOLD.
- Scheduler: OFF.
- Production certification and TRL 9: not established.
