import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { registerWasteCustodyRoutes } from "./waste-custody-routes.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");

test("waste custody routes enforce flow-party assignment, idempotency, provenance and append-only history", { skip: !enabled }, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 6 });
  const app = Fastify({ logger: false });
  await registerWasteCustodyRoutes(app, pool);
  const suffix = randomBytes(8).toString("hex");
  const ownerToken = randomBytes(32).toString("base64url");
  const participantToken = randomBytes(32).toString("base64url");
  const outsiderToken = randomBytes(32).toString("base64url");
  try {
    const owner = (await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-CUSTODY-OWNER-" + suffix],
    )).rows[0]!.id;
    const participant = (await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-CUSTODY-PARTICIPANT-" + suffix],
    )).rows[0]!.id;
    const outsider = (await pool.query<{ id: string }>(
      "insert into organizations(name,organization_type,status) values($1,'test_fixture','VERIFIED') returning id",
      ["TEST-CUSTODY-OUTSIDER-" + suffix],
    )).rows[0]!.id;
    const flow = (await pool.query<{ id: string }>(
      "insert into resource_flows(organization_id,origin_type,resource_form,material_code,declared_quantity,unit) values($1,'COMMERCIAL','WASTE','PAPER_CARDBOARD',100,'kg') returning id",
      [owner],
    )).rows[0]!.id;
    const identities = await Promise.all([
      pool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["test-custody-owner:"+suffix,"Custody Owner","owner-"+suffix+"@example.invalid"]),
      pool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["test-custody-participant:"+suffix,"Custody Participant","participant-"+suffix+"@example.invalid"]),
      pool.query<{ id: string }>("insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') returning id", ["test-custody-outsider:"+suffix,"Custody Outsider","outsider-"+suffix+"@example.invalid"]),
    ]);
    const identityIds = identities.map(row => row.rows[0]!.id);
    const roles = await Promise.all([owner, participant, outsider].map((organizationId, index) =>
      pool.query<{ id: string }>(
        "insert into roles(organization_id,name,permissions,geography_scope) values($1,$2,$3::jsonb,'[]') returning id",
        [organizationId,"custody_test_role_"+suffix+"_"+index,JSON.stringify(["waste:record","waste:read"])],
      ),
    ));
    await pool.query("alter table organization_memberships disable trigger stakeholder_membership_application_guard");
    try {
      await pool.query(
        "insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED'),($4,$5,$6,'VERIFIED'),($7,$8,$9,'VERIFIED')",
        [identityIds[0],owner,roles[0].rows[0]!.id,identityIds[1],participant,roles[1].rows[0]!.id,identityIds[2],outsider,roles[2].rows[0]!.id],
      );
    } finally {
      await pool.query("alter table organization_memberships enable trigger stakeholder_membership_application_guard");
    }
    await pool.query(
      "insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2),($3,now()+interval '1 hour',$4),($5,now()+interval '1 hour',$6)",
      [identityIds[0],tokenHash(ownerToken),identityIds[1],tokenHash(participantToken),identityIds[2],tokenHash(outsiderToken)],
    );
    const headers = (token: string, organizationId: string) => ({
      authorization: "Bearer " + token,
      "x-rupaykg-organization-id": organizationId,
    });

    const invitation = await app.inject({
      method: "POST",
      url: "/api/v1/resource-flows/"+flow+"/participants",
      headers: headers(ownerToken, owner),
      payload: { organizationId: participant },
    });
    assert.equal(invitation.statusCode, 201, invitation.body);
    const participantId = invitation.json().participant.id as string;

    const beforeAccept = await app.inject({
      method: "POST",
      url: "/api/v1/resource-flows/"+flow+"/custody-events",
      headers: headers(participantToken, participant),
      payload: {
        idempotencyKey: "receipt-before-accept",
        eventType: "COLLECTOR_RECEIPT",
        counterpartyOrganizationId: owner,
        quantity: 95,
        unit: "kg",
        quantityBasis: "DECLARED",
        quantitySource: "participant declaration",
        occurredAt: "2026-10-26T09:30:00Z",
      },
    });
    assert.equal(beforeAccept.statusCode, 404, beforeAccept.body);

    const accepted = await app.inject({
      method: "POST",
      url: "/api/v1/resource-flows/"+flow+"/participants/"+participantId+"/accept",
      headers: headers(participantToken, participant),
      payload: {},
    });
    assert.equal(accepted.statusCode, 200, accepted.body);

    const eventPayload = {
      idempotencyKey: "custody-event-1",
      eventType: "COLLECTOR_RECEIPT",
      counterpartyOrganizationId: owner,
      quantity: 95,
      unit: "kg",
      quantityBasis: "DECLARED",
      quantitySource: "collector declaration",
      occurredAt: "2026-10-26T09:30:00Z",
    };
    const submitted = await app.inject({
      method: "POST",
      url: "/api/v1/resource-flows/"+flow+"/custody-events",
      headers: headers(participantToken, participant),
      payload: eventPayload,
    });
    assert.equal(submitted.statusCode, 201, submitted.body);
    assert.equal(submitted.json().custodyEvent.reviewStatus, "PENDING_REVIEW");
    assert.equal(submitted.json().legalAuthorization, "NOT_ASSESSED");
    const eventId = submitted.json().custodyEvent.id as string;

    const replay = await app.inject({
      method: "POST",
      url: "/api/v1/resource-flows/"+flow+"/custody-events",
      headers: headers(participantToken, participant),
      payload: eventPayload,
    });
    assert.equal(replay.statusCode, 200, replay.body);
    assert.equal(replay.json().replay, true);
    assert.equal(replay.json().custodyEvent.id, eventId);

    const collision = await app.inject({
      method: "POST",
      url: "/api/v1/resource-flows/"+flow+"/custody-events",
      headers: headers(participantToken, participant),
      payload: { ...eventPayload, quantity: 94 },
    });
    assert.equal(collision.statusCode, 409, collision.body);
    assert.equal(collision.json().code, "CUSTODY_IDEMPOTENCY_CONFLICT");

    const outsiderRead = await app.inject({
      method: "GET",
      url: "/api/v1/resource-flows/"+flow+"/custody-events",
      headers: headers(outsiderToken, outsider),
    });
    assert.equal(outsiderRead.statusCode, 404, outsiderRead.body);

    await assert.rejects(
      pool.query("update chain_of_custody_links set quantity=1 where id=$1", [eventId]),
      /append-only/i,
    );
  } finally {
    await app.close();
    await pool.end();
  }
});
