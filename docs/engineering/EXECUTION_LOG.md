

## 2026-10-31 — National Environmental Infrastructure audit and runtime startup hardening

- Completed a first-pass audit of the canonical repository, authoritative Neon production main and Render service metadata against the proposed National Environmental Infrastructure Master Architecture and TRL 9 Assurance Plan.
- Verified canonical repo vishaltradewinds/rupaykg; Render service rupaykg (srv-daki4d7qj5pc73b8qksg) deploys repository branch main; latest observed live deploy dep-dbis4nm417fc73a8m7ng uses main commit 862512c8c904cef0f604df0350f02672318953af.
- Verified authoritative Neon project steep-mud-79906940, branch br-restless-base-b44cip2h, database rupaykg, PostgreSQL 18.6; production migration ledger 92 rows.
- Read-only production catalog query found 67 public base tables, zero tables with RLS enabled, zero FORCE RLS tables and zero public-schema RLS policies. This is a hard blocker for certifying tenant-isolated national operation and activating the proposed worker.
- Point-in-time read-only row counts: organizations 0, activities 0, resource_flows 0, carbon_projects 0, carbon_calculations 0, audit_events 0, field_devices 0; regulatory_sources 26, regulatory_requirements 15, ccts_methodology_registry 29. Do not infer sustained real-world operation from schema existence.
- Render metadata does not disclose the effective Neon target; no secret was retrieved. Exact runtime database identity remains UNVERIFIED.
- Inspected Dockerfile and confirmed prior web-service startup executed migration runner, acceptance seed, then API server. Migration runner applies all pending repository migrations to the configured DATABASE_URL. Acceptance seed could insert synthetic fixture records when RUPAYKG_ACCEPTANCE_SEED_ON_START=true; production config guarded a different synthetic-data variable.
- Review branch hardening: Docker CMD now starts only production API server; API package start script no longer invokes acceptance seed; acceptance seed rejects NODE_ENV=production. Explicit migration command remains available for separately controlled release operations. No migration was executed and no production database changed.
- Added master architecture/execution/TRL audit and Render runtime security audit documents; updated README entry point.
- Changes are on existing cleanup review branch engineering/authoritative-db-repository-cleanup-2026-10-31 / PR #173 only. Not merged, not deployed. CI has not yet been observed for the new head.
- Remaining Batch 2 blockers: safe Render runtime database identity proof; dedicated least-privilege migration identity and governed migration job; production RLS design and adversarial cross-tenant tests; independent review of public ingress, rate limiting, monitoring and disaster recovery.
- Safety posture unchanged: production HOLD; worker OFF; scheduler OFF; certification OFF; TRL 9 not claimed. No live Neon writes, Render config/secret changes, deployment, worker activation or certification.


## 2026-10-31 — Runtime startup hardening CI result

- Review-branch head `88ce5125ff658c4401d892d0b501d89d3a07eb03` passed GitHub Actions CI run [#41211914512](https://github.com/vishaltradewinds/rupaykg/actions/runs/41211914512), run number 3896.
- Successful steps: dependency audit, migration validation, disposable PostgreSQL migration run, typecheck, build, browser smoke test, disposable PostgreSQL acceptance tests (including acceptance-seed production guard tests), and production Docker image build.
- No production database, Render configuration, deployment or runtime secret was changed. This CI run validates the review-branch code and Docker image only.
- PR #173 remains draft/open/unmerged. Production HOLD; worker OFF; scheduler OFF; certification OFF; TRL 9 not claimed.


## 2026-10-31 — Tenant isolation catalog and RLS ADR draft

- Ran read-only catalog inventory across all 67 public base tables, direct organization_id columns, multi-party organization references and foreign-key relationships.
- Direct organization_id candidates include activities, audit_events, BWG profiles/reporting, carbon projects, CPCB-SWM workspaces/status history, environmental claims, EPR returns, ESG periods, evidence artifact series, field devices, obligations, organisation assessments/applicability/geography/memberships/statutory profiles/verification evidence, platform access requests, resource flows, roles and stakeholder applications.
- Multi-party records include BWG waste reports, chain-of-custody links, credentials, EPR credit transfers/credits, settlements and registry events; these require participant-specific policies, not a single active-tenant equality predicate.
- Read-only pg_roles check confirmed the inspected Neon session login rupaykg is NOSUPERUSER but BYPASSRLS, CREATEROLE and CREATEDB, with LOGIN. This does not prove Render uses that role; runtime principal remains unverified. The inspected role is not suitable as a least-privilege application/worker identity.
- Added draft RLS ADR with provisional table classification, role separation, signed context versus tenant-specific login options, child-row policy requirements, multi-party semantics and adversarial acceptance tests.
- No production roles, grants, policies, schema or data were changed. Worker remains OFF; production HOLD; certification OFF; TRL 9 not claimed.
