import { afterAll, beforeAll, describe, expect, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
let settlementId = "";

beforeAll(async () => {
  if (!pool) return;
  const result = await pool.query<{ id: string }>(
    `insert into settlements (amount, currency, status)
     values (1, 'INR', 'AUTHORIZED')
     returning id`,
  );
  settlementId = result.rows[0].id;
});

afterAll(async () => {
  if (!pool) return;
  if (settlementId) await pool.query("delete from settlements where id = $1", [settlementId]);
  await pool.end();
});

describe("settlement reconciliation invariants", () => {
  it("runs against PostgreSQL in CI", () => {
    assert.ok(pool, "DATABASE_URL is required for settlement integration tests");
    assert.match(settlementId, /^[0-9a-f-]{36}$/i);
  });

  it("rejects reconciliation evidence without external confirmation", async () => {
    if (!pool) return;
    await assert.rejects(
      pool.query(
        `update settlements set reconciliation_reference = $1 where id = $2`,
        [randomUUID(), settlementId],
      ),
      /reconciliation|confirmation/i,
    );
  });

  it("rejects external confirmation without reconciliation evidence", async () => {
    if (!pool) return;
    await assert.rejects(
      pool.query(
        `update settlements set external_confirmed_at = now() where id = $1`,
        [settlementId],
      ),
      /reconciliation/i,
    );
  });

  it("requires all external evidence before SETTLED", async () => {
    if (!pool) return;
    await assert.rejects(
      pool.query(`update settlements set status = 'SETTLED' where id = $1`, [settlementId]),
      /external settlement reference|external authority confirmation|reconciliation reference/i,
    );

    await pool.query(
      `update settlements
          set external_reference = $1,
              external_confirmed_at = now(),
              reconciliation_reference = $2
        where id = $3`,
      [randomUUID(), randomUUID(), settlementId],
    );
    const settled = await pool.query<{ status: string }>(
      `update settlements set status = 'SETTLED' where id = $1 returning status`,
      [settlementId],
    );
    expect(settled.rows[0].status).toBe("SETTLED");
  });

  it("rejects mutation or clearing of confirmed reconciliation evidence", async () => {
    if (!pool) return;
    await assert.rejects(
      pool.query(`update settlements set reconciliation_reference = $1 where id = $2`, [randomUUID(), settlementId]),
      /cannot be changed|cannot be cleared/i,
    );
    await assert.rejects(
      pool.query(`update settlements set reconciliation_reference = null where id = $1`, [settlementId]),
      /cannot be changed|cannot be cleared/i,
    );
    await assert.rejects(
      pool.query(`update settlements set external_confirmed_at = now() + interval '1 minute' where id = $1`, [settlementId]),
      /cannot be changed/i,
    );
  });
});
