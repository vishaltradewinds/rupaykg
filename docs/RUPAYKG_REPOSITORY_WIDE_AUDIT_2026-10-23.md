# RupayKg Repository-Wide Shakti Audit — 2026-10-23

## Decision

**Engineering is progressing; Pan-India operational readiness and Shakti certification remain BLOCKED.** This is a repository-wide architecture and release-gate review, not an independent penetration test, legal opinion, national data-completeness attestation, or production acceptance.

## Scope and evidence inspected

- Repository tree at commit `9cf1a7f40b3e6a280480b1e60dc2333656bdb7f4`: 412 tracked paths, including API, web client, domain/carbon/compliance/ESG/intelligence packages, migrations, operational scripts, tests, deployment definitions, and governance documents.
- PR #41 code and migration changes, including geography authorization, government crosswalk, SWM Rules 2026 controls, evidence vault, AI evidence intake, asynchronous mirror worker, audit-chain writes, production configuration, and test coverage.
- Existing Pan-India conformance audit, Shakti production gate, production readiness matrix, fundamental Pan-India rule, CI workflow and Render configuration.
- GitHub Actions run #1860 on the exact audited commit: https://github.com/vishaltradewinds/rupaykg/actions/runs/39896487040.

## Current repository validation

Run #1860 passed all configured CI steps on commit `9cf1a7f40b3e6a280480b1e60dc2333656bdb7f4`:
- production dependency audit;
- migration filename/structure validation;
- migrations applied to disposable PostgreSQL;
- TypeScript typecheck and package builds;
- production web build and browser smoke test;
- automated tests, including configured disposable-PostgreSQL acceptance tests;
- production container build.

This is evidence that the configured CI checks passed for this commit. It does not prove national data coverage, independent security certification, official government API access, live Guardian/Hedera acceptance, accredited verification, carbon-credit issuance, or production operations.

## Findings by workstream

| Workstream | Evidence-backed state | Remaining gate / decision |
|---|---|---|
| Core multi-tenant platform | PostgreSQL-backed lifecycle, organization memberships, RBAC, value/registry/settlement controls and tests exist. | Real production identity provisioning, complete runtime tenant-isolation acceptance, backup/restore and operational ownership still require evidence. |
| Geography and authorization | Versioned geography-source and external-identifier structures exist; strict helper and fail-closed activity/resource-flow guards are present in later migrations. High-impact routes have explicit-scope checks. | Do not assume all historical rows, every database writer, all readers, or every background path has been proven. National official source ingestion and reconciliation are absent/unproven. Legacy compatibility helpers remain and must be audited caller-by-caller before any global semantic change. |
| CPCB SWM workspaces | Organization permission and explicit geography checks exist for create/update. This audit found that list reads were not filtering each row by explicit scope, and updates did not lock/filter the existing row by its current scope. Both queries have now been tightened and source-level plus disposable-PostgreSQL runtime regression coverage added. | Verify every CPCB route and runtime DB path; local workspace status is not official CPCB filing or acceptance. |
| Government crosswalk and inbox | Authority-scoped inbox, source snapshots, dual-control crosswalk approval, expiry immutability and external-identifier resolver foundations exist. | No nationwide authoritative source inventory/completeness report, approved identifier coverage, or verified official integration contracts/credentials. Source snapshot lifecycle semantics must remain explicit; do not assume a retired source blocks or permits new mappings without a tested policy. |
| Regulatory applicability | Regulatory source, source-snapshot, versioned-rule, EPR scheme and CCTS methodology registries exist; SWM Rules 2026 requirement records are being mapped. | Registry presence is not a complete rules engine. National/state/local applicability, legal effective dates, conflicts/precedence, all relevant stakeholder and waste-stream coverage, and operationally maintained source evidence remain incomplete/unproven. |
| Evidence vault and MRV | Evidence is activity-bound, content-hashed, geography/permission-gated, reviewed separately, and protected against self-review; AI extraction remains a proposal rather than an authoritative mutation. | Complete source-to-measurement-to-calculation-to-verification lineage, runtime DB authorization, independent methodology validation and real Guardian execution still require acceptance evidence. |
| Audit integrity | Shared audit-chain head locking is used in reviewed CPCB/crosswalk writes; event hashes and DB guards are present. | Concurrency, rollback, missing-head, tamper-detection and recovery tests need final isolated staging evidence across all audit writers. |
| Workers and operational resilience | Bounded worker leases/retries/quarantine, scheduler safeguards and optional webhook alert delivery have code/tests. | Clean isolated staging restart/retry/quarantine acceptance, verified alert delivery, named on-call/escalation, load tests, dead-letter operations, restore/DR and rollback evidence remain open. |
| AI and model/provider boundaries | AI intake validates schema, records source logs, has bounded provider configuration/rate limits/idempotency, and does not directly approve evidence or mutate MRV/credit state. | Provider/privacy/data-retention terms, production keys, abuse testing, observability and human-review operations must be approved for the actual deployment. |
| Web/mobile accessibility | A Vite/React UI, guided stakeholder journey, language selector and offline queue are present; CI builds and smoke-tests the web client. | Device-level ordinary-phone/low-bandwidth/accessibility/local-language acceptance and safe offline conflict recovery are not proven by a browser smoke test. |
| Deployments and external trust rails | Render/Cloud Run configuration and production configuration checks exist. The checked-in `render.yaml` explicitly sets `HEDERA_NETWORK=testnet` for the service named `rupaykg-production`. | This is a **production configuration gate**: do not represent mainnet anchoring as configured. Do not silently switch networks or create a replacement topic/account; first verify the intended environment, existing account/topic, credentials and approval. Actual production DB TLS, secrets/rotation, current deployed SHA, backup/restore, Guardian VERIFIED → Hedera consensus → Mirror Node hash verification, and live operational monitoring must be independently demonstrated. Existing deployment documentation may be stale; verify live environment before relying on it. |

## Changes completed in this audit cycle

1. **CPCB list isolation:** workspace list SQL now filters records to non-null geography rows for which `organization_has_explicit_geography_scope(organization_id, geography_id)` succeeds.
2. **CPCB update isolation:** update query locks only a row in the active organization whose existing geography is explicitly in scope; the requested new geography is separately checked before update.
3. **Regression tests:** `apps/test/strict-geography-callsite-audit.test.ts` asserts the query contracts, and `apps/src/cpcb-swm-routes-db.test.ts` simulates geography-scope realignment to prove stale workspace rows are hidden from list results and cannot be updated through a request to move them into a newly authorized geography.
4. **Validation:** the exact combined head passed CI run #1860. No production migration/deployment or PR merge was performed.

### Additional release-critical configuration finding

The checked-in Render manifest has `HEDERA_NETWORK=testnet` under the service named `rupaykg-production`. This is not proof of the live service's effective environment, but it is proof that the repository's declared deployment template defaults to testnet. Treat real production trust-rail acceptance as blocked until the environment target and existing approved account/topic are verified. Do not change it to mainnet by assumption: a network switch is an externally consequential configuration change and requires matching authorized credentials, topic provenance, cost/operational review and explicit approval.

## Pan-India architecture gaps to close next

1. **Authorization completeness inventory:** enumerate every caller of legacy geography helpers and every activity/resource-flow/evidence/MRV writer, reader, worker and import path. Add targeted fail-closed database/API tests; preserve existing tenant data and do not globally flip compatibility semantics without a migration/backfill plan.
2. **Authoritative geography coverage:** establish official source snapshots and ingestion/reconciliation workflow with counts for received, accepted, rejected, ambiguous and unresolved records. Do not fabricate LGD or state/local-body data. Use versioned external identifiers and dual-control approval.
3. **Rules applicability:** extend the existing source-snapshot and regulatory-rule structures rather than creating a parallel registry. Define tested precedence across India/state/district/local body, scheme, stakeholder, waste stream, effective dates, source lifecycle, and evidence requirements. Resolve overlapping/duplicate concepts by source-backed governance, not guessed legal meaning.
4. **Stakeholder extensibility:** assess the existing taxonomy registry and database constraints; allow governed additions only with explicit permission, lifecycle, geography, regulatory applicability and migration/test support.
5. **End-to-end provenance:** prove evidence → measurement/activity → calculation/version → methodology/source → independent verification → registry eligibility, with no status inflation and complete audit trace.
6. **Scale and recovery:** perform measured concurrency/load/retention tests, queue saturation and process restart/retry/quarantine tests, tenant isolation, backup/restore and disaster-recovery exercises.
7. **Real-world acceptance:** use an isolated staging environment with named owners, authorized credentials and exact evidence capture for government adapter contracts, Guardian/Hedera/Mirror Node, alert escalation, operational runbooks and rollback.
8. **Release governance:** update the Shakti gate with the exact tested commit, evidence owners, untested jurisdictions, approvals, rollback criteria and residual risks. Keep release/certification blocked until all applicable gates are evidenced.

## Release decision

- PR #41 remains **open, draft, unmerged**.
- Read-only Render inspection verified the configured service `rupaykg` is on `main`; latest observed live deploy is `dep-dbbjqic9v7es73ffofmg` at commit `0ddcf6087620880e21ea60f954c9f05d6b759469`. The PR branch is not the deployed branch. Effective runtime secrets/environment variables and current health response were not verified in this audit.
- Production deployment/migration: **not performed by this audit cycle**.
- Pan-India design intent: **mandatory and recorded**.
- Pan-India operational readiness: **not proven**.
- Official compliance, accredited MRV verification and carbon-credit issuance: **not claimed**.
- Shakti certification: **BLOCKED** until the applicable internal and independent external gates are closed.

**Governing rule:** ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.
