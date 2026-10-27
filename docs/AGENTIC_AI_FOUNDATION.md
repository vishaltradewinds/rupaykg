# RupayKg Agentic AI — initial implementation boundary

## Implemented in this change
- Authenticated, organization-scoped agentic workflow planning API.
- Four allow-listed workflows: measurement review, compliance preparation, resource-flow/custody trace, stakeholder onboarding checklist.
- Plans are grounded in PostgreSQL activity, measurement, evidence and verification records.
- Explicit blocker reporting and human-review steps.
- Read-only advisory mode; the planner cannot write operational records, approve compliance, verify evidence, issue/transfer/retire credentials, settle funds, or approve onboarding.

## API
- `GET /api/v1/agentic/capabilities`: lists workflow capabilities and safety boundaries.
- `POST /api/v1/agentic/plan`: JSON body `{"goal":"prepare_compliance","geographyId":"optional-uuid"}`; requires a valid bearer session, active organization, and `audit:read` or `projects:manage` permission.
- Plans are evidence-gated. Missing data is returned as BLOCKED; the service never manufactures evidence or implies legal compliance.

## What this is not
This is a production-code foundation for governed agentic workflows, not a claim of a fully autonomous LLM agent or production certification. No model provider or external paid API is called. A future model adapter must be isolated behind a typed interface, with tool allow-listing, prompt-injection defenses, audit logging, budgets/timeouts, evaluation tests, and human approval gates. Any authoritative write must go through existing domain services and their authorization/idempotency/audit controls.

## Shakti Standards / TRL
- Lifecycle gate: implementation and unit-test evidence only until CI and independent review complete.
- Provisional subsystem TRL: not advanced by this PR; agentic subsystem readiness is NOT DEMONSTRATED beyond source-level implementation until tested in a representative integrated environment.
- Production certification: HOLD/OFF.
