import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, canActForOrganization, type AuthContext } from "./auth.js";

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { body: unknown; params: Record<string, string>; log: { error: (error: unknown) => void } };
function bodyOf(request: Request): Record<string, unknown> { return request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {}; }
function str(body: Record<string, unknown>, key: string): string | null { return typeof body[key] === "string" && body[key].trim() ? body[key].trim() : null; }
function positive(body: Record<string, unknown>, key: string): number | null { const n = Number(body[key]); return Number.isFinite(n) && n > 0 ? n : null; }
async function authFor(request: Request, reply: Reply, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) return null;
  try {
    const auth = await authenticate(request as never, pool);
    if (!auth) { reply.code(401).send({ error: "Authenticated session required", code: "AUTH_REQUIRED" }); return null; }
    return auth;
  } catch (error) {
    request.log.error(error); reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" }); return null;
  }
}

export async function registerEprAllocationRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.post("/api/v1/epr/credits/:creditId/allocations", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const creditId = (request.params as { creditId: string }).creditId;
    const body = bodyOf(request as never);
    const obligationId = str(body, "obligationId");
    const quantity = positive(body, "quantity");
    if (!obligationId || quantity === null) return reply.code(400).send({ error: "obligationId and positive quantity are required", code: "EPR_ALLOCATION_INPUTS_REQUIRED" });
    try {
      const credit = await pool.query<{ id: string; quantity: string; status: string; scheme_id: string }>("select id, quantity::text, status, scheme_id from epr_credits where id=$1", [creditId]);
      if (!credit.rows[0]) return reply.code(404).send({ error: "EPR credit not found", code: "EPR_CREDIT_NOT_FOUND" });
      if (!["ELIGIBLE", "ISSUED", "ACTIVE"].includes(credit.rows[0].status)) return reply.code(409).send({ error: "EPR credit is not allocatable", code: "EPR_CREDIT_NOT_ALLOCATABLE" });
      const obligation = await pool.query<{ id: string; organization_id: string; scheme_id: string; jurisdiction_id: string | null }>("select id, organization_id, scheme_id, jurisdiction_id from epr_obligations where id=$1", [obligationId]);
      if (!obligation.rows[0]) return reply.code(404).send({ error: "EPR obligation not found", code: "EPR_OBLIGATION_NOT_FOUND" });
      if (credit.rows[0].scheme_id !== obligation.rows[0].scheme_id) return reply.code(409).send({ error: "Credit and obligation schemes must match", code: "EPR_SCHEME_MISMATCH" });
      if (!canActForOrganization(auth, obligation.rows[0].organization_id)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
      if (!obligation.rows[0].jurisdiction_id) return reply.code(409).send({ error: "EPR obligation jurisdiction is required", code: "OBLIGATION_JURISDICTION_REQUIRED" });
      const scope = await pool.query<{ ok: boolean }>("select exists(select 1 from organization_memberships om where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED' and organization_has_geography_scope(om.organization_id,$3)) as ok", [auth.identityId, obligation.rows[0].organization_id, obligation.rows[0].jurisdiction_id]);
      if (scope.rows[0]?.ok !== true) return reply.code(403).send({ error: "Obligation jurisdiction is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" });
      const inserted = await pool.query("insert into epr_credit_allocations (epr_credit_id, obligation_id, quantity, status) values ($1,$2,$3,'ALLOCATED') returning *", [creditId, obligationId, quantity]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, allocation: inserted.rows[0] });
    } catch (error) {
      request.log.error(error);
      const message = error instanceof Error ? error.message : "";
      if (message.includes("EPR_CREDIT_CAPACITY_EXCEEDED")) return reply.code(409).send({ error: "Allocation exceeds available EPR credit quantity", code: "EPR_CREDIT_CAPACITY_EXCEEDED" });
      if (message.includes("EPR_CREDIT_NOT_ALLOCATABLE")) return reply.code(409).send({ error: "EPR credit is not allocatable", code: "EPR_CREDIT_NOT_ALLOCATABLE" });
      return reply.code(503).send({ error: "EPR allocation unavailable", syntheticData: false });
    }
  });
}
