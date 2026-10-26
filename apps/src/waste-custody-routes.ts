import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Pool, PoolClient } from "pg";
import { validateWasteCustodyEvent, type WasteCustodyEventInput } from "@rupaykg/domain";
import { authenticate, bearerChallenge, hasOrganizationPermission, type AuthContext } from "./auth.js";

type CustodyFailure = Error & { code: string };
type CustodyCreateResult = {
  entityType: "custody_event";
  entityId: string;
  replay: boolean;
  sequenceNo: number;
  eventHash: string;
};

function fail(code: string, message: string): CustodyFailure {
  return Object.assign(new Error(message), { code });
}

function sameArray(a: unknown, b: readonly string[] | undefined): boolean {
  return JSON.stringify(Array.isArray(a) ? a : []) === JSON.stringify(b ?? []);
}

/**
 * Persist an append-only event in the existing chain_of_custody_links ledger.
 * Authorization, participant-chain checks and evidence ownership are evaluated
 * inside the same transaction as the insert.
 */
export async function persistWasteCustodyEvent(
  client: PoolClient,
  auth: AuthContext,
  input: unknown,
): Promise<CustodyCreateResult> {
  const validation = validateWasteCustodyEvent(input);
  if (!validation.ok) throw fail(validation.code, validation.error);
  const value: WasteCustodyEventInput = validation.value;

  const flowResult = await client.query<{
    id: string;
    organization_id: string;
    source_geography_id: string | null;
    destination_geography_id: string | null;
  }>(
    `select id, organization_id, source_geography_id, destination_geography_id
       from resource_flows where id = $1 for update`,
    [value.resourceFlowId],
  );
  const flow = flowResult.rows[0];
  if (!flow) throw fail("RESOURCE_FLOW_NOT_FOUND", "Resource flow was not found");

  if (!await hasOrganizationPermission(client, auth, value.actorOrganizationId, ["waste:record"])) {
    throw fail("OPERATION_FORBIDDEN", "Verified waste:record permission for the actor organization is required");
  }

  const fromGeographyId = value.fromGeographyId ?? flow.source_geography_id;
  const toGeographyId = value.toGeographyId ?? flow.destination_geography_id;
  if (!fromGeographyId && !toGeographyId) {
    throw fail("CUSTODY_GEOGRAPHY_REQUIRED", "At least one source or destination geography is required for custody provenance");
  }
  const suppliedGeographies = [fromGeographyId, toGeographyId].filter((id): id is string => Boolean(id));
  if (suppliedGeographies.length) {
    const existingGeographies = await client.query<{ id: string }>(
      "select id from geography where id = any($1::uuid[])",
      [suppliedGeographies],
    );
    if (existingGeographies.rows.length !== suppliedGeographies.length) {
      throw fail("CUSTODY_GEOGRAPHY_INVALID", "Every custody geography reference must exist");
    }
  }
  for (const geographyId of [fromGeographyId, toGeographyId]) {
    if (!geographyId) continue;
    const scoped = await client.query<{ ok: boolean }>(
      "select organization_has_geography_scope($1, $2) as ok",
      [value.actorOrganizationId, geographyId],
    );
    if (scoped.rows[0]?.ok !== true) {
      throw fail("OPERATION_FORBIDDEN", "Custody event geography is outside actor organization scope");
    }
  }

  if (value.activityId) {
    const activity = await client.query<{ organization_id: string; geography_id: string | null }>(
      "select organization_id, geography_id from activities where id = $1",
      [value.activityId],
    );
    const row = activity.rows[0];
    if (!row || row.organization_id !== value.actorOrganizationId) {
      throw fail("OPERATION_FORBIDDEN", "Activity must belong to the custody event actor organization");
    }
    if (row.geography_id) {
      const scoped = await client.query<{ ok: boolean }>(
        "select organization_has_geography_scope($1, $2) as ok",
        [value.actorOrganizationId, row.geography_id],
      );
      if (scoped.rows[0]?.ok !== true) {
        throw fail("OPERATION_FORBIDDEN", "Activity geography is outside actor organization scope");
      }
    }
  }

  if (value.evidenceIds?.length) {
    const evidence = await client.query<{ id: string }>(
      `select e.id
         from evidence e
         join activities a on a.id = e.activity_id
        where e.id = any($1::uuid[])
          and a.organization_id = $2`,
      [value.evidenceIds, value.actorOrganizationId],
    );
    if (evidence.rows.length !== value.evidenceIds.length) {
      throw fail("CUSTODY_EVIDENCE_SCOPE_INVALID", "Every evidence reference must exist and belong to an activity of the actor organization");
    }
  }

  if (value.counterpartyOrganizationId) {
    const counterparty = await client.query<{ id: string }>(
      "select id from organizations where id = $1",
      [value.counterpartyOrganizationId],
    );
    if (!counterparty.rows[0]) {
      throw fail("CUSTODY_COUNTERPARTY_INVALID", "Counterparty organization does not exist");
    }
  }

  // Idempotent replay is checked before chain position, because a valid retry
  // may arrive after later events have already been appended.
  const existingResult = await client.query<{
    id: string;
    event_type: string;
    actor_organization_id: string;
    counterparty_organization_id: string | null;
    activity_id: string | null;
    quantity: string;
    unit: string;
    quantity_basis: string;
    quantity_source: string;
    measurement_method: string | null;
    instrument_id: string | null;
    occurred_at: Date | string;
    from_geography_id: string | null;
    to_geography_id: string | null;
    evidence_ids: string[];
    reason_code: string | null;
    supersedes_link_id: string | null;
    sequence_no: number;
    event_hash: string;
  }>(
    `select id, event_type, actor_organization_id, counterparty_organization_id, activity_id,
            quantity, unit, quantity_basis, quantity_source, measurement_method, instrument_id,
            occurred_at, from_geography_id, to_geography_id, evidence_ids, reason_code,
            supersedes_link_id, sequence_no, event_hash
       from chain_of_custody_links
      where resource_flow_id = $1 and idempotency_key = $2`,
    [value.resourceFlowId, value.idempotencyKey],
  );
  const existing = existingResult.rows[0];
  if (existing) {
    const same = existing.event_type === value.eventType
      && existing.actor_organization_id === value.actorOrganizationId
      && existing.counterparty_organization_id === (value.counterpartyOrganizationId ?? null)
      && existing.activity_id === (value.activityId ?? null)
      && Number(existing.quantity) === value.quantity
      && existing.unit === value.unit
      && existing.quantity_basis === value.quantityBasis
      && existing.quantity_source === value.quantitySource
      && existing.measurement_method === (value.measurementMethod ?? null)
      && existing.instrument_id === (value.instrumentId ?? null)
      && new Date(existing.occurred_at).getTime() === new Date(value.occurredAt).getTime()
      && existing.from_geography_id === fromGeographyId
      && existing.to_geography_id === toGeographyId
      && sameArray(existing.evidence_ids, value.evidenceIds)
      && existing.reason_code === (value.reasonCode ?? null)
      && existing.supersedes_link_id === (value.supersedesEventId ?? null);
    if (!same) throw fail("IDEMPOTENCY_CONFLICT", "Custody idempotency key was already used with a different event payload");
    return {
      entityType: "custody_event",
      entityId: existing.id,
      replay: true,
      sequenceNo: existing.sequence_no,
      eventHash: existing.event_hash,
    };
  }

  if (value.eventType === "CORRECTION") {
    const superseded = await client.query<{ actor_organization_id: string; event_type: string }>(
      "select actor_organization_id, event_type from chain_of_custody_links where id = $1 and resource_flow_id = $2",
      [value.supersedesEventId, value.resourceFlowId],
    );
    const target = superseded.rows[0];
    if (!target || target.event_type === "CORRECTION" || target.actor_organization_id !== value.actorOrganizationId) {
      throw fail("CUSTODY_SUPERSESSION_INVALID", "A correction must reference an earlier non-correction event created by the same actor organization in this flow");
    }
  } else {
    const latestResult = await client.query<{
      actor_organization_id: string | null;
      counterparty_organization_id: string | null;
    }>(
      `select actor_organization_id, counterparty_organization_id
         from chain_of_custody_links
        where resource_flow_id = $1 and event_type is not null and event_type <> 'CORRECTION'
        order by sequence_no desc limit 1`,
      [value.resourceFlowId],
    );
    const latest = latestResult.rows[0];
    if (!latest) {
      if (value.actorOrganizationId !== flow.organization_id) {
        throw fail("CUSTODY_PARTICIPANT_OUT_OF_CHAIN", "The first custody event must be recorded by the resource flow's originating organization");
      }
    } else if (
      value.actorOrganizationId !== latest.actor_organization_id
      && value.actorOrganizationId !== latest.counterparty_organization_id
    ) {
      throw fail("CUSTODY_PARTICIPANT_OUT_OF_CHAIN", "The actor organization is not a participant in the latest custody handover");
    }
  }

  const inserted = await client.query<{ id: string; sequence_no: number; event_hash: string }>(
    `insert into chain_of_custody_links (
       resource_flow_id, sequence_no, actor_organization_id, activity_id, quantity, unit,
       from_geography_id, to_geography_id, recorded_at, evidence_id,
       event_type, idempotency_key, counterparty_organization_id, occurred_at,
       quantity_basis, quantity_source, measurement_method, instrument_id,
       reason_code, supersedes_link_id, evidence_ids, recorded_by_identity_id
     ) values (
       $1, 0, $2, $3, $4, $5, $6, $7, clock_timestamp(), $8,
       $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19::uuid[], $20
     ) returning id, sequence_no, event_hash`,
    [
      value.resourceFlowId,
      value.actorOrganizationId,
      value.activityId ?? null,
      value.quantity,
      value.unit,
      fromGeographyId,
      toGeographyId,
      value.evidenceIds?.[0] ?? null,
      value.eventType,
      value.idempotencyKey,
      value.counterpartyOrganizationId ?? null,
      value.occurredAt,
      value.quantityBasis,
      value.quantitySource,
      value.measurementMethod ?? null,
      value.instrumentId ?? null,
      value.reasonCode ?? null,
      value.supersedesEventId ?? null,
      value.evidenceIds ?? [],
      auth.identityId,
    ],
  );
  const row = inserted.rows[0];
  if (!row) throw fail("CUSTODY_INSERT_FAILED", "Custody event insert returned no row");
  return {
    entityType: "custody_event",
    entityId: row.id,
    replay: false,
    sequenceNo: row.sequence_no,
    eventHash: row.event_hash,
  };
}

function bodyOf(request: FastifyRequest): Record<string, unknown> {
  return request.body && typeof request.body === "object" && !Array.isArray(request.body)
    ? request.body as Record<string, unknown>
    : {};
}

export async function registerWasteCustodyRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.post("/api/v1/resource-flows/:resourceFlowId/custody-events", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Custody event service unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false });
    let auth: AuthContext | null;
    try {
      auth = await authenticate(request, pool);
      if (!auth) return reply.code(401).send(bearerChallenge());
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" });
    }
    const { resourceFlowId } = request.params as { resourceFlowId: string };
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resourceFlowId)) {
      return reply.code(400).send({ error: "resourceFlowId must be a UUID", code: "INVALID_RESOURCE_FLOW" });
    }
    const input = { ...bodyOf(request), resourceFlowId };
    const client = await pool.connect();
    try {
      await client.query("begin");
      const created = await persistWasteCustodyEvent(client, auth, input);
      await client.query("commit");
      return reply.code(created.replay ? 200 : 201).send({
        source: "postgresql",
        syntheticData: false,
        authoritativeMutation: !created.replay,
        replay: created.replay,
        custodyEvent: {
          id: created.entityId,
          resourceFlowId,
          sequenceNo: created.sequenceNo,
          eventHash: created.eventHash,
        },
      });
    } catch (error) {
      await client.query("rollback");
      const code = (error as { code?: string }).code ?? "CUSTODY_EVENT_FAILED";
      const message = (error as Error).message;
      if (code === "OPERATION_FORBIDDEN" || code === "CUSTODY_PARTICIPANT_OUT_OF_CHAIN" || code === "CUSTODY_EVIDENCE_SCOPE_INVALID") return reply.code(403).send({ error: message, code });
      if (code === "RESOURCE_FLOW_NOT_FOUND") return reply.code(404).send({ error: message, code });
      if (code === "IDEMPOTENCY_CONFLICT") return reply.code(409).send({ error: message, code });
      if (code.startsWith("CUSTODY_") || code.startsWith("INVALID_")) return reply.code(400).send({ error: message, code });
      request.log.error(error);
      return reply.code(503).send({ error: "Custody event persistence unavailable", code: "CUSTODY_EVENT_UNAVAILABLE", syntheticData: false });
    } finally {
      client.release();
    }
  });
}
