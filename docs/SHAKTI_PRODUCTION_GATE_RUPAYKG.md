# RupayKg — SHAKTI Production Gate

## Purpose

This document is the production-control record for RupayKg under SHAKTI — Standard Operating Systems.

**Rule:** RupayKg must satisfy all applicable SHAKTI gates before it can be treated as SHAKTI-certified for live production. SHAKTI certification does not replace independent statutory, regulatory, contractual, infrastructure-provider, or third-party approvals.

## Current verified baseline

- Repository: `vishaltradewinds/rupaykg`
- Default branch: `main`
- Current deployed commit: `61a36493362bb4f4304ec9d52c9032002999e54d`
- Current commit: `fix(acceptance): authorize independent verifier`
- Render service: `rupaykg`
- Render URL: `https://rupaykg.onrender.com`
- Render branch: `main`
- Auto-deploy: enabled
- Current Render deployment state: live
- Latest observed production deployment: `dep-dalu6inqj5pc73ear3t0`
- Latest observed startup state: PostgreSQL migrations current at 81 files; service listening; root request returned HTTP 200.
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
