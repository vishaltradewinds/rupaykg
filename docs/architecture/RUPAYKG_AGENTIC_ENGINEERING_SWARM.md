# RupayKg Agentic Engineering Swarm — Architecture and Delivery Plan

**Status:** Architecture baseline proposed; implementation and live activation are NOT yet complete.
**Owner:** RupayKg CTO execution function
**Standard:** Shakti Standards
**Scope:** Internal engineering, quality, compliance, security, operations and TRL assurance. This is not an autonomous statutory decision-maker or carbon-credit verifier.

## 1. Plain-language operating model

RupayKg will have one coordinating **Swarm Orchestrator** and a set of specialist agents. The Orchestrator breaks an approved objective into small tasks, assigns each task to the right specialist, checks dependencies, collects evidence, and reports the result.

Agents are workers, not authorities. They may inspect, propose, code, test, and prepare changes within their permissions. They cannot approve their own work, silently change production, certify statutory compliance, issue credits, move money, or declare TRL 9.

The swarm is an engineering capability inside RupayKg. It is distinct from the existing ChatGPT scheduled engineering task and from the existing application background workers.

## 2. Specialist agent roster

| Agent ID | Responsibility | Allowed outputs | Hard boundary |
|---|---|---|---|
| `cto-orchestrator` | Plan work, dependencies, prioritisation, dispatch and reporting | Task graph, assignments, status, escalation | Cannot self-approve or bypass gates |
| `repository-architect` | Repository map, PR overlap, architecture drift, source-of-truth map | Architecture findings, change proposals | No destructive cleanup without review |
| `database-integrity` | Migration parity, schema drift, branch identity, backup/restore evidence | SQL read-only reports, migration proposals, rehearsal results | No direct production DDL/DML or role changes |
| `application-engineering` | API, UI, domain logic, integration implementation | Branch commits and pull requests | No direct production deployment |
| `security-guardian` | Threat modelling, dependency/security checks, auth/RBAC, tenant isolation | Findings, tests, remediation PRs | Cannot weaken controls or mark own findings accepted |
| `quality-assurance` | Unit, integration, browser, API and regression test plans/results | Reproducible test evidence and failure reports | Cannot convert skipped tests into passes |
| `regulatory-compliance` | Version-controlled statutory register and workflow-to-obligation mapping | Traceability matrices, source-backed gap reports | No legal opinion, statutory approval or regulator impersonation |
| `mrv-methodology` | Measurement, evidence lineage, quantification, verification and registry integrity | Methodology checks, provenance and reconciliation reports | Cannot validate/verify/issue credits as an independent accredited body |
| `iot-edge-engineering` | Device onboarding, sensor integrity, calibration, connectivity and edge security | Device profiles, test evidence, integration PRs | No device command that can create unsafe physical outcomes |
| `devops-reliability` | Build/release, observability, backup, restore, incident and capacity | Deployment plans, SLO and recovery evidence | Production changes require explicit release approval |
| `trl-assurance` | Shakti gate evidence and TRL progression | Evidence index, gate status, unresolved assumptions | Cannot self-certify TRL 9; independent evidence required |

Agents can be split into parallel sub-agents only where tasks do not mutate the same files, database objects, or shared state.

## 3. Control-plane architecture

```text
Founder / authorised human approver
                 |
          Swarm Orchestrator
                 |
      Policy + task dependency graph
                 |
        Durable task queue
                 |
  +--------------+--------------------+
  |              |                    |
Specialist agents / bounded execution workers
  |              |                    |
Read-only tools  Isolated worktrees    Disposable DB branches
  |              |                    |
  +--------------+--------------------+
                 |
       Evidence and artifact store
                 |
     Independent QA + security review
                 |
          Human approval gates
                 |
     Existing CI / release pipeline
                 |
       Controlled production release
                 |
         Monitoring and feedback
```

### Core components

1. **Agent registry:** versioned agent IDs, role prompts, capability scopes, allowed tools, model route, budgets, timeouts and owner.
2. **Task queue:** durable task state, dependencies, priority, idempotency key, lease/heartbeat, attempts, timeout, cancellation and dead-letter handling.
3. **Orchestrator:** deterministic planner and dispatcher; LLM may help plan but cannot override policy.
4. **Tool gateway:** allowlisted GitHub, CI, database, Render, Neon and evidence operations, each with scoped permissions.
5. **Workspace isolation:** one branch/worktree per task; no shared mutable worktree; disposable database branches for schema changes.
6. **Evidence store:** immutable links/hashes for commit, PR, CI run, SQL rehearsal, test output, source citation, approver and timestamps.
7. **Policy engine:** capability checks, data classification, approval requirements, spending limits, rate limits and environment boundaries.
8. **Observability:** task traces, agent/model/version, token/cost usage, retries, queue age, failure reasons and operator actions.

## 4. Task lifecycle

`PROPOSED → TRIAGED → READY → CLAIMED → RUNNING → REVIEW_REQUIRED → APPROVED → MERGED → RELEASE_APPROVED → DEPLOYED → VERIFIED`

Terminal alternatives: `BLOCKED`, `REJECTED`, `CANCELLED`, `FAILED`, `ROLLED_BACK`.

- Every task has a human-readable objective, acceptance criteria, risk class, dependencies, owner agent and expiry.
- Claims use atomic leases and fencing tokens; stale workers cannot commit results after lease expiry.
- Retries are bounded and idempotent. Repeated failures go to a dead-letter queue with a concise incident report.
- Agent-to-agent messages are task-scoped and recorded; no hidden side channel.
- A task is not complete until the required tests and evidence are attached.
- Agents may create branches and draft PRs. Merge and production release gates are independent.

## 5. Permission tiers and approval gates

| Tier | Example actions | Policy |
|---|---|---|
| A — Read | Read repository, CI, logs, schema metadata, documentation | Allowed by default within connected account permissions |
| B — Isolated write | Create branch, edit files, run tests, create draft PR, create disposable DB branch | Allowed for assigned tasks with audit trail |
| C — Shared non-production | Update staging config/data, merge reviewed code, run staging migrations | Requires explicit scoped approval and tested rollback |
| D — Production | Production schema/data/role changes, secrets, Render settings, deployment, financial/registry actions | Human approval every time; separate operator identity; two-person review for high-impact actions |

Always prohibited to autonomous agents:
- Exfiltrate secrets, print connection strings, tokens or private keys.
- Disable security controls, tenant boundaries, audit trails or monitoring to make a test pass.
- Modify production data/schema/roles, create credits, approve verification, transfer/retire assets or move funds without the relevant human/legal/business authority and established workflow.
- Self-approve code, security exceptions, compliance outcomes, or TRL gates.
- Claim success without verifiable evidence.

## 6. Model and cost routing

- Provider adapters must be pluggable; the orchestration contract must not depend on one model vendor.
- Route tasks by risk and capability: deterministic code/SQL checks first; smaller/low-cost models for classification and summarisation; stronger models for architecture/security analysis; human review for consequential decisions.
- Support configurable providers such as Groq, OpenRouter, Hugging Face, Gemini and local Ollama where supported by the deployed environment.
- Local inference is an optional route, not a guarantee of zero cost or production suitability.
- Per-agent and per-project budgets, maximum tokens, concurrency, timeout and daily spend ceilings are mandatory.
- If no provider credentials/configuration exist, the agent remains `DISABLED`; do not silently fall back to a paid provider.
- No production personal, confidential, statutory or commercial data is sent to a third-party model unless data classification, provider terms, retention, region and explicit policy permit it.

## 7. Initial parallel workstreams

### Wave 0 — Foundation and safety
- Inventory existing workers, task tables, PRs and CI.
- Confirm one authoritative production database and isolated staging.
- Define agent registry, queue contract, tool scopes and audit evidence.
- Recover and reconcile migration 096; do not rewrite production history.
- Define tenant data classification and threat model.

### Wave 1 — Read-only agents
- Repository architect, database integrity, security guardian, regulatory compliance, TRL assurance.
- These agents produce reports and draft PRs only.
- Compare agent outputs against deterministic scanners and human reviewers.

### Wave 2 — Isolated engineering agents
- Application engineering, QA, IoT edge and MRV methodology agents.
- One isolated branch per task; disposable database branches for schema work.
- Automated tests and independent review required before merge.

### Wave 3 — Controlled staging operations
- Deploy only to staging with approval.
- Run authenticated BWG, EPR, MRV, evidence, registry and audit journeys.
- Execute backup/restore, incident, failover and security regression exercises.

### Wave 4 — Production release governance
- Human-approved change window, release evidence, rollback plan, live smoke tests and post-deploy observation.
- Production deployment is performed by the existing release pipeline, not arbitrary agent shell access.

### Wave 5 — Continuous assurance
- Scheduled drift, vulnerability, migration, source freshness, SLA, backup and TRL evidence checks.
- Automatically create prioritised work items; escalate high-risk findings immediately.

## 8. First agent execution backlog

| ID | Task | Initial agent | Risk | Acceptance evidence |
|---|---|---|---|---|
| SWARM-001 | Inventory existing worker/task orchestration and PR overlap | repository-architect | Low | Repository map and dependency report |
| SWARM-002 | Prove Render runtime's exact Neon branch identity safely | database-integrity | High | Non-secret runtime fingerprint + independent Neon match |
| SWARM-003 | Reconcile migration 096 provenance and current schema/function | database-integrity | High | Historical SQL comparison, live definition hash, reviewed decision |
| SWARM-004 | Map tenant-owned tables and API authorization paths | security-guardian | High | Table/route/tenant matrix |
| SWARM-005 | Draft least-privilege role/RLS design on disposable branch | security-guardian + database-integrity | Critical | Positive/negative cross-tenant tests; no production mutation |
| SWARM-006 | Add migration repository/ledger parity gate | application-engineering + QA | High | CI tests fail on orphan/missing migrations |
| SWARM-007 | Map BWG/EPR/MRV statutory and evidence journeys | regulatory-compliance + MRV | High | Versioned obligation-to-workflow traceability |
| SWARM-008 | Define TRL evidence register and operational acceptance | trl-assurance | Medium | Evidence-backed Shakti gate matrix |

## 9. Implementation sequence and release criteria

The first implementation must reuse and reconcile the existing worker foundation where possible. Do not create a second competing queue or duplicate background-worker system before the current worker tables, leases, claim semantics, and PR candidates have been inspected.

Minimum viable swarm is not "many agents running". It is:
- A single durable queue and orchestrator.
- Versioned agent registry and explicit capabilities.
- Idempotent claims, leases, retries and cancellation.
- Isolated execution workspaces.
- Auditable artifacts and evidence.
- Policy enforcement at the tool gateway.
- Independent QA/security gates.
- Human-controlled merge and production release.
- Operational dashboards and failure escalation.

Before enabling write-capable agents, pass CI, concurrency/lease tests, duplicate-delivery tests, cancellation tests, permission-denial tests, secret-redaction tests, prompt-injection tests, tenant-isolation tests, and recovery tests.

## 10. Shakti Standards and TRL

Every task and agent must carry Shakti stage, evidence type, risk, regulatory boundary, validation result and TRL relevance. Agent orchestration does not itself increase product TRL. TRL 9 requires successful operation in the actual intended environment, sustained performance, real stakeholder acceptance and independently reviewable evidence; it cannot be inferred from CI or agent activity.



## 12. Existing worker foundation discovered — do not duplicate it

A deeper inspection of the current GitHub work identified a substantial existing candidate in draft PR #175:
- PR #175 is titled **Harden government inbox worker lease fencing and migration assurance**.
- It currently contains 134 changed files and 382 commits, and its head is `2e5632d45de89bb3dd944a5d0b86012c2d2d5b1e`.
- Its candidate changes include an asynchronous mirror worker and runner, atomic claim/lease/fencing and concurrency tests, worker privilege tests, database context and role diagnostics, migration-order checks, production-shaped migration rehearsal, route authorization changes, and repository operating rules in `AGENTS.md`.
- The PR description explicitly says production remains HOLD and prohibits production migration, writes, cutover, worker/scheduler activation or certification activation until independent review and migration divergence resolution.
- Its base SHA is `862512c8c904cef0f604df0350f02672318953af`, while the inspected current main deployment is at `b5e91241d84a6712ff544d3deec1805702f45efd`. The base drift must be reconciled before merge; the PR must not be merged just because a CI run passed.

**Architecture decision:** treat PR #175 as the primary existing worker/control-plane candidate to inspect, reconcile and potentially extend. The swarm must reuse its queue/lease/fencing/evidence foundations where they are sound. Do not create a second queue, second scheduler, duplicate worker service, or parallel control plane. The 11 specialist roles in this document are logical agent roles; they may be dispatched by one orchestrator over the existing durable task substrate. Do not activate them until a concrete model/tool adapter, scoped credentials, policy enforcement, budget controls, observability and recovery tests exist.

The next implementation gate is therefore an integration review of PR #175 against current `main`, not a fresh greenfield agent runtime. Review the exact diff by domain and dependency, refresh CI against a reconciled base, independently review worker security and concurrency, and only then decide whether to merge selected commits or rebuild a smaller clean PR. Production activation remains a later separately approved gate.

## 13. Current activation status (honest baseline)

- This document defines the target swarm and controlled delivery plan.
- The current application has an existing TypeScript/Fastify API, PostgreSQL authority, CI workflow and separate worker-related engineering work.
- The repository manifest inspected on 2026-10-31 does not show an installed LLM orchestration SDK in `apps/package.json`.
- No evidence has yet been established that multiple in-platform AI agents are deployed, configured with provider credentials, or running.
- Therefore the swarm is **DESIGNED / NOT ACTIVATED**. Do not describe it as live until deployment, credentials, worker health, queue activity, and end-to-end task evidence have all been verified.

**Decision:** build one governed swarm around the existing RupayKg worker and PostgreSQL foundations; do not build a parallel ungoverned agent platform.


## 14. PR #175 integration preflight — 2026-10-31 17:43 UTC

**Decision: do not merge PR #175 as-is. Do not activate its worker.**

Fresh GitHub metadata and source inspection confirm:
- PR #175 remains OPEN / DRAFT / unmerged. Head: `2e5632d45de89bb3dd944a5d0b86012c2d2d5b1e`; declared base SHA: `862512c8c904cef0f604df0350f02672318953af`.
- Current `main` at the last verified production deployment is `b5e91241d84a6712ff544d3deec1805702f45efd`. Comparing current `main` with the PR head reports a diverged history: PR side 382 commits ahead and 4 commits behind its merge base. The PR's historical green CI is not exact-head evidence for a reconciled integration.
- PR scope is 134 files, approximately 11,728 additions and 567 deletions. This is too broad for a single unreviewed merge.
- The candidate worker implementation exists only on the PR branch; `main` does not contain `async-mirror-worker.ts`, `async-mirror-worker-runner.ts`, or `government-inbox-hash.ts`.
- The runner has a useful safety seam: it requires `GOVERNMENT_INBOX_DATABASE_URL`, rejects the same DB principal as `DATABASE_URL`, and performs a read-only schema readiness check before queue operations. This is not proof that the dedicated principal exists, is least-privileged, or has been deployed.
- The worker is dependency-injected with a PostgreSQL Pool and includes atomic claims/leases/fencing. The inspected least-privilege review explicitly says there is no worker entrypoint/service registration in the application source and no evidence that `server.ts` starts it. Thus the worker is code under review, not a running capability.
- The candidate `server.ts` introduces tenant transaction context and a startup role diagnostic, but its own tenant-context helper explicitly states that callers still need application authorization and that RLS is not enabled by this helper. It must not be presented as tenant isolation.
- Candidate `migrate.ts` adds production migration gates and ordered phases. However, the candidate migration chronology includes a production-only historical `096` and a future-dated chain. It must be tested from a clean production-shaped baseline; never apply it to live production during integration.
- Candidate worker tests are gated behind `CI=true`, non-production mode, `RUPAYKG_RUN_DB_INTEGRATION_TESTS=1`, and a database URL. A green run must be checked for actual test execution versus skipped tests, exact SHA, PostgreSQL service and uploaded evidence.
- The existing main migration runner does not detect orphaned rows in the database ledger whose source file is absent. The known production 096 ledger/source divergence therefore needs an explicit parity rule and baseline manifest, not a blind source restore or ledger edit.

### Integration plan — controlled extraction, not wholesale merge

1. Freeze PR #175 as a draft candidate; no rebase/merge/production deploy.
2. Reconcile the four current-main commits against the PR's merge base and produce a domain-level dependency map.
3. Extract the worker core, canonical hash, dedicated-pool/schema gate and focused tests into a fresh branch from current `main`, only after each dependency is mapped.
4. Keep migration work separate from worker code. First add deterministic migration source/ledger parity validation and a disposable production-shaped baseline test; do not modify production ledger or schema.
5. Keep tenant-context infrastructure separate from any RLS policy rollout. Map route coverage and test transaction context; do not claim tenant isolation until policies, least-privilege runtime roles and cross-tenant negative tests are demonstrated.
6. Add a worker entrypoint/deployment design only after the dedicated role/grants and service lifecycle are approved. Keep worker OFF by default and prove no web-process auto-start.
7. Run exact-head CI on the fresh branch, verify DB integration tests were not skipped, obtain independent review, then open a small focused PR.
8. Only after review may the orchestrator use this worker substrate for read-only engineering agents. Provider adapters, budget/policy gateway and agent registry remain separate implementation gates.

### Explicit current state

- Worker source: PRESENT on PR #175 branch; ABSENT from current `main`.
- Worker entrypoint / deployed service: NOT ESTABLISHED.
- Dedicated worker DB credential and grants: NOT ESTABLISHED.
- Production migration safety: NOT CLEARED.
- Tenant isolation / RLS: NOT ESTABLISHED.
- Agent swarm: DESIGNED, NOT ACTIVATED.
- Production release: HOLD.
- TRL 9: NOT ESTABLISHED.

This review is an engineering source inspection, not an independent security sign-off. No production database, Render configuration, deployment, or worker state was changed by this preflight.


## 15. Worker foundation reference refresh — 2026-10-31 18:11 UTC

This section supersedes the PR-number, branch-base and status references in Sections 12 and 14; those sections remain as a historical record of the earlier preflight.

- The original PR #175 was closed as a duplicate review surface after its exact worker head was carried forward into canonical stacked PR #161. PR #175 is now closed and must not be treated as the active review.
- Canonical worker/security review is [PR #161](https://github.com/vishaltradewinds/rupaykg/pull/161), branch `shakti/atomic-inbox-claim-2026-10-31`, stacked on [PR #157](https://github.com/vishaltradewinds/rupaykg/pull/157).
- PR #157 was retargeted to current `main` at `b5e91241d84a6712ff544d3deec1805702f45efd`, now reports mergeable/clean, and exact-head CI #41200068648 passed production-shaped migration reconstruction, upgrade, idempotency, PostgreSQL acceptance, build and container steps. It remains draft/unmerged.
- PR #161 exact head `797fd76222c601974f9544d05c275371766b8912` passed pull-request CI #41227789668. Subsequent evidence checkpoint commits are under exact-head CI; see PR #161 for the current SHA and run.
- Read-only Neon catalog evidence now confirms production lacks the queue schema, staging lacks several runner readiness dependencies, no separate worker role exists, and the existing `rupaykg` login has elevated role attributes including `BYPASSRLS`. The full evidence is in `docs/engineering/checkpoints/2026-10-31-neon-worker-principal-queue-preflight.md` on the canonical worker branch.
- The worker is still not activated. No production or staging DDL/DML, roles, grants, secrets, Render settings or deployments were changed. Do not create a duplicate queue or agent scheduler.
- The agent swarm remains DESIGN ONLY / NOT ACTIVATED. It must use the eventual governed worker substrate after schema, principal, tenant-isolation, deployment, budget, observability and recovery gates pass.
