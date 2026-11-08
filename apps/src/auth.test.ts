import test from "node:test";
import assert from "node:assert/strict";
import { authenticate, canActForOrganization, hasOrganizationPermission, canVerifyEvidence } from "./auth.js";

test("authorization fails closed without organization or verified membership context", () => {
  assert.equal(canActForOrganization({ identityId: "i", memberships: [] }, "org"), false);
  assert.equal(canActForOrganization({ identityId: "i", memberships: [{ organization_id: "org-a", role_id: "r", status: "VERIFIED" }] }, ""), false);
  assert.equal(canActForOrganization({ identityId: "i", memberships: [{ organization_id: "org-a", role_id: "r", status: "VERIFIED" }] }, "org-b"), false);
  assert.equal(canActForOrganization({ identityId: "i", memberships: [{ organization_id: "org-a", role_id: "r", status: "VERIFIED" }], activeOrganizationId: "org-a" }, "org-a"), true);
  assert.equal(canActForOrganization({ identityId: "i", memberships: [{ organization_id: "org-a", role_id: "r", status: "PENDING" }], activeOrganizationId: "org-a" }, "org-a"), false);
});

test("organization permission lookup is never reached for an unscoped context", async () => {
  let queried = false;
  const client = { query: async () => { queried = true; return { rows: [{ ok: true }] }; } } as never;
  const result = await hasOrganizationPermission(client, { identityId: "i", memberships: [] }, "org-a", ["waste:read"]);
  assert.equal(result, false);
  assert.equal(queried, false);
});

test("evidence verification requires membership in the evidence activity organization", async () => {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const client = { query: async (sql: string, values: unknown[]) => {
    queries.push({ sql, values });
    return { rows: [{ ok: true }] };
  } } as never;
  assert.equal(await canVerifyEvidence(client, "identity-a", "evidence-a"), true);
  assert.match(queries[0]!.sql, /om\.organization_id\s*=\s*a\.organization_id/);
  assert.deepEqual(queries[0]!.values, ["evidence-a", "identity-a", ["VERIFY_EVIDENCE", "verification:approve", "verification.approve"]]);
});


test("authenticate rejects revoked or expired sessions before projecting organization scope", async () => {
  const request = { headers: { authorization: "Bearer revoked-token" }, url: "/api/v1/activities" } as never;
  const pool = {
    query: async () => ({ rows: [] }),
  } as never;
  assert.equal(await authenticate(request, pool), null);
});

test("authenticate requires an explicit organization for multi-organization identities", async () => {
  const request = { headers: { authorization: "Bearer live-token" }, url: "/api/v1/activities" } as never;
  let call = 0;
  const pool = {
    query: async () => {
      call += 1;
      if (call === 1) return { rows: [{ identity_id: "identity-a" }] };
      return {
        rows: [
          { organization_id: "org-a", role_id: "role-a", status: "VERIFIED" },
          { organization_id: "org-b", role_id: "role-b", status: "VERIFIED" },
        ],
      };
    },
  } as never;
  assert.equal(await authenticate(request, pool), null);
});

test("authenticate rejects an organization selector outside the verified membership set", async () => {
  const request = {
    headers: {
      authorization: "Bearer live-token",
      "x-rupaykg-organization-id": "org-b",
    },
    url: "/api/v1/activities",
  } as never;
  let call = 0;
  const pool = {
    query: async () => {
      call += 1;
      if (call === 1) return { rows: [{ identity_id: "identity-a" }] };
      return { rows: [{ organization_id: "org-a", role_id: "role-a", status: "VERIFIED" }] };
    },
  } as never;
  assert.equal(await authenticate(request, pool), null);
});

test("authenticate scopes a single verified organization without trusting request-body identity", async () => {
  const request = {
    headers: { authorization: "Bearer live-token" },
    body: { identityId: "attacker-controlled", organizationId: "attacker-org" },
    url: "/api/v1/activities",
  } as never;
  let call = 0;
  const pool = {
    query: async () => {
      call += 1;
      if (call === 1) return { rows: [{ identity_id: "identity-a" }] };
      return { rows: [{ organization_id: "org-a", role_id: "role-a", status: "VERIFIED" }] };
    },
  } as never;
  assert.deepEqual(await authenticate(request, pool), {
    identityId: "identity-a",
    memberships: [{ organization_id: "org-a", role_id: "role-a", status: "VERIFIED" }],
    activeOrganizationId: "org-a",
    bilateralOrganizationScope: undefined,
  });
});
