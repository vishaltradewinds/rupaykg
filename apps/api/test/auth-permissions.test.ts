import { describe, expect, it } from "node:test";
import assert from "node:assert/strict";
import { HIGH_RISK_PERMISSIONS, canPerformHighRiskActionInDatabase, canVerifyEvidence, type AuthContext } from "../src/auth.js";

describe("high-risk authorization policy", () => {
  it("defines every production high-risk action with an explicit canonical permission", () => {
    const expected = [
      "VERIFY_EVIDENCE",
      "ISSUE_CREDENTIAL",
      "TRANSFER_CREDENTIAL",
      "RETIRE_CREDENTIAL",
      "AUTHORIZE_SETTLEMENT",
      "SETTLE_FUNDS",
    ] as const;
    assert.deepEqual(Object.keys(HIGH_RISK_PERMISSIONS), expected);
    for (const permission of expected) {
      assert.ok(HIGH_RISK_PERMISSIONS[permission].includes(permission));
    }
  });

  it("requires an authenticated organization membership before querying role permissions", async () => {
    let queried = false;
    const client = {
      query: async () => {
        queried = true;
        return { rows: [{ ok: true }] };
      },
    } as never;
    const auth: AuthContext = { identityId: "identity-1", memberships: [] };
    const allowed = await canPerformHighRiskActionInDatabase(client, auth, "org-1", "ISSUE_CREDENTIAL");
    assert.equal(allowed, false);
    assert.equal(queried, false);
  });

  it("authorizes only when the authoritative role query reports an explicit permission", async () => {
    const auth: AuthContext = {
      identityId: "identity-1",
      memberships: [{ organization_id: "org-1", role_id: "role-1", status: "VERIFIED" }],
    };
    const queries: Array<{ text: string; values: unknown[] }> = [];
    const client = {
      query: async (text: string, values: unknown[]) => {
        queries.push({ text, values });
        return { rows: [{ ok: true }] };
      },
    } as never;
    const allowed = await canPerformHighRiskActionInDatabase(client, auth, "org-1", "ISSUE_CREDENTIAL");
    assert.equal(allowed, true);
    assert.equal(queries.length, 1);
    assert.match(queries[0].text, /jsonb_array_elements_text\(r\.permissions\)/);
    assert.deepEqual(queries[0].values, ["identity-1", "org-1", ["ISSUE_CREDENTIAL", "registry:issue", "registry.issue"]]);
  });

  it("fails closed when the authoritative role query reports no permission", async () => {
    const auth: AuthContext = {
      identityId: "identity-1",
      memberships: [{ organization_id: "org-1", role_id: "role-1", status: "VERIFIED" }],
    };
    const client = {
      query: async () => ({ rows: [{ ok: false }] }),
    } as never;
    const allowed = await canPerformHighRiskActionInDatabase(client, auth, "org-1", "SETTLE_FUNDS");
    expect(allowed).toBe(false);
  });

  it("uses explicit VERIFY_EVIDENCE permission instead of role-name elevation", async () => {
    const queries: Array<{ text: string; values: unknown[] }> = [];
    const client = {
      query: async (text: string, values: unknown[]) => {
        queries.push({ text, values });
        return { rows: [{ ok: true }] };
      },
    } as never;
    const allowed = await canVerifyEvidence(client, "identity-1", "evidence-1");
    assert.equal(allowed, true);
    assert.equal(queries.length, 1);
    assert.doesNotMatch(queries[0].text, /lower\(r\.name\)/);
    assert.deepEqual(queries[0].values, ["evidence-1", "identity-1", ["VERIFY_EVIDENCE", "verification:approve", "verification.approve"]]);
  });
});
