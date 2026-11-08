import test from "node:test";
import assert from "node:assert/strict";
import { buildHttpSpan, parseTraceparent, validateObservabilitySpan } from "./observability.js";

test("accepts valid W3C traceparent", () => {
  const context = parseTraceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
  assert.deepEqual(context, {
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    parentId: "00f067aa0ba902b7",
    sampled: true,
  });
});

test("rejects malformed or zero traceparent", () => {
  assert.equal(parseTraceparent("not-a-traceparent"), null);
  assert.equal(parseTraceparent("00-00000000000000000000000000000000-00f067aa0ba902b7-01"), null);
  assert.equal(parseTraceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01"), null);
});

test("preserves unsampled trace flag", () => {
  const context = parseTraceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00");
  assert.equal(context?.sampled, false);
});


test("builds an OTEL-compatible HTTP span without payload or credential attributes", () => {
  const span = buildHttpSpan({
    context: {
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      parentId: "00f067aa0ba902b7",
      sampled: true,
    },
    spanId: "8f0a1e2b3c4d5e6f",
    name: "HTTP GET /api/v1/measurements/:id",
    startTimeUnixNano: "1794120000000000000",
    endTimeUnixNano: "1794120000123000000",
    method: "GET",
    route: "/api/v1/measurements/:id",
    statusCode: 200,
    durationMs: 123,
  });

  assert.equal(span.traceId, "4bf92f3577b34da6a3ce929d0e0e4736");
  assert.equal(span.parentSpanId, "00f067aa0ba902b7");
  assert.equal(span.status, "ok");
  assert.equal(span.attributes["http.response.status_code"], 200);
  assert.equal("authorization" in span.attributes, false);
  assert.equal("request.body" in span.attributes, false);
  assert.equal("payload" in span.attributes, false);
});


test("validates OTEL span identity, timing and sensitive-attribute boundaries", () => {
  const span = buildHttpSpan({
    context: {
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      parentId: "00f067aa0ba902b7",
      sampled: true,
    },
    spanId: "8f0a1e2b3c4d5e6f",
    name: "HTTP GET /api/v1/measurements/:id",
    startTimeUnixNano: "1794120000000000000",
    endTimeUnixNano: "1794120000123000000",
    method: "GET",
    route: "/api/v1/measurements/:id",
    statusCode: 200,
    durationMs: 123,
  });

  validateObservabilitySpan(span);

  assert.throws(
    () => validateObservabilitySpan({
      ...span,
      endTimeUnixNano: "1794119999999999999",
    }),
    /precedes start time/,
  );

  assert.throws(
    () => validateObservabilitySpan({
      ...span,
      attributes: { ...span.attributes, authorization: "redacted" },
    }),
    /Forbidden sensitive span attribute/,
  );
});


test("runtime attestation records the executing Node runtime without application payloads", async () => {
  const { assertSupportedNodeRuntime, buildRuntimeAttestation } = await import("./observability.js");
  assertSupportedNodeRuntime();
  const attestation = buildRuntimeAttestation();
  assert.equal(attestation.event, "rupaykg.runtime.attestation");
  assert.match(attestation.nodeVersion, /^v\\d+\\.\\d+\\.\\d+$/);
  assert.equal(attestation.runtime, "node");
  assert.ok(attestation.platform);
  assert.ok(attestation.arch);
});
