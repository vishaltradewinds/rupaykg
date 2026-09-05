# RupayKG Cloud Run production contract

This document defines the deployment contract for the canonical `vishaltradewinds/rupaykg` repository. It is a deployment specification, not a deployment record. **Do not treat this document as evidence that Cloud Run has been deployed.**

## Architecture

- Build the repository root `Dockerfile` into an immutable container image.
- Run the API container with `apps/api/dist/src/production-server.js` as its entrypoint.
- Cloud Run supplies the ingress `PORT`; the application already reads `process.env.PORT` and listens on `0.0.0.0`.
- Keep the web application separate from the API runtime unless a deliberate static-hosting decision is made. The browser must call the authoritative API through `VITE_API_BASE_URL`.
- Use one production Cloud Run service for the authoritative API and a separately managed web origin.

## Database connectivity

The preferred production topology is **Cloud Run → private-IP Cloud SQL for PostgreSQL over VPC egress**, with TLS enforced by the application/database configuration. Cloud SQL documentation recommends placing Cloud Run and Cloud SQL in the same region and describes direct private-IP connections as an appropriate option; public-IP connections should use a Cloud SQL connector/Auth Proxy rather than an unauthenticated direct connection.

RupayKG production configuration must therefore keep:

- `DATABASE_SSL=require`;
- certificate verification enabled (`rejectUnauthorized=true` in the PostgreSQL client);
- no localhost database target;
- no fallback to insecure TLS;
- no committed database credentials.

If the target environment instead uses Cloud SQL's Cloud Run Unix-socket integration, the application connection strategy must be explicitly adapted and acceptance-tested before production sign-off. Do not silently change `DATABASE_SSL` semantics or weaken certificate validation to make a socket/TCP connection work.

## Secrets and identity

Cloud Run configuration must not contain plaintext production credentials in repository files or build arguments. Google Cloud recommends Secret Manager for sensitive values. Use a dedicated user-managed Cloud Run service account with least-privilege access to the required secrets and Cloud SQL connection permission.

At minimum, production-sensitive database material must be supplied by the deployment secret/configuration system, not `.env.example`, source code, or the browser bundle.

The browser must never receive:

- `DATABASE_URL`;
- database passwords/certificates/private keys;
- server authentication secrets;
- a bundled `VITE_RUPAYKG_SESSION_TOKEN`.

## Required runtime configuration

Set through the deployment configuration/Secret Manager boundary:

- `NODE_ENV=production`
- `DATABASE_URL=<managed PostgreSQL endpoint>`
- `DATABASE_SSL=require`
- `RUPAYKG_AUTH_MODE=real`
- `RUPAYKG_ALLOWED_ORIGINS=https://<exact-authoritative-web-origin>`
- `RUPAYKG_SYNTHETIC_DATA=false`

Do **not** set `PORT`; Cloud Run injects it for the ingress container.

Do not use `--set-env-vars` for database credentials or other secrets. Use Secret Manager-backed configuration for sensitive values, and pin secret versions for environment-variable injection where practical.

## Deployment acceptance sequence

1. Build the root Dockerfile in CI without production secrets.
2. Publish the image to Artifact Registry in the same region as the target Cloud Run service/Cloud SQL instance where practical.
3. Provision a dedicated user-managed Cloud Run service account.
4. Grant only required Secret Manager access and Cloud SQL client/network permissions.
5. Configure private VPC egress if using Cloud SQL private IP.
6. Configure the Cloud SQL connection and production database URL.
7. Inject production secrets/configuration.
8. Deploy a new Cloud Run revision with the production entrypoint.
9. Verify `/health` returns HTTP 200 only when authoritative PostgreSQL is available.
10. Verify an allowed web origin receives CORS authorization and a non-allowlisted origin does not.
11. Verify real identity authentication and organization/geography authorization.
12. Execute the production lifecycle acceptance suite against the actual database.
13. Verify logs/metrics do not expose credentials, authorization tokens or sensitive evidence payloads.
14. Only after all gates pass may the deployment be called production-ready.

## Rollback and revision safety

Cloud Run revisions are immutable deployment units. A failed production acceptance must leave the previous known-good revision untouched and prevent traffic promotion to the failed revision. Rollback must be an explicit operational action, not an application-level fallback.

## Evidence boundary

Repository CI proves application/container build correctness. It does **not** prove that the target GCP project, Cloud SQL instance, VPC, Secret Manager secrets, service account permissions, DNS, HTTPS certificate, external regulatory integrations, or physical MRV instruments are correctly provisioned. Those remain external acceptance gates.
