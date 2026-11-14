# RupayKg Greenfield Repository Assessment

**Status:** Initial static assessment with remediation tracked separately; runtime behavior and live environment not independently validated  
**Baseline reviewed:** `main` at the time of review on 2026-10-26  
**Target:** Greenfield pan-India platform defined in `docs/GREENFIELD_PLATFORM_BASELINE.md`  
**Decision:** Do not infer production readiness from current repository structure or historical CI results.

## 1. Assessment method

This is a first-pass assessment of selected repository files from the default branch. It is intentionally evidence-limited. Findings below distinguish direct code observations from items requiring tests or authorized environment evidence. This document is not a full code audit, regulatory opinion, or production acceptance report.

## 2. Directly observed findings

| Area | Observation | Greenfield disposition | Priority |
|---|---|---|---|
| Runtime startup | Root `Dockerfile` starts `migrate.js`, then `acceptance-seed.js`, then `production-server.js`. The acceptance seed file has an environment guard, but the seed process runs before production configuration is validated. | Rework startup ordering so production configuration and a hard production seed prohibition are validated before any mutation. Prefer separate, explicitly authorized migration and application-release jobs. | P0 review |
| Acceptance seeding | `apps/src/acceptance-seed.ts` is gated by `RUPAYKG_ACCEPTANCE_SEED_ON_START=true`, requires a session token, and creates deterministic acceptance records. Its PostgreSQL client uses `rejectUnauthorized: false` when SSL is enabled. | Keep acceptance fixtures isolated from production; fail closed in production regardless of other flags; never disable certificate validation. | P0 review |
| Migration connection | `apps/src/migrate.ts` uses `rejectUnauthorized: false` when `DATABASE_SSL` is not `false`. The production config's CA-certificate handling is not wired into this migration client's TLS options. | Align migration TLS validation with the validated production configuration; use an explicitly trusted CA or a documented provider-supported verified TLS mode. | P0 review |
| Migration execution | The migration runner creates/uses `schema_migrations`, sorts numeric SQL filenames, checks version-to-filename identity, and applies each new migration in a transaction. It does not by itself prove upgrade safety from every possible previously applied schema state. | Add explicit supported-baseline fixtures and disposable PostgreSQL upgrade tests. Keep migration history immutable once released; do not renumber simply to make numbers contiguous. | P1 |
| Dependency install | Root Docker build and CI workflow use `npm install`; CI also runs dependency audit, migration validation, typecheck/build/tests, browser smoke tests, and container build. | Evaluate lockfile-deterministic `npm ci` in CI/build, verify the lockfile is committed and current, and preserve the existing audit/test coverage. | P1 |
| Production config | `apps/src/production-config.ts` requires real auth mode, validates allowed HTTPS origins, rejects a localhost production database target, and sets synthetic data false in the returned config. | Preserve and test these controls, but do not treat this config alone as proof that earlier startup steps cannot mutate data. | Positive control; test needed |
| Migration validation | `scripts/validate-migrations.mjs` detects duplicate numeric identifiers and duplicate simple `CREATE TYPE`/`CREATE TABLE` object declarations. | Retain it as a useful guard; supplement it with PostgreSQL execution, upgrade, privilege, rollback, and drift tests. Static regex validation is not a schema proof. | P1 |
| Regulatory/MRV constraints | Migration `083_mrv_mirror_node_registry_gate.sql` adds a database gate requiring persisted Mirror Node verification alongside Guardian/HCS fields before certain credential states. | Treat as a component requiring integration evidence, exact payload verification tests, independent review, and real external-system acceptance—not proof of end-to-end MRV readiness. | P1 |
| Pan-India target | Root README describes a nationwide circular-economy platform, but this first-pass review has not verified all actor journeys, state/jurisdiction rule coverage, language accessibility, offline conflict resolution, or tenant-isolation behavior end to end. | Build a requirements-to-evidence matrix across all actor classes and jurisdictions; mark untested capabilities as unverified. | P1 |

## 3. Immediate security concern: startup ordering

The Docker startup command is a chained sequence:

`node apps/dist/src/migrate.js && node apps/dist/src/acceptance-seed.js && node apps/dist/src/production-server.js`

The acceptance seed script exits without changes unless `RUPAYKG_ACCEPTANCE_SEED_ON_START=true`. However, it runs before `production-server.js` calls `readProductionConfig()`. Therefore the later production configuration guard is not, by itself, a control that prevents the seed process from running under a production environment with the acceptance-seed flag enabled.

The seed's PostgreSQL client also disables TLS certificate validation when SSL is enabled. The migration client independently uses the same insecure `rejectUnauthorized: false` pattern for SSL connections. Both are concrete code findings; whether either path is currently active in the hosted environment remains unverified.

**Remediation tracking:** The startup-order, acceptance-seed prohibition, and shared verified-TLS changes are implemented in draft PR [#85](https://github.com/vishaltradewinds/rupaykg/pull/85). The PR's exact head has passed CI, including migration validation, CI PostgreSQL migration execution, typecheck, build, browser smoke, tests, and production container build. This is engineering evidence only; the PR remains unmerged and no production deployment has been performed.

**Remaining remediation and release gates:**
1. Independently review PR #85 and verify the exact-head CI record before merge; no production deployment is implied by its CI pass.
2. Move migrations to a separately authorized deployment job using a dedicated migration role, explicit target verification, lock/serialization, verified TLS, and an approved rollback/recovery plan.
3. Inspect the exact current deployed image/commit and authorized environment metadata before claiming exposure or applying any change.
4. Verify target database identity, data inventory, retention decisions, and backup/restore readiness before any data movement.

## 4. Authorized Render metadata checked on 2026-10-26

The connected Render account metadata was read for the existing service and named database. No environment-variable values, credentials, or connection strings were retrieved.

| Resource | Observed metadata | Consequence |
|---|---|---|
| Web service `rupaykg` (`srv-daki4d7qj5pc73b8qksg`) | Active/not suspended; follows `main`; Docker runtime; auto-deploy enabled; public URL `https://rupaykg.onrender.com`; metadata last updated 2026-10-20; IP allowlist `0.0.0.0/0`. | The service exists and is configured for public access. This does not prove its current runtime health, the exact deployed image behavior, or which database it uses. |
| PostgreSQL `rupaykg-db` (`dpg-dakhdv95efls73e1974g-a`) | Suspended by billing; free plan; region Singapore; metadata reports expiry `2026-10-15T09:59:25.074303Z`; IP allowlist `0.0.0.0/0`. | Do not reactivate it or run SQL/migrations without explicit authorization and a confirmed retention/recovery decision. Its actual data contents and whether it is the service's active database target are unverified. |
| Service environment | Service and database metadata share environment ID `evm-dakhdv15efls73e196u0`. | Shared environment membership is not proof that `DATABASE_URL` or `MIGRATION_DATABASE_URL` targets this database. |

**Required next evidence:** an authorized operator should inspect the effective database target in Render and report only sanitized identifiers (provider/project, hostname, database name, role, TLS mode). Do not disclose passwords, complete URLs, tokens, private keys, or certificate contents. Separately confirm the database's retention/expiry status, backup availability, and tested restore path. Until then, source inventory and data migration remain blocked. No database was queried or changed during this metadata check.

## 5. Greenfield classification

The existing codebase is an implementation candidate, not the target specification. No blanket decision to preserve or discard the current schema is justified yet.

Use these labels during the full repository mapping:

- **REUSE:** independently reviewed, tested, secure, and aligned with the target.
- **REFACTOR:** useful domain capability but needs architectural/security changes.
- **REPLACE:** conflicts with the target or cannot be safely evolved at reasonable cost.
- **MISSING:** target requirement with no verified implementation.
- **NOT VERIFIED:** insufficient evidence to classify.

The next audit should inventory API routes, domain packages, database tables and triggers, permissions/tenant boundaries, UI journeys, tests, external integrations, device paths, deployment workflows, and regulatory source records against the greenfield baseline.

## 6. Required gates before merge or production action

- [ ] Review the greenfield baseline and repository assessment.
- [ ] Trace all runtime startup paths, including Docker, workspace scripts, Render/build start commands, and any release hooks.
- [ ] Implement and test the production acceptance-seed prohibition.
- [ ] Remove insecure TLS options from production migration/seed clients and test certificate trust behavior.
- [ ] Validate the final migration inventory against fresh databases and every explicitly supported existing schema baseline.
- [ ] Verify production DB identity, role separation, network exposure, backup/restore and recovery objectives using authorized sanitized evidence.
- [ ] Complete tenant-isolation, authorization, evidence-integrity, offline-sync and cross-actor workflow tests.
- [ ] Complete independent security and compliance reviews.
- [ ] Keep production certification OFF/HOLD until all applicable Shakti gates are evidenced and approved.

## 7. Evidence limits

This review did not connect to a database, run application tests locally, inspect secrets, verify the live database target, validate any MeitY device approval, exercise a real hardware integration, or establish legal/scheme approval. It did not change runtime code, production configuration, billing, networking, data, or certification state.
