import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registerEmailRecoveryRoutes } from "./auth-email-recovery.js";

function fakePool(options: { identity?: { id: string; email: string } | null } = {}) {
  const calls: string[] = [];
  const client = {
    query: async (sql: string) => {
      calls.push(sql);
      if (sql.includes("select identity_id from identity_email_verification_tokens")) return { rows: [] };
      if (sql.includes("select identity_id from identity_password_reset_tokens")) return { rows: [] };
      return { rows: [] };
    },
    release: () => {},
  };
  return {
    calls,
    connect: async () => client,
    query: async (sql: string) => {
      calls.push(sql);
      if (sql.includes("from identities") && options.identity) return { rows: [options.identity] };
      return { rows: [] };
    },
  } as never;
}

test("email verification rejects invalid or expired tokens without changing identity state", async () => {
  const pool = fakePool();
  const app = Fastify();
  await registerEmailRecoveryRoutes(app, pool);
  const response = await app.inject({ method: "POST", url: "/api/v1/auth/email/verify", payload: { token: "invalid-token" } });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, "TOKEN_INVALID_OR_EXPIRED");
  const statements = (pool as unknown as { calls: string[] }).calls;
  assert.ok(statements.indexOf("set local role rupaykg_app_runtime") > statements.indexOf("begin"));
  await app.close();
});

test("password reset rejects invalid or expired tokens", async () => {
  const app = Fastify();
  const pool = fakePool();
  await registerEmailRecoveryRoutes(app, pool);
  const response = await app.inject({ method: "POST", url: "/api/v1/auth/password/reset", payload: { token: "invalid-token", password: "a-strong-password" } });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, "TOKEN_INVALID_OR_EXPIRED");
  const statements = (pool as unknown as { calls: string[] }).calls;
  assert.ok(statements.indexOf("set local role rupaykg_app_runtime") > statements.indexOf("begin"));
  await app.close();
});

test("password reset request does not disclose whether an account exists", async () => {
  const app = Fastify();
  await registerEmailRecoveryRoutes(app, fakePool());
  const response = await app.inject({ method: "POST", url: "/api/v1/auth/password/request-reset", payload: { email: "nobody@example.org" } });
  assert.equal(response.statusCode, 200);
  assert.match(response.json().message, /If an eligible account exists/);
  await app.close();
});

test("verification resend does not disclose whether an account exists", async () => {
  const app = Fastify();
  await registerEmailRecoveryRoutes(app, fakePool());
  const response = await app.inject({ method: "POST", url: "/api/v1/auth/email/resend", payload: { email: "nobody@example.org" } });
  assert.equal(response.statusCode, 200);
  assert.match(response.json().message, /If the account requires verification/);
  await app.close();
});
