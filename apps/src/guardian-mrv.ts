import { createHash, randomUUID } from "node:crypto";
import { readBoundedResponseBody, ResponseBodyTooLargeError } from "./bounded-response.js";

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
  responseDigest: string | null;
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

function maxResponseBytes(): number {
  const parsed = Number.parseInt(process.env.GUARDIAN_MRV_MAX_RESPONSE_BYTES || "65536", 10);
  return Number.isFinite(parsed) && parsed >= 1024 && parsed <= 1_048_576 ? parsed : 65536;
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
    maxResponseBytes: maxResponseBytes(),
    syntheticData: false,
    integration: "hedera-guardian",
    contract: "rupaykg:guardian-mrv:v1",
  };
}

export async function executeGuardianMrv(input: GuardianMrvRequest): Promise<GuardianMrvResult> {
  const url = endpoint();
  const correlationId = input.correlationId?.trim() || randomUUID();
  const idempotencyKey = input.idempotencyKey?.trim() || deterministicIdempotencyKey(input);
  const base = { policyId: input.policyId, correlationId, idempotencyKey, responseDigest: null as string | null };
  if (!url) {
    return { status: "NOT_CONFIGURED", executionId: null, ...base, message: "Guardian MRV submission is unavailable until GUARDIAN_MRV_SUBMIT_URL is configured." };
  }
  if (nativeDmrv() && !nativeDmrvPolicyBound(url, input.policyId)) {
    return { status: "UNAVAILABLE", executionId: null, ...base, message: "Native Guardian DMRV mode requires GUARDIAN_MRV_SUBMIT_URL to be bound to the configured policy ID." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  let responseDigest: string | null = null;
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
        ...(process.env.GUARDIAN_API_TOKEN ? { authorization: "Bearer " + process.env.GUARDIAN_API_TOKEN } : {}),
      },
      body: JSON.stringify(body),
    });

    let bounded;
    try {
      bounded = await readBoundedResponseBody(response, maxResponseBytes());
    } catch (error) {
      if (error instanceof ResponseBodyTooLargeError) {
        return { status: "UNAVAILABLE", executionId: null, ...base, message: "Guardian MRV response exceeded the configured size limit." };
      }
      throw error;
    }
    responseDigest = bounded.sha256;

    if (!response.ok) {
      return { status: "UNAVAILABLE", executionId: null, ...base, responseDigest, message: "Guardian MRV endpoint returned HTTP " + response.status + "." };
    }
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) {
      return { status: "UNAVAILABLE", executionId: null, ...base, responseDigest, message: "Guardian MRV endpoint returned a non-JSON response." };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(bounded.text);
    } catch {
      return { status: "UNAVAILABLE", executionId: null, ...base, responseDigest, message: "Guardian MRV endpoint returned invalid JSON." };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { status: "UNAVAILABLE", executionId: null, ...base, responseDigest, message: "Guardian MRV endpoint returned an invalid response shape." };
    }
    const payload = parsed as Record<string, unknown>;

    if (nativeDmrv()) {
      const candidateId = typeof payload.id === "string" ? payload.id.trim() : typeof payload.executionId === "string" ? payload.executionId.trim() : "";
      if (!candidateId) {
        return { status: "UNAVAILABLE", executionId: null, ...base, responseDigest, message: "Native Guardian DMRV returned success without an authoritative block result identifier." };
      }
      const returnedPolicyId = typeof payload.policyId === "string" ? payload.policyId.trim() : "";
      if (returnedPolicyId && returnedPolicyId !== input.policyId) {
        return { status: "UNAVAILABLE", executionId: null, ...base, responseDigest, message: "Native Guardian DMRV returned a result for a different policy identifier." };
      }
      return {
        status: "VERIFIED",
        executionId: candidateId,
        ...base,
        responseDigest,
        message: "Guardian native DMRV policy block accepted the MRV submission.",
      };
    }

    const status = payload.status === "REJECTED" ? "REJECTED" : payload.status === "VERIFIED" ? "VERIFIED" : "UNAVAILABLE";
    const candidateId = typeof payload.executionId === "string" ? payload.executionId.trim() : typeof payload.id === "string" ? payload.id.trim() : "";
    const executionId = candidateId || null;
    const returnedPolicyId = typeof payload.policyId === "string" ? payload.policyId.trim() : null;
    if (status === "VERIFIED" && !executionId) {
      return { status: "UNAVAILABLE", executionId: null, ...base, responseDigest, message: "Guardian returned VERIFIED without an authoritative execution identifier." };
    }
    if (status === "VERIFIED" && (!returnedPolicyId || returnedPolicyId !== input.policyId)) {
      return { status: "UNAVAILABLE", executionId: null, ...base, responseDigest, message: "Guardian returned VERIFIED without the expected authoritative policy identifier." };
    }
    return {
      status,
      executionId,
      ...base,
      responseDigest,
      message: status === "VERIFIED" ? "Guardian completed the configured MRV workflow." : status === "REJECTED" ? "Guardian rejected the configured MRV workflow." : "Guardian did not return an authoritative VERIFIED or REJECTED decision.",
    };
  } catch (error) {
    const timedOut = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
    return {
      status: "UNAVAILABLE",
      executionId: null,
      ...base,
      responseDigest,
      message: timedOut ? "Guardian MRV endpoint timed out after " + timeoutMs() + "ms." : "Guardian MRV endpoint is unavailable.",
    };
  } finally {
    clearTimeout(timer);
  }
}
