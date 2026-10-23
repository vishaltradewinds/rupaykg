import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;

test("canonical audit append serializes concurrent writers and links every new row", { skip: !url }, async () => {
  assert.ok(url);
  const pool = new Pool({
    connectionString: url,
    max: 10,
    ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
  });
  const prefix = `audit-chain-test-${randomUUID()}`;
  try {
    const baseline = await pool.query<{ started_at: string; last_event_hash: string | null }>(
      "select clock_timestamp()::text as started_at, last_event_hash from platform_audit_chain_head where singleton=true",
    );
    assert.equal(baseline.rowCount, 1, "audit chain head must be initialized");
    const startedAt = baseline.rows[0]!.started_at;
    const initialHash = baseline.rows[0]!.last_event_hash;

    await Promise.all(Array.from({ length: 8 }, async (_, index) => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(
          "select append_platform_audit_event($1,$2,$3,$4,$5,$6,$7::jsonb)",
          [null, null, "AUDIT_CHAIN_CONCURRENCY_TEST", "test", null, `${prefix}-${index}`, JSON.stringify({ prefix, index })],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    }));

    const snapshot = await pool.query<{
      id: string;
      previous_hash: string | null;
      event_hash: string;
      request_id: string | null;
      head_event_id: string | null;
      head_hash: string | null;
      computed_hash: string;
    }>(
      `with head as (
         select last_event_id, last_event_hash from platform_audit_chain_head where singleton=true
       )
       select e.id,e.previous_hash,e.event_hash,e.request_id,
              h.last_event_id as head_event_id,h.last_event_hash as head_hash,
              encode(digest(convert_to(jsonb_build_object(
                'actorIdentityId',e.actor_identity_id,
                'organizationId',e.organization_id,
                'action',e.action,
                'targetType',e.target_type,
                'targetId',e.target_id,
                'requestId',e.request_id,
                'payload',e.payload,
                'previousHash',e.previous_hash,
                'createdAt',e.created_at
              )::text,'UTF8'),'sha256'),'hex') as computed_hash
         from audit_events e cross join head h
        where e.created_at >= $1::timestamptz
        order by e.created_at,e.id`,
      [startedAt],
    );
    assert.equal(snapshot.rows.length >= 8, true, "all concurrent audit events must be persisted");
    assert.equal(snapshot.rows.filter(row => row.request_id?.startsWith(prefix)).length, 8, "all writers must append their own audit event");

    const byPrevious = new Map<string, typeof snapshot.rows>();
    for (const row of snapshot.rows) {
      assert.equal(row.event_hash, row.computed_hash, `event hash must match canonical persisted fields for ${row.id}`);
      const key = row.previous_hash ?? "__ROOT__";
      byPrevious.set(key, [...(byPrevious.get(key) ?? []), row]);
    }

    let cursor = initialHash ?? "__ROOT__";
    const visited = new Set<string>();
    while (cursor !== (snapshot.rows[0]?.head_hash ?? null) && visited.size < snapshot.rows.length) {
      const candidates = byPrevious.get(cursor) ?? [];
      assert.equal(candidates.length, 1, `each chain position must have exactly one successor for previous hash ${cursor}`);
      const next = candidates[0]!;
      assert.equal(visited.has(next.id), false, "audit chain must not contain a cycle");
      visited.add(next.id);
      cursor = next.event_hash;
    }
    assert.equal(cursor, snapshot.rows[0]?.head_hash ?? null, "chain traversal must reach the authoritative head");
    assert.equal(visited.size, snapshot.rows.length, "every newly written audit row must belong to the canonical chain");
    assert.equal(snapshot.rows.find(row => row.id === snapshot.rows[0]?.head_event_id)?.event_hash, snapshot.rows[0]?.head_hash, "head event ID/hash must match");
  } finally {
    await pool.end();
  }
});
