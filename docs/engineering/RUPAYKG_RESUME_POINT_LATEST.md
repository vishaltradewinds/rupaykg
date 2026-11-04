

## 2026-11-04 authoritative refresh — CTO Run 13

This section supersedes any conflicting PR #243/issue #245 status above.

### PR #243 exact-head evidence
- PR #243 remains OPEN, DRAFT and UNMERGED; branch `feat/mrv-source-snapshot-v2`.
- Exact head: `b700db8ffde6cd6492b545ed4c6e5bf2271b53b8`.
- Exact-head GitHub Actions run #5320 (`41693406353`) completed SUCCESS on 2026-11-04.
- The single `validate` job passed all configured stages: production dependency audit; migration validation; migrations applied to disposable PostgreSQL; TypeScript typecheck; production build; browser smoke test; full tests including disposable PostgreSQL acceptance; production-container build.
- The strict test assertion requiring the custom `MRV source snapshots cannot be truncated` trigger error is present in this exact tested head. The assertion was not relaxed to accept a foreign-key-only error.
- CI evidence closes the exact-head automated-validation item for this revision; it does not close independent DBA/security review, owner/runtime role boundary proof, migration drift, production tenant isolation, field acceptance or TRL 9.
- Issue #245 received the exact-head CI evidence comment. PR #243 received the exact-head validation comment.

### Current PR #243 implementation checkpoint
- PostgreSQL owns canonical snapshot digest calculation over UTF-8 bytes of `jsonb::text`; application obtains digest from PostgreSQL and the insert trigger independently recomputes it.
- Methodology code is bound to payload; a fixed golden digest vector is tested.
- Snapshot rows reject UPDATE, DELETE and TRUNCATE; strict TRUNCATE-trigger behavior is tested with CASCADE in disposable PostgreSQL.
- Activity source revisions are advanced by triggers for activity, verification, evidence, observations, measurements, artifact versions and independent reviews; credential issuance requires a current latest snapshot revision.
- Artifact version/review revision-trigger migration is present, but targeted regression tests for those two mutation paths have not yet been added. Inspect actual artifact schema and fixture constraints before writing those tests; do not guess column names or fixture shape.
- A preliminary code inspection found the artifact version/review trigger function resolves evidence IDs to activity IDs and increments old/new activities. Independently review its behavior for UPDATEs that move an artifact between evidence records and for missing/deleted evidence.

### Production safety / known blocker (unchanged)
- Authoritative Neon production main remains READ-ONLY / HOLD. Prior read-only evidence: 67 public base tables, 0 RLS, 0 FORCE RLS, 92 migration-ledger rows, latest `20261021`; `mrv_source_snapshots` absent; migration 088 not applied; login role `rupaykg` is BYPASSRLS-capable; Neon branch reported `protected=false`.
- No production migration, SQL write, role/grant/RLS change, branch operation, deployment, worker activation, merge or certification was performed in Run 13.
- PR #243 must remain draft until independent DBA/security review and all production/tenant-isolation dependencies are reconciled.

### Next actions
1. Inspect source migrations that create `evidence_artifact_series`, `evidence_artifact_versions` and `evidence_artifact_reviews`; verify actual FK and key columns.
2. Add targeted integration assertions proving artifact-version insert/update/delete and independent-review insert/update/delete each increment the correct activity revision, including evidence reassignment if schema permits. Use disposable PostgreSQL and preserve strict assertions.
3. Map actual application pool role, migration role, table owner, role memberships and deployment secret wiring from source/configuration without exposing secrets; test role boundaries in disposable PostgreSQL only.
4. Continue complete 67-table tenant ownership, endpoint and worker inventory before any RLS policy rollout.
5. Reconcile PR #215/#196 authorization and tenant isolation, PR #214 migration drift, PR #238 verification provenance and PR #242 EPR authorization. No overlapping incompatible routes or triggers.
6. Keep production READ-ONLY / HOLD; do not merge or deploy based on CI success alone.

### TRL / release posture
- Exact-head engineering CI for PR #243: PASS.
- Independent security/DBA review: NOT COMPLETE.
- Production migration and tenant isolation: NOT COMPLETE.
- Guardian/Hedera/Mirror Node live operational round-trip: NOT evidenced by this CI run.
- SITE-JBP-01 Kathonda field validation: PRE-VALIDATION; field evidence not established here.
- Production certification and TRL 9: NOT ACHIEVED.


## 2026-11-04 refresh — CTO Run 14 (06:06 UTC onward)

### MRV artifact invalidation tests
- Exact test commit `4a8a4572a084811725eed8dd31c2c4a3f4d39eac` passed exact-head CI run #5323 (`41783246996`) with SUCCESS.
- All configured stages passed: dependency audit, migration validation, disposable PostgreSQL migration, typecheck, production build, browser smoke, full tests including PostgreSQL acceptance, and production-container build.
- Added integration regressions for artifact-series mutation, artifact-version insertion, independent artifact-review insertion, and immutable/append-only UPDATE/DELETE rejection.
- Migration README documents 088, 089 and 20261022 in later commit `9bd10a7ae63ac07fe642b4044ad30383f25d71f2`. Exact-head CI #5324 (`41783404982`) is running; typecheck had started after dependency, migration validation and disposable PostgreSQL migration stages passed. Do not claim latest-docs-head CI pass until run completes.
- PR #243 and issue #245 received the exact CI evidence.

### Runtime/migrator privilege boundary finding
Read-only source inspection of main shows one database credential contract, not demonstrated least-privilege separation:
- `.env.example` documents only `DATABASE_URL`.
- `apps/src/server.ts` builds the runtime pool from `DATABASE_URL`.
- `apps/src/migrate.ts` builds the migration pool from the same `DATABASE_URL`.
- `render.yaml` declares one `DATABASE_URL` secret, no dedicated migrator secret.
This proves source/config does not demonstrate credential separation; it does not by itself prove the actual deployed role. Issue #196 has been updated with evidence and a safe remediation sequence. Production role membership/secret review remains required.

### Production safety and release posture
- Production remains READ-ONLY / HOLD. No production SQL writes, migrations, grants, RLS changes, deployment, merge, worker activation or certification.
- PR #243 remains draft/unmerged. CI success on the artifact-test commit is engineering evidence only.
- Independent DBA/security review, runtime-vs-migrator role proof, tenant isolation inventory, migration drift reconciliation, live external anchoring and Kathonda field evidence remain incomplete.
