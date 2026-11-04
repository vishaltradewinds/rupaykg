# CTO execution checkpoint — EPR read-only tenant RLS hardening

Date: 2026-11-02 17:23 UTC
Governing standard: Shakti Standards
Canonical application repository: `vishaltradewinds/rupaykg`
Reference UI repository: `vishaltradewinds/rupaykg-aistudio`
Status: Engineering CI PASS for the narrow EPR read-only slice; production HOLD; certification OFF.

## 1. Evidence boundary and repository authority

- Canonical application source remains `vishaltradewinds/rupaykg`; `rupaykg-aistudio` is a UI/reference repository, not the application system of record.
- Canonical `main` HEAD at inspection: `a3fecc0abd2c46549a201058d3963afc0e3a73c9`.
- The requested `docs/engineering/RUPAYKG_RESUME_POINT_LATEST.md` did not exist on canonical `main` or the documentation checkpoint branch at the start of this run. It is created alongside this checkpoint on the existing PR #204 documentation branch.
- No production DDL/DML, migration, role/grant/RLS change, Neon branch operation, Render setting change, deployment, worker/scheduler activation, external registry write or certification occurred.

## 2. Authoritative Neon production snapshot — read-only

Project `rupaykg-production-fresh` (`steep-mud-79906940`), primary/default branch `main` (`br-restless-base-b44cip2h`), database `rupaykg`.

Read-only catalog query on 2026-11-02 returned:

- 67 public base tables.
- RLS enabled: 0/67.
- FORCE RLS: 0/67.
- `public.schema_migrations`: 92 rows; latest version `20261021`.
- The only `rupaykg%` role returned was `rupaykg`: LOGIN, BYPASSRLS, CREATEROLE, CREATEDB and INHERIT.
- Query identity was database `rupaykg`, current user `rupaykg`, PostgreSQL 18.6. The session was not transaction-read-only, but the executed statement was SELECT-only; no data or catalog mutation was issued.

Production tenant isolation therefore remains FAIL/BLOCKED. The elevated production login cannot be treated as a least-privilege application runtime. The two RLS/tenant-isolation lab branches and other rehearsal branches remain non-authoritative; they were not changed or deleted.

## 3. Verified engineering batch

### EPR read-only tenant slice

PR [#211](https://github.com/vishaltradewinds/rupaykg/pull/211) remains OPEN / DRAFT / UNMERGED and is stacked on PR #205, which depends on PR #192.

Current PR #211 head:
`0d4ea374d13cec45b7cb4855fce1e4725225fd40`

Changes in the candidate branch:

- Dedicated `GET /api/v1/epr/returns` route.
- Route is registered only when `RUPAYKG_REQUEST_CONTEXT_MODE=enforced`; the default remains `disabled`.
- Authenticated active organization is the only accepted tenant scope; query/body overrides are not used and unverified organization headers fail closed.
- Permission check and protected EPR list read use the same checked-out transaction client with the signed tenant context.
- Legacy EPR create/submit/external-reference write routes remain unregistered.
- Candidate migration `20261110_epr_return_read_tenant_rls.sql` enables and forces RLS only on `public.epr_returns`, creates one signed-organization SELECT policy, grants SELECT only to the dedicated `rupaykg_app_runtime` on the returns table and scheme catalogue, and grants no EPR writes.
- Startup contract requires the actual API pool connection to be `rupaykg_app_runtime`, a NOBYPASSRLS/NOINHERIT role with no memberships/elevated attributes, the exact SELECT policy and FORCE RLS, verifier execution, no signing-key read, and no EPR write privileges.
- The server entry point does not register the older `epr-return-routes.ts` module; the new route is separately gated.

### Regression discovered and repaired

- Exact-head CI on preceding commit `587bd716bd513200b62cdaafac6bfc7b24e78da9`, run [41490061149](https://github.com/vishaltradewinds/rupaykg/actions/runs/41490061149), failed because an expected permission-denied statement left the PostgreSQL transaction aborted before the next negative assertion.
- Commit `0d4ea374d13cec45b7cb4855fce1e4725225fd40` added a savepoint/rollback boundary around each negative privilege assertion.
- Exact-head CI [41490199189](https://github.com/vishaltradewinds/rupaykg/actions/runs/41490199189) completed SUCCESS.
- Verified job steps: migration validation, restricted EPR runtime-role provisioning, restricted verifier-owner provisioning, disposable migrations, bootstrap temporary-privilege revocation, typecheck, build, two-custodian synthetic bootstrap integration, browser smoke, full tests and production-container build all completed successfully.
- API workspace reported 174/174 tests passed, 0 skipped. Other workspace suites reported 22/22, 2/2, 29/29, 1/1 and 2/2, each with 0 skipped.
- CI logs showed expected permission denials for EPR INSERT, UPDATE, DELETE and direct SELECT on `app_security.request_context_keys`. The two-tenant test also passed tenant A/B isolation, missing-context and forged-context checks.

This is disposable CI evidence only. It is not production Neon role/credential acceptance, a live RLS test, regulatory acceptance or field validation.

## 4. Controlled integration spine and duplicate prevention

- PR #192: authentication/bootstrap candidate, OPEN / DRAFT / UNMERGED; current head `cd6de7c1de0de625ff1181265891c3320f07ceee`; exact-head CI [41484881042](https://github.com/vishaltradewinds/rupaykg/actions/runs/41484881042) SUCCESS.
- PR #205: signed request-context bridge, OPEN / DRAFT / UNMERGED; current head `2bdcc6f02e730d0a81f2fd69a4db348609ff1663`; exact-head CI [41485584069](https://github.com/vishaltradewinds/rupaykg/actions/runs/41485584069) SUCCESS.
- PR #211: EPR read-only RLS slice, OPEN / DRAFT / UNMERGED; exact-head CI [41490199189](https://github.com/vishaltradewinds/rupaykg/actions/runs/41490199189) SUCCESS.
- Older PR #207 contained a second EPR list implementation in an unregistered legacy module, without the database-enforced RLS slice. It was commented and closed unmerged as superseded by #211. Its branch was not deleted.
- PR #210 is closed unmerged; the required Shakti branch CI trigger and restricted runtime-role provisioning are present in the #211 candidate workflow.
- PR #195 remains OPEN / P0. Its status was updated with the current #192 CI evidence and the still-missing production approval gates.

Do not merge the stack merely because individual exact-head CI runs pass. Independent security review, base/head reconciliation, migration sequencing and production gates remain required.

## 5. Shakti lifecycle assessment

| Lifecycle gate | Current evidence | State |
|---|---|---|
| Context and evidence discovery | Canonical repo, active PRs, CI, Neon project/branch and production catalog inspected | PASS for this batch |
| Statutory/compliance boundary | EPR route is read-only; no statutory filing or regulator acceptance claimed | BOUNDARY DEFINED; external acceptance open |
| Feasibility and design | Signed context, same-transaction permission/data access, one-table RLS slice | ENGINEERING DESIGN IMPLEMENTED IN CANDIDATE |
| Engineering | Dedicated route, startup guard, candidate migration and regression tests | CANDIDATE IMPLEMENTED |
| Testing | Exact-head CI and disposable PostgreSQL tests passed | PASS FOR CANDIDATE |
| Independent approval | Independent security/DBA review not evidenced | OPEN |
| Production deployment | No production migration, role, secret or deployment | NOT AUTHORIZED |
| Operations and measurement | No live tenant traffic, field data or production telemetry acceptance | NOT ESTABLISHED |
| Continuous assurance | Route/table matrix and complete worker/background-path coverage remain incomplete | OPEN |

## 6. Evidence-based TRL

- Platform-wide TRL: **NOT ASSESSED / TRL 9 NOT ESTABLISHED**.
- The narrow software slice has lab-level engineering evidence: typecheck/build, browser smoke, disposable PostgreSQL migrations, multi-tenant negative tests and production-container build. This supports at most a provisional component-level TRL 4 interpretation for the tested software slice; it does not establish a whole-platform TRL.
- No evidence in this batch proves a production operational environment, field instrument calibration, Jabalpur SITE-JBP-01 operation, Guardian publication/execution, Hedera HCS consensus/read-back, live Mirror Node verification, external registry acceptance, disaster recovery or independent certification.
- Do not represent CI as pilot acceptance, regulatory approval, production readiness or TRL 9.

## 7. External blockers and indispensable approvals

1. Founder approval of the initial platform authority identity and out-of-band two-custodian bootstrap ceremony for PR #192.
2. Independent security review of the bootstrap trust model, signed-context verifier, EPR RLS policy, runtime role and complete endpoint/worker data-access coverage.
3. DBA-approved production provisioning of dedicated NOLOGIN function owners, restricted app/auth runtime roles and separately provisioned signing material, followed by exact Neon identity/privilege verification.
4. Complete the endpoint → SQL/table → pool/client/transaction → tenant/geography/bilateral scope matrix before expanding RLS beyond the isolated EPR read slice.
5. Render inspection is blocked: the connector lists a single workspace named “My Workspace” but requires explicit workspace confirmation before using it. No workspace was selected.
6. Real external provider credentials, field/site evidence and independent acceptance are still required for Guardian/Hedera/Mirror Node and the Jabalpur pilot.

## 8. Next execution order

1. Reconcile PR #192 → #205 → #211 against their latest base/head refs; obtain independent review and keep production disabled.
2. Complete the route-to-data authorization matrix for all HTTP routes, workers, webhooks and background jobs; classify single-tenant, geography-scoped and bilateral operations.
3. Resolve first-authority bootstrap approval and production least-privilege role/secret provisioning only through the required human/DBA gates.
4. Rehearse the exact production migration sequence on a disposable production-derived database; verify migration-ledger parity and rollback/restore before any production request.
5. Extend RLS one table/workflow at a time, each with exact runtime-role tests, two-tenant positive/negative cases and independent review.
6. Resume BWG and other stakeholder modules only where their transaction/authorization contracts are clear; do not allow feature work to bypass the integration spine.
7. Obtain Render workspace confirmation before runtime/deployment inspection. No deployment or worker/scheduler activation without explicit approval.
8. Continue MRV/EPR/carbon/IoT and national pilot evidence work only after the relevant security and statutory dependencies are satisfied.

Immutable checkpoint for this run. Subsequent work must add a new checkpoint rather than rewrite this file.
