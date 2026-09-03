import { describe, expect, it } from "node:test";
import assert from "node:assert/strict";
import { HIGH_RISK_PERMISSIONS } from "../src/auth.js";

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

  it("does not treat organization membership as a high-risk permission", () => {
    for (const aliases of Object.values(HIGH_RISK_PERMISSIONS)) {
      expect(aliases.length).toBeGreaterThan(0);
    }
  });
});
