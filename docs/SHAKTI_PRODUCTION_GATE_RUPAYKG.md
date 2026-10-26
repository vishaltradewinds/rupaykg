# RupayKg — SHAKTI Production Gate

## Purpose

This document is the production-control record for RupayKg under SHAKTI — Standard Operating Systems.

**Rule:** RupayKg must satisfy all applicable SHAKTI gates before it can be treated as SHAKTI-certified for live production. SHAKTI certification does not replace independent statutory, regulatory, contractual, infrastructure-provider, or third-party approvals.

## Current verified baseline — 2026-10-26

- Repository: `vishaltradewinds/rupaykg`
- Default branch: `main`
- Last known deployed commit: `0ddcf6087620880e21ea60f954c9f05d6b759469` (2026-10-20; confirm against the current Render deploy record before any release).
- Render service: `rupaykg`; service ID `srv-daki4d7qj5pc73b8qksg`
- Render URL: `https://rupaykg.onrender.com`
- Render branch: `main`; auto-deploy is enabled.
- Current observed live checks: `/health` HTTP 200; `/api/v1/status` reports PostgreSQL and `syntheticData=false`; unauthenticated `/api/v1/overview` returns HTTP 401; same-origin CORS is allowed and an untrusted origin receives no `Access-Control-Allow-Origin`.
- Current live responses omit HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy and Permissions-Policy.
- The live application reports PostgreSQL but the exact host/project/branch/runtime role have not been authoritatively mapped. A Neon candidate has matching regulatory-source IDs but is not yet proven to be the live target. Read-only checks of both Neon branches show the sole listed `rupaykg` role has CREATEDB, CREATEROLE, REPLICATION and BYPASSRLS, owns the database/public application objects, and has unsafe table privileges; it must not be used as the API runtime identity.
- The original Render PostgreSQL is suspended for billing. The user confirmed RupayKg is a new application not yet proven in a real operating environment and directed use of no-billing options. No specific irreplaceable business records have been identified; do not pay to recover the old Render database. The candidate Neon snapshot is not an authoritative production backup and expires 2026-11-02.
- Integrated draft PR #57 combines the core DB trust-boundary, startup-seed isolation and baseline security-header changes; exact-head CI run #2214 passed. This is branch-only engineering evidence and does not authorize merge/deployment.
- The deployed Docker command and API start script invoke an opt-in acceptance-seed entrypoint. PR #53 removes those invocations and makes the seed fail closed in production; exact-head CI run #2172 for current head `10ca7d8b623b85fd0cd3340f956ae4b8f620de41` passed, but the PR remains draft, unmerged and undeployed.
- No real-site pilot, MeitY-approved instrument acceptance, or production certification has been demonstrated. PR #47's hardware register/site-evidence documentation passed exact-head CI #2193, and PR #51's full hardware approval/evidence-bound parameter stack passed exact-head CI #2199 for current head `f20a1d4ff85b324962607b450a9162816dc1e86c`; both remain draft/unmerged. PR #55 runtime-role enforcement passed exact-head CI #2184 but remains draft/unmerged. PR #56 migration-runner hardening passed exact-head CI #2182; its latest credential-retention hardening passed exact-head CI #2188.

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
| S10 Validation | BLOCKED | Real end-to-end acceptance has not been demonstrated. Guardian/Hedera consensus evidence is required only for features that claim that trust rail; the immediate application gates also include database identity/recovery, safe startup, security headers, authentication, operational workflows, and hardware/methodology controls. |
| S11 Decision | BLOCKED | Do not declare production-ready or SHAKTI-certified. |
| S12 Design | PASS/ONGOING | Current architecture and acceptance path exist; production hardening continues. |
| S13 Production | LIVE / NOT ACCEPTED | The service is reachable, but end-to-end operational acceptance and all applicable release gates remain open. |
| S14 Verification | OPEN | CI/build/deploy evidence is not equivalent to complete live external verification. |
| S15 Compliance & approvals | OPEN | Required external/statutory/operational approvals and evidence remain to be closed. |
| S16 SHAKTI certification | BLOCKED | Certification cannot be issued while material gates remain open. |
| S17 Live release | BLOCKED FOR PRODUCTION ACCEPTANCE | Service is technically live, but SHAKTI live-production acceptance is not complete. |
| S18 Assurance | OPEN | Monitoring, backup/restore and rollback evidence remain to be demonstrated. |
| S19 Learning | ACTIVE | Current acceptance findings are feeding the next production actions. |

## P0 blockers — ordered before any release

1. **Authoritative database:** identify the exact live PostgreSQL host/project/branch and runtime role without exposing secrets; verify the intended schema and migration state. The Neon candidate branches' only listed role has CREATEDB, CREATEROLE, REPLICATION and BYPASSRLS privileges, so it is not suitable as a least-privilege runtime role.
2. **Data recovery decision:** do not recover/pay for the suspended Render database in the current scope because no irreplaceable operational data has been identified for this new app. Separately, before real traffic, establish a no-billing backup/export and successful isolated restore for the chosen runtime database. Do not treat the unconfirmed Neon candidate snapshot as production recovery evidence.
3. **Safe startup:** remove acceptance fixture seeding from all production startup paths and prove the seed refuses production mode (PR #53; CI/review required).
4. **Security:** add and verify baseline browser security headers (PR #52; not deployed). Keep CSP deferred until SPA, workers and evidence upload are compatibility-audited.
5. **Operational acceptance:** test real authentication, organization/geography authorization, activity → measurement → evidence → verification, replay/idempotency, audit provenance, and failure handling against a controlled live environment with isolated test data.
6. **Hardware and methodology:** enforce exact instrument/model/parameter approval, MeitY evidence, calibration and security lifecycle controls. Confirm the actual pilot site and applicable methodology before any measurement is eligible.
7. **Runtime/migration separation:** review and validate migration locking, inventory preflight, TLS verification, runtime least privilege and separate migration credentials (PR #46 is broad and draft).
8. **External trust rail:** where a feature claims Guardian/Hedera verification, demonstrate `Guardian VERIFIED -> Hedera CONSENSUS_CONFIRMED -> persisted provenance -> Mirror Node verification` using real authorized credentials.
9. **Operations:** verify monitoring/alerting, restore, rollback, and incident procedures before opening real production traffic.

## P1 hardening

- Verify edge/API rate limiting and abuse protection.
- Verify secret storage/rotation and absence of production secrets in client bundles.
- Verify database backup retention and tested restore.
- Verify staging/live separation and rollback procedure.

## SHAKTI release rule

A successful build, CI run, deployment, or HTTP 200 response is **not** sufficient for SHAKTI certification.

RupayKg becomes SHAKTI-certified for its defined production release only after every applicable gate is evidenced, all material blockers are closed, and required independent external approvals/evidence are satisfied.

**Current certification decision: BLOCKED — evidence incomplete.**
