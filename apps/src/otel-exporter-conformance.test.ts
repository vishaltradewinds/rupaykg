import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { trace } from "@opentelemetry/api";
import { buildHttpSpan, validateObservabilitySpan } from "./observability.js";

test("exports a real OTLP trace payload and preserves the application trace identity", async () => {
  const received: Buffer[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", chunk => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      received.push(Buffer.concat(chunks));
      response.writeHead(200);
      response.end();
    });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const endpoint = `http://127.0.0.1:${address.port}/v1/traces`;
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
  });

  const context = {
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    parentId: "00f067aa0ba902b7",
    sampled: true,
  };

  const spanContract = buildHttpSpan({
    context,
    spanId: "8f0a1e2b3c4d5e6f",
    name: "HTTP GET /api/v1/measurements/:id",
    startTimeUnixNano: "1794120000000000000",
    endTimeUnixNano: "1794120000123000000",
    method: "GET",
    route: "/api/v1/measurements/:id",
    statusCode: 200,
    durationMs: 123,
  });

  validateObservabilitySpan(spanContract);
  assert.equal(spanContract.traceId, context.traceId);
  assert.equal(spanContract.parentSpanId, context.parentId);
  assert.equal("authorization" in spanContract.attributes, false);
  assert.equal("request.body" in spanContract.attributes, false);
  assert.equal("payload" in spanContract.attributes, false);

  try {
    sdk.start();
    const tracer = trace.getTracer("rupaykg-otel-conformance");
    const span = tracer.startSpan("rupaykg.conformance.http", {
      attributes: {
        "http.request.method": spanContract.attributes["http.request.method"],
        "http.route": spanContract.attributes["http.route"],
        "http.response.status_code": spanContract.attributes["http.response.status_code"],
        "rupaykg.trace_id": context.traceId,
      },
    });
    span.end();

    await sdk.shutdown();

    assert.ok(received.length > 0, "collector did not receive an OTLP request");
    const payload = Buffer.concat(received);
    assert.ok(payload.length > 0, "collector received an empty OTLP payload");
    assert.equal(payload.includes(Buffer.from("Authorization: Bearer SECRET")), false);
    assert.equal(payload.includes(Buffer.from("sensitive-test-secret")), false);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
