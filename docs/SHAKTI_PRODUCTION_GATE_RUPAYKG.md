# RupayKg — SHAKTI Production Gate

## Purpose

This document is the production-control record for RupayKg under SHAKTI — Standard Operating Systems.

**Rule:** RupayKg must satisfy all applicable SHAKTI gates before it can be treated as SHAKTI-certified for live production. SHAKTI certification does not replace independent statutory, regulatory, contractual, infrastructure-provider, or third-party approvals.

## Current verified baseline

- Repository: `vishaltradewinds/rupaykg`
- Default branch: `main`
- Current deployed commit: `5c1c215c777b0e7f15a4b74168db5c0f9307fbd5`
- Current commit: `docs: add production backup and rollback runbook`
- Render service: `rupaykg`
- Render URL: `https://rupaykg.onrender.com`
- Render branch: `main`
- Auto-deploy: enabled
- Current Render deployment state: live
- Latest observed production deployment: `dep-dans9ibm8hqs73cck110`
- Latest observed startup state: PostgreSQL-backed health/readiness verified on the current live deployment; service listening; root request returned HTTP 200.
- Acceptance fixture is being created at startup and is explicitly marked as a fixture.

## SHAKTI gate status

| Gate | Status | Evidence / condition |
|---|---|---|
| S01 Reality | PASS | Active repository, branch, deployed service and current commit verified. |
| S02 Context | OPEN | Production context is documented; remaining external-service and operational context must be verified. |
| S03 Need / purpose | PASS | RupayKg is the circular-economy/MRV production platform represented by the current repository. |
| S04 Evidence | OPEN | CI/deployment evidence exists; authoritative external Guardian/Hedera evidence is still outstanding. |
| S05 Understanding | OPEN | Production acceptance path is implemented, but external execution must be demonstrated. |
| S06 Relevance | PASS | Current acceptance work is directly tied to the live-production gate. |
| S07 Boundaries | OPEN | Applicable statutory, security, operational and external-service boundaries remain subject to final production evidence. |
| S08 Options | OPEN | No final production-release decision until the remaining acceptance gates are resolved. |
| S09 Feasibility | OPEN | Software deployment is live; complete production feasibility is not yet proven. |
| S10 Validation | BLOCKED | No observed authoritative `CONSENSUS_CONFIRMED` / Mirror Node evidence in current Render logs. |
| S11 Decision | BLOCKED | Do not declare production-ready or SHAKTI-certified. |
| S12 Design | PASS/ONGOING | Current architecture and acceptance path exist; production hardening continues. |
| S13 Production | PASS | Current main is deployed live on Render. |
| S14 Verification | OPEN | CI/build/deploy evidence is not equivalent to complete live external verification. |
| S15 Compliance & approvals | OPEN | Required external/statutory/operational approvals and evidence remain to be closed. |
| S16 SHAKTI certification | BLOCKED | Certification cannot be issued while material gates remain open. |
| S17 Live release | BLOCKED FOR PRODUCTION ACCEPTANCE | Service is technically live, but SHAKTI live-production acceptance is not complete. |
| S18 Assurance | OPEN | Monitoring, backup/restore and rollback evidence remain to be demonstrated. |
| S19 Learning | ACTIVE | Current acceptance findings are feeding the next production actions. |

## P0 blockers

1. Configure and successfully execute an authoritative production Guardian MRV verification.
2. Securely configure production Hedera operator credentials.
3. Use a real authenticated organization/activity/verification/evidence set for acceptance.
4. Execute the live acceptance workflow against the deployed HTTPS service.
5. Demonstrate the complete chain:
   `Guardian VERIFIED -> Hedera CONSENSUS_CONFIRMED -> persisted provenance -> Mirror Node verification`.
6. Complete production monitoring/alerting, backup/restore and rollback evidence before opening real production traffic.

## P1 hardening

- Verify edge/API rate limiting and abuse protection.
- Verify secret storage/rotation and absence of production secrets in client bundles.
- Verify database backup retention and tested restore.
- Verify staging/live separation and rollback procedure.

## SHAKTI release rule

A successful build, CI run, deployment, or HTTP 200 response is **not** sufficient for SHAKTI certification.

RupayKg becomes SHAKTI-certified for its defined production release only after every applicable gate is evidenced, all material blockers are closed, and required independent external approvals/evidence are satisfied.

**Current certification decision: BLOCKED — evidence incomplete.**


## 2026-10-28 integration candidate status (separate from deployed main)

This addendum records the latest validated integration candidate known at 2026-10-28 09:37 UTC. It does not change the deployed `main` production state recorded above.

- Integration PR: [#97](https://github.com/vishaltradewinds/rupaykg/pull/97)
- Latest documented integration head: `f1c8b1d0a4b7d1b903161bc8e9f1ae565af18498`.
- CI for the latest documented head: [workflow 40665375758](https://github.com/vishaltradewinds/rupaykg/actions/runs/40665375758) — **success** (validate job completed successfully; no failed steps). The prior engineering baseline [workflow 40660423796](https://github.com/vishaltradewinds/rupaykg/actions/runs/40660423796) also passed the full test/build workflow for code head `e77a7a0c26bde7f2b2260f48d4fe5f6bd0ee2925`. The latest commit is documentation-only, so do not misrepresent it as a new full code validation.
- Earlier failed workflows belong to intermediate commits and remain historical evidence; they are not the result for the validated head.
- The integration candidate hardens Guardian idempotency input binding, rejects an explicit Guardian policy mismatch, requires a non-empty Hedera transaction identifier before reporting consensus, and separates technical provenance from actual statutory/methodology/registry eligibility.
- Credential issuance is guarded at the API and PostgreSQL boundary. It requires current activity-specific eligibility bound to the activity, approved verification, verified evidence, methodology version, geography, and validity dates. Acceptance/test fixtures remain ineligible; database integration fixtures that exercise the positive path are explicitly labelled TEST FIXTURE ONLY and are not real approvals.
- PR #97 remains open and unmerged. The latest review check returned no submitted independent reviews.
- Live Guardian/Hedera/Mirror Node acceptance remains unproven. The latest docs-only commit adds negative-case coverage requirements and a sanitized evidence-packet checklist; this is a plan/checklist, not evidence that a live test occurred. The earlier Hedera `INVALID_SIGNATURE` event is historical and does not establish current credential status. Re-run only in an authorized non-production environment and capture fresh evidence.
- Indian statutory applicability, official methodology/source locking, numerical reconciliation and independent methodology approval remain open for each applicable activity/jurisdiction.
- Software TRL remains provisional at TRL 4; TRL 5 is not demonstrated by CI alone. Hardware TRL is not assessed in this record.

### Candidate release decision

**HOLD — PR #97 is not merged and this candidate is not deployed or certified.** Exact-head CI is an engineering pass only. Reassess only after independent code/security review, live external trust-chain acceptance, statutory/methodology decisions, and operational/privacy/resilience evidence are completed and reviewed.
