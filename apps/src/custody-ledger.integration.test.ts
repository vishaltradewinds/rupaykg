import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

test("typed custody events are sequenced, hashed, idempotent and append-only", async () => {
  if (!databaseUrl) return;
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  const suffix = randomUUID();
  try {
    await client.query("begin");
    const actorOrg = (await client.query<{ id: string }>(
      "insert into organizations(name, organization_type) values ($1, 'GENERATOR') returning id",
      [`custody-actor-${suffix}`],
    )).rows[0]!.id;
    const counterpartyOrg = (await client.query<{ id: string }>(
      "insert into organizations(name, organization_type) values ($1, 'COLLECTOR') returning id",
      [`custody-counterparty-${suffix}`],
    )).rows[0]!.id;
    const identityId = (await client.query<{ id: string }>(
      "insert into identities(display_name) values ($1) returning id",
      [`custody-identity-${suffix}`],
    )).rows[0]!.id;
    const roleId = (await client.query<{ id: string }>(
      "insert into roles(organization_id, name, permissions) values ($1, 'CUSTODY_OPERATOR', '[\"waste:record\"]'::jsonb) returning id",
      [actorOrg],
    )).rows[0]!.id;
    await client.query(
      "insert into organization_memberships(identity_id, organization_id, role_id, status) values ($1, $2, $3, 'VERIFIED')",
      [identityId, actorOrg, roleId],
    );
    const flowId = (await client.query<{ id: string }>(
      "insert into resource_flows(organization_id, origin_type, resource_form, material_code, declared_quantity, unit) values ($1, 'MUNICIPAL', 'WASTE', 'TEST-MATERIAL', 100, 'kg') returning id",
      [actorOrg],
    )).rows[0]!.id;
    const eventId = (await client.query<{ id: string; sequence_no: number; event_hash: string }>(
      `insert into chain_of_custody_links(
        resource_flow_id, sequence_no, actor_organization_id, counterparty_organization_id,
        quantity, unit, recorded_at, event_type, idempotency_key, quantity_basis,
        quantity_source, occurred_at, recorded_by_identity_id
      ) values ($1, 0, $2, $3, 100, 'kg', now(), 'GENERATOR_HANDOVER', $4,
        'DECLARED', 'generator declaration', '2026-10-26T09:30:00Z', $5)
      returning id, sequence_no, event_hash`,
      [flowId, actorOrg, counterpartyOrg, `event-${suffix}`, identityId],
    )).rows[0]!;
    assert.equal(eventId.sequence_no, 0);
    assert.match(eventId.event_hash, /^[0-9a-f]{64}$/);

    await client.query("savepoint duplicate_event");
    await assert.rejects(
      client.query(
        `insert into chain_of_custody_links(
          resource_flow_id, sequence_no, actor_organization_id, counterparty_organization_id,
          quantity, unit, recorded_at, event_type, idempotency_key, quantity_basis,
          quantity_source, occurred_at, recorded_by_identity_id
        ) values ($1, 0, $2, $3, 100, 'kg', now(), 'GENERATOR_HANDOVER', $4,
          'DECLARED', 'generator declaration', '2026-10-26T09:30:00Z', $5)`,
        [flowId, actorOrg, counterpartyOrg, `event-${suffix}`, identityId],
      ),
      /unique/i,
    );
    await client.query("rollback to savepoint duplicate_event");

    await client.query("savepoint event_update");
    await assert.rejects(
      client.query("update chain_of_custody_links set quantity = 99 where id = $1", [eventId.id]),
      /append-only/i,
    );
    await client.query("rollback to savepoint event_update");

    await client.query("savepoint event_delete");
    await assert.rejects(
      client.query("delete from chain_of_custody_links where id = $1", [eventId.id]),
      /append-only/i,
    );
    await client.query("rollback to savepoint event_delete");
    await client.query("rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});
