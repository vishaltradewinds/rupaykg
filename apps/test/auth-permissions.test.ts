import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HIGH_RISK_PERMISSIONS, canPerformHighRiskActionInDatabase, canVerifyEvidence, establishAuthenticatedDatabaseContext, type AuthContext } from "../src/auth.js";

describe("high-risk authorization policy", () => {
  it("defines every production high-risk action with an explicit canonical permission", () => {
    const expected = ["VERIFY_EVIDENCE", "ISSUE_CREDENTIAL", "TRANSFER_CREDENTIAL", "RETIRE_CREDENTIAL", "AUTHORIZE_SETTLEMENT", "SETTLE_FUNDS"] as const;
    assert.deepEqual(Object.keys(HIGH_RISK_PERMISSIONS), expected);
    for (const permission of expected) assert.ok((HIGH_RISK_PERMISSIONS[permission] as readonly string[]).includes(permission));
  });

  it("uses the authoritative PostgreSQL role query for an authorized organization", async () => {
    let queried = false;
    let queryText = "";
    const client = { query: async (sql: string) => { queried = true; queryText = sql; return { rows: [{ ok: true }] }; } } as never;
    const auth: AuthContext = { identityId: "identity-1", memberships: [{ organization_id: "org-1", role_id: "role-1", status: "VERIFIED" }] };
    const allowed = await canPerformHighRiskActionInDatabase(client, auth, "org-1", "ISSUE_CREDENTIAL");
    assert.equal(allowed, true); assert.equal(queried, true);
    assert.match(queryText, /r\.organization_id = om\.organization_id/);
  });

  it("requires the active organization to match the mutation target", async () => {
    const auth: AuthContext = {
      identityId: "identity-1",
      memberships: [
        { organization_id: "org-1", role_id: "role-1", status: "VERIFIED" },
        { organization_id: "org-2", role_id: "role-2", status: "VERIFIED" },
      ],
      activeOrganizationId: "org-1",
    };
    let queried = false;
    const client = { query: async () => { queried = true; return { rows: [{ ok: true }] }; } } as never;
    assert.equal(await canPerformHighRiskActionInDatabase(client, auth, "org-1", "ISSUE_CREDENTIAL"), true);
    assert.equal(await canPerformHighRiskActionInDatabase(client, auth, "org-2", "ISSUE_CREDENTIAL"), false);
    assert.equal(queried, true);
  });

  it("fails closed when the authoritative role query reports no permission", async () => {
    const auth: AuthContext = { identityId: "identity-1", memberships: [{ organization_id: "org-1", role_id: "role-1", status: "VERIFIED" }] };
    const client = { query: async () => ({ rows: [{ ok: false }] }) } as never;
    assert.equal(await canPerformHighRiskActionInDatabase(client, auth, "org-1", "SETTLE_FUNDS"), false);
  });

  it("uses explicit VERIFY_EVIDENCE permission instead of role-name elevation", async () => {
    const queries: Array<{ text: string; values: unknown[] }> = [];
    const client = { query: async (text: string, values: unknown[]) => { queries.push({ text, values }); return { rows: [{ ok: true }] }; } } as never;
    assert.equal(await canVerifyEvidence(client, "identity-1", "evidence-1", "organization-1"), true);
    assert.equal(queries.length, 1);
    assert.doesNotMatch(queries[0]!.text, /lower\(r\.name\)/);
    assert.match(queries[0]!.text, /om\.organization_id = a\.organization_id/);
    assert.match(queries[0]!.text, /r\.organization_id = om\.organization_id/);
    assert.match(queries[0]!.text, /a\.organization_id = \$3/);
    assert.deepEqual(queries[0]!.values, ["evidence-1", "identity-1", "organization-1", ["VERIFY_EVIDENCE", "verification:approve", "verification.approve"]]);
  });

  it("does not establish a database context for an organization different from AuthContext", async () => {
    const auth: AuthContext = {
      identityId: "identity-1",
      memberships: [
        { organization_id: "org-1", role_id: "role-1", status: "VERIFIED" },
        { organization_id: "org-2", role_id: "role-2", status: "VERIFIED" },
      ],
      activeOrganizationId: "org-1",
    };
    let queried = false;
    const client = { query: async () => { queried = true; return { rows: [{ identity_id: "identity-1" }] }; } } as never;
    const request = { headers: { authorization: "Bearer test-token" } } as never;
    assert.equal(await establishAuthenticatedDatabaseContext(client, request, auth, "org-2"), false);
    assert.equal(queried, false);
  });

  it("establishes database context only when the database identity matches the active application identity", async () => {
    const auth: AuthContext = {
      identityId: "identity-1",
      memberships: [{ organization_id: "org-1", role_id: "role-1", status: "VERIFIED" }],
      activeOrganizationId: "org-1",
    };
    let values: unknown[] = [];
    const client = { query: async (_text: string, params: unknown[]) => { values = params; return { rows: [{ identity_id: "identity-1" }] }; } } as never;
    const request = { headers: { authorization: "Bearer test-token" } } as never;
    assert.equal(await establishAuthenticatedDatabaseContext(client, request, auth, "org-1"), true);
    assert.deepEqual(values, ["test-token", "org-1"]);
  });

  it("rejects a database context whose identity differs from AuthContext", async () => {
    const auth: AuthContext = {
      identityId: "identity-1",
      memberships: [{ organization_id: "org-1", role_id: "role-1", status: "VERIFIED" }],
      activeOrganizationId: "org-1",
    };
    const client = { query: async () => ({ rows: [{ identity_id: "identity-2" }] }) } as never;
    const request = { headers: { authorization: "Bearer test-token" } } as never;
    assert.equal(await establishAuthenticatedDatabaseContext(client, request, auth, "org-1"), false);
  });
});
