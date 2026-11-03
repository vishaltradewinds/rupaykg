export type SyncEnvelopeValidation =
  | { ok: true; idempotencyKey: string; deviceId: string; clientSequence: number; capturedAt: string; payload: Record<string, unknown> | unknown[] }
  | { ok: false; code: string; error: string };

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isStrictTimestamp(value: string): boolean {
  // Require a complete RFC3339-style timestamp with an explicit timezone.
  // Date.parse alone accepts date-only and timezone-naive values in some runtimes.
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const zone = match[8]!;

  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  // Avoid Date.UTC's special handling of years 0000–0099 as 1900–1999.
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthLengths = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > monthLengths[month - 1]!) return false;

  if (zone !== "Z") {
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }

  return Number.isFinite(Date.parse(value));
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
  if (!isStrictTimestamp(capturedAt)) return { ok: false, code: "INVALID_CAPTURE_TIME", error: "capturedAt must be a complete timestamp with an explicit timezone and valid calendar/clock values" };
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
