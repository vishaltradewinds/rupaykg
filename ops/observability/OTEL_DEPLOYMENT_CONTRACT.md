# RupayKg OpenTelemetry Deployment Contract

## Purpose

Define the production integration boundary for OpenTelemetry without introducing an unapproved SDK/exporter dependency or claiming production telemetry before runtime evidence exists.

## Required deployment inputs

The eventual production deployment must provide:
- an approved OpenTelemetry SDK/exporter package and pinned version;
- an OTLP endpoint reachable from the RupayKg runtime;
- explicit transport security configuration;
- service name and deployment/environment attributes;
- trace-context propagation using W3C Trace Context;
- collector/exporter availability monitoring;
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

The repository currently has a transport-neutral OTEL-compatible span contract and deterministic validation. It does **not** yet contain an approved OpenTelemetry SDK/exporter dependency, collector deployment, or production runtime evidence.

Therefore this document is an implementation contract and acceptance gate, not a production deployment claim.