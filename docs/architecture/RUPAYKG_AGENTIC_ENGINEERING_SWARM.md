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

## 11. Current activation status (honest baseline)

- This document defines the target swarm and controlled delivery plan.
- The current application has an existing TypeScript/Fastify API, PostgreSQL authority, CI workflow and separate worker-related engineering work.
- The repository manifest inspected on 2026-10-31 does not show an installed LLM orchestration SDK in `apps/package.json`.
- No evidence has yet been established that multiple in-platform AI agents are deployed, configured with provider credentials, or running.
- Therefore the swarm is **DESIGNED / NOT ACTIVATED**. Do not describe it as live until deployment, credentials, worker health, queue activity, and end-to-end task evidence have all been verified.

**Decision:** build one governed swarm around the existing RupayKg worker and PostgreSQL foundations; do not build a parallel ungoverned agent platform.
