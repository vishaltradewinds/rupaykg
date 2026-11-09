import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";

export type TraceContext = {
  traceId: string;
  parentId?: string;
  sampled: boolean;
};

function validHex(value: string, length: number): boolean {
  return new RegExp(`^[0-9a-f]{${length}}$`).test(value);
}

export function parseTraceparent(value: unknown): TraceContext | null {
  if (typeof value !== "string") return null;
  const parts = value.trim().split("-");
  if (parts.length !== 4 || parts[0] !== "00") return null;
  const [version, traceId, parentId, flags] = parts;
  if (!version || !traceId || !parentId || !flags || !validHex(traceId, 32) || !validHex(parentId, 16) || !validHex(flags, 2)) return null;
  if (/^0+$/.test(traceId) || /^0+$/.test(parentId)) return null;
  return { traceId, parentId, sampled: (Number.parseInt(flags, 16) & 1) === 1 };
}

export function createTraceContext(request: FastifyRequest): TraceContext {
  return parseTraceparent(request.headers.traceparent) ?? {
    traceId: randomBytes(16).toString("hex"),
    sampled: true,
  };
}

export type RuntimeAttestation = {
  event: "rupaykg.runtime.attestation";
  nodeVersion: string;
  runtime: string;
  platform: string;
  arch: string;
};

export function assertSupportedNodeRuntime(): void {
  const match = /^v(\d+)\.(\d+)\.(\d+)/.exec(process.version);
  if (!match) throw new Error("Unable to determine Node.js runtime version");
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (major < 22 || (major === 22 && minor < 15)) {
    throw new Error(`Unsupported Node.js runtime ${process.version}; minimum supported version is v22.15.0`);
  }
  void patch;
}

export function buildRuntimeAttestation(): RuntimeAttestation {
  return {
    event: "rupaykg.runtime.attestation",
    nodeVersion: process.version,
    runtime: "node",
    platform: process.platform,
    arch: process.arch,
  };
}

export function installObservability(app: FastifyInstance): void {
  app.addHook("onRequest", async (request, reply) => {
    const context = createTraceContext(request);
    request.headers["x-rupaykg-trace-id"] = context.traceId;
    (request as FastifyRequest & { rupaykgTrace?: TraceContext }).rupaykgTrace = context;
    reply.header("x-rupaykg-trace-id", context.traceId);
  });

  app.addHook("onResponse", async request => {
    const context = (request as FastifyRequest & { rupaykgTrace?: TraceContext }).rupaykgTrace;
    if (!context) return;
    request.log.info({
      event: "http.request.completed",
      traceId: context.traceId,
      parentId: context.parentId,
      sampled: context.sampled,
      method: request.method,
      route: request.routeOptions.url,
      statusCode: request.raw.statusCode,
      durationMs: Math.round(((request as FastifyRequest & { elapsedTime?: number }).elapsedTime ?? 0) * 100) / 100,
    });
  });
}


export type ObservabilitySpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Record<string, string | number | boolean>;
  status: "ok" | "error" | "unset";
};

export function createSpanId(): string {
  return randomBytes(8).toString("hex");
}

export function validateObservabilitySpan(span: ObservabilitySpan): void {
  if (!validHex(span.traceId, 32) || /^0+$/.test(span.traceId)) {
    throw new Error("Invalid OTEL traceId");
  }
  if (!validHex(span.spanId, 16) || /^0+$/.test(span.spanId)) {
    throw new Error("Invalid OTEL spanId");
  }
  if (span.parentSpanId && (!validHex(span.parentSpanId, 16) || /^0+$/.test(span.parentSpanId))) {
    throw new Error("Invalid OTEL parentSpanId");
  }
  if (!/^\d+$/.test(span.startTimeUnixNano) || !/^\d+$/.test(span.endTimeUnixNano)) {
    throw new Error("OTEL span timestamps must be Unix nanoseconds");
  }
  if (BigInt(span.endTimeUnixNano) < BigInt(span.startTimeUnixNano)) {
    throw new Error("OTEL span end time precedes start time");
  }
  const forbidden = /^(authorization|cookie|set-cookie|request\.body|response\.body|payload|token|password|secret)$/i;
  for (const key of Object.keys(span.attributes)) {
    if (forbidden.test(key)) throw new Error(`Forbidden sensitive span attribute: ${key}`);
  }
}

export function buildHttpSpan(input: {
  context: TraceContext;
  spanId?: string;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
}): ObservabilitySpan {
  return {
    traceId: input.context.traceId,
    spanId: input.spanId ?? createSpanId(),
    ...(input.context.parentId ? { parentSpanId: input.context.parentId } : {}),
    name: input.name,
    startTimeUnixNano: input.startTimeUnixNano,
    endTimeUnixNano: input.endTimeUnixNano,
    attributes: {
      "http.request.method": input.method,
      "http.route": input.route,
      "http.response.status_code": input.statusCode,
      "http.server.duration_ms": input.durationMs,
    },
    status: input.statusCode >= 500 ? "error" : input.statusCode >= 400 ? "error" : "ok",
  };
}
