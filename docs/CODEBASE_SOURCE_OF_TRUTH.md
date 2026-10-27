# Codebase source-of-truth and conflict register

This file records current source-of-truth decisions to avoid duplicate or contradictory implementation paths. It is an engineering register, not production certification.

## Confirmed canonical paths

| Concern | Canonical path | Rule |
|---|---|---|
| API production startup | `apps/src/production-server.ts` via `node apps/dist/src/production-server.js` | Validate production configuration before importing the API server. |
| API implementation | `apps/src/server.ts` and feature route modules in `apps/src/` | Production uses the production entrypoint; the server module remains the underlying server and development target. |
| Stakeholder authentication | `apps/src/auth-routes.ts`, `apps/src/auth.ts`, `apps/src/rbac-policy.ts` | Native PostgreSQL-backed sessions; Firebase is not in the current runtime authentication contract. |
| Production configuration | `apps/src/production-config.ts` | Fail closed on missing or unsafe production settings. |
| Dependencies | Root `package.json` + committed `package-lock.json` | Use `npm ci` for reproducible CI and Docker installs. |
| Root workspace commands | Root `package.json` | Build shared packages before API/web typechecking and tests; no `lint` command is exposed until a real linter is configured. |
| Database schema | Ordered SQL files in `migrations/` + migration validator | Do not rewrite applied migrations; add and validate a new migration for schema changes. |
| Container build/start | Root `Dockerfile` | Build from the root lockfile; migrate, then start the production entrypoint. |
| CI validation | `.github/workflows/ci.yml` | CI is a validation gate, not a deployment or production-certification signal. |
| Render declaration | `render.yaml` | Confirm Blueprint linkage before changing resource identity. |
| Guardian policy build source | `scripts/build-wa03-guardian-policy.mjs` | Generator writes `guardian-policies/WA03.001/`; regenerate generated schemas/policy instead of hand-editing them. |
| Guardian packaged artifact | `guardian-policies/RupayKg-WA03.001-v1.policy` | Rebuild with `scripts/package-wa03.ps1` after changing the generator or generated bundle; verify artifact freshness before import. |
| Guardian live acceptance | `.github/workflows/guardian-live-acceptance.yml` | Live evidence is required for real Guardian/Hedera acceptance claims. |
| Regulatory authority | `docs/WA03_001_GUARDIAN_POLICY_SPEC.md` and `docs/WA03_001_GUARDIAN_POLICY_MANIFEST.json`, subordinate to the controlling BEE methodology | Guardian implementation artifacts do not replace the governing methodology. |

## Conflicts identified and disposition

### Guardian WA03.001 duplicate snapshot — source consolidated, live acceptance pending

The structurally different policy snapshot under `docs/guardian-policy/wa03.001/` and its matching schema were removed because the documented generator and packaging script use `guardian-policies/WA03.001/` as the build source. A redirect/readme now identifies the canonical path. The packaged `.policy` artifact remains as a generated import artifact.

This does not establish that the packaged artifact is current or that Guardian has imported/published it. Before import, regenerate the policy, package it, validate the archive, and confirm live Guardian acceptance. No Guardian ID or publication status may be inferred from local files.

### Render Blueprint versus live service name — unresolved

The Blueprint declares `rupaykg-production`, while the existing live service was identified as `rupaykg`. No rename is performed until the Blueprint's resource linkage and change plan are confirmed. Do not create a second production service to resolve a naming mismatch.

### Cloud Build versus Render — distinct responsibilities

`cloudbuild.yaml` builds and pushes a container image; it does not deploy that image to Render. Keep both only if the registry workflow is intentionally used. Confirm triggers and consumers before removing an unused pipeline.

### CI status documents — consolidated

Four redundant marker-only documents named `docs/CI_LATEST_WEB_TYPECHECK_VERIFICATION_*.md` were removed because they contained no run identifiers or verifiable evidence and duplicated one another. GitHub Actions is the current source of CI status; use the exact commit's run and checks rather than static marker files.

### Portable Guardian packaging

`scripts/package-wa03.ps1` no longer assumes one developer's absolute Windows path. It resolves the repository from the script location and fails if the canonical generated policy source is missing.


### Runtime route registration and orphan code

The production API is started through `apps/src/production-server.ts`, which validates configuration and imports `apps/src/server.ts`. Route modules are not active merely because they compile: each intended module must be registered by the server. The audit traced these modules through their actual registration call graph: `value-routes.ts` registers `auth-routes.ts`, `mrv-routes.ts` registers `statutory-routes.ts`, and `bwg-routes.ts` registers `epr-return-routes.ts`. They are therefore live transitively and must not also be registered directly by `server.ts`. A temporary direct registration attempt was caught by the runtime smoke test as a duplicate `POST /api/v1/auth/register` route and was reverted. CI now starts the server to detect duplicate registrations and checks these route families return `401` when unauthenticated rather than `404`.

The web package's `prebuild` hook called `scripts/validate-web-config.mjs`, which only printed a success message and performed no validation. The hook, no-op script, and the matching Dockerfile command were removed. The unreferenced `apps/web/public/signin-bridge.js` asset was also removed because it was not loaded by `index.html` or referenced by the React entrypoint. The remaining public scripts are explicitly loaded by `apps/web/index.html` and were retained.

A stale `docs/CI_VERIFICATION_TRIGGER.md` file was removed because it contained a marker and an obsolete Firebase-authentication claim rather than verifiable CI evidence. The root `lint` script was also removed because every workspace lacked a `lint` script and the command silently succeeded without running a linter; no linter is claimed to be configured. A further web-source audit removed 17 legacy panel files that were explicitly excluded from TypeScript checking, were not imported by the active React entrypoint or loaded by `index.html`, and still depended on Firebase modules absent from the current web package. Their orphaned operating-context/multilingual helper cluster and two fetch-header compatibility declarations were removed as well. The obsolete `apps/web/tsconfig.json` exclusion list is gone so all remaining web source files are typechecked. These deletions remove unused code; they do not claim those legacy panels were functionally replaced in the current UI.

## Release discipline

- Passing CI does not prove live integration or regulatory acceptance.
- Do not merge until required checks and review are complete.
- Do not enable production certification until Shakti Standards evidence gates, TRL evidence, live stakeholder workflows, security/recovery tests and external trust acceptance are independently satisfied.

### Unused-local compiler guard

The root TypeScript configuration enables `noUnusedLocals` to make unused local variables and imports visible to the compiler across the configured projects. The first run surfaced an unused onboarding hierarchy helper and an unused integration-test variable; both were removed without changing route behavior or test assertions. CI must pass on the final head before this guard is treated as validated. This compiler option does not replace a full unused-export or dependency reachability audit.

### Workspace dependency ownership — duplicate web tooling removed

The root workspace no longer declares `vite` or `@vitejs/plugin-react` as root development dependencies. Both are owned directly by `apps/web/package.json`, where the Vite build scripts run. The matching root manifest metadata in `package-lock.json` was updated while preserving the lockfile's installed package records and the web workspace declarations. CI's `npm ci`, build, typecheck and tests must validate this change before it is accepted.

The remaining API dependency `@grpc/grpc-js` was not removed merely because no direct import was found in the inspected API source: the Hedera SDK integration and dependency/peer requirements must be checked against the resolved lockfile before changing it. Likewise, the `@rupaykg/intelligence` workspace package is built by root scripts but its exports are not imported by the current API route module; it is retained pending a product decision whether this package is an intentional future library or should be integrated/retired. A string search alone is not sufficient proof that a package is safe to delete.

### Evidence review authorization boundary — review, not proven vulnerability

The evidence-vault review route checks the active organization's membership and `evidence:review` permission, verifies the organization's geography scope for the activity, then applies the explicit `VERIFY_EVIDENCE` permission and geography-scope check in `canVerifyEvidence`. It also prevents an uploader from reviewing their own artifact and persists the review decision transactionally. The cross-organization geography check inside `canVerifyEvidence` therefore appears to be an additional verifier-scope gate, not standalone evidence of a tenant-isolation defect. Do not alter this authorization path without regression tests covering owner-organization membership, verifier role permission, geography scope, and self-review rejection.

### Render resource identity — account state verified

Read-only inspection of the connected Render workspace on 2026-10-27 confirms the existing production-facing web service is named `rupaykg`, points to `vishaltradewinds/rupaykg`, deploys from `main`, uses the root Dockerfile, and has health check `/health`. Its Render service ID is `srv-daki4d7qj5pc73b8qksg`. The repository Blueprint still declares `rupaykg-production`; this is a resource-identity mismatch, not a safe rename. Do not apply the Blueprint or rename/create a service as part of cleanup until a non-destructive Blueprint plan confirms that it will reconcile to the existing service rather than create a second service. PR branch commits are not the live service's configured deployment branch.

### Duplicate route authentication helpers — reviewed, not mechanically merged

The API contains similar route-local authentication wrappers in `bwg-routes.ts`, `epr-return-routes.ts`, `mrv-routes.ts`, and `registry-routes.ts`. They all fail closed when the database or session authentication is unavailable, but their response payloads and helper signatures differ. The EPR-return module also has a local organization-membership check; other route families use shared organization-scope/permission helpers. These are related patterns, not yet proven drop-in duplicates.

Do not replace them with a shared helper by text similarity alone. A future consolidation must preserve each route's HTTP response contract and test: (1) missing database, (2) missing/invalid/expired session, (3) verified versus unverified membership, (4) active organization selection for multi-organization identities, and (5) organization permission denial. The existing `authenticate` function in `apps/src/auth.ts` remains the canonical session and active-organization resolver.

### Unused integration/package candidates — evidence required

- `@rupaykg/intelligence` is included in root build/typecheck sequencing but its package exports are not imported by the inspected API route modules. This alone does not establish that it is dead code. Retire it only after checking all workspace imports, package scripts, tests, and intended product scope; otherwise record an explicit integration owner and boundary.
- `@grpc/grpc-js` remains a direct API dependency and root override alongside `@hiero-ledger/sdk`. Do not remove it until the resolved dependency tree and SDK peer/runtime requirements prove it is unnecessary. Avoid changing the lockfile based only on a source-level import search.

### Cloud Build pipeline — consumer/trigger not yet verified

`cloudbuild.yaml` builds and pushes a commit-tagged image to Artifact Registry in `asia-south1`; the Render service independently deploys from the GitHub `main` branch using the root Dockerfile. No evidence in this repository alone proves whether a Cloud Build trigger or external consumer is active. Keep the pipeline until its trigger, image consumers, and retention/cost implications are checked in the owning Google Cloud project. Do not claim the pushed image is the live Render image.

### Next safe cleanup gate

Before further destructive cleanup, review actual import/call graphs and package-manager resolution, add regression coverage for any helper consolidation, run the complete CI suite on the exact commit, and keep production changes outside this cleanup PR. The current evidence supports targeted cleanup and explicit unresolved decisions; it does not support deleting the intelligence package, gRPC dependency, Cloud Build pipeline, or changing Render resource identity yet.

### Guardian generator reproducibility — canonical source reconciliation

The generator `scripts/build-wa03-guardian-policy.mjs` preserves the ten reviewed policy-block IDs and the exact canonical metadata timestamps already present in the tracked policy/schema source. New block tags and schema names fail closed until explicitly mapped. The test `scripts/test-wa03-guardian-policy-reproducibility.mjs`, exposed as `npm run test:guardian-policy` and run by CI, verifies repeat-generation byte equality, canonical timestamps, unique/preserved block IDs, deterministic ZIP hashes, required package members, and archive integrity.

**Reconciliation evidence (2026-10-27):** CI run `40505421195` produced a source reconciliation report. It confirmed the README is already byte-identical; before the canonical timestamp mapping was added, policy/schema JSON differed only in metadata timestamps after the canonical block IDs were restored. The current fix explicitly preserves the tracked policy timestamp `2026-09-24T09:14:36.144Z`, the applicability schema's `.137Z/.139Z` timestamps, and the other four schemas' `.139Z/.139Z` timestamps. This should bring all seven generated source files into byte-for-byte alignment with the tracked files; the next CI report must confirm that before any package replacement.

CI uploads the generated source as `guardian-wa03-001-generated-source-review`, a SHA-256 reconciliation report as `guardian-wa03-001-reconciliation-report`, and the deterministic review-only package as `guardian-wa03-001-review-only`. These artifacts are review evidence, not production acceptance.

**Reconciliation result (CI run `40506260663`, commit `f63dcce81218b0061aaab6dfa918a7d792e3a8a9`): PASS.** The report confirms all seven generated source files match the tracked files byte-for-byte and all seven files inside the checked-in `.policy` archive match the generated source by SHA-256. The archive integrity check also passed. No tracked policy source or package needed replacement; none was overwritten.

**Still pending:** real Guardian import/publication and Guardian → Hedera → Mirror Node live acceptance. The live-acceptance workflow requires a valid session token and real organization/activity/verification/evidence/policy IDs; CI's deterministic build does not substitute for those live checks.
