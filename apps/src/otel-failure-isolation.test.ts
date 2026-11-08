import test from "node:test";
import assert from "node:assert/strict";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { trace } from "@opentelemetry/api";
import { createServer } from "node:http";

test("authoritative application operation does not await OTLP collector availability", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(503);
    response.end();
  });

  server.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", () => resolve());
    server.once("error", reject);
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const exporter = new OTLPTraceExporter({
    url: `http://127.0.0.1:${address.port}/v1/traces`,
  });
  const sdk = new NodeSDK({ traceExporter: exporter });

  try {
    sdk.start();

    const tracer = trace.getTracer("rupaykg-failure-isolation");
    let authoritativeOperationCompleted = false;

    const span = tracer.startSpan("rupaykg.authoritative.operation");
    const result = await Promise.resolve().then(() => {
      authoritativeOperationCompleted = true;
      return { committed: true };
    });
    span.end();

    assert.equal(result.committed, true);
    assert.equal(authoritativeOperationCompleted, true);
  } finally {
    try {
      await sdk.shutdown();
    } catch {
      // Collector failure is intentionally isolated from the application operation.
    }
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
