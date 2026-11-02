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
  raw?: unknown;
  message: string;
}

function endpoint(): string | null {
  const value = process.env.GUARDIAN_MRV_SUBMIT_URL?.trim();
  return value || null;
}

function timeoutMs(): number {
  const parsed = Number.parseInt(process.env.GUARDIAN_MRV_TIMEOUT_MS || "10000", 10);
  return Number.isFinite(parsed) && parsed >= 1000 && parsed <= 60000 ? parsed : 10000;
}

function deterministicIdempotencyKey(input: GuardianMrvRequest): string {
  return createHash("sha256")
    .update([input.activityId, input.verificationId, input.evidenceId, input.policyId, input.methodologyCode || ""].join("|"))
    .digest("hex");
}

export function guardianStatus() {
  return {
    configured: Boolean(endpoint()),
    submitUrlConfigured: Boolean(endpoint()),
    timeoutMs: timeoutMs(),
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
    const raw = contentType.includes("application/json") ? await response.json().catch(() => null) : null;
    if (!response.ok) {
      return { status: "UNAVAILABLE", executionId: null, policyId: input.policyId, correlationId, idempotencyKey, raw, message: `Guardian MRV endpoint returned HTTP ${response.status}.` };
    }
    const body = raw as Record<string, unknown> | null;
    const status = body?.status === "REJECTED" ? "REJECTED" : body?.status === "VERIFIED" ? "VERIFIED" : "UNAVAILABLE";
    const executionId = typeof body?.executionId === "string" ? body.executionId : typeof body?.id === "string" ? body.id : null;
    if (status === "VERIFIED" && !executionId) {
      return { status: "UNAVAILABLE", executionId: null, policyId: input.policyId, correlationId, idempotencyKey, raw, message: "Guardian returned VERIFIED without an authoritative execution identifier." };
    }
    return {
      status,
      executionId,
      policyId: input.policyId,
      correlationId,
      idempotencyKey,
      raw,
      message: status === "VERIFIED" ? "Guardian completed the configured MRV workflow." : status === "REJECTED" ? "Guardian rejected the configured MRV workflow." : "Guardian did not return an authoritative VERIFIED or REJECTED decision.",
    };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? `Guardian MRV endpoint timed out after ${timeoutMs()}ms.` : `Guardian MRV endpoint is unavailable: ${error instanceof Error ? error.message : String(error)}`;
    return { status: "UNAVAILABLE", executionId: null, policyId: input.policyId, correlationId, idempotencyKey, message };
  } finally {
    clearTimeout(timer);
  }
}
