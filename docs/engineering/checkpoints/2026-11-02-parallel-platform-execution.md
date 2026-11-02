# RupayKg parallel platform execution checkpoint — 2026-11-02

## Founder direction
Proceed with all material platform workstreams in parallel, not only the stakeholder demonstration. Preserve one authoritative production Neon database. Keep production changes behind independent review and explicit approval.

## Completed in this execution batch
1. `docs/pilot/PILOT_DEMONSTRATION_READINESS_PLAN.md` — stakeholder demonstration objective, stakeholder-by-stakeholder dashboard capabilities, end-to-end synthetic scenario, demo isolation and release gates. Commit `783c00b863192a7b818aba07cfacec2e53a9ebb8`.
2. `docs/pilot/STAKEHOLDER_DASHBOARD_ROUTE_MATRIX.md` — source-level map of existing dashboard modules to APIs and known evidence gaps. Commit `e54a95ff4d3fee570a7086288b7af755e1aa05dd`.
3. `docs/engineering/checkpoints/2026-11-02-stakeholder-pilot-demo-checkpoint.md` — saved demo objective, current blockers and execution sequence. Commit `fce685470ccb719306b621cf444803b244890cd9`.
4. PR #192 fixture changes:
   - Added explicit `ISSUE_CREDENTIAL` to the settlement credential guard verifier fixture, commit `273013a2bdc061c034c81d05586355674bc8f298`.
   - Replaced settlement reconciliation's local application helper with the shared approved-membership helper, commit `86fa0694ee955cff26f731827af2903b36f586e7`.
   - Exact-head CI run `41451938072` failed PostgreSQL acceptance. Summary: 148 passed, 5 cancelled, 0 assertion failures; the settlement credential guard and reconciliation setup hooks still report `registry event requires explicit permission: ISSUE_CREDENTIAL`. No green CI claim.

## Important security correction
The shared helper `apps/src/test-support/approved-membership.ts` currently inserts PENDING membership/scope rows and directly changes application approval, organization status, membership and scope to VERIFIED. That bypasses the actual `auth_private.review_stakeholder_application` authority-bound dual-control workflow. This is NOT acceptable evidence of the production onboarding path. Do not reuse this helper as production-path proof and do not expand it to bypass further guards. Replace it with a test fixture that bootstraps the first platform authority through the actual two-custodian bootstrap function and runs subsequent stakeholder approval through the actual governed review function with signed identity/organization context. If that cannot be established safely in CI, keep those tests blocked and document the gap rather than weakening authorization.
- Root P0 issue: #195, `P0: define a one-time bootstrap for the first platform authority`.
- Issue evidence: production inventory had 0 organizations, 0 identities, 0 roles, 0 memberships, 0 platform access requests and 0 verified platform authorities. This is a bootstrap/release blocker, not evidence of an active tenant-data exposure.
- The actual review function requires identity-bound authority; logs showed `ONBOARDING_AUTHORITY_FORBIDDEN` and `AUTH_REQUIRED` when the synthetic review setup lacked valid request context.
- Test fixture must preserve two distinct custodians, one-time atomic consumption, no application runtime execution rights, and negative tests for reuse/concurrency/self-approval/unauthorized reserved-role grants.

## Parallel workstreams — current evidence and next gates

### A. Stakeholder demo / UX
- Existing source has substantial role/workspace panels, not just a landing page:
  - `apps/web/src/main.tsx` central workbench, permissions-filtered workspace navigation, onboarding, admin and evidence flows.
  - `ulb-command-center.tsx`, resource flow, field device/capture, evidence vault, MRV verification, EPR, CPCB-SWM, statutory applicability, carbon/value, registry, settlement/reconciliation, ESG and multilingual modules.
- The route matrix maps those components to APIs and marks what is only source-level.
- Next: execute a role-by-role browser walkthrough against isolated demo data, verify every mutation and exception, accessibility/mobile, and create a repeatable reset/seed. No synthetic data in production.

### B. Authentication, onboarding and governance
- PR #192 remains draft. CI run `41451938072` failed; do not weaken database guards.
- Issue #195 is the P0 bootstrap path. Need a two-custodian, out-of-band, single-use bootstrap that is used by both disposable CI and the separately approved production ceremony.
- Complete identity-bound onboarding create/withdraw/review functions and convert route writes to them; test actual signed request context and exact runtime roles.

### C. Tenant isolation / database security
- Production Neon baseline previously read-only audited: 67 public tables, 0 RLS enabled, 0 FORCE RLS, zero policies; production role `rupaykg` is BYPASSRLS and elevated.
- Continue complete 67-table ownership/FK/JSON/polymorphic mapping; route-to-SQL/function/trigger/worker matrix; exact runtime roles and grants; bilateral settlement policies; disposable two-tenant negative matrix; backup/restore and rollback.
- Never enable RLS indiscriminately or use the elevated production owner as application runtime. No production DDL, DML, role/grant, secret or migration action in this batch.

### D. MRV, Guardian, Hedera and methodology
- Guardian policy bundle exists at `guardian-policies/WA03.001/policy.json`, but its README explicitly says it is an unpublished implementation build artifact and has no real Guardian IDs, Hedera message IDs, signatures or publication evidence.
- `apps/src/guardian-mrv.ts` returns NOT_CONFIGURED unless `GUARDIAN_MRV_SUBMIT_URL` exists; a VERIFIED response must include an execution ID.
- `apps/src/hedera-anchor.ts` uses testnet by default unless configured; HCS success requires transaction ID and consensus timestamp, and Mirror Node verification is a separate read.
- Next: validate/import the policy in a real Guardian environment; capture policy/execution IDs and execution receipt; verify HCS transaction and Mirror Node proof; bind all to the exact activity/evidence/verification and methodology version. Keep these states distinct and fail closed.
- Carbon methodology production eligibility remains gated by locked authoritative source, applicability, parameters/equations, independent numerical reconciliation and independent regression evidence.

### E. EPR / statutory compliance
- Frontend EPR panel supports draft creation, evidence-backed internal submission and external portal reference recording. It explicitly distinguishes internal workflow from actual CPCB submission.
- Backend EPR submit/external-reference authorization was corrected to use the same transaction client as the mutation in earlier commit `0b06f342290d3b8fa9444db5038b4d90854c4899`.
- Next: exact-head CI, statutory source version/effective-date review, and only claim external portal submission when a genuine portal receipt exists.

### F. Resource operations / IoT / field sync
- Resource-flow and measurement APIs, field-device panel and capture experience exist.
- Next: test device enrollment and identity binding, signed capture, idempotency/replay protection, conflict resolution, scale/weighbridge provenance, custody transitions, mass-balance and offline synchronization under the exact worker/service identity. Device data is untrusted until verified.

### G. Registry / market / settlement
- Registry and settlement panels and API lifecycle routes exist.
- Credential issuance DB guard requires actual independent verification, Guardian VERIFIED, HCS consensus and persisted Mirror Node verification. Do not create issued credentials from demo fixtures or synthetic acceptance activities.
- Settlement requires payer/payee authority, current credential ownership, external authority confirmation and immutable reconciliation evidence. Use sandbox-only demonstration; no fake payment.

### H. Assurance / TRL / operations
- Maintain a claim-to-evidence ledger for every TRL assertion, with requirement, test, artifact, environment, exact commit, independent reviewer and unresolved limitations.
- Run vulnerability/dependency audits, observability/error-path checks, backup/restore, disaster recovery, performance, accessibility, operational runbook, support/incident process and release rollback.
- TRL 9 requires proven operational deployment and sustained use in the intended environment; a passing unit suite or UI demonstration is not sufficient.

## Execution order
Parallelize independent source-level audits, UX mapping, methodology evidence reconciliation, Guardian/Hedera integration verification and EPR/statutory review. Serialize schema/migration changes, bootstrap changes and security-sensitive release steps behind exact-head CI, independent review and founder approval. Use small reversible commits and update this checkpoint on each meaningful batch.

## Release posture
PR #192 and #203 remain draft. Production Neon remains unchanged. Production certification OFF/HOLD. TRL 9 NOT established. No external pilot site has been represented as live by this checkpoint.


## 2026-11-02 follow-on batch — latest findings
- Latest CI run `41452442514` on commit `be2d8e2f0faf99a765a0045d9e94d10b3dc80cb6` failed the disposable PostgreSQL acceptance job. The setup failure is still `registry event requires explicit permission: ISSUE_CREDENTIAL`; other guard tests emit expected rejection errors and are not themselves failures. The workflow log shows no assertion failures in the displayed acceptance summary from the prior run; do not infer a green run.
- Corrected the remaining explicit permission omission in `apps/test/settlement-reconciliation.test.ts`: fixture role now includes `ISSUE_CREDENTIAL`, commit `a771446296290a6b139873300a4e06aa97d6d5b5`. CI for this exact head has not yet been observed. Verify this role/identity is the actual `recorded_by_identity_id` and the role is the one linked to that identity before accepting the result.
- Re-read `migrations/20261102_platform_authority_bootstrap.sql`. It implements a distinct NOLOGIN bootstrap owner, exactly two LOGIN custodian identities via a NOLOGIN capability role, per-custodian claim submission, expiry checks, identity verification, one-time locked state consumption, platform-authority organization/role/membership creation, and immutable ceremony audit hash. Migration preflight requires DBA-provisioned owner role and temporary migration principal membership/ADMIN OPTION, then revokes temporary membership and database CREATE. This is a candidate one-time mechanism, not a completed production ceremony.
- Critical bootstrap assurance still required: inspect complete migration tail and disposable PostgreSQL tests for privilege revocation, function owner, all object grants, role membership cleanup, concurrency/rollback, no third login, secret provisioning/revocation, and identity-to-custodian out-of-band binding. Do not create real custodian credentials or execute production bootstrap without founder/DBA approval.
- Shared helper `apps/src/test-support/approved-membership.ts` still directly updates approval/application/membership/geography state. It does not call `auth_private.review_stakeholder_application`. It remains fixture-only and cannot be accepted as evidence that actual identity-bound dual-control onboarding works. Replace only after building a test that calls the actual review function using signed request context and two distinct, scoped reviewers.
- The credential guard fixture has an explicit `ISSUE_CREDENTIAL` permission on its verifier role, but its setup still failed at registry event insertion in the latest run. If it persists after the reconciliation fixture correction, trace the exact role attached to `recorded_by_identity_id`, database permission helper, role name/permissions parser, membership status and transaction visibility. Do not add permission indiscriminately or disable the trigger.
- Guardian/ HCS code inspection: Guardian policy README says WA03.001 bundle is unpublished and has no real Guardian IDs/signatures/publication evidence. Guardian submit returns NOT_CONFIGURED absent endpoint and only accepts VERIFIED with execution ID. Hedera submit requires real transaction ID + consensus timestamp; Mirror Node verification is separate. Keep all demo outputs visibly synthetic and non-issuance eligible.
- Dashboard route matrix committed at `e54a95ff4d3fee570a7086288b7af755e1aa05dd`; it maps existing source modules to APIs but remains static evidence, not browser/API acceptance.


## 2026-11-02 exact-head CI result and next assurance batch
- Exact commit `a771446296290a6b139873300a4e06aa97d6d5b5` (settlement reconciliation fixture explicitly includes `ISSUE_CREDENTIAL`) has CI run `41452808808`, completed **success**. The workflow's `validate` job completed success with no failed steps. This clears the observed PostgreSQL acceptance failure at this exact code head; it does not validate production Neon roles, RLS, live Guardian/Hedera, real onboarding identities, or production release readiness.
- PR #192 remains draft; no merge/deploy/production mutation.
- Reconfirmed onboarding fixture helper `apps/src/test-support/approved-membership.ts` still directly changes application approvals, organization status, membership status and geography-scope status. It does not invoke `auth_private.review_stakeholder_application`; its comment describes intended equivalent state transitions but does not prove the governed execution path. Treat as test-fixture debt and a gap in integration assurance, not a production bypass finding.
- Settlement route review: creation checks verified access and `settlement:authorize` permission for both payer and payee. Later authorize/settle/confirm transitions verify both-party access but call `canPerformHighRiskActionInDatabase` for payer organization only. This may be an intentional single-operator execution model, but does not establish bilateral counterparty consent. Before release, specify transition-by-transition actor authority, payer authorization, payee acceptance/confirmation, external settlement authority, idempotency, replay resistance, and independent reconciliation. Do not add blanket payee permissions without the policy decision and tests.
- Registry ownership queries remain inconsistent in ordering: some paths order by `created_at DESC` only while settlement creation uses `created_at DESC,id DESC`. A canonical event ordering/ownership function and explicit RETIRED terminal semantics remain required.
- Verifier migration audit draft identifies a further missing predicate: require subject organization `status='VERIFIED'` in addition to verified membership and geography root before approval. This is a migration correction and disposable-PostgreSQL regression gate; no production change.
- The current successful CI result is an engineering validation signal only. Production security posture remains HOLD (67/67 tables without RLS, elevated owner/runtime separation unresolved), live integrations remain unverified, and TRL 9 is not established.
