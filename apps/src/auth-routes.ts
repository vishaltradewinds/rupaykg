import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, issueOpaqueToken, type AuthContext } from "./auth.js";
import { getPermissionsForRole } from "./rbac-policy.js";
import { verifyFirebaseIdToken } from "./firebase-auth.js";

type Body = Record<string, unknown>;
const text = (body: Body, key: string) => typeof body[key] === "string" && body[key].trim() ? body[key].trim() : null;
export const STAKEHOLDER_OPTIONS = [
  ["citizen", "Citizen / household / waste generator", "individual"], ["farmer", "Farmer / rural producer", "rural_enterprise"], ["safai_mitra", "Waste collection worker / Safai Mitra", "collection_operator"], ["fpo", "FPO / rural enterprise / Panchayat partner", "rural_institution"], ["municipal_admin", "ULB / municipal authority", "ulb"], ["municipal_generator", "Municipal / bulk facility generator", "bulk_generator"], ["aggregator", "Aggregator / transporter", "logistics"], ["processor", "MRF / recycler / processor / treatment facility", "processing_facility"], ["industry_generator", "Industrial generator", "industrial_generator"], ["commercial_generator", "Commercial / bulk waste generator", "commercial_generator"], ["institution_generator", "Institutional generator", "institutional_generator"], ["PROJECT_OWNER", "Carbon project owner", "carbon_project"], ["ACVA_USER", "Accredited Carbon Verification Agency user", "acva"], ["ccc_buyer", "Carbon / ESG buyer", "buyer"], ["epr_partner", "Producer / brand owner / importer / EPR partner", "epr"], ["csr_partner", "CSR / ESG partner", "csr"], ["regulator", "Regulator / public authority", "regulator"]
] as const;
type StakeholderRoleKey = typeof STAKEHOLDER_OPTIONS[number][0];
const roleKeys = new Set<StakeholderRoleKey>(STAKEHOLDER_OPTIONS.map(([key]) => key));
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const bodyOf = (request: { body: unknown }): Body => request.body && typeof request.body === "object" ? request.body as Body : {};
async function requireAuth(request: any, reply: any, pool: Pool | null): Promise<AuthContext | null> { if (!pool) { reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" }); return null; } const auth = await authenticate(request, pool); if (!auth) { reply.code(401).send({ error: "Authenticated session required", code: "AUTH_REQUIRED" }); return null; } return auth; }

export async function registerAuthRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.post("/api/v1/auth/exchange", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" });
    const body = bodyOf(request); const idToken = text(body, "idToken");
    if (!idToken) return reply.code(400).send({ error: "Firebase ID token required", code: "ID_TOKEN_REQUIRED" });
    try {
      const decoded = await verifyFirebaseIdToken(idToken);
      if (!decoded.email || decoded.email_verified !== true) return reply.code(403).send({ error: "Verified email required", code: "EMAIL_NOT_VERIFIED" });
      const displayName = typeof decoded.name === "string" && decoded.name.trim() ? decoded.name.trim() : decoded.email;
      const identityResult = await pool.query<{id:string}>(`insert into identities(firebase_uid,email,display_name,status) values($1,$2,$3,'VERIFIED') on conflict(firebase_uid) do update set email=excluded.email,display_name=excluded.display_name,status='VERIFIED',updated_at=now() returning id`, [decoded.sub, decoded.email, displayName]);
      const identityId = identityResult.rows[0].id;
      const sessionToken = await issueOpaqueToken(pool, identityId);
      const memberships = await pool.query(`select om.organization_id,om.role_id,om.status,r.name as role_name,r.permissions,o.name as organization_name,o.type as organization_type,can_assess_epr(om.identity_id,om.organization_id) as can_assess_epr,can_write_esg(om.identity_id,om.organization_id) as can_write_esg from organization_memberships om join roles r on r.id=om.role_id join organizations o on o.id=om.organization_id where om.identity_id=$1 order by om.created_at desc`, [identityId]);
      const applications = await pool.query(`select id,organization_id,requested_role_key,requested_organization_type,geography_id,status,created_at,reviewed_at,applicant_note from stakeholder_applications where applicant_identity_id=$1 order by created_at desc`, [identityId]);
      return reply.send({ sessionToken, identity: { id: identityId, display_name: displayName, email: decoded.email, status: "VERIFIED" }, memberships: memberships.rows, applications: applications.rows });
    } catch (error) { request.log.error(error); return reply.code(401).send({ error: "Invalid Firebase identity", code: "INVALID_ID_TOKEN" }); }
  });

  app.get("/api/v1/auth/me", async (request, reply) => {
    const auth = await requireAuth(request, reply, pool); if (!auth || !pool) return;
    const identity = await pool.query(`select id,display_name,email,status from identities where id=$1`, [auth.identityId]);
    const memberships = await pool.query(`select om.organization_id,om.role_id,om.status,r.name as role_name,r.permissions,o.name as organization_name,o.type as organization_type,can_assess_epr(om.identity_id,om.organization_id) as can_assess_epr,can_write_esg(om.identity_id,om.organization_id) as can_write_esg from organization_memberships om join roles r on r.id=om.role_id join organizations o on o.id=om.organization_id where om.identity_id=$1 order by om.created_at desc`, [auth.identityId]);
    const applications = await pool.query(`select id,organization_id,requested_role_key,requested_organization_type,geography_id,status,created_at,reviewed_at,applicant_note from stakeholder_applications where applicant_identity_id=$1 order by created_at desc`, [auth.identityId]);
    return reply.send({ identity: identity.rows[0] ?? null, memberships: memberships.rows, applications: applications.rows });
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" });
    const token = typeof request.headers.authorization === "string" && request.headers.authorization.startsWith("Bearer ") ? request.headers.authorization.slice(7).trim() : "";
    if (token) await pool.query(`update sessions set revoked_at=now() where token_hash=$1`, [hash(token)]);
    return reply.send({ message: "Signed out" });
  });

  app.get("/api/v1/onboarding/options", async (_request, reply) => reply.send({ roles: STAKEHOLDER_OPTIONS.map(([key,label,organizationType]) => ({ key, label, organizationType })) }));

  app.post("/api/v1/onboarding/applications", async (request, reply) => {
    const auth = await requireAuth(request, reply, pool); if (!auth || !pool) return; const body = bodyOf(request);
    const organizationName = text(body, "organizationName"); const roleKey = text(body, "roleKey") as StakeholderRoleKey | null; const geographyId = text(body, "geographyId"); const applicantNote = text(body, "applicantNote");
    if (!organizationName || !roleKey || !roleKeys.has(roleKey)) return reply.code(400).send({ error: "Organization name and supported stakeholder role are required", code: "INVALID_APPLICATION" });
    const option = STAKEHOLDER_OPTIONS.find(([key]) => key === roleKey)!; const organizationType = option[2];
    if (geographyId) { const geography = await pool.query(`select id from geographies where id=$1`, [geographyId]); if (!geography.rowCount) return reply.code(400).send({ error: "Selected geography does not exist", code: "GEOGRAPHY_NOT_FOUND" }); }
    const existing = await pool.query(`select id from stakeholder_applications where applicant_identity_id=$1 and status in ('PENDING','APPROVED') limit 1`, [auth.identityId]);
    if (existing.rowCount) return reply.code(409).send({ error: "An active stakeholder application already exists", code: "APPLICATION_EXISTS" });
    const organization = await pool.query<{id:string}>(`insert into organizations(name,type,status) values($1,$2,'PENDING') returning id`, [organizationName, organizationType]);
    const organizationId = organization.rows[0].id;
    const role = await pool.query<{id:string}>(`insert into roles(organization_id,name,permissions) values($1,$2,$3) returning id`, [organizationId, roleKey, JSON.stringify(getPermissionsForRole(roleKey))]);
    const membership = await pool.query<{id:string}>(`insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'PENDING') returning id`, [auth.identityId, organizationId, role.rows[0].id]);
    if (geographyId) await pool.query(`insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'PENDING')`, [organizationId, geographyId]);
    const application = await pool.query<{id:string}>(`insert into stakeholder_applications(applicant_identity_id,organization_id,membership_id,requested_role_key,requested_organization_type,geography_id,status,applicant_note) values($1,$2,$3,$4,$5,$6,'PENDING',$7) returning id`, [auth.identityId, organizationId, membership.rows[0].id, roleKey, organizationType, geographyId, applicantNote]);
    return reply.code(201).send({ id: application.rows[0].id, message: "Stakeholder application submitted for platform review." });
  });

  app.get("/api/v1/onboarding/review-queue", async (request, reply) => {
    const auth = await requireAuth(request, reply, pool); if (!auth || !pool) return;
    if (!auth.isPlatformAdmin && !auth.permissions.includes("MANAGE_STAKEHOLDERS")) return reply.code(403).send({ error: "Stakeholder management permission required", code: "FORBIDDEN" });
    const result = await pool.query(`select sa.id,sa.organization_id,sa.requested_role_key,sa.requested_organization_type,sa.geography_id,sa.status,sa.created_at,sa.reviewed_at,sa.applicant_note,sa.applicant_identity_id,i.display_name as applicant_name,i.email as applicant_email,o.name as organization_name,o.type as organization_type from stakeholder_applications sa join identities i on i.id=sa.applicant_identity_id join organizations o on o.id=sa.organization_id where sa.status='PENDING' order by sa.created_at asc`);
    return reply.send({ applications: result.rows });
  });

  app.post("/api/v1/onboarding/applications/:id/approve", async (request, reply) => {
    const auth = await requireAuth(request, reply, pool); if (!auth || !pool) return; const applicationId = request.params.id;
    if (!auth.isPlatformAdmin && !auth.permissions.includes("MANAGE_STAKEHOLDERS")) return reply.code(403).send({ error: "Stakeholder management permission required", code: "FORBIDDEN" });
    const application = await pool.query<{applicant_identity_id:string;organization_id:string;membership_id:string;geography_id:string|null}>(`select applicant_identity_id,organization_id,membership_id,geography_id from stakeholder_applications where id=$1 and status='PENDING'`, [applicationId]);
    if (!application.rowCount) return reply.code(404).send({ error: "Pending stakeholder application not found", code: "APPLICATION_NOT_FOUND" });
    if (application.rows[0].applicant_identity_id === auth.identityId) return reply.code(409).send({ error: "Self-approval is not permitted", code: "SELF_APPROVAL_FORBIDDEN" });
    const a = application.rows[0];
    await pool.query("begin");
    try { await pool.query(`update organizations set status='VERIFIED',updated_at=now() where id=$1`, [a.organization_id]); await pool.query(`update organization_memberships set status='VERIFIED',verified_at=now() where id=$1`, [a.membership_id]); if (a.geography_id) await pool.query(`update organization_geography_scopes set status='VERIFIED',verified_at=now() where organization_id=$1 and geography_id=$2`, [a.organization_id,a.geography_id]); await pool.query(`update stakeholder_applications set status='APPROVED',reviewed_at=now(),reviewed_by=$2 where id=$1`, [applicationId,auth.identityId]); await pool.query("commit"); } catch (error) { await pool.query("rollback"); throw error; }
    return reply.send({ message: "Stakeholder application approved and membership verified." });
  });
}
