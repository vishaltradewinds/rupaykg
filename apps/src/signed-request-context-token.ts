import { createHmac } from "node:crypto";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY_ID_RE = /^[a-z0-9_-]{1,32}$/;
const MAX_CONTEXT_TTL_SECONDS = 120;

export type SignedRequestContextInput = {
  /** Must come from the validated AuthContext, never from request body/header input. */
  actorIdentityId: string;
  /** Must be selected from a verified membership before signing. */
  organizationId: string;
};

export type SignedRequestContextOptions = {
  /** Must match the active key material in the database's protected context-key store. */
  secret: string;
  /** Public key identifier used for safe key rotation. */
  keyId: string;
  /** Short-lived transaction context; defaults to 60 seconds and cannot exceed 120. */
  ttlSeconds?: number;
};

/**
 * Signs the exact wire format verified by the PostgreSQL RLS helper:
 * actor_uuid|organization_uuid|issued_at|expires_at|key_id.hex_hmac_sha256
 *
 * This utility only signs claims. The caller remains responsible for authenticating
 * the bearer session and proving that organizationId is a VERIFIED membership.
 */
export function createSignedRequestContextToken(
  input: SignedRequestContextInput,
  options: SignedRequestContextOptions,
): string {
  if (!UUID_RE.test(input.actorIdentityId)) {
    throw new Error("REQUEST_CONTEXT_INVALID: actor identity must be a UUID");
  }
  if (!UUID_RE.test(input.organizationId)) {
    throw new Error("REQUEST_CONTEXT_INVALID: organization must be a UUID");
  }
  if (!KEY_ID_RE.test(options.keyId)) {
    throw new Error("REQUEST_CONTEXT_CONFIG_INVALID: key ID is invalid");
  }
  if (typeof options.secret !== "string" || Buffer.byteLength(options.secret, "utf8") < 32) {
    throw new Error("REQUEST_CONTEXT_CONFIG_INVALID: HMAC key must be at least 32 bytes");
  }

  const ttlSeconds = options.ttlSeconds ?? 60;
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > MAX_CONTEXT_TTL_SECONDS) {
    throw new Error("REQUEST_CONTEXT_INVALID: context lifetime must be between 1 and 120 seconds");
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + ttlSeconds;
  const payload = [
    input.actorIdentityId.toLowerCase(),
    input.organizationId.toLowerCase(),
    String(issuedAt),
    String(expiresAt),
    options.keyId,
  ].join("|");
  const signature = createHmac("sha256", options.secret).update(payload, "utf8").digest("hex");
  return `${payload}.${signature}`;
}

import type { AuthContext } from "./auth.js";

/**
 * Derives signed claims from a validated application AuthContext.
 * The selected organization must be present in the VERIFIED membership set;
 * callers cannot supply actor or organization IDs independently.
 */
export function createSignedRequestContextForAuth(
  auth: AuthContext,
  options: SignedRequestContextOptions,
): string {
  const organizationId = auth.activeOrganizationId;
  if (!organizationId) {
    throw new Error("REQUEST_CONTEXT_UNAVAILABLE: an active organization must be selected");
  }
  if (!auth.memberships.some(
    (membership) => membership.organization_id.toLowerCase() === organizationId.toLowerCase()
      && membership.status === "VERIFIED",
  )) {
    throw new Error("REQUEST_CONTEXT_FORBIDDEN: active organization membership is not verified");
  }
  return createSignedRequestContextToken(
    { actorIdentityId: auth.identityId, organizationId },
    options,
  );
}
