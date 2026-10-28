# RupayKg Resume Checkpoint — 2026-10-20 13:45 UTC

## Repository and current state
- Repository: `vishaltradewinds/rupaykg`
- Branch: `intelligence/ai-evidence-intake-middleware`
- PR: [#41](https://github.com/vishaltradewinds/rupaykg/pull/41) — open, draft, unmerged, undeployed.
- Current branch head at checkpoint creation: `1da4b8ba0a2acd206404373188b62b990564dfa3`.
- Latest fully successful CI on code head: [run #1535](https://github.com/vishaltradewinds/rupaykg/actions/runs/39432120027), tested `2a13676b8a125f79d22ca697f2945799969c3b76`. The only subsequent commits are audit documentation and PR metadata.
- CI passed: production dependency audit (0 production dependency vulnerabilities reported), migration validation and application in disposable PostgreSQL, typecheck, build, browser smoke test, full tests including PostgreSQL acceptance, and production-container build.
- Production was not deployed or migrated. Existing Docker/Guardian/Hedera configuration and configured Hedera account/topic `0.0.10121000` remain unchanged.

## Engineering work completed in this continuation
1. Optional HTTPS-only webhook delivery for government inbox worker attention/failure alerts. URL userinfo/fragments and redirects are rejected; requests time out; only aggregate operational metadata is sent. Endpoint is opt-in and no real webhook is configured.
2. Graceful API shutdown on SIGTERM/SIGINT with Fastify and PostgreSQL pool close, bounded by a 10-second timeout.
3. Added `GET /health/ready` to check critical platform tables and seeded audit-chain head, distinct from the existing basic `/health` connectivity probe. Runtime acceptance tests cover ready and no-database states.
4. AI intake rate-limit hardening: newly created empty job rows are removed when denied before source persistence; existing retry jobs are fenced and marked retryable. PostgreSQL integration test verifies 10 allowed synthetic requests, 11th denied, no extra job row and no provider invocation for the denied request.
5. Field-sync envelope timestamps now require valid timezone-bearing RFC 3339 format with calendar/time validation.
6. The compatibility `/api/v1/operations/sync` endpoint rejects malformed explicitly supplied client sequences instead of silently replacing them with current time. Omitted sequence still has a documented legacy fallback; new clients should send a stable positive per-device sequence.
7. Government interoperability audit and PR description updated with the latest validation and known release gates.

## Important controls
- AI output remains an unverified proposal requiring human review; no direct MRV mutation, credit creation, or Guardian/Hedera mutation from the intake path.
- Government inbox worker `VALIDATED` means internal structural validation only—not official CPCB acceptance, statutory compliance, verified MRV, CCTS verification, or CCC issuance.
- Stakeholder authorization is an internal two-person governance gate, not CPCB registration or government approval.
- No external official API is fabricated or called. No production secrets or credentials were added to Git.

## Remaining gates — do not skip
1. Confirm the exact branch head's code is covered by CI if any further code change is made; documentation-only commits after #1535 do not change the tested code.
2. Exercise the recurring worker scheduler in a clean, isolated staging database with synthetic records; do not mutate inherited records in Neon branch `br-spring-hill-b4544vz5` without an approved triage plan.
3. Configure and test a trusted alert webhook plus an accountable on-call owner and escalation path before enabling the scheduler.
4. Complete PostgreSQL audit-chain concurrency/rollback and historical-chain reconciliation with an explicitly documented legacy cutover boundary.
5. Complete backup/restore, retention/privacy, incident-response, deployment rollback, and independent security review evidence.
6. Keep official CPCB/BEE/Indian Carbon Market authorization/schema onboarding and live Guardian/Hedera/Mirror Node verification as separately authorized gates.
7. Production migrations/deployment require explicit change approval and Shakti release gate approval.

## Resume instruction
Continue on `intelligence/ai-evidence-intake-middleware`. Keep PR #41 draft, unmerged and undeployed. Preserve the existing Docker/Guardian/Hedera configuration and topic/account; do not create replacement keys/topics. Prefer practical, test-backed remediation and update this checkpoint only after new verifiable milestones.
