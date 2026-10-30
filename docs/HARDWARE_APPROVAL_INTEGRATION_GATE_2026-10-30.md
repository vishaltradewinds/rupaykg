# Hardware Approval Integration Gate — 2026-10-30

**Status:** COORDINATION PLAN — NOT AN INTEGRATION APPROVAL  
**Canonical repository:** `vishaltradewinds/rupaykg`  
**Main baseline used to create this document branch:** `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`  
**Governance:** Shakti Standards  
**Release disposition:** HOLD — no merge, migration, device procurement, site connection, or production activation authorized by this record.

## 1. Decision

PR #49 and PR #51 are overlapping candidate implementations of model-specific instrument approval and evidence-bound measurement acceptance. Do not merge either independently until one combined integration candidate is created from current `main`, reviewed as a whole, and passes exact-head CI.

The source branches both use the same older base SHA `0ddcf6087620880e21ea60e954c9f05d6b759469`; current main baseline is `54a7fe1ceb41b37a68720a71c10a1dd03af30dea`. This is branch divergence requiring a reviewed integration—not a reason to force-update either source branch or to resolve conflicts mechanically.

## 2. Candidate snapshots inspected

| Candidate | Head SHA at checkpoint | Prior recorded CI | Limit |
|---|---|---|---|
| PR #49 — model-specific hardware approval | `4d606e188b31b890eb894aa8dfdd275f7c8ee4c4` | Run `40198548747`, SUCCESS | CI applies only to that branch head and environment. |
| PR #51 — evidence-bound approval and parameter specs | `1824d2a342ab64850575c9488a544edf3c80cbd5` | Run `41058468210`, SUCCESS | CI applies only to that branch head and environment. |
| PR #108 — migration-history/dual-ledger acceptance | `e4dcb3588d208968c49947d0493f98da6884aed2` | Run `41064298999`, SUCCESS | Separate candidate; does not resolve live migration-source provenance. |

None of these results is evidence of physical instrument qualification, current production/staging database provenance, site acceptance, legal approval, or TRL advancement.

## 3. Confirmed overlap and migration hazards

Inspection found the following paths shared by #49 and #51:

- `apps/src/mrv-instrument-approval.ts`
- `apps/src/mrv-instrument-routes.ts`
- `apps/src/mrv-routes.ts`
- `apps/src/server.ts`
- `apps/src/sync-routes.ts`
- approval-specific tests and `runtime-acceptance-v2.test.ts`
- API documentation, migration README and package lock
- `migrations/088_mrv_instrument_approval_register.sql`
- `migrations/089_measurement_instrument_binding_guard.sql`

The two `088` migration files and the two `089` migration files were inspected and have matching Git blob SHAs across both source branches. **They must appear only once in the integrated migration history.** Do not duplicate, rename, rewrite, or replay them merely to make branch history or live ledger state appear consistent.

PR #51 also contains `migrations/20261031_mrv_instrument_current_expiry_guard.sql`. This filename is dated 2026-10-31, one day after this checkpoint. Its intended release date, dependency order, naming convention, manifest/catalogue inclusion and upgrade-path compatibility must be explicitly reviewed before inclusion.

## 4. Required integration procedure

### Gate A — freeze and capture inputs
1. Re-fetch current main SHA, both PR heads, changed-file lists, migration catalogues and exact diffs immediately before integration.
2. Record the authoritative intended feature scope and designate one integration owner and one independent reviewer.
3. Keep #49 and #51 Draft; no merge, rebase or force-push of their source branches is implied by this plan.

### Gate B — construct one candidate from current main
1. Create a dedicated integration branch based on the then-current main SHA.
2. Integrate the smallest coherent set of required changes from #49/#51. Do not blindly merge both branches.
3. Resolve shared application files manually against current main and document every behavior decision.
4. Include migration 088 and 089 once only; inspect all subsequent migrations for dependency ordering and idempotent, forward-only upgrade behavior.
5. Treat the 2026-10-31 migration as blocked until its date/version intent and catalogue ordering are explicitly resolved.
6. Preserve fail-closed behavior: unknown device/model, unverified approval, missing/expired calibration, unapproved parameter, stale/revoked evidence, or authorization failure must not be accepted as authoritative MRV evidence.

### Gate C — prove the combined candidate
Required exact-head checks, with results retained:
- dependency/security audit, typecheck, production build and production-container build;
- migration catalogue validation and fresh-install migration run in disposable PostgreSQL;
- upgrade-path tests for every supported migration history, including dual-ledger histories and duplicate/missing/wrong-version source cases;
- approval-route, tenant/site isolation, authorization and sync regression tests;
- instrument/model/firmware identity, parameter/unit/range/resolution/accuracy, calibration validity, approval revocation, evidence hash/version and reviewer-locking negative tests;
- full suite and any required browser/runtime acceptance tests.

Any unexplained migration mismatch or critical acceptance failure blocks integration. Never alter a live migration ledger to force CI green.

### Gate D — independent review and decision
1. Review the full combined diff, migration order and test evidence independently of the implementation author.
2. Verify exact-head CI against the candidate SHA after the last change.
3. Keep the PR Draft if CI is pending/failed, independent review is missing, or migration provenance remains unresolved.
4. Only an authorized maintainer may decide merge after the repository's required checks and reviews pass. This document grants no merge permission.

## 5. External evidence and statutory applicability remain separate

Software approval logic is not proof that a real instrument is lawful or fit for use. For each candidate device, retain:
- exact manufacturer, model/SKU/revision, serial/asset ID and firmware;
- official certificate/registry evidence and a documented applicability decision for MeitY/STQC/BIS/QCO/WPC/Legal Metrology or other obligations relevant to that exact product and intended use;
- instrument manual, interface/register-map details, measurement range, units, accuracy/uncertainty, resolution and environmental limits;
- valid calibration/verification certificate, traceability, as-found/as-left results and due date;
- authorized site/operator data, installation/commissioning evidence and independent field acceptance.

Do not infer that MeitY approval is generic across categories, or that Indian origin, a processor brand, a vendor claim or open-source status establishes the required approval. If the required applicable route or exact-model evidence cannot be verified, record BLOCKED and do not procure/connect/use the device under the strict project rule.

## 6. Site and methodology boundary

The Kathonda/Jabalpur site intake remains OPEN and HOLD. Public records are leads, not current operator confirmation. The known public-record description points to a WtE mass-incineration plant; do not assume a landfill-methane recovery project or select methane instrumentation by default. Establish the actual operating process, project boundary and methodology eligibility from current authoritative/operator evidence before finalizing measurement requirements or a hardware BOM.

## 7. Separate production migration-provenance blocker

PR #108's green disposable-PostgreSQL CI does not establish which migration source was deployed to live production or staging. Before any live reconciliation, require authorized read-only ledger and schema evidence from both environments, canonical migration/source provenance, schema fingerprints, duplicate/removed-source analysis, fresh-install and upgrade-path acceptance, and a reviewed forward-only plan. No production read/write, replay, deployment, scheduler activation or certification is authorized here.

## 8. Exit status

- Combined current-main integration candidate: **NOT CREATED**
- Exact-head CI for combined candidate: **NOT RUN**
- Independent combined-diff review: **NOT RUN**
- Production/staging migration provenance: **BLOCKED / NOT ESTABLISHED**
- Physical device qualification and site acceptance: **NOT ASSESSED / NOT DEMONSTRATED**
- Production certification: **HOLD / OFF**
- TRL 5: **NOT DEMONSTRATED**; software remains provisional TRL 4; integrated-platform TRL unverified.

**Next action:** perform Gate A, then create and test a single coordinated candidate only after the exact current heads and intended scope are revalidated. Do not represent this coordination document as code integration or qualification evidence.

**Shakti Standards:** ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.
