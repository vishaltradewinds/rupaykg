# RupayKg — SHAKTI Production Gate

## Purpose

This document is the production-control record for RupayKg under SHAKTI — Standard Operating Systems.

**Rule:** RupayKg must satisfy all applicable SHAKTI gates before it can be treated as SHAKTI-certified for live production. SHAKTI certification does not replace independent statutory, regulatory, contractual, infrastructure-provider, or third-party approvals.

## Controlling architecture priority — national deployment first

**National deployment objectives are the primary architecture objective. Jabalpur SITE-JBP-01 Kathonda is the first field implementation and validation instance of that same national architecture—not a separate pilot architecture.**

RupayKg must be built as one pan-India platform. The Jabalpur implementation must use the same shared capabilities, data contracts, tenancy and security model, integration boundaries, release artefacts and operational controls intended for national deployment. Site-specific parameters belong in governed configuration and adapters. Do not introduce a Jabalpur-only fork, data model, API contract or workflow engine. Where a local shortcut conflicts with national operability, the national requirement takes priority.

Controlling architecture record: [docs/RUPAYKG_NATIONAL_DEPLOYMENT_ARCHITECTURE_AND_JABALPUR_VALIDATION.md](RUPAYKG_NATIONAL_DEPLOYMENT_ARCHITECTURE_AND_JABALPUR_VALIDATION.md).

**Validation boundary:** Jabalpur success proves only the site, workflows, integrations and operating conditions actually tested. It does not by itself prove national deployment readiness, nationwide statutory applicability, multi-state acceptance, capacity or TRL 9. National readiness requires separately evidenced tenant isolation, cross-jurisdiction coverage, load/resilience, security, backup/restore, external integration, field operations and rollout gates.

## Controlling DPI ecosystem and commercialisation strategy

Use both DPI ecosystems together but for distinct purposes:

- **DPGA Registry:** reusable software and technology discovery, followed by exact upstream, licence, security, portability and cost evaluation.
- **Global DPI Repository (GDPIR):** implementation, governance, maturity, institutional operating model and deployment learning; not a software marketplace or runtime dependency.
- **RupayKg:** translate validated learning into a commercially viable interoperable environmental operating platform and paid integration/implementation services.
- **DIGICORE INFRASYS:** intended engineering, product, IP stewardship, implementation and managed-services company, subject to documented entity, IP rights and contracting evidence.

The target is a commercially sustainable RupayKg that can be deployed within government-led digital ecosystems under each programme's lawful institutional, data, procurement and security controls. Do not claim that RupayKg is itself a government DPI, public authority, regulator or official operator without a separate legal/institutional basis.

Controlling companion record: [docs/DPI_ECOSYSTEM_STRATEGY_DIGICORE_INFRASYS_RUPAYKG.md](DPI_ECOSYSTEM_STRATEGY_DIGICORE_INFRASYS_RUPAYKG.md).

## Current verified baseline

- Repository: `vishaltradewinds/rupaykg`
- Default branch: `main`
- Current deployed commit: `19c40659594760711e1b3584706b3e1586a903e4`
- Repository head: `19c40659594760711e1b3584706b3e1586a903e4` (current canonical `main` head)
- The deployment identifiers recorded below are historical observed evidence and must not be treated as proof that this repository head is currently deployed.
- Render service: `rupaykg`
- Render URL: `https://rupaykg.onrender.com`
- Render branch: `main`
- Auto-deploy: enabled
- Current Render deployment state: live
- Latest observed production deployment: `dep-dbopsjoae00c73a01ma0`
- Latest observed startup state: production deployment is LIVE; `/health` and `/` returned HTTP 200; runtime DB preflight passed; application startup logs showed no `sslmode` warning in the verified deployment window.
- Acceptance fixture is being created at startup and is explicitly marked as a fixture.

## SHAKTI gate status

| Gate | Status | Evidence / condition |
|---|---|---|
| S01 Reality | PASS | Active repository, branch, deployed service and current commit verified. |
| S02 Context | OPEN | Production runtime context is verified; external-service and operational context remain open. |
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
| S13 Production | PASS | Canonical `main` commit `19c4065959...` is live on Render deployment `dep-dbopsjoae00c73a01ma0`. |
| S14 Verification | OPEN | CI/build/deploy evidence is not equivalent to complete live external verification. |
| S15 Compliance & approvals | OPEN | Required external/statutory/operational approvals and evidence remain to be closed. |
| S16 SHAKTI certification | BLOCKED | Certification cannot be issued while material gates remain open. |
| S17 Live release | BLOCKED FOR PRODUCTION ACCEPTANCE | Service is technically live, but SHAKTI live-production acceptance is not complete. |
| S18 Assurance | OPEN | Runtime health is verified; monitoring, backup/restore and rollback evidence remain to be demonstrated. |
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

## Commercial monetization and DPG sourcing — controlling direction

RupayKg is a proprietary commercial product. The commercial objective is revenue through software subscriptions, enterprise/public-sector contracts, implementation, integration, managed operations, APIs, support, training and SLAs.

Controlling companion records:
- docs/RUPAYKG_COMMERCIAL_MONETIZATION_STRATEGY.md — commercial packages, revenue models, DPGA/GDPIR sourcing strategy and DIGICORE INFRASYS commercialisation role.
- docs/DPG_REGISTRY_COMPONENT_EVALUATION_RUPAYKG.md — ranked DPG component sourcing and integration evaluation.
- docs/RUPAYKG_OPEN_MRV_CORE_FEASIBILITY_ASSESSMENT.md — revised commercial IP boundary; earlier Open MRV Core extraction is on hold.
- docs/RUPAYKG_NATIONAL_DEPLOYMENT_ARCHITECTURE_AND_JABALPUR_VALIDATION.md — national-first architecture and Jabalpur field validation boundary.
- docs/DPI_ECOSYSTEM_STRATEGY_DIGICORE_INFRASYS_RUPAYKG.md — dual DPI ecosystem operating model and commercialisation strategy.

- docs/DPI_ECOSYSTEM_EXECUTION_ROADMAP_RUPAYKG.md — prioritised DPGA/GDPIR research, national capability mapping, buyer validation, component due diligence, commercial service and rollout execution backlog.
- docs/RUPAYKG_NATIONAL_CAPABILITY_GAP_MATRIX_20261107.md — initial repository-backed national capability status and P0/P1 deployment proof gaps.

No root licence, package-publication flag or source-code release is authorised by this workstream. Use selected DPGs as separately governed dependencies/services only where customer value, exact licence, security, operating cost and support responsibilities have been validated.
