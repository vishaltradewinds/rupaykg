import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { persistWasteCustodyEvent } from "./waste-custody-routes.js";
import type { AuthContext } from "./auth.js";

const databaseUrl = process.env.DATABASE_URL;

test("custody route persistence is idempotent and rejects organizations outside the chain", async () => {
  if (!databaseUrl) return;
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  const suffix = randomUUID();
  try {
    await client.query("begin");
    const createOrg = async (kind: string) => (await client.query<{ id: string }>(
      "insert into organizations(name, organization_type) values ($1, $2) returning id",
      [`custody-route-${kind}-${suffix}`, kind],
    )).rows[0]!.id;
    const actorOrg = await createOrg("GENERATOR");
    const counterpartyOrg = await createOrg("COLLECTOR");
    const outsideOrg = await createOrg("RECYCLER");
    const identityId = (await client.query<{ id: string }>(
      "insert into identities(display_name) values ($1) returning id",
      [`custody-route-identity-${suffix}`],
    )).rows[0]!.id;
    const createMembership = async (organizationId: string) => {
      const roleId = (await client.query<{ id: string }>(
        "insert into roles(organization_id, name, permissions) values ($1, $2, '[\"waste:record\"]'::jsonb) returning id",
        [organizationId, `CUSTODY_OPERATOR_${suffix.slice(0, 8)}`],
      )).rows[0]!.id;
      await client.query(
        "insert into organization_memberships(identity_id, organization_id, role_id, status) values ($1, $2, $3, 'VERIFIED')",
        [identityId, organizationId, roleId],
      );
      return roleId;
    };
    const actorRole = await createMembership(actorOrg);
    const counterpartyRole = await createMembership(counterpartyOrg);
    const geographyId = (await client.query<{ id: string }>(
      "insert into geography(kind, name) values ('STATE_UT', $1) returning id",
      [`custody-route-geography-${suffix}`],
    )).rows[0]!.id;
    const flowId = (await client.query<{ id: string }>(
      `insert into resource_flows(organization_id, origin_type, resource_form, material_code, declared_quantity, unit, source_geography_id)
       values ($1, 'MUNICIPAL', 'WASTE', 'TEST-MATERIAL', 100, 'kg', $2) returning id`,
      [actorOrg, geographyId],
    )).rows[0]!.id;
    const actorAuth: AuthContext = {
      identityId,
      memberships: [
        { organization_id: actorOrg, role_id: actorRole, status: "VERIFIED" },
      ],
      activeOrganizationId: actorOrg,
    };
    const input = {
      resourceFlowId: flowId,
      idempotencyKey: `custody-route-${suffix}`,
      eventType: "GENERATOR_HANDOVER",
      actorOrganizationId: actorOrg,
      counterpartyOrganizationId: counterpartyOrg,
      quantity: 100,
      unit: "kg",
      quantityBasis: "DECLARED",
      quantitySource: "generator declaration",
      occurredAt: "2026-10-26T09:30:00Z",
    };
    const first = await persistWasteCustodyEvent(client, actorAuth, input);
    assert.equal(first.replay, false);
    assert.equal(first.sequenceNo, 0);
    assert.match(first.eventHash, /^[0-9a-f]{64}$/);
    const replay = await persistWasteCustodyEvent(client, actorAuth, input);
    assert.equal(replay.replay, true);
    assert.equal(replay.entityId, first.entityId);
    const correction = await persistWasteCustodyEvent(client, actorAuth, {
      ...input,
      idempotencyKey: `correction-${suffix}`,
      eventType: "CORRECTION",
      reasonCode: "SOURCE_FIX",
      supersedesEventId: first.entityId,
    });
    const counterpartyAuth: AuthContext = {
      identityId,
      memberships: [{ organization_id: counterpartyOrg, role_id: counterpartyRole, status: "VERIFIED" }],
      activeOrganizationId: counterpartyOrg,
    };
    const receipt = await persistWasteCustodyEvent(client, counterpartyAuth, {
      ...input,
      idempotencyKey: `receipt-${suffix}`,
      eventType: "COLLECTOR_RECEIPT",
      actorOrganizationId: counterpartyOrg,
      counterpartyOrganizationId: actorOrg,
      quantitySource: "collector receipt",
    });
    assert.equal(correction.sequenceNo, 1);
    assert.equal(receipt.sequenceNo, 2);
    await assert.rejects(
      persistWasteCustodyEvent(client, actorAuth, { ...input, quantity: 99 }),
      (error: unknown) => (error as { code?: string }).code === "IDEMPOTENCY_CONFLICT",
    );

    const outsideRole = (await client.query<{ id: string }>(
      "insert into roles(organization_id, name, permissions) values ($1, $2, '[\"waste:record\"]'::jsonb) returning id",
      [outsideOrg, `OUTSIDE_OPERATOR_${suffix.slice(0, 8)}`],
    )).rows[0]!.id;
    await client.query(
      "insert into organization_memberships(identity_id, organization_id, role_id, status) values ($1, $2, $3, 'VERIFIED')",
      [identityId, outsideOrg, outsideRole],
    );
    const outsideAuth: AuthContext = {
      identityId,
      memberships: [{ organization_id: outsideOrg, role_id: outsideRole, status: "VERIFIED" }],
      activeOrganizationId: outsideOrg,
    };
    await assert.rejects(
      persistWasteCustodyEvent(client, outsideAuth, {
        ...input,
        idempotencyKey: `outside-chain-${suffix}`,
        actorOrganizationId: outsideOrg,
        counterpartyOrganizationId: actorOrg,
      }),
      (error: unknown) => (error as { code?: string }).code === "CUSTODY_PARTICIPANT_OUT_OF_CHAIN",
    );
    await client.query("rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});
