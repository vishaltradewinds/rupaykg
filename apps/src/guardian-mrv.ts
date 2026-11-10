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

function nativeDmrv(): boolean {
  return process.env.GUARDIAN_MRV_NATIVE_DMRV === "true";
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

function nativeDmrvPolicyBound(url: string, policyId: string): boolean {
  try {
    const path = new URL(url).pathname;
    return path.includes(`/api/v1/dmrv/${encodeURIComponent(policyId)}/`);
  } catch {
    return false;
  }
}

export function guardianStatus() {
  return {
    configured: Boolean(endpoint()),
    submitUrlConfigured: Boolean(endpoint()),
    nativeDmrv: nativeDmrv(),
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
  if (nativeDmrv() && !nativeDmrvPolicyBound(url, input.policyId)) {
    return { status: "UNAVAILABLE", executionId: null, policyId: input.policyId, correlationId, idempotencyKey, message: "Native Guardian DMRV mode requires GUARDIAN_MRV_SUBMIT_URL to be bound to the configured policy ID." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const body = nativeDmrv()
      ? {
          activityId: input.activityId,
          verificationId: input.verificationId,
          evidenceId: input.evidenceId,
          policyId: input.policyId,
          ...(input.methodologyCode !== undefined ? { methodologyCode: input.methodologyCode } : {}),
          observations: input.observations,
          evidence: input.evidence,
          metadata: input.metadata,
        }
      : {
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
        };

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
      body: JSON.stringify(body),
    });
    const contentType = response.headers.get("content-type") || "";
    const raw = contentType.includes("application/json") ? await response.json().catch(() => null) : null;
    if (!response.ok) {
      return { status: "UNAVAILABLE", executionId: null, policyId: input.policyId, correlationId, idempotencyKey, raw, message: `Guardian MRV endpoint returned HTTP ${response.status}.` };
    }

    const payload = raw as Record<string, unknown> | null;
    if (nativeDmrv()) {
      const executionId = typeof payload?.id === "string" ? payload.id : typeof payload?.executionId === "string" ? payload.executionId : null;
      if (!executionId) {
        return { status: "UNAVAILABLE", executionId: null, policyId: input.policyId, correlationId, idempotencyKey, raw, message: "Native Guardian DMRV returned success without an authoritative block result identifier." };
      }
      return {
        status: "VERIFIED",
        executionId,
        policyId: input.policyId,
        correlationId,
        idempotencyKey,
        raw,
        message: "Guardian native DMRV policy block accepted the MRV submission.",
      };
    }

    const status = payload?.status === "REJECTED" ? "REJECTED" : payload?.status === "VERIFIED" ? "VERIFIED" : "UNAVAILABLE";
    const executionId = typeof payload?.executionId === "string" ? payload.executionId : typeof payload?.id === "string" ? payload.id : null;
    const returnedPolicyId = typeof payload?.policyId === "string" ? payload.policyId.trim() : null;
    if (status === "VERIFIED" && !executionId) {
      return { status: "UNAVAILABLE", executionId: null, policyId: input.policyId, correlationId, idempotencyKey, raw, message: "Guardian returned VERIFIED without an authoritative execution identifier." };
    }
    if (status === "VERIFIED" && (!returnedPolicyId || returnedPolicyId !== input.policyId)) {
      return { status: "UNAVAILABLE", executionId: null, policyId: input.policyId, correlationId, idempotencyKey, raw, message: "Guardian returned VERIFIED without the expected authoritative policy identifier." };
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
