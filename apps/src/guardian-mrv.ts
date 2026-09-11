export interface GuardianMrvRequest {
  activityId: string;
  verificationId: string;
  evidenceId: string;
  policyId: string;
  methodologyCode?: string;
  observations: unknown[];
  evidence: unknown[];
  metadata?: Record<string, unknown>;
}

export interface GuardianMrvResult {
  status: "VERIFIED" | "REJECTED" | "NOT_CONFIGURED" | "UNAVAILABLE";
  executionId: string | null;
  policyId: string;
  raw?: unknown;
  message: string;
}

function endpoint(): string | null {
  const value = process.env.GUARDIAN_MRV_SUBMIT_URL?.trim();
  return value || null;
}

export function guardianStatus() {
  return {
    configured: Boolean(endpoint()),
    submitUrlConfigured: Boolean(endpoint()),
    syntheticData: false,
    integration: "hedera-guardian",
  };
}

export async function executeGuardianMrv(input: GuardianMrvRequest): Promise<GuardianMrvResult> {
  const url = endpoint();
  if (!url) {
    return { status: "NOT_CONFIGURED", executionId: null, policyId: input.policyId, message: "Guardian MRV submission is unavailable until GUARDIAN_MRV_SUBMIT_URL is configured." };
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(process.env.GUARDIAN_API_TOKEN ? { authorization: `Bearer ${process.env.GUARDIAN_API_TOKEN}` } : {}) },
      body: JSON.stringify({ schema: "rupaykg:guardian-mrv:v1", policyId: input.policyId, activityId: input.activityId, verificationId: input.verificationId, evidenceId: input.evidenceId, methodologyCode: input.methodologyCode, observations: input.observations, evidence: input.evidence, metadata: input.metadata }),
    });
    const raw = await response.json().catch(() => null);
    if (!response.ok) return { status: "UNAVAILABLE", executionId: null, policyId: input.policyId, raw, message: `Guardian MRV endpoint returned HTTP ${response.status}.` };
    const body = raw as Record<string, unknown> | null;
    const status = body?.status === "REJECTED" ? "REJECTED" : body?.status === "VERIFIED" || body?.verified === true ? "VERIFIED" : "UNAVAILABLE";
    const executionId = typeof body?.executionId === "string" ? body.executionId : typeof body?.id === "string" ? body.id : null;
    return { status, executionId, policyId: input.policyId, raw, message: status === "VERIFIED" ? "Guardian completed the configured MRV workflow." : "Guardian did not return an authoritative VERIFIED decision." };
  } catch (error) {
    return { status: "UNAVAILABLE", executionId: null, policyId: input.policyId, message: `Guardian MRV endpoint is unavailable: ${error instanceof Error ? error.message : String(error)}` };
  }
}
