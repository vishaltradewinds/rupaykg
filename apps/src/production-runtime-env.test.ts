import assert from "node:assert/strict";
import test from "node:test";
import { applyRequestContextRuntimeEnvironment } from "./production-runtime-env.js";

test("propagates validated request-context signing values to the server environment", () => {
  const target: NodeJS.ProcessEnv = {};
  applyRequestContextRuntimeEnvironment({
    requestContextSecret: "production-test-request-context-secret-material",
    requestContextKeyId: "v1",
  }, target);

  assert.equal(target.RUPAYKG_REQUEST_CONTEXT_SECRET, "production-test-request-context-secret-material");
  assert.equal(target.RUPAYKG_REQUEST_CONTEXT_KEY_ID, "v1");
  assert.equal(target.VITE_RUPAYKG_REQUEST_CONTEXT_SECRET, undefined);
  assert.equal(target.VITE_RUPAYKG_REQUEST_CONTEXT_KEY_ID, undefined);
});

test("does not mutate process.env when an explicit target environment is supplied", () => {
  const originalSecret = process.env.RUPAYKG_REQUEST_CONTEXT_SECRET;
  const originalKeyId = process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID;
  applyRequestContextRuntimeEnvironment({
    requestContextSecret: "isolated-test-secret-material-with-32-bytes",
    requestContextKeyId: "isolated_test",
  }, {});

  assert.equal(process.env.RUPAYKG_REQUEST_CONTEXT_SECRET, originalSecret);
  assert.equal(process.env.RUPAYKG_REQUEST_CONTEXT_KEY_ID, originalKeyId);
});
