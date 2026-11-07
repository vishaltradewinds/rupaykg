import test from "node:test";
import assert from "node:assert/strict";
import { canActForOrganization, hasOrganizationPermission, canVerifyEvidence } from "./auth.js";

test("authorization fails closed without organization or verified membership context", () => {
  assert.equal(canActForOrganization({ identityId: "i", memberships: [] }, "org"), false);
  assert.equal(canActForOrganization({ identityId: "i", memberships: [{ organization_id: "org-a", role_id: "r", status: "VERIFIED" }] }, ""), false);
  assert.equal(canActForOrganization({ identityId: "i", memberships: [{ organization_id: "org-a", role_id: "r", status: "VERIFIED" }] }, "org-b"), false);
  assert.equal(canActForOrganization({ identityId: "i", memberships: [{ organization_id: "org-a", role_id: "r", status: "VERIFIED" }], activeOrganizationId: "org-a" }, "org-a"), true);
});

test("organization permission lookup is never reached for an unscoped context", async () => {
  let queried = false;
  const client = { query: async () => { queried = true; return { rows: [{ ok: true }] }; } } as never;
  const result = await hasOrganizationPermission(client, { identityId: "i", memberships: [] }, "org-a", ["waste:read"]);
  assert.equal(result, false);
  assert.equal(queried, false);
});

test("evidence verification requires membership in the evidence activity organization", async () => {
  const queries: unknown[][] = [];
  const client = { query: async (_sql: string, values: unknown[]) => {
    queries.push(values);
    return { rows: [{ ok: true }] };
  } } as never;
  assert.equal(await canVerifyEvidence(client, "identity-a", "evidence-a"), true);
  assert.deepEqual(queries[0], ["evidence-a", "identity-a", ["VERIFY_EVIDENCE", "verification:approve", "verification.approve"]]);
});
