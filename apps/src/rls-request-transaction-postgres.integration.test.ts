import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import type { AuthContext } from "./auth.js";
import { withRlsRequestTransaction } from "./rls-request-transaction.js";

const databaseUrl = process.env.DATABASE_URL;
const ssl = process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false };

test("transaction-local signed request context is cleared on pooled connection reuse", { skip: !databaseUrl }, async () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1, ssl });
  const auth: AuthContext = {
    identityId: "11111111-1111-4111-8111-111111111111",
    activeOrganizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    memberships: [{ organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", role_id: "test-role", status: "VERIFIED" }],
  };
  const config = { hmacSecret: "integration-test-hmac-secret-material-32-bytes", keyId: "integration_test", ttlSeconds: 60 };
  try {
    const committedToken = await withRlsRequestTransaction(pool, auth, config, async (client) => {
      const result = await client.query<{ context: string }>("select current_setting('app.request_context', true) as context");
      assert.match(result.rows[0]?.context ?? "", /^11111111-1111-4111-8111-111111111111\|aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa\|[0-9]+\|[0-9]+\|integration_test\.[a-f0-9]{64}$/);
      return result.rows[0]!.context;
    });
    assert.ok(committedToken);
    const afterCommit = await pool.query<{ context: string | null }>("select nullif(current_setting('app.request_context', true), '') as context");
    assert.equal(afterCommit.rows[0]?.context, null);

    await assert.rejects(
      withRlsRequestTransaction(pool, auth, config, async (client) => {
        const result = await client.query<{ context: string }>("select current_setting('app.request_context', true) as context");
        assert.ok(result.rows[0]?.context);
        throw new Error("intentional rollback test");
      }),
      /intentional rollback test/,
    );
    const afterRollback = await pool.query<{ context: string | null }>("select nullif(current_setting('app.request_context', true), '') as context");
    assert.equal(afterRollback.rows[0]?.context, null);
  } finally {
    await pool.end();
  }
});
