import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, hasOrganizationPermission, type AuthContext } from "./auth.js";

function bodyOf(request: { body: unknown }): Record<string, unknown> {
  return request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
}
function requiredString(body: Record<string, unknown>, key: string): string | null {
  return typeof body[key] === "string" && body[key].trim() ? body[key].trim() : null;
}
function positiveNumber(body: Record<string, unknown>, key: string): number | null {
  const value = Number(body[key]);
  return Number.isFinite(value) && value > 0 ? value : null;
}
async function authFor(request: Parameters<typeof authenticate>[0], reply: { code: (status: number) => { send: (body: unknown) => unknown } }, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Authoritative API unavailable", code: "DATABASE_UNAVAILABLE", syntheticData: false }); return null; }
  try {
    const auth = await authenticate(request, pool);
    if (!auth) { reply.code(401).send(bearerChallenge()); return null; }
    return auth;
  } catch (error) {
    request.log.error(error);
    reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE", syntheticData: false });
    return null;
  }
}
function canAct(auth: AuthContext, organizationId: string): boolean {
  return auth.memberships.some((membership) => membership.organization_id === organizationId && membership.status === "VERIFIED");
}

export async function registerEprReturnRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/api/v1/epr/returns", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const organizationId = typeof request.headers["x-rupaykg-organization-id"] === "string" ? request.headers["x-rupaykg-organization-id"] : auth.activeOrganizationId;
    if (!organizationId || !canAct(auth, organizationId)) return reply.code(403).send({ error: "Verified organization membership required", code: "ORG_FORBIDDEN" });
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["epr:read", "epr:manage", "reports:read"])) return reply.code(403).send({ error: "EPR return read permission required", code: "EPR_RETURN_READ_FORBIDDEN" });
    try {
      const rows = await pool.query(`select r.id,r.scheme_id,s.code as scheme_code,s.name as scheme_name,r.organization_id,r.obligation_id,r.period_start,r.period_end,r.return_type,r.reported_quantity,r.obligation_quantity,r.fulfilled_quantity,r.status,r.external_reference,r.evidence_id,r.verification_id,r.submitted_at,r.created_at from epr_returns r join epr_schemes s on s.id=r.scheme_id where r.organization_id=$1 order by r.period_end desc,r.created_at desc limit 100`, [organizationId]);
      return { source: "postgresql", syntheticData: false, returns: rows.rows };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "EPR return workspace unavailable", syntheticData: false }); }
  });

  app.post("/api/v1/epr/returns", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const body = bodyOf(request);
    const organizationId = requiredString(body, "organizationId") ?? auth.activeOrganizationId;
    const schemeId = requiredString(body, "schemeId");
    const obligationId = requiredString(body, "obligationId");
    const periodStart = requiredString(body, "periodStart");
    const periodEnd = requiredString(body, "periodEnd");
    const returnType = requiredString(body, "returnType");
    const reportedQuantity = positiveNumber(body, "reportedQuantity");
    if (!organizationId || !schemeId || !obligationId || !periodStart || !periodEnd || !returnType || reportedQuantity === null) return reply.code(400).send({ error: "organizationId, schemeId, obligationId, periodStart, periodEnd, returnType and positive reportedQuantity are required", code: "INVALID_EPR_RETURN" });
    if (!canAct(auth, organizationId)) return reply.code(403).send({ error: "Verified organization membership required", code: "ORG_FORBIDDEN" });
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["epr:manage"])) return reply.code(403).send({ error: "EPR management permission required", code: "EPR_RETURN_WRITE_FORBIDDEN" });
    if (Number.isNaN(Date.parse(periodStart)) || Number.isNaN(Date.parse(periodEnd)) || periodStart > periodEnd) return reply.code(400).send({ error: "Valid periodStart and periodEnd are required", code: "INVALID_PERIOD" });
    try {
      const rows = await pool.query(`insert into epr_returns(scheme_id,organization_id,obligation_id,period_start,period_end,return_type,reported_quantity,status) select $1,$2,$3,$4::date,$5::date,$6,$7,'DRAFT' where exists(select 1 from epr_schemes where id=$1 and status='VERIFIED') and exists(select 1 from epr_obligations eo join obligations o on o.id=eo.obligation_id where eo.id=$3 and eo.scheme_id=$1 and eo.obligated_organization_id=$2 and eo.status in ('OPEN','ELIGIBLE') and o.period_start <= $5::date and o.period_end >= $4::date) returning *`, [schemeId, organizationId, obligationId, periodStart, periodEnd, returnType, reportedQuantity]);
      if (!rows.rows[0]) return reply.code(409).send({ error: "Verified EPR scheme and matching open/eligible obligation are required", code: "EPR_RETURN_NOT_ELIGIBLE" });
      return reply.code(201).send({ source: "postgresql", syntheticData: false, authoritativeMutation: true, eprReturn: rows.rows[0] });
    } catch (error: unknown) {
      request.log.error(error);
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("duplicate key")) return reply.code(409).send({ error: "An EPR return already exists for this scheme, organization, period and return type", code: "EPR_RETURN_EXISTS" });
      return reply.code(503).send({ error: "EPR return creation unavailable", syntheticData: false });
    }
  });

  app.post("/api/v1/epr/returns/:returnId/submit", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const { returnId } = request.params as { returnId: string };
    const body = bodyOf(request);
    const evidenceId = requiredString(body, "evidenceId");
    const verificationId = requiredString(body, "verificationId");
    if (!evidenceId || !verificationId) return reply.code(400).send({ error: "Verified evidence and approved verification are required to submit a statutory EPR return", code: "EVIDENCE_REQUIRED" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query(`select r.*,eo.target_quantity,eo.fulfilled_quantity as obligation_fulfilled,eo.status as obligation_status,s.code as scheme_code from epr_returns r join epr_obligations eo on eo.id=r.obligation_id join epr_schemes s on s.id=r.scheme_id where r.id=$1 for update`, [returnId]);
      const row = current.rows[0];
      if (!row) { await client.query("ROLLBACK"); return reply.code(404).send({ error: "EPR return not found", code: "EPR_RETURN_NOT_FOUND" }); }
      if (!canAct(auth, row.organization_id) || !await hasOrganizationPermission(pool, auth, row.organization_id, ["epr:manage"])) { await client.query("ROLLBACK"); return reply.code(403).send({ error: "EPR management permission required", code: "EPR_RETURN_WRITE_FORBIDDEN" }); }
      if (row.status !== "DRAFT" && row.status !== "REJECTED") { await client.query("ROLLBACK"); return reply.code(409).send({ error: `Return cannot be submitted from ${row.status}`, code: "INVALID_EPR_RETURN_STATE" }); }
      const obligation = await client.query(`select id,target_quantity,fulfilled_quantity,status from epr_obligations where id=$1 for update`, [row.obligation_id]);
      const obligationRow = obligation.rows[0];
      if (!obligationRow) { await client.query("ROLLBACK"); return reply.code(409).send({ error: "Bound EPR obligation not found", code: "OBLIGATION_NOT_FOUND" }); }
      if (!["OPEN", "ELIGIBLE"].includes(obligationRow.status)) { await client.query("ROLLBACK"); return reply.code(409).send({ error: `EPR obligation cannot be fulfilled from ${obligationRow.status}`, code: "OBLIGATION_NOT_ELIGIBLE" }); }
      const evidence = await client.query(`select e.id,e.status,e.content_hash,e.content_uri,a.organization_id,a.geography_id from evidence e join activities a on a.id=e.activity_id join verifications v on v.id=$2 and v.evidence_id=e.id and v.decision='APPROVED' where e.id=$1`, [evidenceId, verificationId]);
      const evidenceRow = evidence.rows[0];
      if (!evidenceRow || evidenceRow.status !== "VERIFIED" || (!evidenceRow.content_hash && !evidenceRow.content_uri) || evidenceRow.organization_id !== row.organization_id || !evidenceRow.geography_id) { await client.query("ROLLBACK"); return reply.code(409).send({ error: "Submission evidence must be verified, provenance-backed, approved and organization-scoped", code: "EVIDENCE_NOT_ELIGIBLE" }); }
      const geo = await client.query(`select organization_has_geography_scope($1,$2) as ok`, [row.organization_id, evidenceRow.geography_id]);
      if (!geo.rows[0]?.ok) { await client.query("ROLLBACK"); return reply.code(403).send({ error: "Evidence geography is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" }); }
      const fulfilled = Number(row.reported_quantity);
      const balance = Number(obligationRow.target_quantity) - Number(obligationRow.fulfilled_quantity);
      if (!Number.isFinite(fulfilled) || fulfilled <= 0) { await client.query("ROLLBACK"); return reply.code(400).send({ error: "Reported quantity must be positive", code: "INVALID_QUANTITY" }); }
      if (fulfilled > balance + 1e-9) { await client.query("ROLLBACK"); return reply.code(409).send({ error: "Reported quantity exceeds remaining EPR obligation balance", code: "OBLIGATION_BALANCE_EXCEEDED", remainingQuantity: Math.max(balance, 0) }); }
      const updated = await client.query(`update epr_returns set fulfilled_quantity=$2,obligation_quantity=$3,evidence_id=$4,verification_id=$5,status='SUBMITTED',submitted_at=now() where id=$1 returning *`, [returnId, fulfilled, obligationRow.target_quantity, evidenceId, verificationId]);
      await client.query(`update epr_obligations set fulfilled_quantity=fulfilled_quantity+$2,status=case when fulfilled_quantity+$2 >= target_quantity then 'COMPLIANT' else 'OPEN' end where id=$1`, [row.obligation_id, fulfilled]);
      await client.query("COMMIT");
      return { source: "postgresql", syntheticData: false, authoritativeMutation: true, eprReturn: updated.rows[0], externalSubmission: "NOT_SUBMITTED" };
    } catch (error) { await client.query("ROLLBACK"); request.log.error(error); return reply.code(503).send({ error: "EPR return submission unavailable", syntheticData: false }); }
    finally { client.release(); }
  });

  app.post("/api/v1/epr/returns/:returnId/external-reference", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const body = bodyOf(request); const externalReference = requiredString(body, "externalReference");
    if (!externalReference) return reply.code(400).send({ error: "externalReference is required", code: "EXTERNAL_REFERENCE_REQUIRED" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const returnId = (request.params as { returnId: string }).returnId;
      const row = await client.query<{ organization_id: string; status: string; external_reference: string | null }>("select organization_id,status,external_reference from epr_returns where id=$1 for update", [returnId]);
      if (!row.rows[0]) { await client.query("ROLLBACK"); return reply.code(404).send({ error: "EPR return not found", code: "EPR_RETURN_NOT_FOUND" }); }
      if (!canAct(auth, row.rows[0].organization_id) || !await hasOrganizationPermission(pool, auth, row.rows[0].organization_id, ["epr:manage"])) { await client.query("ROLLBACK"); return reply.code(403).send({ error: "EPR management permission required", code: "EPR_RETURN_WRITE_FORBIDDEN" }); }
      if (!["SUBMITTED","ACCEPTED","COMPLETED"].includes(row.rows[0].status)) { await client.query("ROLLBACK"); return reply.code(409).send({ error: "External reference can only be recorded after submission", code: "INVALID_EPR_RETURN_STATE" }); }
      if (row.rows[0].external_reference && row.rows[0].external_reference !== externalReference) { await client.query("ROLLBACK"); return reply.code(409).send({ error: "A different external reference is already recorded for this EPR return", code: "EXTERNAL_REFERENCE_IMMUTABLE" }); }
      const updated = await client.query("update epr_returns set external_reference=$2 where id=$1 returning *", [returnId, externalReference]);
      await client.query("COMMIT");
      return { source: "postgresql", syntheticData: false, authoritativeMutation: true, eprReturn: updated.rows[0], externalSubmission: "EXTERNAL_REFERENCE_RECORDED_NOT_ISSUED_BY_RUPAYKG" };
    } catch (error: unknown) {
      await client.query("ROLLBACK").catch(() => undefined);
      request.log.error(error);
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("duplicate key")) return reply.code(409).send({ error: "That external EPR reference is already recorded on another return", code: "EXTERNAL_REFERENCE_EXISTS" });
      return reply.code(503).send({ error: "External EPR reference recording unavailable", syntheticData: false });
    } finally { client.release(); }
  });
}
