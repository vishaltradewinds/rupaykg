import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registerSecurityHeaders } from "./security-headers.js";

test("security headers are applied to API responses", async () => {
  const app = Fastify();
  registerSecurityHeaders(app);
  app.get("/probe", async () => ({ ok: true }));

  try {
    const response = await app.inject({ method: "GET", url: "/probe" });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["strict-transport-security"], "max-age=31536000; includeSubDomains");
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["x-frame-options"], "DENY");
    assert.equal(response.headers["referrer-policy"], "strict-origin-when-cross-origin");
    assert.equal(response.headers["permissions-policy"], "camera=(self), geolocation=(self), microphone=()");
    assert.deepEqual(response.json(), { ok: true });
  } finally {
    await app.close();
  }
});
