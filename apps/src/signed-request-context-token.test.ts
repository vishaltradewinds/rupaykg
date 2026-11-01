import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createSignedRequestContextToken } from "./signed-request-context-token.js";

const actorIdentityId = "11111111-1111-4111-8111-111111111111";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const secret = "test-only-hmac-secret-material-32-bytes-minimum";

test("signed request context matches the PostgreSQL HMAC wire format", () => {
  const before = Math.floor(Date.now() / 1000);
  const token = createSignedRequestContextToken(
    { actorIdentityId, organizationId },
    { secret, keyId: "key_2026_11", ttlSeconds: 90 },
  );
  const after = Math.floor(Date.now() / 1000);
  const [payload, signature, extra] = token.split(".");
  assert.ok(payload);
  assert.ok(signature);
  assert.equal(extra, undefined);
  const [actor, organization, issuedAtRaw, expiresAtRaw, keyId] = payload.split("|");
  assert.equal(actor, actorIdentityId);
  assert.equal(organization, organizationId);
  assert.equal(keyId, "key_2026_11");
  const issuedAt = Number(issuedAtRaw);
  const expiresAt = Number(expiresAtRaw);
  assert.ok(issuedAt >= before && issuedAt <= after);
  assert.equal(expiresAt - issuedAt, 90);
  assert.equal(signature, createHmac("sha256", secret).update(payload, "utf8").digest("hex"));
});

test("signed request context normalizes UUID case before signing", () => {
  const token = createSignedRequestContextToken(
    { actorIdentityId: actorIdentityId.toUpperCase(), organizationId: organizationId.toUpperCase() },
    { secret, keyId: "k1" },
  );
  const payload = token.split(".")[0]!;
  assert.ok(payload.startsWith(`${actorIdentityId}|${organizationId}|`));
});

test("signed request context rejects invalid actor and organization IDs", () => {
  assert.throws(
    () => createSignedRequestContextToken({ actorIdentityId: "not-a-uuid", organizationId }, { secret, keyId: "k1" }),
    /actor identity must be a UUID/,
  );
  assert.throws(
    () => createSignedRequestContextToken({ actorIdentityId, organizationId: "not-a-uuid" }, { secret, keyId: "k1" }),
    /organization must be a UUID/,
  );
});

test("signed request context rejects weak keys and invalid key IDs", () => {
  assert.throws(
    () => createSignedRequestContextToken({ actorIdentityId, organizationId }, { secret: "short", keyId: "k1" }),
    /HMAC key must be at least 32 bytes/,
  );
  assert.throws(
    () => createSignedRequestContextToken({ actorIdentityId, organizationId }, { secret, keyId: "bad key id" }),
    /key ID is invalid/,
  );
});

test("signed request context lifetime is bounded to 120 seconds", () => {
  assert.throws(
    () => createSignedRequestContextToken({ actorIdentityId, organizationId }, { secret, keyId: "k1", ttlSeconds: 0 }),
    /between 1 and 120 seconds/,
  );
  assert.throws(
    () => createSignedRequestContextToken({ actorIdentityId, organizationId }, { secret, keyId: "k1", ttlSeconds: 121 }),
    /between 1 and 120 seconds/,
  );
  assert.throws(
    () => createSignedRequestContextToken({ actorIdentityId, organizationId }, { secret, keyId: "k1", ttlSeconds: 1.5 }),
    /between 1 and 120 seconds/,
  );
});

import { createSignedRequestContextForAuth } from "./signed-request-context-token.js";

test("signed request context derives actor and active organization from verified AuthContext", () => {
  const token = createSignedRequestContextForAuth({
    identityId: actorIdentityId,
    activeOrganizationId: organizationId,
    memberships: [{ organization_id: organizationId, role_id: "role-1", status: "VERIFIED" }],
  }, { secret, keyId: "k1" });
  const payload = token.split(".")[0]!;
  assert.ok(payload.startsWith(`${actorIdentityId}|${organizationId}|`));
});

test("signed request context rejects an unselected organization", () => {
  assert.throws(() => createSignedRequestContextForAuth({
    identityId: actorIdentityId,
    memberships: [{ organization_id: organizationId, role_id: "role-1", status: "VERIFIED" }],
  }, { secret, keyId: "k1" }), /active organization must be selected/);
});

test("signed request context rejects bilateral scope until multi-party policies exist", () => {
  assert.throws(() => createSignedRequestContextForAuth({
    identityId: actorIdentityId,
    activeOrganizationId: organizationId,
    bilateralOrganizationScope: true,
    memberships: [{ organization_id: organizationId, role_id: "role-1", status: "VERIFIED" }],
  }, { secret, keyId: "k1" }), /bilateral operations require a separately designed multi-party RLS context/);
});

test("signed request context rejects pending or foreign active membership", () => {
  assert.throws(() => createSignedRequestContextForAuth({
    identityId: actorIdentityId,
    activeOrganizationId: organizationId,
    memberships: [{ organization_id: organizationId, role_id: "role-1", status: "PENDING" }],
  }, { secret, keyId: "k1" }), /membership is not verified/);
  assert.throws(() => createSignedRequestContextForAuth({
    identityId: actorIdentityId,
    activeOrganizationId: organizationId,
    memberships: [{ organization_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", role_id: "role-1", status: "VERIFIED" }],
  }, { secret, keyId: "k1" }), /membership is not verified/);
});
