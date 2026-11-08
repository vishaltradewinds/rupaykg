# OpenTelemetry Dependency Review

## Review date

2026-11-08

## Decision

**DO NOT ADD the OpenTelemetry SDK to the production runtime yet.** The dependency review establishes the integration direction, but runtime compatibility must be verified before dependency adoption. OpenTelemetry JavaScript 3.x requires Node.js >=22.15.0, and the current repository does not prove that runtime requirement is met in production.

## Evidence reviewed

- OpenTelemetry JavaScript announced SDK 3.0 on 2026-11-05. Stable 3.x packages require Node.js >=22.15.0; Node.js 18 and 20 are no longer supported by SDK 3.x.
- The current RupayKg repository is an ESM Node.js application and declares @types/node 24.x, but the repository evidence reviewed here does not establish the deployed production Node.js runtime version.
- @opentelemetry/sdk-node is Apache-2.0 licensed. The package family is in an active transition between the stable 3.x line and experimental 0.300.x line.
- Official OpenTelemetry guidance recommends initializing the Node SDK before application modules load and using the SDK plus appropriate exporters/instrumentations.

## Required compatibility gate

Before adding production OTEL dependencies, prove:

1. deployed Node.js runtime is >=22.15.0;
2. exact SDK/exporter versions are pinned rather than floating;
3. licenses and transitive dependency licenses are reviewed;
4. ESM startup ordering is compatible with production-server.js;
5. OTLP transport and endpoint are explicitly configured;
6. telemetry failure cannot mutate authoritative state or bypass authorization;
7. redaction tests cover authorization, cookies, request/response bodies, payloads and secrets;
8. end-to-end correlation is demonstrated across HTTP → service → PostgreSQL → calculation/MRV → registry/external integration.

## Current repository decision

The existing transport-neutral OTEL-compatible span contract and deterministic validation remain in place. They are the safe engineering foundation while runtime compatibility and deployment evidence are established.

No SDK dependency is being introduced merely to make the control appear GREEN.

## External evidence

OpenTelemetry JavaScript SDK 3.0 announcement: https://opentelemetry.io/blog/2026/otel-js-sdk-3-0/
OpenTelemetry JavaScript Node.js guidance: https://opentelemetry.io/docs/languages/js/getting-started/nodejs/
OpenTelemetry JavaScript instrumentation guidance: https://opentelemetry.io/docs/languages/js/instrumentation/


## Repository runtime gate

`apps/package.json` now declares `engines.node >=22.15.0`, matching the minimum runtime required by OpenTelemetry JavaScript SDK 3.x. This is a repository contract, not proof that the deployed production runtime already satisfies it. Deployment evidence remains required.
