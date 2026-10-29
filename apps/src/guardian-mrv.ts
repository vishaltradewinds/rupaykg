import { createHash, randomUUID } from "node:crypto";

export interface GuardianMrvRequest {
  activityId: string;
  verificationId: string;
  evidenceId: string;
  policyId: string;
  methodologyCode?: string | undefined;
  observations: unknown[];
  evidence: unknown[];
  metadata?: Record<string, unknown>;
  correlationId?: string | undefined;
  idempotencyKey?: string | undefined;
}

export interface GuardianMrvResult {
  status: "VERIFIED" | "REJECTED" | "NOT_CONFIGURED" | "UNAVAILABLE";
  executionId: string | null;
  policyId: string;
  correlationId: string;
  idempotencyKey: string;
  providerCorrelationId?: string;
  responseDigest?: string;
  message: string;
}

const MAX_RESPONSE_BYTES = 1024 * 1024;

function endpoint(): string | null {
  const value = process.env.GUARDIAN_MRV_SUBMIT_URL?.trim();
  if (!value) return null;
  let parsed: URL;
  try { parsed = new URL(value); } catch { return null; }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname.toLowerCase());
  const secureRemote = parsed.protocol === "https:";
  const localDevelopment = process.env.NODE_ENV !== "production" && parsed.protocol === "http:" && localHost;
  if (!secureRemote && !localDevelopment) return null;
  return parsed.toString().replace(/\/$/, "");
}

function timeoutMs(): number {
  const parsed = Number.parseInt(process.env.GUARDIAN_MRV_TIMEOUT_MS || "10000", 10);
  return Number.isFinite(parsed) && parsed >= 1000 && parsed <= 60000 ? parsed : 10000;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function deterministicIdempotencyKey(input: GuardianMrvRequest): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize({
      schema: "rupaykg:guardian-mrv-idempotency:v1",
      activityId: input.activityId,
      verificationId: input.verificationId,
      evidenceId: input.evidenceId,
      policyId: input.policyId,
      methodologyCode: input.methodologyCode,
      observations: input.observations,
      evidence: input.evidence,
      metadata: input.metadata,
    })))
    .digest("hex");
}

async function readBoundedBody(response: Response, maxBytes = MAX_RESPONSE_BYTES): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("PROVIDER_RESPONSE_TOO_LARGE");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("PROVIDER_RESPONSE_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export function guardianStatus() {
  return {
    configured: Boolean(endpoint()),
    submitUrlConfigured: Boolean(endpoint()),
    timeoutMs: timeoutMs(),
    maxResponseBytes: MAX_RESPONSE_BYTES,
    syntheticData: false,
    integration: "hedera-guardian",
    contract: "rupaykg:guardian-mrv:v1",
  };
}

export async function executeGuardianMrv(input: GuardianMrvRequest): Promise<GuardianMrvResult> {
  const url = endpoint();
  const correlationId = input.correlationId?.trim() || randomUUID();
  const idempotencyKey = input.idempotencyKey?.trim() || deterministicIdempotencyKey(input);
  if (!url) {
    return { status: "NOT_CONFIGURED", executionId: null, policyId: input.policyId, correlationId, idempotencyKey, message: "Guardian MRV submission is unavailable until GUARDIAN_MRV_SUBMIT_URL is configured." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-rupaykg-contract": "rupaykg:guardian-mrv:v1",
        "x-rupaykg-correlation-id": correlationId,
        "idempotency-key": idempotencyKey,
        ...(process.env.GUARDIAN_API_TOKEN ? { authorization: `Bearer ${process.env.GUARDIAN_API_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        schema: "rupaykg:guardian-mrv:v1",
        correlationId,
        idempotencyKey,
        policyId: input.policyId,
        activityId: input.activityId,
        verificationId: input.verificationId,
        evidenceId: input.evidenceId,
        ...(input.methodologyCode !== undefined ? { methodologyCode: input.methodologyCode } : {}),
        observations: input.observations,
        evidence: input.evidence,
        metadata: input.metadata,
      }),
    });
    const contentType = response.headers.get("content-type") || "";
    let rawText = "";
    if (contentType.toLowerCase().includes("application/json")) {
      try {
        rawText = await readBoundedBody(response);
      } catch (error) {
        const code = error instanceof Error && error.message === "PROVIDER_RESPONSE_TOO_LARGE" ? "exceeded the configured size limit" : "could not be safely read";
        return { status: "UNAVAILABLE", executionId: null, policyId: input.policyId, correlationId, idempotencyKey, message: `Guardian response ${code}.` };
      }
    } else {
      await response.body?.cancel().catch(() => undefined);
    }
    const responseDigest = rawText ? createHash("sha256").update(rawText).digest("hex") : undefined;
    if (!response.ok) {
      return { status: "UNAVAILABLE", executionId: null, policyId: input.policyId, correlationId, idempotencyKey, ...(responseDigest ? { responseDigest } : {}), message: `Guardian MRV endpoint returned HTTP ${response.status}.` };
    }
    let raw: unknown = null;
    if (rawText) {
      try { raw = JSON.parse(rawText); }
      catch {
        return { status: "UNAVAILABLE", executionId: null, policyId: input.policyId, correlationId, idempotencyKey, ...(responseDigest ? { responseDigest } : {}), message: "Guardian returned malformed JSON." };
      }
    }
    const body = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
    if (!body) {
      return { status: "UNAVAILABLE", executionId: null, policyId: input.policyId, correlationId, idempotencyKey, ...(responseDigest ? { responseDigest } : {}), message: "Guardian returned an invalid response shape." };
    }
    const status = body.status === "REJECTED" ? "REJECTED" : body.status === "VERIFIED" ? "VERIFIED" : "UNAVAILABLE";
    const executionIdValue = typeof body.executionId === "string" ? body.executionId : typeof body.id === "string" ? body.id : null;
    const executionId = executionIdValue?.trim() || null;
    const providerCorrelationId = typeof body.correlationId === "string" && body.correlationId.length <= 200 ? body.correlationId : undefined;
    if (status === "VERIFIED" && !executionId) {
      return { status: "UNAVAILABLE", executionId: null, policyId: input.policyId, correlationId, idempotencyKey, ...(providerCorrelationId ? { providerCorrelationId } : {}), ...(responseDigest ? { responseDigest } : {}), message: "Guardian returned VERIFIED without an authoritative execution identifier." };
    }
    if (status === "VERIFIED" && body.policyId !== input.policyId) {
      return { status: "UNAVAILABLE", executionId: null, policyId: input.policyId, correlationId, idempotencyKey, ...(providerCorrelationId ? { providerCorrelationId } : {}), ...(responseDigest ? { responseDigest } : {}), message: "Guardian VERIFIED response omitted or mismatched the requested policy identifier." };
    }
    if (typeof body.policyId === "string" && body.policyId !== input.policyId) {
      return { status: "UNAVAILABLE", executionId: null, policyId: input.policyId, correlationId, idempotencyKey, ...(providerCorrelationId ? { providerCorrelationId } : {}), ...(responseDigest ? { responseDigest } : {}), message: "Guardian returned a response for a policy identifier that does not match the requested policy." };
    }
    return {
      status,
      executionId,
      policyId: input.policyId,
      correlationId,
      idempotencyKey,
      ...(providerCorrelationId ? { providerCorrelationId } : {}),
      ...(responseDigest ? { responseDigest } : {}),
      message: status === "VERIFIED" ? "Guardian completed the configured MRV workflow." : status === "REJECTED" ? "Guardian rejected the configured MRV workflow." : "Guardian did not return an authoritative VERIFIED or REJECTED decision.",
    };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? `Guardian MRV endpoint timed out after ${timeoutMs()}ms.` : "Guardian MRV endpoint is unavailable due to a network or transport error.";
    return { status: "UNAVAILABLE", executionId: null, policyId: input.policyId, correlationId, idempotencyKey, message };
  } finally {
    clearTimeout(timer);
  }
}
