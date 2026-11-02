import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyProductionRequestContextEnvironment } from "./production-runtime-env.js";

describe("production request-context runtime environment", () => {
  it("propagates validated signing material only to server-side variable names", () => {
    const environment: NodeJS.ProcessEnv = {};
    applyProductionRequestContextEnvironment({
      requestContextSecret: "validated-secret-material-at-least-32-bytes",
      requestContextKeyId: "v1",
    }, environment);
    assert.equal(environment.RUPAYKG_REQUEST_CONTEXT_SECRET, "validated-secret-material-at-least-32-bytes");
    assert.equal(environment.RUPAYKG_REQUEST_CONTEXT_KEY_ID, "v1");
    assert.equal(environment.VITE_RUPAYKG_REQUEST_CONTEXT_SECRET, undefined);
    assert.equal(environment.VITE_RUPAYKG_REQUEST_CONTEXT_KEY_ID, undefined);
  });

  it("does not mutate global process.env when an explicit environment is supplied", () => {
    const previousSecret = process.env.RUPAYKG_REQUEST_CONTEXT_SECRET;
    const previousKeyId = process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID;
    const environment: NodeJS.ProcessEnv = {};
    applyProductionRequestContextEnvironment({ requestContextSecret: "test-secret", requestContextKeyId: "test-key" }, environment);
    assert.equal(process.env.RUPAYKG_REQUEST_CONTEXT_SECRET, previousSecret);
    assert.equal(process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID, previousKeyId);
  });
});
