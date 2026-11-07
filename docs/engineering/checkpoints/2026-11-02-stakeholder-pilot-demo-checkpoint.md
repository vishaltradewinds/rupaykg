# Stakeholder pilot demonstration checkpoint — 2026-11-02

## Founder objective
Deliver a working RupayKg controlled pilot demonstration that can be presented across national/state/district authorities, ULBs, waste generators/producers/PROs, collectors/aggregators, processors, independent verifiers, carbon/methodology reviewers, registry/market participants, settlement counterparties and auditors.

## Durable artifact
- Added `docs/pilot/PILOT_DEMONSTRATION_READINESS_PLAN.md`.
- Commit: `783c00b863192a7b818aba07cfacec2e53a9ebb8`.
- Defines stakeholder dashboard expectations, role/action boundaries, one end-to-end synthetic journey, release gates, current blockers, execution order and explicit acceptance criteria.
- The plan requires isolated demo tenant/data, synthetic labels, no production writes, no fake statutory acceptance, no fake credit issuance and no fake bank settlement.

## Current verified engineering posture
- UI parity PR #203 remains draft. Prior exact-head UI/browser checks passed at the recorded tested head; this is public-entry/theme parity, not proof that all stakeholder workflows are backend-functional.
- Backend/security PR #192 remains draft.
- Latest exact-head CI after lifecycle helper fix: run `41450461789`, commit `654e1696b92047edeeac6cd07412daeb4f95b73e`, FAILED at PostgreSQL acceptance.
- Dependency audit, migration validation, restricted verifier-owner provisioning, disposable PostgreSQL migration apply, privilege teardown, synthetic bootstrap ceremony, typecheck, build and browser smoke passed.
- API acceptance reported 146 passed, 7 cancelled, 0 assertion failures; the two parent suites failed in setup:
  - `settlement-credential-guard.test.ts`: `registry event requires explicit permission: ISSUE_CREDENTIAL` at setup line 39/registry event insertion.
  - `settlement-reconciliation.test.ts`: `verifier lacks VERIFY_EVIDENCE authorization` at setup line 50/verification insertion.
- The previous duplicate membership issue in `lifecycle-integration.test.ts` was removed by commit `654e1696b92047edeeac6cd07412daeb4f95b73e`.
- Attempts to update two remaining test fixture permission arrays through GitHub write action were blocked by repository safety checks. No claim that those changes were committed.
- Do not weaken production database guards. Inspect actual trigger permission semantics and repair the fixture identity/role that performs each operation.

## Immediate next execution batch
1. Fix credential guard fixture: the identity recorded in registry event `recorded_by_identity_id` is verifier; grant exact DB-required `ISSUE_CREDENTIAL` to the correct role/identity or use a distinct authorized issuer identity while retaining independent verifier identity. Keep negative unauthorized actor test.
2. Fix reconciliation fixture: use canonical `approveTestMembership` helper (or align its setup with the helper) and verify organization, same-org membership, geography root/scope and the exact permission representation expected by `enforce_verification_independence`. Current local helper in `settlement-reconciliation.test.ts` only changes application/approval rows and does not create/verify membership or geography scope.
3. Re-run exact-head CI and inspect all setup failures; add positive and negative verifier-scope regression coverage.
4. Inventory actual dashboard routes, APIs, permission checks and mutations by stakeholder; mark missing/dead-end actions.
5. Implement missing authenticated backend handoffs and end-to-end tests, not just dashboard cosmetics.
6. Build isolated deterministic demo seed/environment; never seed production Neon.
7. Run role-by-role end-to-end walkthrough, accessibility and responsive acceptance; produce operator runbook and stakeholder presentation evidence pack.

## Non-negotiable boundaries
- Sole authoritative production DB remains production Neon; no second production DB introduced.
- No production schema/data/role/grant/secret change, migration, deployment or certification from this work.
- No demo identity or synthetic event can be described as a real authority approval, verified environmental outcome, carbon credit, Hedera consensus or bank settlement.
- PR #192 and #203 stay draft until review and gates complete.
- Production certification OFF/HOLD; TRL 9 NOT established.
