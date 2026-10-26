# RupayKg — Shakti Requirements and Evidence Matrix (Draft)

- **Document ID:** RKG-SHAKTI-MATRIX-001
- **Version:** 1.0-draft
- **Assessment date:** 2026-10-26
- **Basis:** Existing RupayKg production gate, production readiness/operations records, and currently available project checkpoint evidence.
- **Status:** Engineering control artifact; not a certification or claim of successful real-world pilot operation.

## Status legend

- **PASS:** Current direct evidence proves the stated criterion for the named scope.
- **FAIL:** A direct test/evidence item demonstrates nonconformance.
- **BLOCKED:** A prerequisite is missing.
- **NOT VERIFIED:** No adequate current evidence is available.
- **N/A:** Documented applicability rationale plus authorized approval is required.

Do not treat historical documentation, code presence, green CI, HTTP health, or a deployed service as proof of complete real-world acceptance. Reassess statuses against current evidence before every release decision.

## Relationship to existing canonical records

This matrix supplements, and does not replace, `docs/SHAKTI_PRODUCTION_GATE_RUPAYKG.md`, `docs/PRODUCTION_READINESS_MATRIX.md`, and the production operations/backup/rollback runbooks. The existing readiness matrix uses GREEN/AMBER/RED/NOT_IMPLEMENTED, while the Shakti gate uses OPEN/BLOCKED and the proposed core standard defines PASS/FAIL/BLOCKED/NOT VERIFIED/NOT APPLICABLE. These vocabularies must not be silently mixed; this draft uses the proposed states where possible and records legacy labels only as quoted evidence. Before adoption, reconcile every status against fresh evidence and record an approved mapping.

The existing Shakti gate also references Cloud Run in its release sequence while the currently queried Render service is the observed live service. Treat this as an architecture/documentation discrepancy to reconcile—not as permission to switch providers. Render's current service metadata reports the web service as not suspended, Free plan, branch `main`, auto-deploy enabled, and URL `https://rupaykg.onrender.com`. Its latest listed live deploy is commit `0ddcf6087620880e21ea60f954c9f05d6b759469` (deployment `dep-dbbjqic9v7es73ffofmg`, started 2026-10-20T10:07:05Z). These facts verify the Render control-plane record only; they do not establish production acceptance. A fresh HTTPS smoke check from the authorized desktop on 2026-10-26 returned `/health` HTTP 200 with `status=READY`, `database=AVAILABLE`, `syntheticData=false`, and `/api/v1/status` HTTP 200 with `sourceOfTruth=postgresql`, `syntheticData=false`. However, the Render account's listed Postgres resource `rupaykg-db` (`dpg-dakhdv95efls73e1974g-a`) is **SUSPENDED for billing** and expired on 2026-10-15. Therefore the successful web health response does not prove the web service is connected to that Render Postgres resource; it makes authoritative database-host/project/branch identification more urgent. Do not pay/recover this database or assume it is the live source of truth. These smoke checks prove only health/status responses at the time checked—not authenticated MRV workflow completion, real pilot activity, Guardian/Hedera acceptance, database identity mapping, backup/restore, or regulatory certification.

## Current decision

**ENGINEERING PASS — PRODUCTION HOLD.** The integrated engineering changes described in checkpoint PR #57 have a reported passing exact-head CI run, but PR #57 is still draft/unmerged/undeployed. The currently deployed Render service has passed limited HTTP smoke checks only. Authenticated end-to-end MRV acceptance and required external trust-rail evidence have not been demonstrated. The authoritative live database mapping is not yet confirmed. No merge or deployment is authorized by this matrix.

## Requirement register

| ID | Requirement / acceptance criterion | Current status | Evidence or gap | Release effect / next action |
|---|---|---|---|---|
| RKG-SH-001 | Confirm actual repository, branch, live service and deployed commit | PASS (control-plane metadata + limited smoke test) | Render service metadata and deploy listing currently confirm repository `vishaltradewinds/rupaykg`, service `rupaykg`, branch `main`, and live commit `0ddcf6087620880e21ea60f954c9f05d6b759469` / deploy `dep-dbbjqic9v7es73ffofmg`. Existing `docs/SHAKTI_PRODUCTION_GATE_RUPAYKG.md` records a different historical commit/deployment, so its baseline needs controlled reconciliation. | Update canonical gate/runbook only after confirming and preserving history; this limited pass does not prove application acceptance. |
| RKG-SH-002 | Establish authoritative production DB host/project/branch and role without exposing credentials | BLOCKED — P0 | Render environment values cannot be read by the current audit; the Render Postgres resource `rupaykg-db` is suspended for billing, while the web health endpoint currently reports PostgreSQL available. Candidate Neon projects exist, but live mapping is unconfirmed. | Hard blocker: identify the configured DB host/project/branch from Render Environment using sanitized metadata only (host, database name, provider/project/branch, role; omit password, query params and full URL). Do not recover/pay the suspended Render DB without explicit approval. Verify that health is connected to the intended DB and not a fallback or unrelated target. |
| RKG-SH-003 | Dedicated least-privilege runtime identity; distinct migration identity where required | BLOCKED | Candidate Neon main/staging show only an overprivileged rupaykg role in the inspected snapshot. PR #55/#56/#57 reportedly implement guardrails but are not deployed. | Provision roles only after target DB mapping; verify grants and negative tests. |
| RKG-SH-004 | Production TLS verifies the server certificate and hostname | BLOCKED | PR #56/#57 reportedly enforce TLS configuration; actual target runtime certificate/connection acceptance remains unverified. | Verify against mapped live target; do not disable certificate verification. |
| RKG-SH-005 | Production startup refuses missing/unsafe DB configuration and does not fall back to synthetic data | NOT VERIFIED for live build | PR #53/#57 reportedly prohibit acceptance fixture seeding in production; live deployment predates these unmerged changes. | Test deployed candidate in a safe staging environment before release. |
| RKG-SH-006 | Security headers and browser-origin policy match the production threat model | BLOCKED | PR #52/#57 reportedly add headers; selected headers were absent from the observed live response because changes are not deployed. | Review CSP compatibility separately; verify exact live headers and origin behavior after approved release. |
| RKG-SH-007 | Migrations are validated, serialized, inventory-preflighted and use the proper identity | BLOCKED | PR #56/#57 CI reportedly covers migration validation, clean disposable PostgreSQL, and concurrency acceptance. Production DB target not mapped and PR not deployed. | Confirm inventory against mapped DB; rehearsal and rollback assessment required. |
| RKG-SH-008 | Real identity and organization authorization work in deployed runtime | NOT VERIFIED | Unauthenticated protected endpoint returning 401 is a limited fail-closed smoke test; no authenticated live workflow evidence. | Run approved real-identity acceptance in non-destructive scope. |
| RKG-SH-009 | Activity → measurement → evidence → verification lifecycle succeeds with real, authorized records | NOT VERIFIED | No evidence of completed authenticated end-to-end live MRV workflow; no real pilot operation proven. | Required before production acceptance. Do not seed fake production activity. |
| RKG-SH-010 | Measurement data has provenance, calibration/quality metadata and replay/tamper controls appropriate to device | NOT VERIFIED | Hardware/site integration remains an external acceptance gate. | Produce device/site register, calibration evidence, protocol tests and failure-mode results. |
| RKG-SH-011 | Exact device and sensor models satisfy applicable conformity/procurement requirements | BLOCKED | Applicable exact-model evidence has not been supplied for a production deployment. | Verify MeitY procurement conditions and other applicable BIS/WPC/electrical/EMC/metrology/calibration obligations per device/use; do not apply blanket assumptions. |
| RKG-SH-012 | Regulatory sources and methodology are source-locked, current and correctly scoped | NOT VERIFIED | Catalog and methodology governance controls exist; database catalog is not itself regulatory approval. Candidate catalog has reference-field gaps; methodologies marked `REGISTRY_ONLY` are not thereby implemented/approved. | Resolve metadata gaps and obtain authoritative independent methodology approval/reconciliation evidence. |
| RKG-SH-013 | Guardian verification, Hedera consensus and Mirror Node evidence form a real verified chain where claimed | BLOCKED | Existing production gate says authoritative CONSENSUS_CONFIRMED / Mirror Node evidence is absent; real credentials and live acceptance pending. | Required if this trust-rail chain is in scope; otherwise document an approved scope-specific N/A and remove unsupported claims. |
| RKG-SH-014 | Audit events/provenance are immutable, attributable and independently verifiable | NOT VERIFIED end-to-end | Candidate audit-chain head is empty/incomplete, consistent with no operational records; no live end-to-end proof. | Test append-only behavior, hash/sequence verification, failure recovery and evidence export. |
| RKG-SH-015 | Backup/restore and recovery objectives are tested on an isolated target | BLOCKED — P0 | Render Postgres `rupaykg-db` is currently listed as suspended by billing with expiry 2026-10-15; no paid recovery/upgrade authorized. Neon snapshot protects only the identified Neon candidate, not the suspended Render resource. Restore evidence absent. | Do not incur charges. First confirm whether the suspended DB is actually referenced by the web service; preserve available metadata, map the authoritative DB, then establish a free, authorized backup/restore path before production acceptance. |
| RKG-SH-016 | Monitoring, alerting, rate limits, incident response and rollback are operationally tested | NOT VERIFIED | Runbook exists; operational exercises and live edge rate-limit evidence are incomplete. | Perform controlled drills; record evidence, owner and response times. |
| RKG-SH-017 | CI is green on exact proposed commit and tests cover critical failure modes | PASS for reported PR #57 head only | Reported CI run #2230 / 40289232369 passed on 5056debedc937143cd230f073cbad61f78873881; PR is draft and not merged. | Re-run exact-head CI after any changes; CI is necessary, not sufficient. |
| RKG-SH-018 | Local changes and user data are preserved during remediation | PASS as a working rule; continuously verify | Local worktree contains modified test and untracked Guardian policy/configuration files. | Never reset, clean, overwrite, switch branch or force-push this worktree without explicit preservation and approval. |
| RKG-SH-019 | Procurement follows free-first and no unapproved billing | PASS as policy; active dependency remains | User has explicitly required no-billing options; no paid recovery or upgrade authorized. | Do not upgrade/restore a paid resource or incur charges without explicit approval. |
| RKG-SH-020 | Release decision is independently reviewed, scoped and reversible | BLOCKED | Material database mapping, role/TLS provisioning, real acceptance and external evidence remain unresolved. | Keep release HOLD; deployment is last after all applicable gates pass. |

## Evidence capture template

For each requirement, append a dated record:
- Requirement ID:
- Evidence URI / artifact hash:
- Source, version and capture time:
- Environment/site/configuration and tested commit:
- Procedure and expected result:
- Actual result and logs:
- Limitations / what this does not prove:
- Status:
- Owner and due date:
- Reviewer / approver:
- Revalidation trigger / expiry:

Do not paste secrets, full connection strings, personal data or sensitive credentials into this register.

## Release gate

The following are mandatory prerequisites for a production release decision:
1. Confirm the actual live database target from sanitized provider metadata.
2. Verify least-privilege runtime and migration roles on that exact target.
3. Verify production TLS certificate/hostname validation.
4. Reconcile migration inventory and rehearse changes safely.
5. Run authenticated, non-synthetic end-to-end MRV acceptance.
6. Close the in-scope Guardian/Hedera/Mirror Node chain or formally narrow scope without unsupported claims.
7. Demonstrate device/site and applicable conformity evidence for any real physical deployment.
8. Test backup/restore, monitoring, incident response and rollback.
9. Re-run exact-head CI and independent security/release review.
10. Record the Shakti decision and approval before deployment.

**Current release decision: HOLD. No merge, paid recovery, billing activation or deployment is authorized by this document.**