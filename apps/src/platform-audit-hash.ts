import { createHash } from "node:crypto";

/** Stable JSON serialization for audit event hashes, including nested payloads. */
export function canonicalAuditJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("AUDIT_HASH_NON_FINITE_NUMBER");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return "[" + value.map(canonicalAuditJson).join(",") + "]";
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return "{" + Object.keys(object).sort().map((key) => JSON.stringify(key) + ":" + canonicalAuditJson(object[key])).join(",") + "}";
  }
  throw new Error("AUDIT_HASH_UNSUPPORTED_VALUE");
}

export function hashPlatformAuditEventV2(event: unknown): string {
  return createHash("sha256").update(canonicalAuditJson(event), "utf8").digest("hex");
}

export type PlatformAuditEventV2 = {
  actorIdentityId: string;
  action: string;
  targetType: string;
  targetId: string;
  organizationId: string | null;
  requestId: string;
  payload: unknown;
  previousHash: string | null;
};

export function auditEventV2FromRow(row: {
  actor_identity_id: string;
  action: string;
  target_type: string;
  target_id: string;
  organization_id: string | null;
  request_id: string;
  payload: unknown;
  previous_hash: string | null;
}): PlatformAuditEventV2 {
  return {
    actorIdentityId: row.actor_identity_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    organizationId: row.organization_id,
    requestId: row.request_id,
    payload: row.payload,
    previousHash: row.previous_hash,
  };
}
