# RupayKg

**India's Circular Economy Operating System**

RupayKg is a pan-India platform for circular resource flows, stakeholder onboarding, digital measurement/reporting/verification (MRV), carbon accounting, EPR compliance, ESG reporting, environmental-attribute provenance, registry operations and governed settlement.

## Runtime architecture

- **Web:** React + Vite, in `apps/web`.
- **API:** Fastify + TypeScript, in `apps/src`.
- **Data:** PostgreSQL, with ordered SQL migrations in `migrations`.
- **Authentication:** Native PostgreSQL-backed RupayKg sessions; see `docs/AUTHENTICATION.md`.
- **External trust rail:** Hedera Guardian/Hedera integrations are fail-closed and must not fabricate external acceptance, transaction IDs or credentials.
- **Production entrypoint:** `node apps/dist/src/production-server.js`; it validates the production configuration before loading the API server.
- **Container:** The root `Dockerfile` runs migrations and then the production server.
- **CI:** `.github/workflows/ci.yml` validates dependencies, migrations, type-checking, build, tests and container construction.
- **Render:** `render.yaml` is the Blueprint declaration. Confirm its linkage to the existing live service before applying resource-identity changes.
- **Cloud Build:** `cloudbuild.yaml` builds and pushes an image; it does not itself deploy that image to the live Render service.

## Local development

1. Install Node.js 22 and npm compatible with the committed lockfile.
2. Copy `.env.example` to `.env` and set local-only values.
3. Install locked dependencies with `npm ci`.
4. Validate migrations with `npm run validate:migrations`.
5. Build with `npm run build`.
6. Run tests with `npm test`.

Never use production credentials in local development or commit secrets. Production configuration has additional fail-closed requirements.

## Regulatory and production status

Policy bundles are implementation artifacts until imported, validated and independently evidenced in the real Guardian environment. A successful build, unit test, or health check does not establish statutory acceptance, production certification, TRL advancement or pan-India field validation.

See `docs/GUARDIAN_INTEGRATION.md`, `docs/WA03_001_GUARDIAN_POLICY_MANIFEST.json` and the Shakti Standards evidence/TRL gates for release criteria.
