import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, canActForOrganization, hasOrganizationPermission, type AuthContext } from "./auth.js";

type Reply = { code: (status: number) => { send: (body: unknown) => unknown } };
type Request = { body: unknown; params: Record<string, string>; log: { error: (error: unknown) => void } };
const bodyOf = (request: Request): Record<string, unknown> => request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
const text = (body: Record<string, unknown>, key: string): string | null => typeof body[key] === "string" && body[key].trim() ? body[key].trim() : null;
const nonNegative = (body: Record<string, unknown>, key: string): number | null | undefined => {
  if (body[key] === undefined || body[key] === null || body[key] === "") return undefined;
  const value = Number(body[key]);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

async function authFor(request: Request, reply: Reply, pool: Pool | null): Promise<AuthContext | null> {
  if (!pool) { reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" }); return null; }
  try {
    const auth = await authenticate(request as never, pool);
    if (!auth) { reply.code(401).send({ error: "Authenticated session required", code: "AUTH_REQUIRED" }); return null; }
    return auth;
  } catch (error) {
    request.log.error(error);
    reply.code(503).send({ error: "Authentication service unavailable", code: "AUTH_UNAVAILABLE" });
    return null;
  }
}

async function organizationFor(auth: AuthContext, pool: Pool, request: Request, reply: Reply): Promise<string | null> {
  const requested = text(bodyOf(request), "organizationId") || auth.activeOrganizationId || auth.memberships[0]?.organization_id || null;
  if (!requested || !canActForOrganization(auth, requested)) {
    reply.code(403).send({ error: "No verified membership for organization", code: "ORG_FORBIDDEN" });
    return null;
  }
  return requested;
}

async function evidenceBindingValid(pool: Pool, organizationId: string, evidenceId: string | null, verificationId: string | null): Promise<boolean> {
  if (!evidenceId && !verificationId) return true;
  if (!evidenceId || !verificationId) return false;
  const result = await pool.query<{ ok: boolean }>(
    `select exists(
       select 1 from evidence e
       join activities a on a.id=e.activity_id
       join verifications v on v.id=$3 and v.activity_id=a.id
       where e.id=$2 and a.organization_id=$1
     ) ok`,
    [organizationId, evidenceId, verificationId],
  );
  return result.rows[0]?.ok === true;
}

function bwgStatus(floorArea: number | undefined, water: number | undefined, waste: number | undefined): "UNKNOWN" | "UNDER_REVIEW" | "APPLICABLE" | "NOT_APPLICABLE" {
  if ([floorArea, water, waste].some(value => value === null)) return "UNDER_REVIEW";
  const complete = floorArea !== undefined && water !== undefined && waste !== undefined;
  if (!complete) return "UNKNOWN";
  return floorArea >= 20000 || water >= 40000 || waste >= 100 ? "APPLICABLE" : "NOT_APPLICABLE";
}

export async function registerStatutoryRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.get("/api/v1/statutory/applicability", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const organizationId = await organizationFor(auth, pool, request as never, reply); if (!organizationId) return;
    try {
      if (!await hasOrganizationPermission(pool, auth, organizationId, ["swm:read", "epr:read", "reports:read"])) return reply.code(403).send({ error: "Statutory applicability read permission required", code: "STATUTORY_PERMISSION_REQUIRED" });
      const [profiles, bwg, epr] = await Promise.all([
        pool.query("select id,framework,rule_reference,effective_from,effective_to,applicability_status,basis,determination_note,externally_confirmed,external_authority,external_reference,determined_by_identity_id,determined_at,created_at from organization_statutory_profiles where organization_id=$1 order by effective_from desc nulls last,created_at desc", [organizationId]),
        pool.query("select * from organization_bwg_assessments where organization_id=$1 order by assessment_date desc,created_at desc", [organizationId]),
        pool.query("select * from organization_epr_applicability where organization_id=$1 order by scheme", [organizationId]),
      ]);
      return { source: "postgresql", syntheticData: false, statutoryBoundary: "INTERNAL_APPLICABILITY_PREPARATION_ONLY", profiles: profiles.rows, bwgAssessments: bwg.rows, eprApplicability: epr.rows };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "Statutory applicability unavailable", code: "STATUTORY_UNAVAILABLE", syntheticData: false }); }
  });

  app.post("/api/v1/statutory/bwg/assess", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const body = bodyOf(request as never);
    const organizationId = text(body, "organizationId") || auth.activeOrganizationId || auth.memberships[0]?.organization_id || null;
    if (!organizationId || !canActForOrganization(auth, organizationId)) return reply.code(403).send({ error: "No verified membership for organization", code: "ORG_FORBIDDEN" });
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["swm:manage", "audit:execute", "reports:export"])) return reply.code(403).send({ error: "BWG applicability assessment permission required", code: "STATUTORY_WRITE_REQUIRED" });
    const floorArea = nonNegative(body, "floorAreaSqM");
    const water = nonNegative(body, "waterConsumptionLpd");
    const waste = nonNegative(body, "solidWasteKgpd");
    if ([floorArea, water, waste].some(value => value === null)) return reply.code(400).send({ error: "BWG measurements must be non-negative numbers", code: "INVALID_BWG_MEASUREMENTS" });
    const evidenceId = text(body, "evidenceId");
    const verificationId = text(body, "verificationId");
    if (!await evidenceBindingValid(pool, organizationId, evidenceId, verificationId)) return reply.code(400).send({ error: "Evidence and verification must be supplied together and belong to the organization", code: "STATUTORY_EVIDENCE_BINDING_INVALID" });
    const status = bwgStatus(floorArea, water, waste);
    const note = text(body, "determinationNote");
    try {
      const result = await pool.query(
        `insert into organization_bwg_assessments
          (organization_id,assessment_date,floor_area_sq_m,water_consumption_lpd,solid_waste_kgpd,
           floor_area_threshold_sq_m,water_threshold_lpd,waste_threshold_kgpd,threshold_basis,
           applicability_status,evidence_id,verification_id,determination_note,determined_by_identity_id,determined_at)
         values($1,coalesce($2::date,current_date),$3,$4,$5,20000,40000,100,'SWM_RULES_2026_S_O_388_E',$6,$7,$8,$9,$10,now())
         returning *`,
        [organizationId, text(body, "assessmentDate"), floorArea ?? null, water ?? null, waste ?? null, status, evidenceId, verificationId, note, auth.identityId],
      );
      return reply.code(201).send({ source: "postgresql", syntheticData: false, assessment: result.rows[0], statutoryBoundary: "INTERNAL_APPLICABILITY_PREPARATION_ONLY", externalRegistrationRequired: status === "APPLICABLE" });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "BWG assessment could not be persisted", code: "STATUTORY_WRITE_UNAVAILABLE", syntheticData: false }); }
  });

  app.post("/api/v1/statutory/epr", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const body = bodyOf(request as never);
    const organizationId = text(body, "organizationId") || auth.activeOrganizationId || auth.memberships[0]?.organization_id || null;
    if (!organizationId || !canActForOrganization(auth, organizationId)) return reply.code(403).send({ error: "No verified membership for organization", code: "ORG_FORBIDDEN" });
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["epr:manage", "audit:execute", "reports:export"])) return reply.code(403).send({ error: "EPR applicability management permission required", code: "STATUTORY_EPR_WRITE_REQUIRED" });
    const scheme = text(body, "scheme");
    if (!scheme) return reply.code(400).send({ error: "EPR scheme is required", code: "EPR_SCHEME_REQUIRED" });
    const status = text(body, "applicabilityStatus") || "UNDER_REVIEW";
    const allowed = new Set(["UNKNOWN", "POTENTIALLY_APPLICABLE", "APPLICABLE", "NOT_APPLICABLE", "UNDER_REVIEW"]);
    if (!allowed.has(status)) return reply.code(400).send({ error: "Invalid EPR applicability status", code: "INVALID_EPR_APPLICABILITY" });
    const evidenceId = text(body, "evidenceId");
    const verificationId = text(body, "verificationId");
    if (!await evidenceBindingValid(pool, organizationId, evidenceId, verificationId)) return reply.code(400).send({ error: "Evidence and verification must be supplied together and belong to the organization", code: "STATUTORY_EVIDENCE_BINDING_INVALID" });
    try {
      const result = await pool.query(
        `insert into organization_epr_applicability
          (organization_id,scheme,rule_reference,applicability_status,basis,cpcb_registration_status,cpcb_registration_reference,evidence_id,verification_id,determination_note,determined_by_identity_id,determined_at)
         values($1,$2,$3,$4,coalesce($5::jsonb,'{}'),$6,$7,$8,$9,$10,$11,now())
         on conflict(organization_id,scheme) do update set
           rule_reference=excluded.rule_reference,applicability_status=excluded.applicability_status,basis=excluded.basis,
           cpcb_registration_status=excluded.cpcb_registration_status,cpcb_registration_reference=excluded.cpcb_registration_reference,
           evidence_id=excluded.evidence_id,verification_id=excluded.verification_id,determination_note=excluded.determination_note,
           determined_by_identity_id=excluded.determined_by_identity_id,determined_at=excluded.determined_at
         returning *`,
        [organizationId, scheme, text(body, "ruleReference"), status, typeof body.basis === "string" ? body.basis : JSON.stringify(body.basis ?? {}), text(body, "cpcbRegistrationStatus") || "NOT_ASSERTED", text(body, "cpcbRegistrationReference"), evidenceId, verificationId, text(body, "determinationNote"), auth.identityId],
      );
      return reply.code(201).send({ source: "postgresql", syntheticData: false, applicability: result.rows[0], statutoryBoundary: "INTERNAL_APPLICABILITY_PREPARATION_ONLY", cpcbExternalStatus: result.rows[0]?.cpcb_registration_status });
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "EPR applicability could not be persisted", code: "EPR_WRITE_UNAVAILABLE", syntheticData: false }); }
  });

  app.post("/api/v1/statutory/epr/:id/external-registration", async (request, reply) => {
    const auth = await authFor(request as never, reply, pool); if (!auth || !pool) return;
    const body = bodyOf(request as never);
    const id = (request.params as { id: string }).id;
    const reference = text(body, "cpcbRegistrationReference");
    const status = text(body, "cpcbRegistrationStatus");
    if (!reference || status !== "REGISTERED_EXTERNALLY") return reply.code(400).send({ error: "An externally issued CPCB registration reference is required to record REGISTERED_EXTERNALLY", code: "EXTERNAL_REGISTRATION_REFERENCE_REQUIRED" });
    const organization = await pool.query<{ organization_id: string }>("select organization_id from organization_epr_applicability where id=$1", [id]);
    const organizationId = organization.rows[0]?.organization_id;
    if (!organizationId || !canActForOrganization(auth, organizationId)) return reply.code(403).send({ error: "Organization access denied", code: "ORG_FORBIDDEN" });
    if (!await hasOrganizationPermission(pool, auth, organizationId, ["epr:manage", "audit:execute"])) return reply.code(403).send({ error: "EPR management permission required", code: "STATUTORY_EPR_WRITE_REQUIRED" });
    try {
      const result = await pool.query("update organization_epr_applicability set cpcb_registration_status='REGISTERED_EXTERNALLY',cpcb_registration_reference=$2,determined_by_identity_id=$3,determined_at=now() where id=$1 returning *", [id, reference, auth.identityId]);
      if (!result.rows[0]) return reply.code(404).send({ error: "EPR applicability record not found", code: "EPR_RECORD_NOT_FOUND" });
      return { source: "postgresql", syntheticData: false, applicability: result.rows[0], statutoryBoundary: "EXTERNAL_REFERENCE_RECORDED_NOT_ISSUED_BY_RUPAYKG" };
    } catch (error) { request.log.error(error); return reply.code(503).send({ error: "External EPR registration reference could not be recorded", code: "EPR_EXTERNAL_STATUS_UNAVAILABLE", syntheticData: false }); }
  });
}
