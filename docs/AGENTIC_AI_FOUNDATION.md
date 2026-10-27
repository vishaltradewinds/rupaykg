# RupayKg Agentic AI — capabilities, controls and rollout

## Implemented in this source-code increment
- Authenticated, organization-scoped workflow planning backed by authoritative PostgreSQL records.
- Four allow-listed goals: measurement review, compliance preparation, resource-flow/custody tracing, and stakeholder onboarding checklist.
- Evidence gates and explicit READY, BLOCKED, and REQUIRES_HUMAN steps. Evidence counts are described as recorded metadata only; the planner explicitly does not treat counts or an existing APPROVED flag as independent proof of provenance, integrity, admissibility, custody completeness, or verifier independence.
- Optional provider-neutral OpenAI-compatible chat-completions adapter for plain-language plan explanation. It is disabled by default and has no tools or action-execution access.
- Capability discovery endpoint and unit tests for planning gates and model adapter configuration.
- Model-boundary tests verify the provider receives a minimized summary (not organization/geography/source-record identifiers), blocker lists are bounded, provider output is capped, and malformed responses fail closed.
- Typed, allow-listed domain-tool policy registry for activity, measurement, evidence, verification and stakeholder-onboarding reads; workflows are checked against read-oriented permissions required by their tool set before planning.
- Optional disposable-PostgreSQL integration coverage verifies read access is granted by explicit read permissions and rejects `projects:manage`, `VERIFY_EVIDENCE`, and `MANAGE_STAKEHOLDERS` as standalone substitutes. The test runs only when `RUPAYKG_RUN_DB_INTEGRATION_TESTS=1` and `DATABASE_URL` are set.
- Capability discovery reports tool metadata; the model cannot invoke tools. Domain SQL remains fixed, parameterized, and organization/geography scoped in the workflow route.
- Shakti Standards lifecycle / TRL boundary documentation.

## Stakeholder coverage baseline
See [AGENTIC_STAKEHOLDER_PERMISSION_MATRIX.md](AGENTIC_STAKEHOLDER_PERMISSION_MATRIX.md) for the pan-India stakeholder matrix, current-versus-planned implementation status, permission boundaries, cross-cutting control roles, source/evidence expectations, rollout batches and Shakti Standards gates.

The matrix identifies 35 stakeholder categories. This is target coverage, not a claim that each category has a dedicated agent or live integration. The current increment provides four generic read-only advisory workflow goals only.

## Read-only tool registry

The registry in `apps/src/agentic-tools.ts` defines six tool identifiers and their domain, permission alternatives, read-only mode and organization/geography scope. Each of the four goals is mapped to an explicit tool allow-list. The plan endpoint checks each required tool permission before reading domain data and returns `AGENTIC_TOOL_FORBIDDEN` with the denied tool ID when authorization fails. Fixed parameterized read handlers are wired into the route; they return bounded identifiers and aggregate counts, enforce organization/geography scope in SQL, and never accept model-supplied SQL or filters. The registry does not grant permissions or perform writes. Tool metadata is discoverable from the capabilities endpoint. The model itself cannot invoke tools; the server executes only the fixed allow-listed read path after authorization.

## API
- `GET /api/v1/agentic/capabilities`
- `POST /api/v1/agentic/plan` with JSON such as `{"goal":"prepare_compliance","geographyId":"optional-uuid"}`
- Add query parameter `?explain=true` to request an optional model explanation. When model configuration is absent or the provider fails, the response reports DISABLED or UNAVAILABLE without blocking the evidence-grounded plan.
- Requires a valid bearer session and active organization. Authorization is then checked per goal against each tool’s read-oriented permission alternatives; broad `projects:manage` alone is not accepted as a substitute for read permission.

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

## Authorization gate — role-level geography scope
- Migration `092_role_geography_authorization.sql` defines role-root/descendant scope. Migration `093_verification_and_artifact_digest_hardening.sql` adds `identity_has_geography_scope(identity, organization, geography)`, which requires both organization-level and role-level scope and fails closed if more than one verified role exists for the same identity and organization.
- The agentic planner and read handlers use role-level scope. The same shared identity/geography gate is now applied to workspace reads, EPR returns and obligations, CPCB SWM workspace reads/writes, Guardian MRV operations, and evidence verification.
- An empty role scope inherits organization-level geography authorization; it does not bypass organization scope. Unrelated or unlocated records are excluded from geography-bound reads and mutations.
- Real-PostgreSQL regression coverage includes descendant allow, unrelated deny, unlocated deny, and ambiguous-role deny. Evidence-vault tests also verify database-level digest rejection.
- Exact-code CI passed migration execution, typecheck, build, browser smoke, disposable-PostgreSQL tests, and production-container build on commit `296c8af4a7dfeef1b1e41c397f8ee56ea0960852` (run `40487113250`).

This is engineering/CI evidence, not independent security certification. The platform-wide authorization audit remains open for other route families, including registry, settlement/sync, value/carbon, statutory applicability, and stakeholder onboarding. Do not merge, deploy, or enable production certification until those remaining routes are audited and Shakti Standards approval gates are satisfied.
