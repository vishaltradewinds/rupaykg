import test from "node:test";
import assert from "node:assert/strict";
import { bwgProfileReviewBasis, canReadBwgWorkspace } from "./value-routes.js";

test("BWG profile intake never self-asserts statutory applicability or external registration", () => {
  const basis = bwgProfileReviewBasis();
  assert.equal(basis.sourceRuleReference, "SWM_RULES_2026_S_O_388_E");
  assert.equal(basis.classification, "REVIEW_REQUIRED");
  assert.equal(basis.determinationBoundary, "PROFILE_INTAKE_ONLY_NOT_A_STATUTORY_DETERMINATION");
  assert.equal(basis.evidenceAndIndependentReviewRequired, true);
  assert.equal(basis.externalRegistrationAsserted, false);
});


test("BWG workspace read requires the explicit reports:read permission", async () => {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const auth = {
    identityId: "identity-1",
    memberships: [{ organization_id: "org-1", role_id: "role-1", status: "VERIFIED" }],
    activeOrganizationId: "org-1",
  };
  const client = {
    query: async (sql: string, values: unknown[]) => {
      queries.push({ sql, values });
      return { rows: [{ ok: true }] };
    },
  } as never;

  assert.equal(await canReadBwgWorkspace(client, auth, "org-1"), true);
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0]!.values, ["identity-1", "org-1", ["reports:read"]]);
});

test("BWG workspace read fails closed when reports:read is absent or organization scope differs", async () => {
  let queryCount = 0;
  const auth = {
    identityId: "identity-1",
    memberships: [{ organization_id: "org-1", role_id: "role-1", status: "VERIFIED" }],
    activeOrganizationId: "org-1",
  };
  const deniedClient = {
    query: async () => { queryCount += 1; return { rows: [{ ok: false }] }; },
  } as never;

  assert.equal(await canReadBwgWorkspace(deniedClient, auth, "org-1"), false);
  assert.equal(await canReadBwgWorkspace(deniedClient, auth, "org-2"), false);
  assert.equal(queryCount, 1);
});
