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

A stale `docs/CI_VERIFICATION_TRIGGER.md` file was removed because it contained a marker and an obsolete Firebase-authentication claim rather than verifiable CI evidence. The root `lint` script was also removed because every workspace lacked a `lint` script and the command silently succeeded without running a linter; no linter is claimed to be configured.

## Release discipline

- Passing CI does not prove live integration or regulatory acceptance.
- Do not merge until required checks and review are complete.
- Do not enable production certification until Shakti Standards evidence gates, TRL evidence, live stakeholder workflows, security/recovery tests and external trust acceptance are independently satisfied.
