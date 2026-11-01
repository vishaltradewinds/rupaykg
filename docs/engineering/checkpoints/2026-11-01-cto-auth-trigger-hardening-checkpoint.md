# RupayKg CTO checkpoint — 2026-11-01: auth trigger hardening and bootstrap blocker

**Repository:** vishaltradewinds/rupaykg  
**Integration branch:** shakti/auth-bootstrap-application-integration-2026-11-01  
**Code head:** 003f4e29bf555660681da3052f8152353fa42013  
**Main baseline:** b5e91241d84a6712ff544d3deec1805702f45efd  
**Release posture:** HOLD — production certification OFF — no TRL 9 claim  
**P0 issue:** #195 — first platform authority bootstrap

## 1. Work completed in this batch

On the draft auth integration branch:

1. Restored the existing two-person database guard for reserved roles in public.prevent_direct_membership_activation(). super_admin and platform_admin grants/restores continue to require an APPROVED, applied platform_access_change_requests record, two distinct existing verified super_admin identities, and the original organization/role/target bindings.
2. Retained the stricter approved-stakeholder-application requirement for ordinary membership activation on INSERT and status promotion.
3. Closed a separate approval bypass: new stakeholder_applications must start PENDING. The platform authority check now applies to the governed approval transition, not only UPDATE of an existing row.
4. Removed the unnecessary database-level CREATE grant from rupaykg_auth_owner. The migration principal creates and owns auth_private; the NOLOGIN function owner does not receive CREATE on the database.
5. Granted the auth function owner SELECT on platform_access_change_requests so the reserved-role trigger can evaluate dual control from the SECURITY DEFINER context.
6. Added disposable PostgreSQL negative tests for (a) direct reserved-role membership INSERT and (b) direct stakeholder-application INSERT as APPROVED.

The two new tests passed in exact-head CI as test cases 51 and 52. These are repository changes only; the migration was run only by CI against its disposable PostgreSQL service.

## 2. Exact CI evidence

- Exact-head workflow: #4345, run ID 41331793993.
- Result: FAIL at “Run tests including disposable PostgreSQL acceptance”.
- PASS steps: dependency audit, migration validation, disposable migration execution, TypeScript typecheck, build and browser smoke.
- PASS regression tests: reserved-role INSERT remains behind dual control; direct APPROVED application INSERT is rejected.
- Remaining failure: registry/settlement, runtime-acceptance and settlement fixtures still insert VERIFIED memberships without the governed stakeholder-application/approval lifecycle. Their failures are expected under the stricter guard and must be fixed by a valid bootstrap and real onboarding/review contract. Do not weaken the guard.
- PR #192 remains draft and unmerged.

## 3. P0 bootstrap finding

Production has no initial authority records, and the authorization model is circular:

- An ordinary VERIFIED membership needs an APPROVED stakeholder application.
- An application approval needs a verified platform_admin or super_admin reviewer.
- A reserved-role grant requires two distinct existing super_admin identities.
- A system authority organization is required because role and membership organization_id values are NOT NULL.

A single initial super_admin is insufficient: it cannot approve the second super_admin grant under the existing two-person rule. The bootstrap design therefore needs two distinct, independently pre-bound initial authority identities (or a separately reviewed second-person ceremony), each bound to a separately provisioned single-use secret. Both claims must be consumed atomically. The exact identities, IdP issuer trust, custodians and token provisioning require founder approval and independent security review.

Issue #195 records this. No identity or secret has been selected or provisioned. No public bootstrap route is authorized. No production DDL/DML, role/grant/RLS change, migration, deployment, worker activation or certification was performed.

## 4. Authoritative Neon production snapshot — read-only

- Project: steep-mud-79906940
- Authoritative production branch: br-restless-base-b44cip2h
- Database: rupaykg
- Production counts: 0 organizations, 0 identities, 0 roles, 0 organization memberships, 0 platform access requests.
- Migration ledger: 92 rows.
- Public base tables: 67.
- RLS-enabled tables: 0.
- FORCE RLS tables: 0.
- The inspected current database role is elevated and has BYPASSRLS/CREATEROLE/CREATEDB/REPLICATION capability through its role memberships.
- Main contains 91 migration source files; PR #192 contains 92 including candidate 20261026_auth_scoped_onboarding_mutations.sql. Production history also has a recorded historical version absent from main. Staging ledger has 95 rows and contains additional async mirror/AI-intake history.

No live schema, data, role, grant, policy or branch was changed. Do not replay, rewrite, reset, delete or promote any ledger/branch as a shortcut.

## 5. Hosting and deployment boundary

- Render service: rupaykg, srv-daki4d7qj5pc73b8qksg.
- Tracks main with automatic deploy on commit; free plan, Singapore region.
- Latest live deployment: dep-dbj1r07avr4c73bjc2c0, commit b5e91241d84a6712ff544d3deec1805702f45efd.
- Draft PR branches have not been deployed.
- Do not merge auth changes while the runtime role, auth functions/grants, all API compatibility gates and production environment protection remain unresolved.

## 6. Other active PRs and reviews

- PR #193 BWG profile/report correction: exact-head CI #4335 passed on branch head 27cc85a25e82dad1f8c917d1952beea57a2185c6. No submitted independent review.
- PR #194 BWG workspace read gate: exact-head CI #4333 passed on branch head 0c315293b9dd7a6c238e0b456a1e8d5576c9d640. No submitted independent review.
- PR #192 auth integration: draft; exact-head CI #4345 failed as detailed above; no submitted independent review.
- PRs #189 and #191 remain separate tenant-isolation design/adapter workstreams; revalidate their exact heads and CI before relying on older checkpoints.
- CI success is not legal acceptance, independent assurance, live external integration, production readiness or permission to merge/deploy.

## 7. Provisional TRL assessment

See docs/engineering/TRL_ASSESSMENT_2026-11-01.md and issue #112.

- Core software/API slices with disposable PostgreSQL/HTTP acceptance: provisional TRL 4, laboratory evidence only.
- BWG workspace/reporting slice: provisional TRL 4, laboratory evidence only; no real BWG participant or CPCB submission.
- MRV/carbon/registry/settlement software: component-dependent TRL 3–4; live Guardian/Hedera/Mirror Node proof remains absent.
- IoT/edge/physical instrumentation: TRL 2–3; no calibrated field device or operational telemetry evidence.
- External trust/regulatory integrations: TRL 2–3 / not verified.
- National end-to-end RupayKg operating system: conservative provisional TRL 3. No representative urban/rural end-to-end operational demonstration or independent field evaluation is evidenced. No TRL 5–9 claim.

## 8. Next actions — ordered by safety and critical path

1. Obtain founder approval for the two initial authority identities and the out-of-band trust ceremony; obtain independent security review of token storage, ownership, execution grants, trigger exception and audit evidence. Until then, do not provision production bootstrap claims.
2. On disposable CI only, implement and test the approved bootstrap mechanism with two distinct identity-bound secrets, atomic single-use consumption, dedicated NOLOGIN owner, empty-by-default claim table, immutable audit evidence and no app-runtime EXECUTE privilege.
3. Replace the legacy platform-admin test fixture that disables the membership trigger. Convert all VERIFIED membership fixtures to the bootstrap plus real onboarding/review contract; add missing/reused/concurrent token, self-approval and unauthorized runtime tests.
4. Convert onboarding create/withdraw and hierarchical review/approval routes to identity- and authority-bound auth_private functions. Do not enable least-privilege runtime roles until all API modules are compatible.
5. Complete the 67-table tenant/RLS classification, transaction-local identity context integration, composite tenant integrity, cross-tenant negative tests, and role separation on disposable Neon only.
6. Reconcile production (92) and staging (95) migration ledgers with all exact source files and object-level differences. No historical ledger rewrite or live migration.
7. Obtain independent review of PR #193 and #194 before any merge; both have passing CI but no review submission.
8. Keep staging async mirror/AI-intake workers OFF. Preserve staging queue evidence and expired leases until source, status constraints, idempotency and recovery are reconciled.
9. Demonstrate a real authorized urban and rural workflow, calibrated field instrumentation, live external trust-chain acceptance, backup/restore, monitoring, incident response and independent review before increasing system-level TRL.

## 9. Non-negotiable state

- Neon production: read-only during this run; no mutations.
- Production RLS: 0/67.
- Production deployment: unchanged at main commit b5e912.
- Worker/scheduler activation: OFF.
- Regulatory submissions and carbon-credit issuance: none evidenced.
- Production certification: OFF / HOLD.
- TRL 9: not established.

This checkpoint is immutable. Update the resume pointer, not this checkpoint, on the next run.
