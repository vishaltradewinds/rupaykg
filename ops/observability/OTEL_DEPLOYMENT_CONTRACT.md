# RupayKg OpenTelemetry Deployment Contract

## Purpose

Define the production integration boundary for OpenTelemetry without introducing an unapproved SDK/exporter dependency or claiming production telemetry before runtime evidence exists.

## Required deployment inputs

The production Render deployment now declares the OTEL controls explicitly; telemetry remains disabled by default until an approved collector endpoint is provisioned. An enabled deployment must provide:
- an approved OpenTelemetry SDK/exporter package and pinned version;
- an OTLP endpoint reachable from the RupayKg runtime;
- explicit transport security configuration;
- service name and deployment/environment attributes;
- trace-context propagation using W3C Trace Context;
- collector/exporter availability monitoring;
- `RUPAYKG_OTEL_ENABLED=true` only after collector endpoint and outage-response controls are approved;
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` supplied as a deployment secret/configuration value, never embedded in source;
- deterministic redaction of credentials, authorization headers, cookies, request/response bodies, payloads and secrets.

## Correlation requirement

A production acceptance run must demonstrate one trace crossing the applicable path:

`HTTP request → RupayKg service → PostgreSQL operation → calculation/MRV operation → registry or external integration`

Each hop must preserve the trace identity while creating its own span identity.

## Failure behavior

Telemetry failure must not:
1. mutate authoritative environmental state;
2. bypass authorization;
3. expose sensitive data;
4. convert a successful business transaction into a false regulatory/MRV success;
5. create an unbounded retry loop.

The telemetry path must be operationally isolated from authoritative application state.

## Acceptance evidence

Before changing the control matrix to GREEN, retain:
1. dependency/version/license review;
2. configuration fingerprint;
3. trace propagation test output;
4. collector/exporter connectivity evidence;
5. end-to-end correlation evidence;
6. redaction test output;
7. telemetry outage/failure behavior evidence;
8. production runtime evidence;
9. rollback procedure and evidence.

## Current state

The repository now contains pinned OpenTelemetry SDK/exporter dependencies, an ESM bootstrap, transport-neutral span validation, application-path span instrumentation, and an executable runtime acceptance probe. It does **not** yet contain production collector connectivity evidence, end-to-end production trace evidence, or controlled production telemetry-failure acceptance evidence.

Therefore this document is an implementation contract and acceptance gate, not a production deployment claim.

## Application correlation boundaries implemented

The application now creates child spans for the major authoritative path boundaries:
`HTTP → tenant PostgreSQL transaction → calculation/MRV → Guardian → Hedera HCS → registry credential issuance`, with a separate external-integration acceptance span where that path is used.

This establishes the repository-side span topology required for acceptance. A production acceptance run must still demonstrate that a real trace retains the same trace identity across these boundaries and that the collector receives the resulting spans.

## Executable runtime acceptance probe

The repository now includes `ops/observability/OTEL_RUNTIME_ACCEPTANCE.mjs`. It is an executable probe for a deployed RupayKg environment and requires:
- `RUPAYKG_BASE_URL`
- `RUPAYKG_BEARER_TOKEN`
- `RUPAYKG_ORGANIZATION_ID`

The probe verifies authoritative PostgreSQL-backed health/status, sends a deterministic W3C `traceparent`, exercises the authenticated external-integration mediator, verifies that the response preserves the supplied trace identity, and fails if the acceptance response claims synthetic data or authoritative environmental mutation. It records the supplied and returned trace identity plus HTTP outcomes as evidence.

A manual `workflow_dispatch` workflow is provided at `.github/workflows/otel-runtime-acceptance.yml`. It is evidence-producing but is not itself proof that a production collector received the spans. Collector receipt, end-to-end span correlation, redaction under live telemetry, and telemetry-failure acceptance remain separate gates.


## Telemetry failure isolation acceptance

The repository includes `apps/src/otel-failure-isolation.test.ts`. It exercises a real OTLP exporter against an HTTP endpoint that returns 503 and verifies that an application operation completes independently of collector availability. The test deliberately treats exporter shutdown failure as telemetry failure, not business-operation failure.

This is an engineering isolation test. It does **not** prove production outage behavior. Production acceptance still requires an evidence-producing run against the deployed RupayKg service with the production collector unavailable or rejecting telemetry, while verifying that authoritative transactions continue to enforce authentication, authorization, tenant isolation, idempotency and commit/rollback semantics.
