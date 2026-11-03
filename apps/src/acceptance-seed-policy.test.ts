import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldRunAcceptanceSeed } from "./acceptance-seed-policy.js";

describe("acceptance seed policy", () => {
  it("does not seed unless explicitly requested", () => {
    assert.equal(shouldRunAcceptanceSeed({ NODE_ENV: "test" }), false);
  });

  it("allows explicitly requested fixtures outside production", () => {
    assert.equal(shouldRunAcceptanceSeed({
      NODE_ENV: "test",
      RUPAYKG_ACCEPTANCE_SEED_ON_START: "true",
    }), true);
  });

  it("blocks acceptance fixtures in production before a database connection", () => {
    assert.throws(() => shouldRunAcceptanceSeed({
      NODE_ENV: "production",
      RUPAYKG_ACCEPTANCE_SEED_ON_START: "true",
    }), /ACCEPTANCE_SEED_FORBIDDEN_IN_PRODUCTION/);
  });
});
