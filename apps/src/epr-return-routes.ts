import type { FastifyInstance } from "fastify";
import type { Pool, PoolClient } from "pg";
import { authenticate, bearerChallenge, hasOrganizationPermission, type AuthContext } from "./auth.js";
import { evaluateEprQuantityBinding, isIsoCalendarDate } from "./epr-quantity-binding.js";

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

// Mutating EPR routes call this inside their open transaction. Lock current
// membership, role and identity rows so an actor's authority cannot be revoked
// between authorization and the protected mutation.
async function hasLockedEprManagementAuthority(client: PoolClient, auth: AuthContext, organizationId: string): Promise<boolean> {
  const result = await client.query(`select om.identity_id
    from organization_memberships om
    join roles r on r.id=om.role_id
    join identities i on i.id=om.identity_id
    where om.identity_id=$1 and om.organization_id=$2 and om.status='VERIFIED'
      and i.status='VERIFIED' and i.suspended_at is null
      and exists(select 1 from jsonb_array_elements_text(r.permissions) p where p=any($3::text[]))
    for share of om, r, i`,
    [auth.identityId, organizationId, ["epr:manage"]]);
  return result.rows.length > 0;
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
    if (!isIsoCalendarDate(periodStart) || !isIsoCalendarDate(periodEnd) || periodStart > periodEnd) return reply.code(400).send({ error: "periodStart and periodEnd must be valid ISO calendar dates in ascending order", code: "INVALID_PERIOD" });
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

  app.get("/api/v1/epr/returns/:returnId/quantity-binding-options", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const { returnId } = request.params as { returnId: string };
    try {
      const ret = await pool.query<{ organization_id: string; status: string }>("select organization_id,status from epr_returns where id=$1", [returnId]);
      const row = ret.rows[0];
      if (!row) return reply.code(404).send({ error: "EPR return not found", code: "EPR_RETURN_NOT_FOUND" });
      if (!canAct(auth, row.organization_id) || !await hasOrganizationPermission(pool, auth, row.organization_id, ["epr:manage"])) return reply.code(403).send({ error: "EPR management permission required", code: "EPR_RETURN_WRITE_FORBIDDEN" });
      const existing = await pool.query(`select id,measurement_id,resource_flow_id,custody_link_id,evidence_id,verification_id,methodology_version_id,category_code,unit_code,period_start,period_end,measured_quantity,consumed_at from epr_return_quantity_bindings where epr_return_id=$1`, [returnId]);
      if (row.status !== "DRAFT" || existing.rows[0]) return { source: "postgresql", syntheticData: false, binding: existing.rows[0] ?? null, options: [] };
      const options = await pool.query(`select m.id as measurement_id,rf.id as resource_flow_id,c.id as custody_link_id,e.id as evidence_id,v.id as verification_id,mv.id as methodology_version_id,
          m.value::text as measured_quantity,m.unit as unit_code,rf.material_code as category_code,mv.methodology_code,mv.version as methodology_version,m.measured_at
        from epr_returns r join epr_obligations eo on eo.id=r.obligation_id and eo.scheme_id=r.scheme_id and eo.obligated_organization_id=r.organization_id
        join epr_schemes s on s.id=r.scheme_id
        join measurements m on m.quality_status='VERIFIED' and m.measured_at::date between r.period_start and r.period_end
        join activities a on a.id=m.activity_id and a.organization_id=r.organization_id and a.geography_id is not null and organization_has_geography_scope(r.organization_id,a.geography_id)
        join resource_flows rf on rf.organization_id=r.organization_id and rf.material_code=eo.category_code and rf.unit=m.unit and rf.status in ('ACCEPTED','COMPLETED','VERIFIED')
        join chain_of_custody_links c on c.resource_flow_id=rf.id and c.activity_id=a.id and c.actor_organization_id=r.organization_id and c.quantity=m.value and c.unit=m.unit and c.recorded_at::date between r.period_start and r.period_end
        join evidence e on e.status='VERIFIED' and (e.content_hash is not null or e.content_uri is not null) and (e.measurement_id=m.id or e.activity_id=m.activity_id) and (c.evidence_id=e.id or e.measurement_id=m.id)
        join verifications v on v.evidence_id=e.id and v.decision='APPROVED'
        join methodology_versions mv on mv.effective_from is not null and mv.effective_from <= r.period_start
          and mv.rules->'eprBinding'->>'schemeCode'=s.code and mv.rules->'eprBinding'->>'categoryCode'=eo.category_code and mv.rules->'eprBinding'->>'unitCode'=m.unit
        where r.id=$1 and r.organization_id=$2 and r.status='DRAFT'
          and exists(select 1 from organization_memberships om
            join roles ro on ro.id=om.role_id
            join identities i on i.id=om.identity_id
            where om.identity_id=v.verifier_identity_id and om.organization_id=r.organization_id
              and om.status='VERIFIED' and i.status='VERIFIED' and i.suspended_at is null
              and organization_has_geography_scope(om.organization_id,a.geography_id)
              and exists(select 1 from jsonb_array_elements_text(ro.permissions) p where p=any($3::text[])))
          and not exists(select 1 from epr_return_quantity_bindings b where b.measurement_id=m.id or b.custody_link_id=c.id)
          and (select coalesce(sum(b.measured_quantity),0)+m.value <= rf.declared_quantity from epr_return_quantity_bindings b where b.resource_flow_id=rf.id)
        order by m.measured_at desc limit 100`, [returnId, row.organization_id, ["VERIFY_EVIDENCE", "verification:approve", "verification.approve"]]);
      return { source: "postgresql", syntheticData: false, binding: null, options: options.rows };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "EPR quantity-binding options unavailable", syntheticData: false }); }
  });

  app.post("/api/v1/epr/returns/:returnId/bind-quantity", async (request, reply) => {
    const auth = await authFor(request, reply, pool); if (!auth || !pool) return;
    const { returnId } = request.params as { returnId: string };
    const body = bodyOf(request);
    const measurementId = requiredString(body, "measurementId");
    const resourceFlowId = requiredString(body, "resourceFlowId");
    const custodyLinkId = requiredString(body, "custodyLinkId");
    const evidenceId = requiredString(body, "evidenceId");
    const verificationId = requiredString(body, "verificationId");
    const methodologyVersionId = requiredString(body, "methodologyVersionId");
    if (!measurementId || !resourceFlowId || !custodyLinkId || !evidenceId || !verificationId || !methodologyVersionId) {
      return reply.code(400).send({ error: "Persisted measurement, resource flow, custody link, evidence, verification and methodology version IDs are required", code: "EPR_BINDING_INPUT_REQUIRED" });
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const ret = await client.query(`select r.*,eo.category_code,eo.id as epr_obligation_id,eo.status as obligation_status,s.code as scheme_code
        from epr_returns r join epr_obligations eo on eo.id=r.obligation_id and eo.scheme_id=r.scheme_id and eo.obligated_organization_id=r.organization_id
        join epr_schemes s on s.id=r.scheme_id where r.id=$1 for update of r,eo`, [returnId]);
      const row = ret.rows[0];
      if (!row) { await client.query("ROLLBACK"); return reply.code(404).send({ error: "EPR return or linked obligation not found", code: "EPR_RETURN_NOT_FOUND" }); }
      if (!canAct(auth, row.organization_id) || !await hasLockedEprManagementAuthority(client, auth, row.organization_id)) {
        await client.query("ROLLBACK"); return reply.code(403).send({ error: "Current EPR management authority is required", code: "EPR_RETURN_WRITE_FORBIDDEN" });
      }
      if (row.status !== "DRAFT") { await client.query("ROLLBACK"); return reply.code(409).send({ error: "Only draft returns may receive a quantity binding", code: "INVALID_EPR_RETURN_STATE" }); }
      // Serialize bindings per flow so concurrent returns cannot over-allocate its declared mass.
      await client.query("select id from resource_flows where id=$1 for update", [resourceFlowId]);
      const source = await client.query(`select m.id as measurement_id,m.value::text as measured_quantity,m.unit as measurement_unit,m.method,m.measured_at,m.quality_status,
        a.id as activity_id,a.organization_id as activity_organization_id,a.geography_id,
        rf.id as resource_flow_id,rf.organization_id as flow_organization_id,rf.material_code,rf.unit as flow_unit,rf.status as flow_status,rf.declared_quantity::text as flow_declared_quantity,
        c.id as custody_link_id,c.actor_organization_id,c.activity_id as custody_activity_id,c.quantity::text as custody_quantity,c.unit as custody_unit,c.recorded_at,c.evidence_id as custody_evidence_id,
        e.status as evidence_status,e.content_hash,e.content_uri,e.activity_id as evidence_activity_id,e.measurement_id as evidence_measurement_id,
        v.verifier_identity_id,v.decision,v.evidence_id as verification_evidence_id,
        mv.methodology_code,mv.version,mv.effective_from,mv.rules
        from measurements m join activities a on a.id=m.activity_id
        join resource_flows rf on rf.id=$2
        join chain_of_custody_links c on c.id=$3 and c.resource_flow_id=rf.id
        join evidence e on e.id=$4
        join verifications v on v.id=$5 and v.evidence_id=e.id and v.decision='APPROVED'
        join methodology_versions mv on mv.id=$6
        where m.id=$1 and a.organization_id=$7 and rf.organization_id=$7
          and c.actor_organization_id=$7 and c.activity_id=a.id
          and a.geography_id is not null and organization_has_geography_scope($7,a.geography_id)
          and rf.status in ('ACCEPTED','COMPLETED','VERIFIED')
          and m.quality_status='VERIFIED' and m.measured_at::date between $8::date and $9::date
          and rf.material_code=$10 and m.unit=rf.unit and c.unit=m.unit
          and c.quantity=m.value and c.recorded_at::date between $8::date and $9::date
          and e.status='VERIFIED' and (e.content_hash is not null or e.content_uri is not null)
          and (e.measurement_id=m.id or (e.activity_id=m.activity_id and e.activity_id is not null))
          and (c.evidence_id=e.id or e.measurement_id=m.id)
          and mv.effective_from is not null and mv.effective_from <= $8::date
          and mv.rules->'eprBinding'->>'schemeCode'=$11
          and mv.rules->'eprBinding'->>'categoryCode'=$10
          and mv.rules->'eprBinding'->>'unitCode'=m.unit
        for share of m,a,c,e,v,mv`,
        [measurementId, resourceFlowId, custodyLinkId, evidenceId, verificationId, methodologyVersionId, row.organization_id, row.period_start, row.period_end, row.category_code, row.scheme_code]);
      const src = source.rows[0];
      if (!src || src.activity_organization_id !== row.organization_id || src.flow_organization_id !== row.organization_id || src.verification_evidence_id !== evidenceId) {
        await client.query("ROLLBACK"); return reply.code(409).send({ error: "Measurement, custody, evidence, verifier decision and effective EPR methodology must match persisted organization/category/unit/period records", code: "EPR_AUTHORITATIVE_BINDING_INVALID" });
      }
      const flowCapacity = await client.query(`select coalesce(sum(measured_quantity),0)+$2::numeric <= $3::numeric as within_capacity
        from epr_return_quantity_bindings where resource_flow_id=$1`, [resourceFlowId, src.measured_quantity, src.flow_declared_quantity]);
      if (flowCapacity.rows[0]?.within_capacity !== true) {
        await client.query("ROLLBACK"); return reply.code(409).send({ error: "Binding would exceed the resource flow's declared quantity; mass-balance reconciliation is required", code: "EPR_FLOW_MASS_BALANCE_EXCEEDED" });
      }
      // Require current identity + organization membership + permission, and lock
      // every authority row until the binding transaction commits. Geography scope
      // alone is insufficient: a verifier from another organization must not qualify.
      const verifier = await client.query(`select om.identity_id
        from organization_memberships om
        join roles r on r.id=om.role_id
        join identities i on i.id=om.identity_id
        where om.identity_id=$1 and om.organization_id=$4 and om.status='VERIFIED'
          and i.status='VERIFIED' and i.suspended_at is null
          and organization_has_geography_scope(om.organization_id,$2)
          and exists(select 1 from jsonb_array_elements_text(r.permissions) p where p=any($3::text[]))
        for share of om, r, i`,
        [src.verifier_identity_id, src.geography_id, ["VERIFY_EVIDENCE", "verification:approve", "verification.approve"], row.organization_id]);
      if (verifier.rows.length === 0) { await client.query("ROLLBACK"); return reply.code(409).send({ error: "Approving verifier lacks current database-backed verification authority for this organization and evidence geography", code: "EPR_VERIFIER_AUTHORITY_INVALID" }); }
      const inserted = await client.query(`insert into epr_return_quantity_bindings
        (epr_return_id,obligation_id,measurement_id,resource_flow_id,custody_link_id,evidence_id,verification_id,methodology_version_id,category_code,unit_code,period_start,period_end,measured_quantity,created_by_identity_id,declared_quantity_before_binding)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12::date,$13::numeric,$14,$15::numeric) returning id,epr_return_id,obligation_id,measurement_id,resource_flow_id,custody_link_id,evidence_id,verification_id,methodology_version_id,category_code,unit_code,period_start,period_end,measured_quantity,declared_quantity_before_binding,created_at`,
        [returnId,row.epr_obligation_id,measurementId,resourceFlowId,custodyLinkId,evidenceId,verificationId,methodologyVersionId,row.category_code,src.measurement_unit,row.period_start,row.period_end,src.measured_quantity,auth.identityId,row.reported_quantity]);
      const reconciled = await client.query("update epr_returns set reported_quantity=$2::numeric where id=$1 and status='DRAFT' returning id", [returnId, src.measured_quantity]);
      if (!reconciled.rows[0]) { await client.query("ROLLBACK"); return reply.code(409).send({ error: "EPR return changed while quantity binding was being saved", code: "EPR_RETURN_STATE_CONFLICT" }); }
      await client.query("COMMIT");
      return reply.code(201).send({ source: "postgresql", syntheticData: false, quantityBinding: inserted.rows[0], statutoryFulfillmentApplied: false });
    } catch (error: unknown) {
      await client.query("ROLLBACK").catch(() => undefined);
      request.log.error(error);
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("duplicate key")) return reply.code(409).send({ error: "Measurement, custody link or return is already bound; duplicate consumption is prohibited", code: "EPR_BINDING_ALREADY_EXISTS" });
      return reply.code(503).send({ error: "EPR quantity binding unavailable", syntheticData: false });
    } finally { client.release(); }
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
      if (!canAct(auth, row.organization_id) || !await hasLockedEprManagementAuthority(client, auth, row.organization_id)) { await client.query("ROLLBACK"); return reply.code(403).send({ error: "Current EPR management authority is required", code: "EPR_RETURN_WRITE_FORBIDDEN" }); }
      // Rejected returns may already have consumed obligation balance. Until a
      // reconciliation workflow atomically reverses that balance, do not resubmit.
      if (row.status !== "DRAFT") {
        await client.query("ROLLBACK");
        return reply.code(409).send({
          error: row.status === "REJECTED" ? "Rejected return requires fulfillment reconciliation before resubmission" : `Return cannot be submitted from ${row.status}`,
          code: row.status === "REJECTED" ? "EPR_REJECTED_RETURN_RECONCILIATION_REQUIRED" : "INVALID_EPR_RETURN_STATE"
        });
      }
      const obligation = await client.query(`select id,target_quantity,fulfilled_quantity,status from epr_obligations where id=$1 for update`, [row.obligation_id]);
      const obligationRow = obligation.rows[0];
      if (!obligationRow) { await client.query("ROLLBACK"); return reply.code(409).send({ error: "Bound EPR obligation not found", code: "OBLIGATION_NOT_FOUND" }); }
      if (!["OPEN", "ELIGIBLE"].includes(obligationRow.status)) { await client.query("ROLLBACK"); return reply.code(409).send({ error: `EPR obligation cannot be fulfilled from ${obligationRow.status}`, code: "OBLIGATION_NOT_ELIGIBLE" }); }
      const evidence = await client.query(`select e.id,e.status,e.content_hash,e.content_uri,a.organization_id,a.geography_id from evidence e join activities a on a.id=e.activity_id join verifications v on v.id=$2 and v.evidence_id=e.id and v.decision='APPROVED' where e.id=$1`, [evidenceId, verificationId]);
      const evidenceRow = evidence.rows[0];
      if (!evidenceRow || evidenceRow.status !== "VERIFIED" || (!evidenceRow.content_hash && !evidenceRow.content_uri) || evidenceRow.organization_id !== row.organization_id || !evidenceRow.geography_id) { await client.query("ROLLBACK"); return reply.code(409).send({ error: "Submission evidence must be verified, provenance-backed, approved and organization-scoped", code: "EVIDENCE_NOT_ELIGIBLE" }); }
      const geo = await client.query(`select organization_has_geography_scope($1,$2) as ok`, [row.organization_id, evidenceRow.geography_id]);
      if (!geo.rows[0]?.ok) { await client.query("ROLLBACK"); return reply.code(403).send({ error: "Evidence geography is outside organization authorization scope", code: "GEOGRAPHY_FORBIDDEN" }); }
      const bindingResult = await client.query(`select b.*,r.reported_quantity,r.period_start as return_period_start,r.period_end as return_period_end,
          eo.target_quantity,eo.fulfilled_quantity as obligation_fulfilled,eo.category_code as obligation_category_code,eo.scheme_id,
          m.value as current_measurement_value,m.unit as current_measurement_unit,m.quality_status,a.geography_id as evidence_geography_id,
          rf.organization_id as current_flow_organization_id,rf.status as current_flow_status,rf.material_code as current_flow_material_code,rf.unit as current_flow_unit,rf.declared_quantity::text as current_flow_declared_quantity,
          c.actor_organization_id as current_custody_actor_organization_id,c.quantity as current_custody_quantity,c.unit as current_custody_unit,c.recorded_at::date as current_custody_recorded_date,c.evidence_id as current_custody_evidence_id,
          e.status as current_evidence_status,e.content_hash,e.content_uri,e.measurement_id as current_evidence_measurement_id,e.activity_id as current_evidence_activity_id,a.id as current_activity_id,
          v.decision as current_verification_decision,v.evidence_id as current_verification_evidence,v.verifier_identity_id,
          s.code as return_scheme_code,mv.effective_from,mv.rules
        from epr_return_quantity_bindings b
        join epr_returns r on r.id=b.epr_return_id
        join epr_obligations eo on eo.id=b.obligation_id
        join epr_schemes s on s.id=r.scheme_id
        join measurements m on m.id=b.measurement_id
        join activities a on a.id=m.activity_id
        join resource_flows rf on rf.id=b.resource_flow_id
        join chain_of_custody_links c on c.id=b.custody_link_id and c.resource_flow_id=rf.id and c.activity_id=a.id
        join evidence e on e.id=b.evidence_id
        join verifications v on v.id=b.verification_id
        join methodology_versions mv on mv.id=b.methodology_version_id
        where b.epr_return_id=$1
        for update of b,eo,rf
        for share of m,a,c,e,v,mv`, [returnId]);
      const binding = bindingResult.rows[0];
      if (!binding || binding.obligation_id !== row.obligation_id || binding.evidence_id !== evidenceId || binding.verification_id !== verificationId || binding.category_code !== binding.obligation_category_code
          || String(binding.period_start).slice(0,10) !== String(binding.return_period_start).slice(0,10)
          || String(binding.period_end).slice(0,10) !== String(binding.return_period_end).slice(0,10)
          || String(binding.measured_quantity) !== String(binding.reported_quantity)
          || String(binding.current_measurement_value) !== String(binding.measured_quantity)
          || binding.current_measurement_unit !== binding.unit_code || binding.quality_status !== "VERIFIED"
          || binding.current_flow_organization_id !== row.organization_id || !["ACCEPTED", "COMPLETED", "VERIFIED"].includes(binding.current_flow_status)
          || binding.current_flow_material_code !== binding.category_code || binding.current_flow_unit !== binding.unit_code
          || binding.current_custody_actor_organization_id !== row.organization_id
          || String(binding.current_custody_quantity) !== String(binding.measured_quantity) || binding.current_custody_unit !== binding.unit_code
          || String(binding.current_custody_recorded_date).slice(0,10) < String(binding.return_period_start).slice(0,10)
          || String(binding.current_custody_recorded_date).slice(0,10) > String(binding.return_period_end).slice(0,10)
          || (binding.current_custody_evidence_id !== binding.evidence_id
            && binding.current_evidence_measurement_id !== binding.measurement_id
            && binding.current_evidence_activity_id !== binding.current_activity_id)
          || binding.current_evidence_status !== "VERIFIED" || (!binding.content_hash && !binding.content_uri)
          || binding.current_verification_decision !== "APPROVED" || binding.current_verification_evidence !== binding.evidence_id
          || binding.consumed_at || !binding.effective_from || new Date(binding.effective_from) > new Date(binding.return_period_start)
          || binding.rules?.eprBinding?.schemeCode !== binding.return_scheme_code
          || binding.rules?.eprBinding?.categoryCode !== binding.category_code
          || binding.rules?.eprBinding?.unitCode !== binding.unit_code) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: "A current, unconsumed authoritative quantity binding matching the return is required", code: "EPR_AUTHORITATIVE_BINDING_REQUIRED", productionGate: "HOLD" });
      }
      // The resource-flow row is locked above, serializing this final mass-balance
      // check against concurrent quantity-binding allocations on the same flow.
      const currentFlowCapacity = await client.query(`select coalesce(sum(measured_quantity),0) <= $2::numeric as within_capacity
        from epr_return_quantity_bindings where resource_flow_id=$1`,
        [binding.resource_flow_id, binding.current_flow_declared_quantity]);
      if (currentFlowCapacity.rows[0]?.within_capacity !== true) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: "Current quantity bindings exceed the resource flow's declared quantity; reconciliation is required", code: "EPR_FLOW_MASS_BALANCE_EXCEEDED" });
      }
      // Lock the authority rows until the EPR submission commits. Without these
      // row locks, a membership revocation, role change, or identity suspension
      // could race between this check and the authoritative fulfillment mutation.
      const currentVerifierAuthority = await client.query(`select om.identity_id
        from organization_memberships om
        join roles r on r.id=om.role_id
        join identities i on i.id=om.identity_id
        where om.identity_id=$1 and om.organization_id=$4 and om.status='VERIFIED'
          and i.status='VERIFIED' and i.suspended_at is null
          and organization_has_geography_scope(om.organization_id,$2)
          and exists(select 1 from jsonb_array_elements_text(r.permissions) p where p=any($3::text[]))
        for share of om, r, i`,
        [binding.verifier_identity_id, binding.evidence_geography_id, ["VERIFY_EVIDENCE", "verification:approve", "verification.approve"], row.organization_id]);
      if (currentVerifierAuthority.rows.length === 0) {
        await client.query("ROLLBACK"); return reply.code(409).send({ error: "Verifier authority is no longer valid", code: "EPR_VERIFIER_AUTHORITY_INVALID" });
      }
      const quantityBinding = evaluateEprQuantityBinding({
        organizationId: row.organization_id, schemeId: row.scheme_id, obligationId: row.obligation_id,
        measurementId: binding.measurement_id, custodyAllocationId: binding.custody_link_id,
        categoryCode: binding.category_code, unitCode: binding.unit_code,
        methodologyVersion: binding.methodology_version_id,
        periodStart: String(binding.period_start).slice(0,10), periodEnd: String(binding.period_end).slice(0,10),
        measuredQuantity: Number(binding.measured_quantity), measurementVerified: true,
        verifierCurrentlyAuthorized: true, evidenceNotRevoked: true,
      });
      if (!quantityBinding.ready) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ error: "Authoritative EPR quantity binding failed validation", code: quantityBinding.code, productionGate: "HOLD" });
      }
      const consume = await client.query(`update epr_return_quantity_bindings set consumed_at=now()
        where id=$1 and consumed_at is null returning id`, [binding.id]);
      if (!consume.rows[0]) { await client.query("ROLLBACK"); return reply.code(409).send({ error: "Quantity binding was already consumed", code: "EPR_BINDING_ALREADY_CONSUMED" }); }
      const obligationUpdate = await client.query(`update epr_obligations set fulfilled_quantity=fulfilled_quantity+$2::numeric,
        status=case when fulfilled_quantity+$2::numeric >= target_quantity then 'COMPLETED'::lifecycle_status else status end
        where id=$1 and fulfilled_quantity+$2::numeric <= target_quantity returning fulfilled_quantity`, [row.obligation_id, binding.measured_quantity]);
      if (!obligationUpdate.rows[0]) { await client.query("ROLLBACK"); return reply.code(409).send({ error: "Measured quantity exceeds remaining obligation balance", code: "EPR_OBLIGATION_BALANCE_EXCEEDED" }); }
      const updatedReturn = await client.query(`update epr_returns set fulfilled_quantity=$2::numeric,evidence_id=$3,verification_id=$4,status='SUBMITTED',submitted_at=now()
        where id=$1 and status='DRAFT' returning *`, [returnId, binding.measured_quantity, binding.evidence_id, binding.verification_id]);
      if (!updatedReturn.rows[0]) { await client.query("ROLLBACK"); return reply.code(409).send({ error: "EPR return changed while submission was in progress", code: "EPR_RETURN_STATE_CONFLICT" }); }
      await client.query("COMMIT");
      return reply.code(200).send({ source: "postgresql", syntheticData: false, authoritativeMutation: true, eprReturn: updatedReturn.rows[0], quantityBindingId: binding.id, fulfilledQuantity: binding.measured_quantity, productionGate: "HOLD_FOR_EXTERNAL_REGULATORY_ACCEPTANCE" });
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
