# RupayKg component-specific TRL assessment — 2026-11-01

## Assessment status
**Internal provisional assessment only.** This is not an independent TRL certification, statutory approval, product acceptance or production-readiness decision.

## Evidence basis
- Main commit b5e91241d84a6712ff544d3deec1805702f45efd passed main CI #4007.
- BWG PR #193 exact-head CI #4335 passed; PR #194 exact-head CI #4333 passed. Both include disposable PostgreSQL/HTTP acceptance for evidence/report writes and organization-scoped reads, but neither has an independent review submission.
- PR #192 adds auth/onboarding integration and disposable PostgreSQL acceptance. Its latest exact-head CI #4345 passed migration validation, migration execution, dependency audit, typecheck, build and browser smoke; the full PostgreSQL test step failed because existing fixtures still insert VERIFIED memberships without the governed approval lifecycle. Two newly added negative trigger tests passed.
- Read-only production Neon inventory found zero organizations, identities, roles, memberships and platform access requests; 67 public base tables, zero RLS-enabled and zero FORCE RLS.
- Render is live for the main commit, but this is hosting evidence, not evidence of real tenant operations.
- No real urban/rural stakeholder workflow, calibrated field instrumentation, live Guardian/Hedera/Mirror Node acceptance, CPCB/CCTS portal acceptance, or independent operational evaluation was evidenced.

## Component assessment

| Component | Provisional TRL | Basis | Missing evidence |
|---|---:|---|---|
| Core software/API lifecycle slices | 4 — laboratory only | Disposable PostgreSQL and HTTP tests exercise authentication/authorization boundaries, evidence, verification and lifecycle invariants. | Representative real users, production tenant isolation, operational support and independent acceptance. |
| BWG workspace/reporting | 4 — laboratory only | Exact-head PostgreSQL/HTTP acceptance on PRs #193 and #194 for evidence-backed report writes and organization-scoped workspace reads. | Real BWG, measured waste handover, complete chain of custody, real regulatory reporting and independent review. |
| MRV/carbon/registry/settlement software | 3–4, component-dependent | Deterministic logic and database acceptance cover selected lifecycle and settlement controls. | Live Guardian submission, Hedera consensus, Mirror Node retrieval, independently verified provenance and real external registry acceptance. |
| IoT/edge/physical instrumentation | 2–3 | Architecture and interface planning exist. | Calibrated instruments, deployed edge stations, verified sensor accuracy, secure device enrollment and sustained field telemetry. |
| External trust/regulatory integrations | 2–3 / NOT VERIFIED | Software connectors and fail-closed paths exist. | Live authorized sandbox/production round-trip and authoritative transaction/acceptance evidence for Guardian/Hedera, CPCB, CCTS and registry counterparts. |
| National end-to-end operating system | **3 — conservative system-level rating** | Integrated software prototype and laboratory acceptance across selected domains. | Representative urban and rural operations, real stakeholder network, verified multi-tenant production, calibrated hardware, external acceptance, resilience/restore tests and independent field evaluation. |

## Shakti decision
- Do not claim TRL 5–9.
- Treat CI and disposable databases as laboratory evidence only.
- Increase system-level TRL only after a representative operational demonstration with real authorized participants, measured waste flows, calibrated instruments, independently verified MRV provenance, external acceptance, tenant-isolation proof, operational recovery evidence and independent review.
- Keep statutory compliance, voluntary ESG/ICVCM integrity, carbon methodology eligibility and external credit issuance as distinct evidence gates.
