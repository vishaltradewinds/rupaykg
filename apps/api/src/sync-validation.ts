export type SyncEnvelopeValidation =
  | { ok: true; idempotencyKey: string; deviceId: string; clientSequence: number; capturedAt: string; payload: Record<string, unknown> | unknown[] }
  | { ok: false; code: string; error: string };

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function validateSyncEnvelope(body: Record<string, unknown>): SyncEnvelopeValidation {
  const idempotencyKey = requiredString(body.idempotencyKey);
  const deviceId = requiredString(body.deviceId);
  const capturedAt = requiredString(body.capturedAt);
  const clientSequence = Number(body.clientSequence);

  if (!idempotencyKey || !deviceId || !capturedAt || !Number.isSafeInteger(clientSequence) || clientSequence < 1 || body.payload === undefined) {
    return { ok: false, code: "INVALID_ENVELOPE", error: "idempotencyKey, deviceId, positive integer clientSequence, capturedAt and payload are required" };
  }
  if (!isUuid(deviceId)) return { ok: false, code: "INVALID_DEVICE", error: "deviceId must be a field device UUID" };
  if (Number.isNaN(Date.parse(capturedAt))) return { ok: false, code: "INVALID_CAPTURE_TIME", error: "capturedAt must be an ISO date" };
  if (body.payload === null || typeof body.payload !== "object") return { ok: false, code: "INVALID_PAYLOAD", error: "payload must be a JSON object or array" };

  return { ok: true, idempotencyKey, deviceId, clientSequence, capturedAt, payload: body.payload as Record<string, unknown> | unknown[] };
}

export function validateConflictResolution(body: Record<string, unknown>): { ok: true; resolutionStatus: "RESOLVED" | "REJECTED"; resolutionReason: string } | { ok: false; code: string; error: string } {
  const resolutionStatus = requiredString(body.resolutionStatus);
  const resolutionReason = requiredString(body.resolutionReason);
  if (!resolutionStatus || !["RESOLVED", "REJECTED"].includes(resolutionStatus) || !resolutionReason) {
    return { ok: false, code: "INVALID_RESOLUTION", error: "resolutionStatus RESOLVED|REJECTED and resolutionReason are required" };
  }
  return { ok: true, resolutionStatus: resolutionStatus as "RESOLVED" | "REJECTED", resolutionReason };
}
