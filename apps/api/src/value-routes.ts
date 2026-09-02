import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { calculateEmissionReduction } from "@rupaykg/carbon";
import { assessEprObligation } from "@rupaykg/compliance";
import { classifyMetric } from "@rupaykg/esg";
import { authenticate, canActForOrganization, type AuthContext } from "./auth.js";

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { body: unknown; params: Record<string, string>; log: { error: (error: unknown) => void }; headers: Record<string, string | undefined> };

function bodyOf(request: Request): Record<string, unknown> {
  return request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
}
function str(body: Record<string, unknown>, key: string): string | null {
  return typeof body[key] === "string" && body[key].trim() ? body[key].trim() : null;
}
function nonNegative(body: Record<string, unknown>, key: string): number | null {
  const n = Number(body[key]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
async function authFor(request: Request, reply: Reply, pool: Pool | null): Promise<AuthContext | null> {
  try {
    const auth = await authenticate(request as never, pool);
    if (!auth) { reply.code(401).send({ error: "Authenticated session required", code: "AUTH_REQUIRED" }); return null; }
    return auth;
  } catch (error) {
    request.log.error(error); reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" }); return null;
  }
}
async function activityAccess(client: Pool | PoolClient, activityId: string, identityId: string): Promise<{ organization_id: string } | null> {
  const result = await client.query<{ organization_id: string }>(
    `select a.organization_id from activities a join organization_memberships om on om.organization_id = a.organization_id
     where a.id = $1 and om.identity_id = $2 and om.status = 'VERIFIED'`, [activityId, identityId]);
  return result.rows[0] ?? null;
}

export async function registerValueRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.post("/api/v1/carbon/calculations", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const body = bodyOf(request as never);
    const activityId = str(body, "activityId"); const methodologyCode = str(body, "methodologyCode"); const methodologyVersion = str(body, "methodologyVersion");
    const baselineTco2e = nonNegative(body, "baselineTco2e"); const projectTco2e = nonNegative(body, "projectTco2e");
    const leakageTco2e = nonNegative(body, "leakageTco2e") ?? 0; const uncertaintyTco2e = nonNegative(body, "uncertaintyTco2e") ?? 0;
    if (!activityId || !methodologyCode || !methodologyVersion || baselineTco2e === null || projectTco2e === null) return reply.code(400).send({ error: "activityId, methodologyCode, methodologyVersion, baselineTco2e and projectTco2e are required" });
    try {
      const access = await activityAccess(pool, activityId, auth.identityId); if (!access) return reply.code(403).send({ error: "Activity access denied", code: "ACTIVITY_FORBIDDEN" });
      const method = await pool.query<{ id: string }>("select id from methodology_versions where methodology_code = $1 and version = $2", [methodologyCode, methodologyVersion]);
      if (!method.rows[0]) return reply.code(409).send({ error: "Methodology version is not registered", code: "METHODOLOGY_NOT_REGISTERED" });
      const result = calculateEmissionReduction({ activityId, methodologyCode, methodologyVersion, baselineTco2e, projectTco2e, leakageTco2e, uncertaintyTco2e });
      const inputs = { activityId, methodologyCode, methodologyVersion, baselineTco2e, projectTco2e, leakageTco2e, uncertaintyTco2e };
      const inserted = await pool.query("insert into carbon_calculations (activity_id, methodology_version_id, inputs, result, unit, status, calculated_at, baseline_result, uncertainty) values ($1,$2,$3,$4,$5,$6,now(),$7,$8) returning *", [activityId, method.rows[0].id, inputs, result.netReductionTco2e, "tCO2e", result.status, baselineTco2e, uncertaintyTco2e]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, calculation: inserted.rows[0], calculationResult: result });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Carbon calculation unavailable", syntheticData: false }); }
  });

  app.post("/api/v1/epr/obligations/:obligationId/assess", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const obligationId = (request.params as { obligationId: string }).obligationId;
    try {
      const obligation = await pool.query<{ id: string; organization_id: string; required_quantity: string }>("select id, organization_id, required_quantity from obligations where id = $1", [obligationId]);
      if (!obligation.rows[0]) return reply.code(404).send({ error: "Obligation not found" });
      if (!canActForOrganization(auth, obligation.rows[0].organization_id)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
      const evidence = await pool.query<{ evidence_id: string; verification_id: string; quantity: string }>(
        `select c.evidence_id, c.verification_id, c.quantity::text from epr_credits c join epr_obligations eo on eo.scheme_id = c.scheme_id and eo.obligated_organization_id = $1
         join evidence e on e.id = c.evidence_id join verifications v on v.id = c.verification_id
         where eo.obligation_id = $2 and c.status in ('ELIGIBLE','ISSUED','ACTIVE') and e.status = 'VERIFIED' and v.decision = 'APPROVED'`,
        [obligation.rows[0].organization_id, obligationId]);
      const assessment = assessEprObligation(Number(obligation.rows[0].required_quantity ?? 0), evidence.rows.map(row => ({ evidenceId: row.evidence_id, verificationId: row.verification_id, approved: true, quantity: Number(row.quantity) })));
      await pool.query("update obligations set status = $2, required_quantity = $3 where id = $1", [obligationId, assessment.status, assessment.requiredQuantity]);
      return { source: "postgresql", syntheticData: false, assessment };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "EPR assessment unavailable", syntheticData: false }); }
  });

  app.post("/api/v1/esg/reporting-periods/:periodId/metrics", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const periodId = (request.params as { periodId: string }).periodId; const body = bodyOf(request as never);
    const metricCode = str(body, "metricCode"); const scope = str(body, "scope") as "1" | "2" | "3" | "IMPACT" | null; const unit = str(body, "unit"); const value = nonNegative(body, "value");
    if (!metricCode || !scope || !["1","2","3","IMPACT"].includes(scope) || !unit || value === null) return reply.code(400).send({ error: "metricCode, scope, unit and non-negative value are required" });
    try {
      const period = await pool.query<{ organization_id: string }>("select organization_id from esg_reporting_periods where id = $1", [periodId]);
      if (!period.rows[0]) return reply.code(404).send({ error: "Reporting period not found" });
      if (!canActForOrganization(auth, period.rows[0].organization_id)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
      const evidenceId = str(body, "evidenceId"); const verificationId = str(body, "verificationId");
      if (verificationId && !evidenceId) return reply.code(400).send({ error: "verificationId requires evidenceId" });
      const metric = { code: metricCode, scope, value, unit, ...(evidenceId ? { evidenceId } : {}), ...(verificationId ? { verificationId } : {}) };
      const state = classifyMetric(metric);
      if (verificationId) {
        const verified = await pool.query("select 1 from verifications where id = $1 and evidence_id = $2 and decision = 'APPROVED'", [verificationId, evidenceId]);
        if (!verified.rows[0]) return reply.code(409).send({ error: "Verification is not an approved verification for the supplied evidence", code: "VERIFICATION_INVALID" });
      }
      const inserted = await pool.query("insert into esg_metrics (reporting_period_id, metric_code, scope, value, unit, evidence_id, verification_id, status, metadata) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *", [periodId, metricCode, scope, value, unit, evidenceId, verificationId, state, body.metadata ?? {}]);
      return reply.code(201).send({ source: "postgresql", syntheticData: false, metric: inserted.rows[0], state });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "ESG metric recording unavailable", syntheticData: false }); }
  });
}
