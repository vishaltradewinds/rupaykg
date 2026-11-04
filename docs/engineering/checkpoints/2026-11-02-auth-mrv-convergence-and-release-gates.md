# CTO execution checkpoint — auth/MRV convergence and production RLS release gates

Date: 2026-11-02 17:53 UTC
Governing standard: Shakti Standards
Canonical application repository: vishaltradewinds/rupaykg
Reference UI repository: vishaltradewinds/rupaykg-aistudio
Status: candidate engineering progress verified; production HOLD; certification OFF; TRL 9 NOT ESTABLISHED.

## 1. Evidence boundary

This checkpoint records live GitHub, CI, issue/PR and Neon evidence inspected during this session. Production Neon queries were SELECT-only. No production DDL/DML, migration, role/grant/RLS change, branch operation, deployment, secret provisioning, worker/scheduler activation, provider write, regulatory submission or certification occurred.

The canonical resume pointer and this checkpoint are committed on the existing documentation PR #204 branch. They are not yet present on main.

## 2. Canonical repository and integration spine

- Canonical application repository: vishaltradewinds/rupaykg.
- Reference UI repository: vishaltradewinds/rupaykg-aistudio; it is a design reference, not the application system of record.
- GitHub main at inspection: a3fecc0abd2c46549a201058d3963afc0e3a73c9.
- PR #192 current head at 17:53 UTC: 8f28e4f12136bbb9865b02e2fd2827f4aebf8fe3; OPEN / DRAFT / UNMERGED.
- PR #192 base/merge-base SHA: b5e91241d84a6712ff544d3deec1805702f45efd. GitHub compare reports main is 2 commits ahead of the branch merge base. This is a real integration gate, not a reason to blind-rebase.
- The two intervening main commits must be reconciled deliberately: 14b73560 added AUTH_DATABASE_URL validation for a separate auth runtime pool; a3fecc0 later reverted that field. PR #192 restores the separate auth pool and currently depends on it. The final runtime contract and Render environment must be agreed before merge/deploy.
- PR #192 has no independent review recorded.

## 3. Exact-head CI evidence

### PR #192 source-snapshot correction

- Earlier head cc95b9208815e9181a10be731716b77faa0e6bbf failed API typecheck because the generic MRV source snapshot object, including observations/evidence, was passed to integrityHash(), whose contract is the strict Hedera AnchorPayload.
- Commit b0287552b9211e4c7610ed18da8f0eb1ddbe3780 corrected both source-snapshot comparisons to use a separate SHA-256 digest over the serialized source snapshot. The HCS AnchorPayload schema and integrityHash contract remain unchanged.
- Exact-head CI run 41494418403 completed SUCCESS, including dependency audit, migration validation, restricted verifier-owner provisioning, disposable PostgreSQL migrations, temporary bootstrap privilege teardown, synthetic two-custodian bootstrap, typecheck, build, browser smoke, full API/disposable PostgreSQL tests and production-container build.
- Documentation-only commit c68c023b264522b16530b07e6b846c65135a414e added the worker RLS release gate. Exact-head CI run 41494550889 completed SUCCESS across the same workflow.
- Current PR #192 head 8f28e4f12136bbb9865b02e2fd2827f4aebf8fe3 consolidates a duplicate disabled-worker test; the remaining fail-closed test still asserts the worker makes zero DB connections when disabled. Exact-head CI run 41495054442 was at production-container build as of 17:53 UTC. Recheck the final conclusion before treating this latest head as fully green.
- Earlier failed CI runs remain historical diagnostics. They are not the status of the corrected code head.

### PR #213 — single candidate EPR read-only tenant slice

- PR #213 head: 00f50eedee10035cf98adf58c1b642c4eac7d158; base SHA at creation: ae41ed76ee7f5a64045f526edb1d95acda390945; OPEN / DRAFT / UNMERGED.
- Exact-head CI run 41493275165 completed SUCCESS: migration validation, restricted-role provisioning, disposable migrations, typecheck/build, synthetic bootstrap, browser smoke, full tests and container build.
- The candidate registers only GET /api/v1/epr/returns. It uses withRlsRequestTransaction so permission evaluation and protected EPR reads share the same checked-out signed-tenant client. It does not register EPR write routes.
- The feature flag defaults OFF. Startup requires the exact dedicated runtime connection, NOBYPASSRLS/NOINHERIT/no-membership role contract, FORCE RLS, the expected tenant SELECT policy, verifier execution, no signing-key read and no EPR write grants.
- PR #213 also contains the same production-runtime request-context secret propagation helper and test as PR #212.
- PR #213's base is older than the current PR #192 head. Reconcile/rebase against 8f28e4f and rerun exact-head CI plus independent security/DBA review before merge.

### Duplicate branch convergence

The following PRs were closed unmerged with explanatory comments; their branches were preserved:

- PR #205: second tenant-db-context transaction abstraction superseded by PR #192's canonical signed token/verifier and withRlsRequestTransaction boundary.
- PR #211: older context-aware-pool EPR route superseded by #213's same-client transaction boundary and fail-closed startup contract. Its MRV fixture change is unnecessary because the current #192 fixture uses the governed approved-membership helper and its disposable PostgreSQL suite passes.
- PR #212: request-context runtime environment helper/test is included verbatim in #213.

PR #213 remains the only EPR read-only candidate in this stack. Do not merge it until it is reconciled with the latest #192 base and independently reviewed.

## 4. Authoritative Neon production snapshot — SELECT only

Project: rupaykg-production-fresh (steep-mud-79906940)
Primary/default branch: main (br-restless-base-b44cip2h)
Database: rupaykg
Query role: rupaykg

Observed facts:

- Public base tables: 67.
- RLS enabled: 0/67.
- FORCE RLS: 0/67.
- Migration ledger: 92 rows; latest version 20261021.
- Organizations: 0.
- Identities: 0.
- Roles: 0.
- Organization memberships: 0.
- Platform access requests: 0.
- The only inspected rupaykg-prefixed login role was rupaykg: LOGIN, BYPASSRLS, CREATEROLE, CREATEDB and INHERIT.
- Neon project metadata reports the primary branch is not protected, no IP allowlist entries are configured, and public connections are not blocked. These are additional hardening items to assess; no settings were changed.
- Non-primary staging/rehearsal/security-lab branches remain non-authoritative. No branch was reset or deleted.

Production tenant isolation remains FAIL/BLOCKED. The elevated rupaykg login is not an acceptable least-privilege application runtime. Do not enable RLS or change roles/grants until the complete table/route/worker contract, exact role manifest, adversarial tests, backup/restore and rollback gates pass.

## 5. MRV worker evidence correction and release gate

- Current source apps/src/mrv-submission-worker.ts implements a 30-second lease heartbeat around Guardian, Hedera HCS and Mirror Node external calls, renewing a 120-second lease. The earlier note that no heartbeat exists is stale and must not be repeated.
- If heartbeat renewal fails, the operation is allowed to finish but its result is not persisted under a lease that is no longer owned; the next owner must reconcile using the same persisted Guardian idempotency key or Hedera transaction ID. Explicit provider-call cancellation and lease-loss race tests remain open.
- The worker still executes tenant-related SQL directly through its worker connection and does not establish the same signed tenant-context transaction used by tenant-facing routes.
- Migration 20261109_durable_mrv_submission_jobs.sql intentionally creates no worker grants, RLS policies, narrow SECURITY DEFINER worker functions or production role changes.
- The worker therefore remains disabled. The API durable-job routes remain feature-gated. Do not deploy or activate the worker until a narrow system-actor contract, two-tenant claim/advance/finalize tests, revocation-between-stages tests, lease fencing, provider idempotency/reconciliation and independent review pass.

## 6. Open P0/P1 and stakeholder work

- Issue #195: first platform authority bootstrap remains OPEN. CI exercises only synthetic identities and secrets. No real initial authority identities, custodian logins, claims or secrets have been selected or provisioned.
- Issue #196: production tenant isolation and least-privilege database roles remain OPEN.
- Founder approval of two distinct initial verified authority identities and the out-of-band two-custodian secret-custody ceremony is indispensable before production bootstrap. Independent security review and DBA-approved production role/secret provisioning are also indispensable.
- PRs #193 and #194 contain BWG authorization corrections and disposable acceptance; no independent reviews were recorded in this inspection.
- PR #203 remains the separate UI/UX parity track. It must receive accessibility, keyboard/focus, screen-reader, contrast/zoom, localization and field usability acceptance. UI completion does not substitute for security or operational readiness.
- PR #198 remains a design/audit track; the complete 67-table policy and function/trigger/ACL manifest is not implemented on production.
- Render inspection remains blocked pending explicit workspace confirmation. No workspace was selected.

## 7. Evidence-based TRL

The internal provisional assessment remains unchanged:

- National end-to-end platform: TRL 3, conservative system-level rating.
- Tested software slices: at most provisional component-level TRL 4 based on disposable PostgreSQL, HTTP, browser and CI acceptance.
- MRV/carbon/registry/settlement: component-dependent TRL 3–4; live Guardian/Hedera/Mirror Node and external registry acceptance are not evidenced.
- IoT/edge instrumentation and external integrations: TRL 2–3 / NOT VERIFIED.

No representative Jabalpur SITE-JBP-01 operation, calibrated field instrumentation, real stakeholder network, sustained production tenant traffic, independent field evaluation, disaster recovery acceptance or statutory portal acceptance was evidenced by this session. CI does not raise system TRL. TRL 9 is NOT ESTABLISHED.

## 8. Next execution order

1. Recheck exact-head CI run 41495054442 for PR #192 and record the final container-build conclusion.
2. Reconcile PR #192's two-commit divergence from main, specifically the AUTH_DATABASE_URL/auth-pool contract; do not blind-rebase or merge.
3. Reconcile PR #213 onto the current #192 head, rerun full CI and obtain independent security/DBA review.
4. Complete the machine-readable endpoint → SQL/table → pool/client/transaction → role/function → tenant/geography/bilateral-scope matrix across HTTP routes, workers, webhooks and background paths.
5. Complete the 67-table ownership/policy classification and exact function/trigger/owner/search_path/EXECUTE-grant manifest on a disposable production-derived database.
6. Resolve founder approval for the two-identity/two-custodian bootstrap, independent security review and DBA-approved production roles/secrets.
7. Complete worker system-actor SECURITY DEFINER functions, two-tenant isolation, lease-loss/retry/reconciliation tests and independent review; keep worker OFF.
8. Continue BWG, stakeholder UI and pilot-demo tracks only behind the same Shakti security and statutory gates.
9. Keep production Neon read-only, deployment HOLD, certification OFF and TRL 9 unclaimed.

This checkpoint is immutable. Add a new checkpoint for subsequent engineering work; do not rewrite this file.
