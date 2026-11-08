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

The implementation now includes a pinned OpenTelemetry SDK/OTLP exporter bootstrap for opt-in runtime use. It remains a deployment acceptance gate until a concrete collector endpoint, runtime connectivity, end-to-end correlation and retained production evidence are proven.

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


## Pinned OTEL bootstrap

The repository now pins the OpenTelemetry runtime integration to `@opentelemetry/api` 1.10.0, `@opentelemetry/sdk-node` 0.301.0, `@opentelemetry/exporter-trace-otlp-proto` 0.301.0 and `@opentelemetry/instrumentation-http` 0.301.0. The production Docker command loads `otel-bootstrap.js` with Node `--import` before `production-server.js`, satisfying the required early-initialization ordering. OTEL is opt-in via `RUPAYKG_OTEL_ENABLED=true`; when enabled, an OTLP endpoint is mandatory and absence fails closed. SDK shutdown is handled on SIGTERM/SIGINT.

The pinned SDK/exporter packages are the current 3.x-generation experimental Node integration line; OpenTelemetry documents Node.js >=22.15.0 for the 3.x generation and requires SDK initialization before application modules are loaded. citeturn605696search0turn605696search2

**Production status remains PARTIAL:** dependency/bootstrap implementation is present, but collector connectivity, end-to-end trace evidence, redaction validation under live telemetry, runtime log retention and production acceptance are still required. The repository `package-lock.json` has not been regenerated in this tool session; deployment currently uses `npm install`, which resolves the declared dependencies, but lockfile reconciliation remains a release-integrity gate.


## Lockfile integrity gate — CLOSED

`package-lock.json` now contains the declared OTEL dependencies at the exact pinned versions: `@opentelemetry/api` 1.10.0, `@opentelemetry/sdk-node` 0.301.0, `@opentelemetry/exporter-trace-otlp-proto` 0.301.0 and `@opentelemetry/instrumentation-http` 0.301.0, including registry resolution and integrity metadata. The workspace `apps` lock entry also matches the declared dependency set and Node runtime floor.

This closes the repository dependency/lockfile reconciliation gate. It does not establish live collector connectivity or production telemetry acceptance.


## OTLP exporter conformance gate

The repository now contains `apps/src/otel-exporter-conformance.test.ts`. The test starts an ephemeral local HTTP collector endpoint, initializes the pinned OTLP protobuf exporter, emits a real OpenTelemetry span under the application trace identity, verifies an OTLP payload is received, and checks that known credential/payload sentinel strings are absent from the emitted payload.

This is a repository-level exporter/conformance test. It does **not** prove production collector availability, production runtime configuration, end-to-end PostgreSQL/calculation/registry correlation, or production acceptance. Those remain open until executed against the deployed environment and retained as evidence.


## Application-path span instrumentation

The authoritative application path now creates OpenTelemetry spans at the principal control boundaries:

- tenant-scoped PostgreSQL transactions: `rupaykg.db.tenant_transaction`;
- carbon/MRV calculation: `rupaykg.mrv.calculation`;
- Guardian MRV verification: `rupaykg.mrv.guardian_verification`;
- Hedera HCS anchoring: `rupaykg.mrv.hedera_anchor`;
- registry credential issuance: `rupaykg.registry.credential_issuance`;
- external integration acceptance: `rupaykg.external_integration.accept`.

These spans deliberately avoid request payloads, credentials and environmental measurement values as span attributes. They provide the application-level correlation structure needed for the production acceptance path. They do not by themselves prove that a deployed collector received the spans or that a real production request traversed every boundary.
