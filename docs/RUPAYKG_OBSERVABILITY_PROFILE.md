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
