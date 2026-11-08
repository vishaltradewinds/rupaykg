import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";

const enabled = process.env.OTEL_SDK_DISABLED !== "true" &&
  process.env.RUPAYKG_OTEL_ENABLED === "true";

if (enabled) {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (!endpoint) {
    throw new Error("RUPAYKG_OTEL_ENABLED=true requires an OTLP endpoint");
  }

  const exporter = new OTLPTraceExporter({
    url: endpoint.endsWith("/v1/traces") ? endpoint : `${endpoint.replace(/\/$/, "")}/v1/traces`,
  });

  const sdk = new NodeSDK({
    traceExporter: exporter,
    instrumentations: [new HttpInstrumentation()],
    serviceName: process.env.OTEL_SERVICE_NAME ?? "rupaykg-api",
  });

  sdk.start();

  const shutdown = async (signal: string) => {
    try {
      await sdk.shutdown();
      console.info(JSON.stringify({
        event: "rupaykg.otel.shutdown",
        signal,
      }));
    } catch (error) {
      console.error(JSON.stringify({
        event: "rupaykg.otel.shutdown_error",
        signal,
        error: error instanceof Error ? error.message : String(error),
      }));
      process.exitCode = 1;
    }
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));

  console.info(JSON.stringify({
    event: "rupaykg.otel.initialized",
    serviceName: process.env.OTEL_SERVICE_NAME ?? "rupaykg-api",
    exporter: "otlp/http-protobuf",
  }));
} else {
  console.info(JSON.stringify({
    event: "rupaykg.otel.disabled",
  }));
}
