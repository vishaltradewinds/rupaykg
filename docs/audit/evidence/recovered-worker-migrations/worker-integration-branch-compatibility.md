# Government inbox worker branch — schema compatibility and deployment boundary

**Classification:** source/compatibility audit only. No staging or production writes were performed.

## Source branch
The inspected feature/CI branch is `ci/enable-worker-integration-pr-validation-2026-10-30`. It contains:
- `apps/src/async-mirror-routes.ts`
- `apps/src/async-mirror-worker.ts`
- `apps/src/async-mirror-worker-db.test.ts`
- `apps/src/async-mirror-worker.test.ts`
- `apps/src/intelligence-evidence-intake.ts`
- `apps/src/intelligence-evidence-intake.test.ts`
- `apps/src/intelligence-rate-limit.test.ts`
- `docs/GOVERNMENT_INBOX_WORKER_OPERATIONS.md`

The worker operations document explicitly describes engineering capability only; the production scheduler is not enabled or certified. The worker performs structural validation and jurisdiction crosswalk resolution; it must not be treated as official CPCB/BEE acceptance, verified MRV, or carbon-credit issuance.

## Proposed branch-only migration dependencies

The same feature branch contains a much larger migration chain than the five crosswalk files archived in this evidence folder. The tree includes dated migrations from `20261018` through `20261129`. The key later dependency chain includes `20261026_organization_stakeholder_authorization.sql`, `20261027_stakeholder_authorization_dual_control.sql`, `20261028_platform_audit_hash_versions.sql`, `20261029_cpcb_swm_workspace_geography_required.sql`, `20261030_explicit_geography_scope.sql`, the five crosswalk migrations below, `20261103_swm_stakeholder_taxonomy_registry.sql`, `20261104_source_snapshot_and_regulatory_rule_versions.sql`, `20261106_regulatory_rule_source_gate.sql`, `20261107_approved_source_snapshot_immutability.sql`, `20261109_source_snapshot_retirement_terminal.sql`, `20261110_failed_settlement_terminal_for_retirement.sql`, and further strict geography/SWM/EPR migrations through `20261129_credential_descendant_scope.sql`. This is a full feature-branch migration lineage, not a five-file isolated patch.

The following five crosswalk files are archived byte-for-byte in this evidence folder:
- `20261031_government_jurisdiction_crosswalk.sql` — request and mapping tables, dual-control lifecycle and crosswalk constraints.
- `20261101_async_mirror_unresolved_crosswalk.sql` — adds the internal `UNRESOLVED` inbox state.
- `20261102_government_crosswalk_evidence_binding.sql` — binds crosswalk request/mapping evidence to immutable Evidence Vault artifacts and verified evidence.
- `20261105_crosswalk_snapshot_binding.sql` — binds crosswalks to approved authoritative source snapshots.
- `20261108_crosswalk_request_expiry_immutability.sql` — prevents rewriting request expiry during approval.

Three historical refs returned identical Git blob SHAs for these five files; the README in this folder records the source identities.

## Read-only compatibility inspection

On 2026-11-04, the authoritative production branch `br-restless-base-b44cip2h` and non-authoritative staging branch `br-spring-hill-b4544vz5` were inspected:
- production dated migration ledger ends at `20261021_evidence_artifact_vault.sql`;
- staging dated migration ledger ends at `20261025_ai_evidence_intake_jobs.sql`;
- production and staging ledger rows for the five crosswalk filenames archived here: **0**;
- production and staging have no applied entries for the feature-branch dated migration chain after their respective cutoffs;
- production and staging presence of `government_jurisdiction_crosswalks`: absent;
- production and staging presence of `authoritative_source_snapshots`: absent on the inspected branches;
- staging `async_mirror_inbox.status` constraint allows RECEIVED, PROCESSING, PROCESSED, VALIDATED, REJECTED, RETRY, QUARANTINED, but **not UNRESOLVED**.

The four 20261022–20261025 migrations are separately confirmed staging-only and archived in PR #261. Production has only 20261018–20261021 from this dated series; staging has 20261018–20261025. The four staging-only migrations create the inbox, worker lease/event foundation, AI rate-limit table and AI intake idempotency ledger. They do not create the crosswalk tables required by the feature-branch worker. The worker feature branch depends on a later, much larger migration chain through 20261129 that is absent from both inspected databases. The feature-branch worker therefore cannot safely run against the inspected staging schema snapshot: its crosswalk and source-snapshot dependencies are missing, and the UNRESOLVED status is not enabled.

## Important source-code and schema boundary
- The presence of code and migrations on a feature/CI branch is not evidence that they were deployed.
- The five migrations are not present in either inspected database ledger and are not in `main`.
- These migrations are archived as proposed branch source only, not as active migrations and not as approved production change.
- Do not enable the worker scheduler, configure a production cron job, or deploy the worker until its complete migration dependency chain, crosswalk source evidence, authorization, lease fencing, retries/quarantine, and isolated end-to-end acceptance have passed review.
- No real authority crosswalks are created by the base crosswalk migration. Real mappings require verified authoritative source codes and evidence, dual control, exact source snapshots and independent approval.

## Required next gates
1. Reproduce the full dependency sequence in a disposable PostgreSQL database after establishing the correct baseline migrations.
2. Validate all foreign keys, trigger dependencies, row-level authorization, dual-control semantics, source-snapshot expiry, and immutability.
3. Compare the resulting schema to a clearly identified target branch; do not assume the 20261020 staging snapshot is the target for the later worker code.
4. Run the worker's DB acceptance tests and adversarial cross-tenant/crosswalk ambiguity tests against that disposable schema.
5. Keep production scheduler disabled and production read-only pending independent review and explicit founder approval.
