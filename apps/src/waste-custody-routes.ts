import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Pool, PoolClient } from "pg";
import { validateWasteCustodyEvent, type WasteCustodyEventInput } from "@rupaykg/domain";
import { authenticate, bearerChallenge, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";

type Body = Record<string, unknown>;
const bodyOf = (request: FastifyRequest): Body =>
  request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? request.body as Body
    : {};
const text = (body: Body, key: string): string | null =>
  typeof body[key] === "string" && body[key].trim() ? body[key].trim() : null;
const uuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function fail(reply: FastifyReply, status: number, error: string, code: string) {
  return reply.code(status).send({ error, code, syntheticData: false });
}
async function authFor(request: FastifyRequest, reply: FastifyReply, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { fail(reply, 503, "Database unavailable", "DATABASE_UNAVAILABLE"); return null; }
  try {
    const auth = await authenticate(request, pool);
    if (!auth) { reply.code(401).send(bearerChallenge()); return null; }
    return auth;
  } catch (error) {
    request.log.error(error);
    fail(reply, 503, "Authentication service unavailable", "AUTH_UNAVAILABLE");
    return null;
  }
}
async function hasFlowAccess(
  client: Pool | PoolClient,
  flowId: string,
  organizationId: string,
): Promise<{ ownerOrganizationId: string; unit: string } | null> {
  const result = await client.query<{ owner_organization_id: string; unit: string; accessible: boolean }>(
    `select rf.organization_id as owner_organization_id, rf.unit,
       (rf.organization_id=$2 or exists (
          select 1 from resource_flow_participants p
           where p.resource_flow_id=rf.id and p.organization_id=$2 and p.status='ACTIVE'
       )) as accessible
       from resource_flows rf where rf.id=$1`,
    [flowId, organizationId],
  );
  const row = result.rows[0];
  return row?.accessible ? { ownerOrganizationId: row.owner_organization_id, unit: row.unit } : null;
}
async function geographyScoped(client: Pool | PoolClient, organizationId: string, geographyId: string): Promise<boolean> {
  if (!uuid(geographyId)) return false;
  const result = await client.query<{ ok: boolean }>(
    "select organization_has_geography_scope($1::uuid,$2::uuid) as ok",
    [organizationId, geographyId],
  );
  return result.rows[0]?.ok === true;
}
async function audit(
  client: PoolClient,
  auth: AuthContext,
  organizationId: string,
  action: string,
  targetType: string,
  targetId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await client.query(
    "insert into audit_events(actor_identity_id,organization_id,action,target_type,target_id,event_hash,payload) values($1,$2,$3,$4,$5,$6,$7)",
    [auth.identityId, organizationId, action, targetType, targetId, hash({ action, targetId, payload, actorIdentityId: auth.identityId }), payload],
  );
}

/**
 * Records participant assignments and custody assertions on the existing resource-flow ledger.
 * Events remain PENDING_REVIEW. These routes do not certify legality, issue certificates, or
 * authorize physical handling; regulated actions still require separately verified legal scope.
 */
export async function registerWasteCustodyRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.post("/api/v1/resource-flows/:flowId/participants", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const { flowId } = request.params as { flowId: string };
    const body = bodyOf(request);
    const organizationId = text(body, "organizationId");
    if (!uuid(flowId) || !organizationId || !uuid(organizationId)) return fail(reply, 400, "Valid flowId and organizationId are required", "INVALID_PARTICIPANT_INVITATION");
    const ownerOrganizationId = auth.activeOrganizationId;
    if (!ownerOrganizationId || !canActForOrganization(auth, ownerOrganizationId)
      || !await hasOrganizationPermission(pool, auth, ownerOrganizationId, ["waste:record"])) {
      return fail(reply, 403, "Active flow-owner waste-record permission required", "FLOW_PARTICIPANT_INVITE_FORBIDDEN");
    }
    if (organizationId === ownerOrganizationId) return fail(reply, 400, "Flow owner is already an implicit participant", "FLOW_OWNER_ALREADY_PARTICIPANT");
    const client = await pool.connect();
    try {
      await client.query("begin");
      const flow = await client.query<{ organization_id: string }>(
        "select organization_id from resource_flows where id=$1 for update", [flowId],
      );
      if (flow.rows[0]?.organization_id !== ownerOrganizationId) {
        await client.query("rollback");
        return fail(reply, 404, "Resource flow not found for active organization", "RESOURCE_FLOW_NOT_FOUND");
      }
      const target = await client.query<{ id: string }>("select id from organizations where id=$1", [organizationId]);
      if (!target.rows[0]) { await client.query("rollback"); return fail(reply, 404, "Participant organization not found", "PARTICIPANT_ORGANIZATION_NOT_FOUND"); }
      const inserted = await client.query<{ id: string; status: string }>(
        "insert into resource_flow_participants(resource_flow_id,organization_id,status,invited_by_identity_id) values($1,$2,'INVITED',$3) on conflict(resource_flow_id,organization_id) do nothing returning id,status",
        [flowId, organizationId, auth.identityId],
      );
      if (!inserted.rows[0]) { await client.query("rollback"); return fail(reply, 409, "Organization is already invited or assigned to this flow", "FLOW_PARTICIPANT_ALREADY_EXISTS"); }
      await audit(client, auth, ownerOrganizationId, "RESOURCE_FLOW_PARTICIPANT_INVITED", "resource_flow_participant", inserted.rows[0].id, { flowId, organizationId, status: "INVITED" });
      await client.query("commit");
      return reply.code(201).send({ source: "postgresql", syntheticData: false, participant: inserted.rows[0], legalAuthorization: "NOT_ASSESSED" });
    } catch (error) {
      await client.query("rollback"); request.log.error(error);
      return fail(reply, 503, "Resource-flow participant invitation unavailable", "FLOW_PARTICIPANT_INVITE_UNAVAILABLE");
    } finally { client.release(); }
  });

  app.post("/api/v1/resource-flows/:flowId/participants/:participantId/accept", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const { flowId, participantId } = request.params as { flowId: string; participantId: string };
    const organizationId = auth.activeOrganizationId;
    if (!uuid(flowId) || !uuid(participantId) || !organizationId) return fail(reply, 400, "Valid flow, participant and active organization are required", "INVALID_PARTICIPANT_ACCEPTANCE");
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["waste:record"])) return fail(reply, 403, "Waste-record permission required to accept a flow assignment", "FLOW_PARTICIPANT_ACCEPT_FORBIDDEN");
    const client = await pool.connect();
    try {
      await client.query("begin");
      const selected = await client.query<{ id: string; status: string; organization_id: string; resource_flow_id: string }>(
        "select id,status,organization_id,resource_flow_id from resource_flow_participants where id=$1 and resource_flow_id=$2 for update",
        [participantId, flowId],
      );
      const row = selected.rows[0];
      if (!row || row.organization_id !== organizationId) { await client.query("rollback"); return fail(reply, 404, "Invitation not found for active organization", "FLOW_PARTICIPANT_INVITATION_NOT_FOUND"); }
      if (row.status === "ACTIVE") { await client.query("commit"); return reply.code(200).send({ source: "postgresql", syntheticData: false, replay: true, participant: row }); }
      if (row.status !== "INVITED") { await client.query("rollback"); return fail(reply, 409, "Invitation is not in an acceptable state", "FLOW_PARTICIPANT_STATE_INVALID"); }
      const updated = await client.query<{ id: string; status: string; organization_id: string; resource_flow_id: string; accepted_at: string }>(
        "update resource_flow_participants set status='ACTIVE',accepted_by_identity_id=$2,accepted_at=now() where id=$1 and status='INVITED' returning id,status,organization_id,resource_flow_id,accepted_at",
        [participantId, auth.identityId],
      );
      const participant = updated.rows[0];
      if (!participant) throw new Error("Participant invitation was not activated");
      await audit(client, auth, organizationId, "RESOURCE_FLOW_PARTICIPANT_ACCEPTED", "resource_flow_participant", participantId, { flowId, status: "ACTIVE" });
      await client.query("commit");
      return reply.code(200).send({ source: "postgresql", syntheticData: false, participant, legalAuthorization: "NOT_ASSESSED" });
    } catch (error) {
      await client.query("rollback"); request.log.error(error);
      return fail(reply, 503, "Resource-flow participant acceptance unavailable", "FLOW_PARTICIPANT_ACCEPT_UNAVAILABLE");
    } finally { client.release(); }
  });

  app.post("/api/v1/resource-flows/:flowId/custody-events", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const { flowId } = request.params as { flowId: string };
    const organizationId = auth.activeOrganizationId;
    if (!uuid(flowId) || !organizationId) return fail(reply, 400, "Valid flowId and active organization are required", "INVALID_CUSTODY_EVENT");
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["waste:record"])) return fail(reply, 403, "Waste-record permission required to submit custody assertions", "CUSTODY_EVENT_FORBIDDEN");
    const body = bodyOf(request);
    if (body.resourceFlowId !== undefined && body.resourceFlowId !== flowId) return fail(reply, 400, "resourceFlowId must match the route", "CUSTODY_FLOW_MISMATCH");
    if (body.actorOrganizationId !== undefined && body.actorOrganizationId !== organizationId) return fail(reply, 403, "Actor organization is derived from the authenticated session", "CUSTODY_ACTOR_MISMATCH");
    const validation = validateWasteCustodyEvent({
      ...body,
      resourceFlowId: flowId,
      actorOrganizationId: organizationId,
    });
    if (!validation.ok) return fail(reply, 400, validation.error, validation.code);
    const event: WasteCustodyEventInput = validation.value;
    const client = await pool.connect();
    try {
      await client.query("begin");
      const flow = await hasFlowAccess(client, flowId, organizationId);
      if (!flow) { await client.query("rollback"); return fail(reply, 404, "Resource flow is not assigned to the active organization", "RESOURCE_FLOW_NOT_FOUND"); }
      if (event.unit !== flow.unit) { await client.query("rollback"); return fail(reply, 400, "Custody quantity unit must match the flow unit; conversions require a separately reviewed basis", "CUSTODY_UNIT_MISMATCH"); }
      if (event.counterpartyOrganizationId) {
        const counterparty = await hasFlowAccess(client, flowId, event.counterpartyOrganizationId);
        if (!counterparty) { await client.query("rollback"); return fail(reply, 403, "Counterparty must be the flow owner or an accepted flow participant", "CUSTODY_COUNTERPARTY_NOT_ASSIGNED"); }
      }
      for (const geographyId of [event.fromGeographyId, event.toGeographyId]) {
        if (geographyId && !await geographyScoped(client, organizationId, geographyId)) {
          await client.query("rollback"); return fail(reply, 403, "Custody event geography is outside actor organization scope", "CUSTODY_GEOGRAPHY_FORBIDDEN");
        }
      }
      if (event.activityId) {
        const activity = await client.query<{ organization_id: string; geography_id: string | null }>(
          "select organization_id,geography_id from activities where id=$1", [event.activityId],
        );
        if (activity.rows[0]?.organization_id !== organizationId || !activity.rows[0]?.geography_id
          || !await geographyScoped(client, organizationId, activity.rows[0].geography_id)) {
          await client.query("rollback"); return fail(reply, 403, "Activity must belong to actor organization and an authorized geography", "CUSTODY_ACTIVITY_FORBIDDEN");
        }
      }
      if (event.supersedesEventId) {
        const prior = await client.query<{ id: string }>(
          "select id from chain_of_custody_links where id=$1 and resource_flow_id=$2", [event.supersedesEventId, flowId],
        );
        if (!prior.rows[0]) { await client.query("rollback"); return fail(reply, 400, "Superseded event must belong to the same flow", "CUSTODY_SUPERSESSION_INVALID"); }
      }
      if (event.evidenceIds?.length) {
        const parties = [organizationId, ...(event.counterpartyOrganizationId ? [event.counterpartyOrganizationId] : [])];
        const evidenceRows = await client.query<{ id: string }>(
          "select e.id from evidence e join activities a on a.id=e.activity_id where e.id=any($1::uuid[]) and a.organization_id=any($2::uuid[])",
          [event.evidenceIds, parties],
        );
        if (evidenceRows.rows.length !== new Set(event.evidenceIds).size) {
          await client.query("rollback"); return fail(reply, 400, "Every evidence reference must belong to the actor or assigned counterparty organization", "CUSTODY_EVIDENCE_SCOPE_INVALID");
        }
      }
      await client.query("select id from resource_flows where id=$1 for update", [flowId]);
      const replay = await client.query<{ id: string; sequence_no: number; review_status: string; same_payload: boolean }>(
        "select id,sequence_no,review_status,event_payload=$3::jsonb as same_payload from chain_of_custody_links where resource_flow_id=$1 and idempotency_key=$2 for update",
        [flowId, event.idempotencyKey, JSON.stringify(event)],
      );
      if (replay.rows[0]) {
        const existing = replay.rows[0];
        if (!existing.same_payload) { await client.query("rollback"); return fail(reply, 409, "Idempotency key was reused with a different custody payload", "CUSTODY_IDEMPOTENCY_CONFLICT"); }
        await client.query("commit");
        return reply.code(200).send({ source: "postgresql", syntheticData: false, replay: true, custodyEvent: { id: existing.id, sequenceNo: existing.sequence_no, reviewStatus: existing.review_status }, legalAuthorization: "NOT_ASSESSED" });
      }
      const sequence = await client.query<{ next_sequence: number }>(
        "select coalesce(max(sequence_no),-1)+1 as next_sequence from chain_of_custody_links where resource_flow_id=$1", [flowId],
      );
      const sequenceNo = Number(sequence.rows[0]?.next_sequence ?? 0);
      const inserted = await client.query<{ id: string; sequence_no: number; review_status: string }>(
        `insert into chain_of_custody_links
          (resource_flow_id,sequence_no,actor_organization_id,actor_identity_id,counterparty_organization_id,activity_id,
           quantity,unit,from_geography_id,to_geography_id,recorded_at,evidence_id,event_type,idempotency_key,
           quantity_basis,quantity_source,measurement_method,instrument_id,reason_code,supersedes_event_id,event_payload)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb)
         returning id,sequence_no,review_status`,
        [flowId,sequenceNo,organizationId,auth.identityId,event.counterpartyOrganizationId ?? null,event.activityId ?? null,
          event.quantity,event.unit,event.fromGeographyId ?? null,event.toGeographyId ?? null,event.occurredAt,
          event.evidenceIds?.[0] ?? null,event.eventType,event.idempotencyKey,event.quantityBasis,event.quantitySource,
          event.measurementMethod ?? null,event.instrumentId ?? null,event.reasonCode ?? null,event.supersedesEventId ?? null,
          JSON.stringify(event)],
      );
      const custodyEvent = inserted.rows[0];
      if (!custodyEvent) throw new Error("Custody event insert returned no row");
      for (const evidenceId of new Set(event.evidenceIds ?? [])) {
        await client.query("insert into chain_of_custody_event_evidence(custody_event_id,evidence_id) values($1,$2)", [custodyEvent.id,evidenceId]);
      }
      await audit(client, auth, organizationId, "WASTE_CUSTODY_EVENT_SUBMITTED", "chain_of_custody_link", custodyEvent.id, {
        flowId, eventType: event.eventType, sequenceNo, reviewStatus: custodyEvent.review_status, payloadHash: hash(event),
      });
      await client.query("commit");
      return reply.code(201).send({
        source: "postgresql", syntheticData: false,
        custodyEvent: { id: custodyEvent.id, sequenceNo: custodyEvent.sequence_no, eventType: event.eventType, reviewStatus: custodyEvent.review_status },
        legalAuthorization: "NOT_ASSESSED",
        statutoryBoundary: "CUSTODY_ASSERTION_ONLY_NO_PERMIT_OR_CERTIFICATE_ISSUED",
      });
    } catch (error) {
      await client.query("rollback"); request.log.error(error);
      const code = (error as { code?: string }).code;
      if (code === "23505") return fail(reply, 409, "Duplicate custody event; retry using the original idempotency key", "CUSTODY_IDEMPOTENCY_CONFLICT");
      if (code === "23514") return fail(reply, 400, (error as Error).message, "CUSTODY_EVENT_DATABASE_GUARD");
      return fail(reply, 503, "Custody event submission unavailable", "CUSTODY_EVENT_UNAVAILABLE");
    } finally { client.release(); }
  });

  app.get("/api/v1/resource-flows/:flowId/custody-events", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const { flowId } = request.params as { flowId: string };
    const organizationId = auth.activeOrganizationId;
    if (!uuid(flowId) || !organizationId) return fail(reply, 400, "Valid flowId and active organization are required", "INVALID_CUSTODY_FLOW");
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["waste:read", "waste:record", "reports:read"])) return fail(reply, 403, "Waste-flow read permission required", "CUSTODY_READ_FORBIDDEN");
    try {
      const access = await hasFlowAccess(pool, flowId, organizationId);
      if (!access) return fail(reply, 404, "Resource flow is not assigned to the active organization", "RESOURCE_FLOW_NOT_FOUND");
      const events = await pool.query(
        `select c.id,c.resource_flow_id,c.sequence_no,c.actor_organization_id,c.actor_identity_id,
                c.counterparty_organization_id,c.activity_id,c.quantity,c.unit,c.from_geography_id,c.to_geography_id,
                c.recorded_at,c.event_type,c.quantity_basis,c.quantity_source,c.measurement_method,c.instrument_id,
                c.reason_code,c.supersedes_event_id,c.review_status,c.created_at,
                coalesce(jsonb_agg(jsonb_build_object('evidenceId',ce.evidence_id) order by ce.evidence_id)
                  filter (where ce.evidence_id is not null),'[]'::jsonb) as evidence
           from chain_of_custody_links c
           left join chain_of_custody_event_evidence ce on ce.custody_event_id=c.id
          where c.resource_flow_id=$1
          group by c.id
          order by c.sequence_no asc`,
        [flowId],
      );
      return { source: "postgresql", syntheticData: false, events: events.rows, statutoryBoundary: "ASSERTIONS_MAY_REMAIN_PENDING_REVIEW" };
    } catch (error) {
      request.log.error(error);
      return fail(reply, 503, "Custody timeline unavailable", "CUSTODY_TIMELINE_UNAVAILABLE");
    }
  });
}
