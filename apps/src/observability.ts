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

export function installObservability(app: FastifyInstance): void {
  app.addHook("onRequest", async request => {
    const context = createTraceContext(request);
    request.headers["x-rupaykg-trace-id"] = context.traceId;
    (request as FastifyRequest & { rupaykgTrace?: TraceContext }).rupaykgTrace = context;
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
      durationMs: Math.round(request.elapsedTime * 100) / 100,
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
