import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { withSignedRequestDatabaseContext } from "./request-database-context.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const auth = {
  identityId: "11111111-1111-4111-8111-111111111111",
  activeOrganizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  memberships: [{
    organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    role_id: "role-1",
    status: "VERIFIED",
  }],
};
const options = {
  secret: "test-only-hmac-secret-material-32-bytes-minimum",
  keyId: "ci-test-key",
};

test("signed request context is transaction-local and cleared before a pooled connection is reused", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const inside = await withSignedRequestDatabaseContext(pool, auth, options, async (client) => {
      const result = await client.query<{ context: string | null }>(
        "select current_setting('app.request_context', true) as context",
      );
      return result.rows[0]?.context ?? null;
    });
    assert.ok(inside);
    const [payload, signature] = inside.split(".");
    assert.ok(payload);
    assert.match(signature ?? "", /^[0-9a-f]{64}$/);

    const outside = await pool.query<{ context: string | null }>(
      "select current_setting('app.request_context', true) as context",
    );
    assert.equal(outside.rows[0]?.context ?? null, "");
  } finally {
    await pool.end();
  }
});

test("signed request context is cleared when the request transaction rolls back", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    await assert.rejects(
      withSignedRequestDatabaseContext(pool, auth, options, async (client) => {
        const result = await client.query<{ context: string | null }>(
          "select current_setting('app.request_context', true) as context",
        );
        assert.ok(result.rows[0]?.context);
        throw new Error("synthetic request failure");
      }),
      /synthetic request failure/,
    );
    const outside = await pool.query<{ context: string | null }>(
      "select current_setting('app.request_context', true) as context",
    );
    assert.equal(outside.rows[0]?.context ?? null, "");
  } finally {
    await pool.end();
  }
});
