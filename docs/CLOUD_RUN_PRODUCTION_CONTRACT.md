# RupayKG Cloud Run production contract

This document defines the deployment contract for the canonical `vishaltradewinds/rupaykg` repository. It is a deployment specification, not a deployment record. **Do not treat this document as evidence that Cloud Run has been deployed.**

## Architecture

- Build the repository-root `Dockerfile` into an immutable container image.
- The production entrypoint is `apps/src/production-server.ts`, compiled as `apps/dist/src/production-server.js`.
- The same Fastify production server serves the built web application from `apps/web/dist` and exposes the authoritative `/api/v1/*` API.
- The browser uses relative `/api/v1/...` requests; there is no required `VITE_API_BASE_URL` deployment setting.
- Cloud Run supplies the ingress `PORT`; the application listens on `0.0.0.0` and must not require a hard-coded production port.
- Prefer a controlled Dockerfile + Cloud Build + Artifact Registry flow for production. Cloud Run can deploy from source, but Google documents image-based deployment as the more controllable option when full build customization is required. citeturn0search0turn0search1

## Frontend build configuration

Firebase web configuration is required at **build time** because Vite embeds `VITE_FIREBASE_*` values into the browser bundle.

Required public build arguments:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

The web build fails closed when any of these values is missing. The root Dockerfile accepts them as Docker build arguments and exports them only in the build stage. CI supplies non-production test values so the container build proves that the validation path works.

These four Firebase web configuration values are client configuration, not database/server secrets. **Never pass database credentials, private keys, session tokens or other server secrets as Docker build arguments.** Sensitive runtime material belongs at the Cloud Run/Secret Manager boundary.

## Database connectivity

The preferred production topology is **Cloud Run → private-IP Cloud SQL for PostgreSQL over VPC egress**, with TLS enforced by the application/database configuration. Cloud SQL documentation should be checked for the selected connectivity mode before provisioning.

RupayKG production configuration must therefore keep:

- `DATABASE_SSL=require`;
- certificate verification enabled (`rejectUnauthorized=true` in the PostgreSQL client);
- no localhost database target;
- no fallback to insecure TLS;
- no committed database credentials.

If the target environment instead uses Cloud SQL's Cloud Run Unix-socket integration, the application connection strategy must be explicitly adapted and acceptance-tested before production sign-off. Do not silently change `DATABASE_SSL` semantics or weaken certificate validation to make a socket/TCP connection work.

## Secrets and identity

Cloud Run configuration must not contain plaintext production credentials in repository files or build arguments. Use Secret Manager for sensitive values and a dedicated user-managed Cloud Run service account with least-privilege access to required secrets and Cloud SQL/network resources.

At minimum, production-sensitive database material must be supplied by the deployment secret/configuration system, not `.env.example`, source code, or the browser bundle.

The browser must never receive:

- `DATABASE_URL`;
- database passwords/certificates/private keys;
- server authentication secrets;
- a bundled `VITE_RUPAYKG_SESSION_TOKEN`.

## Required runtime configuration

Set through deployment configuration/Secret Manager:

- `NODE_ENV=production`
- `DATABASE_URL=<managed PostgreSQL endpoint>`
- `DATABASE_SSL=require`
- `RUPAYKG_AUTH_MODE=real`
- `RUPAYKG_ALLOWED_ORIGINS=https://<exact-authoritative-web-origin>`
- `RUPAYKG_SYNTHETIC_DATA=false`

Do **not** set `PORT`; Cloud Run injects it for the ingress container.

## Controlled build

`cloudbuild.yaml` is a **build-and-push-only** pipeline. It does not deploy Cloud Run. It builds the canonical Dockerfile, supplies the four public Firebase build arguments, and publishes an immutable commit-SHA-tagged image to Artifact Registry.

For a pilot, invoke Cloud Build with the real Firebase web configuration and a deliberate Artifact Registry region/repository. Do not put production database secrets into the substitutions. After the image is built and acceptance-tested, deploy the exact image digest to Cloud Run. Cloud Run revisions are immutable, and image tags are resolved to a digest for the serving revision. citeturn0search10

## Deployment acceptance sequence

1. CI is green on the exact main commit.
2. Build the root Dockerfile with the controlled Firebase configuration.
3. Publish the image to Artifact Registry in the selected region.
4. Record the immutable image digest.
5. Provision a dedicated user-managed Cloud Run service account.
6. Grant only required Secret Manager access and Cloud SQL/network permissions.
7. Configure private VPC egress if using Cloud SQL private IP.
8. Configure the Cloud SQL connection and production database URL.
9. Inject production secrets/configuration.
10. Deploy the exact image digest as a new Cloud Run revision.
11. Verify `/health` returns HTTP 200 only when authoritative PostgreSQL is available.
12. Verify an allowed web origin receives CORS authorization and a non-allowlisted origin does not.
13. Verify real identity authentication and organization/geography authorization.
14. Execute the stakeholder lifecycle acceptance suite against the actual database.
15. Verify logs/metrics do not expose credentials, authorization tokens or sensitive evidence payloads.
16. Promote traffic only after all gates pass.

## Rollback and revision safety

Cloud Run revisions are immutable deployment units. A failed production acceptance must leave the previous known-good revision untouched and prevent traffic promotion to the failed revision. Rollback must be an explicit operational action, not an application-level fallback.

## Evidence boundary

Repository CI proves application/container build correctness. It does **not** prove that the target GCP project, Cloud SQL instance, VPC, Secret Manager secrets, service account permissions, DNS, HTTPS certificate, external regulatory integrations, or physical MRV instruments are correctly provisioned. Those remain external acceptance gates.
