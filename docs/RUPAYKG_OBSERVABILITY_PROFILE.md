# RupayKg Observability Profile

## Status

**Engineering status: PARTIAL — W3C trace-context correlation and structured HTTP lifecycle telemetry implemented.**

This profile establishes an interoperability boundary without claiming that RupayKg is already an OpenTelemetry SDK/exporter deployment.

## Implemented

- W3C Trace Context `traceparent` parsing.
- Per-request trace ID generation when no valid parent context is supplied.
- Trace context retained for request lifecycle logging.
- Structured `http.request.completed` telemetry containing trace ID, parent ID, sampling flag, method, route, status and duration.
- No credentials, authorization tokens or request payloads are emitted by the observability hooks.

## Deployment boundary

The current implementation is transport-neutral and uses Fastify's structured logger. OpenTelemetry SDK/OTLP exporter deployment remains a separate integration step and must be introduced only with an explicit dependency/version/license review.

## Shakti evidence gate

A production OpenTelemetry acceptance claim requires:

1. approved SDK/exporter dependency and version;
2. trace propagation interoperability test;
3. OTLP collector/exporter configuration;
4. request → service → database → calculation → registry/external connector correlation evidence;
5. sensitive-data redaction test;
6. production runtime evidence;
7. failure/availability behavior documented.

Until those are evidenced, this control remains **PARTIAL**, not GREEN.

## OTEL-compatible span contract foundation

The repository now exposes a transport-neutral HTTP span contract with W3C trace correlation, parent-span linkage, nanosecond timestamps, standard HTTP attributes and explicit error status mapping. Tests also assert that authorization, request-body and payload fields are not emitted as span attributes.

This remains an interoperability foundation, not an OpenTelemetry SDK/OTLP deployment. SDK/exporter dependency review, collector configuration, runtime propagation, end-to-end service/database/calculation/registry correlation and production availability evidence remain required before production acceptance.

## Span contract validation gate

The transport-neutral span contract now includes deterministic validation for W3C trace/span identity, Unix-nanosecond timestamp ordering, and forbidden sensitive attribute names. Repository tests cover invalid timing and sensitive-attribute rejection. This strengthens the engineering interoperability gate but does not constitute SDK, OTLP collector, runtime, or production acceptance.


See `ops/observability/OTEL_DEPLOYMENT_CONTRACT.md` for the production dependency, collector, correlation, failure-behaviour and acceptance evidence contract.


## Dependency compatibility review

The OpenTelemetry dependency review is recorded in `ops/observability/OTEL_DEPENDENCY_REVIEW.md`. Production SDK adoption remains blocked until the deployed Node.js runtime version, pinned SDK/exporter versions, license review, ESM startup ordering, OTLP configuration and runtime evidence are proven.


## Runtime attestation foundation

Production startup now emits a structured `rupaykg.runtime.attestation` event containing the executing Node.js version, runtime, platform and architecture before the authoritative server module is loaded. Repository tests validate the attestation shape and Node version format. This provides a machine-readable runtime-evidence hook; retained production log evidence is still required before declaring the live runtime gate closed.


## Runtime fail-closed gate

Production startup now validates `process.version` and fails closed below Node.js v22.15.0. This is aligned with the OpenTelemetry JavaScript SDK 3.x minimum runtime. The startup sequence performs the check before loading the authoritative server module, then emits the runtime attestation. This prevents an unsupported runtime from silently entering a future OTEL-enabled production path.
