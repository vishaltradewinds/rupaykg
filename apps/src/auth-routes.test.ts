import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerAuthRoutes } from "./auth-routes.js";

test("auth and onboarding route module registers public options and fail-closed auth endpoints", async () => {
  const app = Fastify({ logger: false });
  await registerAuthRoutes(app, null, null);

  const options = await app.inject({ method: "GET", url: "/api/v1/onboarding/options" });
  assert.equal(options.statusCode, 200);
  assert.ok(Array.isArray(options.json().stakeholders));

  const login = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email: "nobody@example.invalid", password: "not-a-real-password" },
  });
  assert.equal(login.statusCode, 503);
  assert.equal(login.json().code, "DATABASE_UNAVAILABLE");

  await app.close();
});
