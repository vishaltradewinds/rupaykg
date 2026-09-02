import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, bearerChallenge, type AuthContext } from "./auth.js";

async function requireAuth(app: FastifyInstance, pool: Pool | null, request: Parameters<typeof authenticate>[0], reply: { code: (status: number) => { send: (body: unknown) => unknown } }): Promise<AuthContext | null> {
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

function orgIds(auth: AuthContext): string[] { return [...new Set(auth.memberships.map((m) => m.organization_id))]; }
function result<T>(data: T) { return { source: "postgresql", syntheticData: false, data }; }

export async function registerWorkspaceRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/api/v1/workspaces/resource-flows", async (request, reply) => {
    const auth = await requireAuth(app, pool, request, reply); if (!auth || !pool) return;
    const ids = orgIds(auth); if (!ids.length) return result({ resourceFlows: [] });
    try {
      const rows = await pool.query(`select rf.id, rf.organization_id, o.name as organization_name, rf.origin_type, rf.resource_form, rf.material_code, rf.declared_quantity, rf.unit, rf.status, rf.source_geography_id, sg.name as source_geography_name, rf.destination_geography_id, dg.name as destination_geography_name, rf.created_at from resource_flows rf join organizations o on o.id = rf.organization_id left join geography sg on sg.id = rf.source_geography_id left join geography dg on dg.id = rf.destination_geography_id where rf.organization_id = any($1::uuid[]) order by rf.created_at desc limit 100`, [ids]);
      return result({ resourceFlows: rows.rows });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Resource-flow workspace unavailable", syntheticData: false }); }
  });

  app.get("/api/v1/workspaces/mrv", async (request, reply) => {
    const auth = await requireAuth(app, pool, request, reply); if (!auth || !pool) return;
    const ids = orgIds(auth); if (!ids.length) return result({ activities: [], measurements: [], evidence: [], verifications: [] });
    try {
      const [activities, measurements, evidence, verifications] = await Promise.all([
        pool.query(`select a.id, a.activity_type, a.status, a.occurred_at, a.created_at, a.geography_id, g.name as geography_name from activities a left join geography g on g.id = a.geography_id where a.organization_id = any($1::uuid[]) order by a.created_at desc limit 100`, [ids]),
        pool.query(`select m.id, m.activity_id, m.value, m.unit, m.method, m.source, m.measured_at, m.quality_status from measurements m join activities a on a.id = m.activity_id where a.organization_id = any($1::uuid[]) order by m.measured_at desc limit 100`, [ids]),
        pool.query(`select e.id, e.activity_id, e.measurement_id, e.evidence_type, e.status, e.captured_at, e.content_uri, e.content_hash from evidence e join activities a on a.id = e.activity_id where a.organization_id = any($1::uuid[]) order by e.captured_at desc limit 100`, [ids]),
        pool.query(`select v.id, v.evidence_id, v.activity_id, v.verifier_identity_id, v.decision, v.scope, v.rationale, v.decided_at from verifications v join evidence e on e.id = v.evidence_id join activities a on a.id = e.activity_id where a.organization_id = any($1::uuid[]) order by v.decided_at desc limit 100`, [ids]),
      ]);
      return result({ activities: activities.rows, measurements: measurements.rows, evidence: evidence.rows, verifications: verifications.rows });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "MRV workspace unavailable", syntheticData: false }); }
  });

  app.get("/api/v1/workspaces/compliance", async (request, reply) => {
    const auth = await requireAuth(app, pool, request, reply); if (!auth || !pool) return;
    const ids = orgIds(auth); if (!ids.length) return result({ obligations: [] });
    try {
      const rows = await pool.query(`select ob.id, ob.organization_id, o.name as organization_name, ob.jurisdiction_id, g.name as jurisdiction_name, ob.obligation_type, ob.period_start, ob.period_end, ob.required_quantity, ob.status from obligations ob join organizations o on o.id = ob.organization_id left join geography g on g.id = ob.jurisdiction_id where ob.organization_id = any($1::uuid[]) order by ob.period_end desc limit 100`, [ids]);
      return result({ obligations: rows.rows });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Compliance workspace unavailable", syntheticData: false }); }
  });

  app.get("/api/v1/workspaces/carbon", async (request, reply) => {
    const auth = await requireAuth(app, pool, request, reply); if (!auth || !pool) return;
    const ids = orgIds(auth); if (!ids.length) return result({ calculations: [] });
    try {
      const rows = await pool.query(`select cc.id, cc.activity_id, cc.methodology_version_id, mv.methodology_code, mv.version as methodology_version, cc.inputs, cc.result, cc.unit, cc.status, cc.calculated_at from carbon_calculations cc join activities a on a.id = cc.activity_id join methodology_versions mv on mv.id = cc.methodology_version_id where a.organization_id = any($1::uuid[]) order by cc.calculated_at desc nulls last, cc.id desc limit 100`, [ids]);
      return result({ calculations: rows.rows });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Carbon workspace unavailable", syntheticData: false }); }
  });

  app.get("/api/v1/workspaces/registry", async (request, reply) => {
    const auth = await requireAuth(app, pool, request, reply); if (!auth || !pool) return;
    const ids = orgIds(auth); if (!ids.length) return result({ credentials: [], events: [] });
    try {
      const [credentials, events] = await Promise.all([
        pool.query(`select c.id, c.activity_id, c.issuer_organization_id, o.name as issuer_name, c.trust_root_id, c.status, c.credential_uri, c.issued_at from credentials c join organizations o on o.id = c.issuer_organization_id where c.issuer_organization_id = any($1::uuid[]) order by c.issued_at desc nulls last, c.id desc limit 100`, [ids]),
        pool.query(`select re.id, re.credential_id, re.event_type, re.from_owner_id, fo.name as from_owner_name, re.to_owner_id, too.name as to_owner_name, re.external_reference, re.event_hash, re.created_at from registry_events re left join organizations fo on fo.id = re.from_owner_id left join organizations too on too.id = re.to_owner_id join credentials c on c.id = re.credential_id where c.issuer_organization_id = any($1::uuid[]) order by re.created_at desc limit 200`, [ids]),
      ]);
      return result({ credentials: credentials.rows, events: events.rows });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Registry workspace unavailable", syntheticData: false }); }
  });

  app.get("/api/v1/workspaces/settlement", async (request, reply) => {
    const auth = await requireAuth(app, pool, request, reply); if (!auth || !pool) return;
    const ids = orgIds(auth); if (!ids.length) return result({ settlements: [] });
    try {
      const rows = await pool.query(`select s.id, s.obligation_id, s.credential_id, s.payer_id, p.name as payer_name, s.payee_id, py.name as payee_name, s.amount, s.currency, s.status, s.external_reference, s.created_at, s.settled_at from settlements s left join organizations p on p.id = s.payer_id left join organizations py on py.id = s.payee_id where s.payer_id = any($1::uuid[]) or s.payee_id = any($1::uuid[]) order by s.created_at desc limit 100`, [ids]);
      return result({ settlements: rows.rows });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Settlement workspace unavailable", syntheticData: false }); }
  });
}
