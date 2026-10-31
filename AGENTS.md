# RupayKg Repository Working Rules (Mandatory)

These rules apply to every contributor, agent, automation, engineering batch, audit, and release activity in this repository. They are mandatory and persistent.

## 1. Resume-point rule — never restart from memory or guesswork
At the end of every coherent work batch, update:
- `docs/engineering/RUPAYKG_RESUME_POINT_LATEST.md` with the exact current state and next executable step.
- A dated, immutable checkpoint under `docs/engineering/checkpoints/` for material milestones.
- Relevant domain/architecture/runbook documents affected by the work.

The latest resume point must include: timestamp (UTC), repository, branch, exact HEAD SHA, PR/review state, CI run and conclusion for that exact SHA, work completed, files/commits changed, tests and evidence, production changes (if any), database authority, unresolved risks/blockers, explicit NOT DONE items, and one ordered next-step plan.

Never mark a task complete without evidence. Clearly label facts as VERIFIED, INFERRED, PROPOSED, BLOCKED, or NOT ASSESSED. If a check cannot be run, record that limitation. Do not overwrite historical checkpoint files; create a new dated checkpoint and update the LATEST pointer.

## 2. Mandatory resume procedure
Before any new work:
1. Read this file and `docs/engineering/RUPAYKG_RESUME_POINT_LATEST.md`.
2. Read the latest dated checkpoint and any linked decision records.
3. Check the actual Git branch and HEAD; compare with the recorded SHA.
4. Check current PR metadata and CI for the exact HEAD; never rely on an earlier commit's green check.
5. Inspect the relevant code, tests, database and deployment evidence before acting.
6. Reconcile any drift and update the resume point before proceeding.

If the recorded branch/commit is unavailable or stale, stop and report the discrepancy; do not silently switch to another branch or recreate state from assumptions.

## 3. Database authority and safety
- Neon project `rupaykg-production-fresh`, branch `main` (`br-restless-base-b44cip2h`) is the sole authoritative live production database unless a formally approved, evidenced change supersedes it.
- Rehearsal, staging, preview and test branches are NOT production authorities. Never promote, merge, delete, reset or write to them merely because their schema appears newer.
- Never delete data, branches, migrations, tables, schemas, roles or files as “obsolete” without dependency analysis, backup/restore evidence, owner approval where required, and a recorded reversible change plan.
- Production SQL is read-only by default. Any production DDL/DML, role/grant change, migration, worker activation or deployment requires a reviewed change plan, exact target confirmation, backup/restore readiness, explicit authorization and post-change verification.
- Do not assume the Neon inspection identity is the Render runtime identity. Verify the actual runtime principal independently.
- Keep API, migration, worker, event-writer and read-only operations identities separated by least privilege. Do not activate a worker before its authority, principal, queue scope, monitoring and recovery behavior are approved.

## 4. Engineering and architecture
- Preserve the PostgreSQL-centred modular-monolith architecture unless measured evidence justifies a change. Do not split into microservices by default.
- Keep domain boundaries explicit: stakeholder operations, compliance/EPR, carbon/MRV, evidence, registry/settlement, field sync, government intake and external trust adapters.
- Treat PostgreSQL as the operational system of record; do not create competing “authoritative” stores.
- Maintain explicit state transitions. Capture, synchronization, authoritative acceptance, verification, value eligibility, certification/issuance, external registration, transfer/retirement, settlement and reporting are distinct states.
- Never imply that code presence proves a live integration, regulator acceptance, certification, credit issuance, payment, hardware approval or field operation.

## 5. Shakti Standards and TRL
Apply Shakti Standards to every relevant workstream: reality/context discovery, evidence, legal/statutory boundaries, feasibility, validation, solution selection, design, engineering, testing, approval, certification, deployment, operation, measurement and continuous assurance.
Golden Rule: **ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.**
Include a TRL assessment with evidence and limitations. Software, hardware, integrated service and operational deployment may have different readiness levels. Do not claim TRL 9, pan-India readiness or production certification without independent, real-world operational evidence.

## 6. Regulatory and integrity boundaries
- Indian statutory requirements (including applicable CPCB, SWM, EPR and CCTS obligations) remain distinct from voluntary frameworks and internal product rules.
- ICVCM Core Carbon Principles may be used as a complementary integrity benchmark; never present them as a substitute for Indian law or statutory approval.
- A baseline, internal assessment, methodology calculation, evidence hash, ledger entry or test pass is not itself regulator approval, a carbon credit, external registry confirmation or settlement proof.
- Version and preserve source documents, methodology/rule snapshots, provenance, reviewer identity and approval history. Dual-control requirements must be enforced, not just described in UI text.

## 7. Security, evidence and operational discipline
- Map routes to tables, operations, tenant scope and permissions before claiming tenant isolation.
- Do not blanket-enable RLS. Design policies with transaction-local identity/tenant context, least-privilege roles and positive/negative cross-tenant tests.
- Preserve append-only audit/evidence history where required; quarantine ambiguous or untrusted records rather than silently resolving them.
- Treat external submission timeouts as ambiguous outcomes until reconciled; design idempotency and duplicate prevention.
- Do not expose secrets, credentials, personal data or raw sensitive payloads in logs, audit documents or checkpoints.

## 8. Batch and change discipline
- Work in coherent, dependency-ordered batches; avoid isolated changes that break the execution plan.
- Before each write, inspect current content and branch. Never overwrite a file based on stale content.
- Run the narrow tests first, then the relevant integration/security/migration tests, then full CI as appropriate.
- Record exact commands, run IDs, commit SHAs and results. A green CI is an engineering signal, not production certification.
- Keep PRs draft until independent review, security, migration, operational and release gates are satisfied. Never merge solely because GitHub reports mergeable.
- State explicitly what was not changed. No hidden assumptions, silent cleanup or destructive “simplification”.

## 9. Completion standard
A batch is complete only when its code/documentation, tests/evidence, risk status and resume point agree. The next session must be able to continue from the recorded SHA and next action without asking the user to reconstruct prior work.
