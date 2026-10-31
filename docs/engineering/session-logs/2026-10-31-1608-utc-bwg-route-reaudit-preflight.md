# Session preflight — BWG route re-audit and permission gate — 2026-10-31 16:08 UTC

## Mandatory resume procedure
- Read `AGENTS.md` from working branch.
- Read `docs/engineering/RUPAYKG_RESUME_POINT_LATEST.md`.
- Read immutable checkpoint `docs/engineering/checkpoints/2026-10-31-bwg-api-contract-gap-confirmed.md`.
- Repository: `vishaltradewinds/rupaykg`.
- Working branch: `shakti/atomic-inbox-claim-2026-10-31`.
- Exact branch HEAD before this preflight note: `b2deb5fb7b793e9a90aa59b7eadc22debebc980d`; GitHub ref independently resolves to the same SHA. No unexplained branch drift.

## PR and CI evidence
- PR #175: OPEN, DRAFT, base `main`, head is working branch at `b2deb5fb7b793e9a90aa59b7eadc22debebc980d`; not merged.
- Exact-head CI run #3953 / ID `41217704587`: completed SUCCESS on the exact HEAD above.
- Branch comparison against main: 300 commits ahead, 1 behind; GitHub reports diverged. PR has 300 commits, 107 changed files, 10,223 additions and 565 deletions. This is a material integration-governance risk; do not merge or rebase autonomously.
- GitHub `main` branch protection is disabled; required status checks are not enforced.

## Corrected BWG source review
- Six UI/API paths are implemented in `apps/src/value-routes.ts` and registered by `registerValueRoutes` in `apps/src/server.ts`; `bwg-routes.ts` is not the full BWG reporting API.
- Canonical BWG tables are present in production catalog: `bwg_profiles`, `bwg_reporting_periods`, `bwg_waste_reports`, `bwg_epr_reports`, `bwg_esg_reports`.
- Candidate source migrations: 036–038, 043–044; CPCB BWG workflow tracking in 20261019.
- `GET /api/v1/workspaces/bwg` scopes queries to the authenticated active organization and verified membership, but returns reporting data without an explicit `reports:read` authorization gate. Capability flags are computed, but are not a read-denial boundary.
- `POST /api/v1/statutory/bwg/assess` writes `organization_bwg_assessments`; the BWG profile API writes `bwg_profiles` as `REVIEW_REQUIRED/PENDING`. Migration 044 requires `APPLICABLE/VERIFIED` before period creation. A verified determination-to-profile transition was not found in inspected routes. Do not auto-promote.
- Existing `apps/src/value-routes.test.ts` only tests the profile review basis; no BWG HTTP route tests found in inspected test inventory.
- Issue #176 was corrected to track authorization, statutory workflow linkage, error semantics, quantity invariants and HTTP acceptance—not missing endpoint creation.

## Neon authoritative production preflight (read-only)
- Project `rupaykg-production-fresh`, ID `steep-mud-79906940`.
- Primary/default branch `main`, ID `br-restless-base-b44cip2h`, state READY, Neon branch protection false.
- Database `rupaykg`.
- Catalog SELECT result: 67 public base tables; 0 RLS-enabled; 0 public policies; 5 BWG tables present; migration ledger 92 rows, max version `20261021`.
- Role attributes rechecked: `rupaykg` is LOGIN, BYPASSRLS, CREATEDB, CREATEROLE and REPLICATION; `neon_service` also BYPASSRLS/CREATEDB/CREATEROLE/REPLICATION; `neon_superuser` BYPASSRLS/CREATEDB/CREATEROLE/REPLICATION (NOLOGIN); `cloud_admin` SUPERUSER/BYPASSRLS/CREATEDB/CREATEROLE/REPLICATION. No least-privilege runtime identity established.
- No production DDL/DML, role/grant/RLS change, migration, branch operation or write performed.

## Render runtime preflight
- Render service `rupaykg`, ID `srv-daki4d7qj5pc73b8qksg`, repository `vishaltradewinds/rupaykg`, branch `main`, Docker, health path `/health`.
- Latest live deployment `dep-dbis4nm417fc73a8m7ng` runs commit `862512c8c904cef0f604df0350f02672318953af`, not the working feature branch.
- Runtime database identity and deployed environment binding were NOT ASSESSED; do not infer them from Neon inspection role.
- Render service has public IP allow-list 0.0.0.0/0; no change made.

## Safety and next action
- Production remains HOLD; tenant isolation NOT ESTABLISHED; worker OFF; scheduler OFF; certification OFF; TRL 9 NOT ESTABLISHED.
- Next narrow engineering batch: add explicit `reports:read` gate to BWG workspace read, add authorization unit coverage, correct the stakeholder matrix's stale BWG API gap statement, then run exact-head CI. Separately trace the statutory assessment approval authority before changing the profile state machine.
- Do not merge PR #175, alter production, or claim national production readiness.
