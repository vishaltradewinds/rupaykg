import { createHash } from "node:crypto";

/** Canonical JSON encoding for stable hashes across object-key order and JSONB round trips. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const object = value as Record<string, unknown>;
  return "{" + Object.keys(object).sort().map((key) => JSON.stringify(key) + ":" + canonicalJson(object[key])).join(",") + "}";
}

export function canonicalGovBridgeHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
