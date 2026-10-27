# RupayKg Agentic AI — capabilities, controls and rollout

## Implemented in this source-code increment
- Authenticated, organization-scoped workflow planning backed by authoritative PostgreSQL records.
- Four allow-listed goals: measurement review, compliance preparation, resource-flow/custody tracing, and stakeholder onboarding checklist.
- Evidence gates and explicit READY, BLOCKED, and REQUIRES_HUMAN steps.
- Optional provider-neutral OpenAI-compatible chat-completions adapter for plain-language plan explanation. It is disabled by default and has no tools or action-execution access.
- Capability discovery endpoint and unit tests for planning gates and model adapter configuration.
- Shakti Standards lifecycle / TRL boundary documentation.

## Stakeholder coverage baseline
See [AGENTIC_STAKEHOLDER_PERMISSION_MATRIX.md](AGENTIC_STAKEHOLDER_PERMISSION_MATRIX.md) for the pan-India stakeholder matrix, current-versus-planned implementation status, permission boundaries, cross-cutting control roles, source/evidence expectations, rollout batches and Shakti Standards gates.

The matrix identifies 35 stakeholder categories. This is target coverage, not a claim that each category has a dedicated agent or live integration. The current increment provides four generic read-only advisory workflow goals only.

## API
- `GET /api/v1/agentic/capabilities`
- `POST /api/v1/agentic/plan` with JSON such as `{"goal":"prepare_compliance","geographyId":"optional-uuid"}`
- Add query parameter `?explain=true` to request an optional model explanation. When model configuration is absent or the provider fails, the response reports DISABLED or UNAVAILABLE without blocking the evidence-grounded plan.
- Requires a valid bearer session, active organization, and `audit:read` or `projects:manage` permission.

## Optional model configuration
Model use is disabled unless explicitly enabled. Configure through deployment secrets/environment, never source control:
- `RUPAYKG_AGENTIC_MODEL_ENABLED=true`
- `RUPAYKG_AGENTIC_MODEL_BASE_URL=https://<trusted-provider-host>` (remote HTTPS required; HTTP allowed only for localhost inference)
- `RUPAYKG_AGENTIC_MODEL_NAME=<configured-model-name>`
- optionally `RUPAYKG_AGENTIC_MODEL_API_KEY`
- optionally `RUPAYKG_AGENTIC_MODEL_TIMEOUT_MS=8000` (bounded to 1000–20000 ms)

The adapter sends a bounded plan summary, not raw uploaded evidence. Model output is capped and treated as advisory text only. The model cannot invoke tools, write records, or override policy. Use a trusted endpoint; review data-residency and privacy terms before enabling any remote provider.

## Explicitly not implemented or not claimed
- Autonomous mutation/execution of domain actions.
- OCR/evidence extraction, external registry submissions, Hedera write/consensus verification, W3C VC signing, weighbridge/device control, or statutory filings.
- Long-running queues/retries, persistent agent memory, multi-agent delegation, model evaluation/observability dashboard, or provider-specific operational integration.
- Dedicated agents for all stakeholder categories in the matrix.
- Field validation, independent security review, TRL advancement, or production certification.

Those capabilities require domain-specific evidence, explicit authorization, idempotency, audit trails, threat modelling, integration tests, operational recovery and human approval gates. Production certification remains HOLD/OFF.
