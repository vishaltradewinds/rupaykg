import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { authenticate, issueOpaqueToken, type AuthContext } from "./auth.js";
import { getPermissionsForRole } from "./rbac-policy.js";
import { verifyFirebaseIdToken } from "./firebase-auth.js";

type Body = Record<string, unknown>;
const text = (body: Body, key: string) => typeof body[key] === "string" && body[key].trim() ? body[key].trim() : null;
const bool = (body: Body, key: string) => typeof body[key] === "boolean" ? body[key] : null;
export const STAKEHOLDER_OPTIONS = [
  ["citizen", "Citizen / household / waste generator", "individual"], ["farmer", "Farmer / rural producer", "rural_enterprise"], ["safai_mitra", "Waste collection worker / Safai Mitra", "collection_operator"], ["fpo", "FPO / rural enterprise / Panchayat partner", "rural_institution"], ["municipal_admin", "ULB / municipal authority", "ulb"], ["municipal_generator", "Municipal / bulk facility generator", "bulk_generator"], ["aggregator", "Aggregator / transporter", "logistics"], ["processor", "MRF / recycler / processor / treatment facility", "processing_facility"], ["industry_generator", "Industrial generator", "industrial_generator"], ["commercial_generator", "Commercial / bulk waste generator", "commercial_generator"], ["institution_generator", "Institutional generator", "institutional_generator"], ["PROJECT_OWNER", "Carbon project owner", "carbon_project"], ["ACVA_USER", "Accredited Carbon Verification Agency user", "acva"], ["ccc_buyer", "Carbon / ESG buyer", "buyer"], ["epr_partner", "Producer / brand owner / importer / EPR partner", "epr"], ["csr_partner", "CSR / ESG partner", "csr"], ["regulator", "Regulator / public authority", "regulator"]
] as const;
type StakeholderRoleKey = typeof STAKEHOLDER_OPTIONS[number][0];
const roleKeys = new Set<StakeholderRoleKey>(STAKEHOLDER_OPTIONS.map(([key]) => key));
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const bodyOf = (request: { body: unknown }): Body => request.body && typeof request.body === "object" ? request.body as Body : {};
const organizationRequiresLegalVerification = (organizationType: string) => organizationType !== "individual";
async function requireAuth(request: any, reply: any, pool: Pool | null): Promise<AuthContext | null> { if (!pool) { reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" }); return null; } const auth = await authenticate(request, pool); if (!auth) { reply.code(401).send({ error: "Authenticated session required", code: "AUTH_REQUIRED" }); return null; } return auth; }
async function isPlatformReviewer(pool: Pool, identityId: string): Promise<boolean> { const allowed = await pool.query<{ ok: boolean }>(`select exists(select 1 from organization_memberships om join roles r on r.id=om.role_id where om.identity_id=$1 and om.status='VERIFIED' and r.name in('platform_admin','super_admin')) ok`, [identityId]); return allowed.rows[0]?.ok === true; }

export async function registerAuthRoutes(app: FastifyInstance, pool: Pool | null): Promise<void> {
  app.post("/api/v1/auth/exchange", async (request, reply) => {
    if (!pool) return reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" });
    const idToken = text(bodyOf(request), "idToken");
    if (!idToken) return reply.code(400).send({ error: "idToken is required", code: "ID_TOKEN_REQUIRED" });
    try {
      const claims = await verifyFirebaseIdToken(idToken);
      if (!claims.email) return reply.code(403).send({ error: "A Firebase account email is required", code: "EMAIL_REQUIRED" });
      const identity = await pool.query<{ id: string }>(`insert into identities(external_subject,display_name,email,status) values($1,$2,$3,'VERIFIED') on conflict(external_subject) do update set display_name=excluded.display_name,email=excluded.email returning id`, [claims.sub, claims.name?.trim() || claims.email.trim(), claims.email.trim().toLowerCase()]);
      const identityRow = identity.rows[0]; if (!identityRow) throw new Error("Identity insert returned no row");
      const status = await pool.query<{ status: string }>("select status from identities where id=$1", [identityRow.id]);
      if (!status.rows[0] || status.rows[0].status !== "VERIFIED") return reply.code(403).send({ error: "RupayKG identity is not active", code: "IDENTITY_INACTIVE" });
      const sessionToken = issueOpaqueToken();
      await pool.query(`insert into identity_sessions(identity_id,expires_at,token_hash,request_context) values($1,now()+interval '8 hours',$2,$3)`, [identityRow.id, hash(sessionToken), JSON.stringify({ provider: "firebase", auth_time: claims.auth_time, email_verified: claims.email_verified === true })]);
      const memberships = await pool.query(`select om.organization_id,om.role_id,om.status,r.name role_name,r.permissions,o.name organization_name,o.organization_type,can_assess_epr(om.identity_id,om.organization_id) as can_assess_epr,can_write_esg(om.identity_id,om.organization_id) as can_write_esg from organization_memberships om join roles r on r.id=om.role_id join organizations o on o.id=om.organization_id where om.identity_id=$1 order by om.created_at`, [identityRow.id]);
      const applications = await pool.query(`select sa.id,sa.organization_id,sa.requested_role_key,sa.requested_organization_type,sa.status,sa.created_at,sa.reviewed_at,sa.review_note,o.verification_status,o.verification_note,(select count(*) from organization_verification_evidence ove where ove.organization_id=o.id) evidence_count from stakeholder_applications sa join organizations o on o.id=sa.organization_id where sa.identity_id=$1 order by sa.created_at desc`, [identityRow.id]);
      return { source: "postgresql", syntheticData: false, sessionToken, expiresInSeconds: 28800, identity: { id: identityRow.id, externalSubject: claims.sub, displayName: claims.name ?? claims.email, email: claims.email, emailVerified: claims.email_verified === true }, memberships: memberships.rows, applications: applications.rows };
    } catch (error) { request.log.error(error); return reply.code(401).send({ error: "Firebase identity could not be verified", code: "IDENTITY_VERIFICATION_FAILED" }); }
  });
  app.get("/api/v1/auth/me", async (request, reply) => { const auth = await requireAuth(request, reply, pool); if (!auth || !pool) return; const [identity, memberships, applications] = await Promise.all([pool.query(`select id,display_name,email,status from identities where id=$1`, [auth.identityId]), pool.query(`select om.organization_id,om.role_id,om.status,r.name role_name,r.permissions,o.name organization_name,o.organization_type,can_assess_epr(om.identity_id,om.organization_id) as can_assess_epr,can_write_esg(om.identity_id,om.organization_id) as can_write_esg from organization_memberships om join roles r on r.id=om.role_id join organizations o on o.id=om.organization_id where om.identity_id=$1`, [auth.identityId]), pool.query(`select sa.id,sa.organization_id,sa.requested_role_key,sa.requested_organization_type,sa.status,sa.created_at,sa.reviewed_at,sa.review_note,o.verification_status,o.verification_note,(select count(*) from organization_verification_evidence ove where ove.organization_id=o.id) evidence_count from stakeholder_applications sa join organizations o on o.id=sa.organization_id where sa.identity_id=$1 order by sa.created_at desc`, [auth.identityId])]); return { source: "postgresql", syntheticData: false, identity: identity.rows[0] ?? null, memberships: memberships.rows, applications: applications.rows }; });
  app.post("/api/v1/auth/logout", async (request, reply) => { if (!pool) return reply.code(503).send({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" }); const header = request.headers.authorization; if (header?.startsWith("Bearer ")) await pool.query("update identity_sessions set revoked_at=now() where token_hash=$1 and revoked_at is null", [hash(header.slice(7).trim())]); return reply.code(204).send(); });
  app.get("/api/v1/onboarding/options", async () => ({ source: "application", syntheticData: false, stakeholders: STAKEHOLDER_OPTIONS.map(([key, label, organizationType]) => ({ key, label, organizationType })) }));
  app.post("/api/v1/onboarding/applications", async (request, reply) => {
    const auth = await requireAuth(request, reply, pool); if (!auth || !pool) return;
    const body = bodyOf(request), organizationName = text(body, "organizationName"), roleKeyText = text(body, "roleKey"), note = text(body, "applicantNote"), geographyId = text(body, "geographyId");
    const legalName = text(body, "legalName") ?? organizationName;
    const legalForm = text(body, "legalForm");
    const registrationIdentifier = text(body, "registrationIdentifier");
    const registrationAuthority = text(body, "registrationAuthority");
    const evidenceType = text(body, "evidenceType");
    const documentReference = text(body, "documentReference");
    const contentHash = text(body, "contentHash");
    const issuerName = text(body, "issuerName");
    const issuedAt = text(body, "issuedAt");
    const expiresAt = text(body, "expiresAt");
    if (!organizationName || !roleKeyText || !roleKeys.has(roleKeyText as StakeholderRoleKey)) return reply.code(400).send({ error: "organizationName and a supported stakeholder role are required", code: "INVALID_ONBOARDING" });
    const roleKey = roleKeyText as StakeholderRoleKey; const option = STAKEHOLDER_OPTIONS.find(([key]) => key === roleKey); if (!option) return reply.code(400).send({ error: "Unsupported stakeholder role", code: "INVALID_ONBOARDING" });
    if (organizationRequiresLegalVerification(option[2]) && (!legalName || !legalForm || !registrationIdentifier || !registrationAuthority)) return reply.code(400).send({ error: "Legal name, legal form, registration identifier and registration authority are required for organization-backed stakeholder onboarding", code: "LEGAL_IDENTITY_REQUIRED" });
    if (organizationRequiresLegalVerification(option[2]) && (!evidenceType || !documentReference || !contentHash)) return reply.code(400).send({ error: "At least one legal verification evidence reference and content hash are required for organization-backed stakeholder onboarding", code: "LEGAL_EVIDENCE_REQUIRED" });
    if (geographyId && !(await pool.query("select id from geography where id=$1", [geographyId])).rows[0]) return reply.code(400).send({ error: "Selected geography does not exist", code: "GEOGRAPHY_NOT_FOUND" });
    if ((await pool.query(`select id from stakeholder_applications where identity_id=$1 and status in('PENDING','APPROVED') limit 1`, [auth.identityId])).rows[0]) return reply.code(409).send({ error: "An active stakeholder application already exists for this identity", code: "APPLICATION_EXISTS" });
    const client = await pool.connect();
    try {
      await client.query("begin");
      const organization = await client.query<{ id: string }>("insert into organizations(name,organization_type,legal_name,legal_form,registration_identifier,registration_authority,status,verification_status) values($1,$2,$3,$4,$5,$6,'PENDING','UNDER_REVIEW') returning id", [organizationName, option[2], legalName, legalForm, registrationIdentifier, registrationAuthority]); const organizationRow = organization.rows[0]; if (!organizationRow) throw new Error("Organization insert returned no row");
      const role = await client.query<{ id: string }>("insert into roles(organization_id,name,permissions,geography_scope) values($1,$2,$3,'[]') returning id", [organizationRow.id, roleKey, JSON.stringify(getPermissionsForRole(roleKey))]); const roleRow = role.rows[0]; if (!roleRow) throw new Error("Role insert returned no row");
      await client.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'PENDING')", [auth.identityId, organizationRow.id, roleRow.id]);
      if (geographyId) await client.query("insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'PENDING')", [organizationRow.id, geographyId]);
      if (evidenceType && documentReference && contentHash) await client.query("insert into organization_verification_evidence(organization_id,evidence_type,document_reference,content_hash,issuer_name,issued_at,expires_at,status) values($1,$2,$3,$4,$5,$6,$7,'PENDING')", [organizationRow.id,evidenceType,documentReference,contentHash,issuerName,issuedAt ? new Date(issuedAt) : null,expiresAt ? new Date(expiresAt) : null]);
      const application = await client.query("insert into stakeholder_applications(identity_id,organization_id,role_id,requested_role_key,requested_organization_type,geography_id,status,applicant_note) values($1,$2,$3,$4,$5,$6,'PENDING',$7) returning *", [auth.identityId, organizationRow.id, roleRow.id, roleKey, option[2], geographyId, note]);
      await client.query("commit"); return reply.code(201).send({ source: "postgresql", syntheticData: false, application: application.rows[0], legalVerification: { status: "UNDER_REVIEW", evidenceSubmitted: Boolean(evidenceType && documentReference && contentHash) }, message: "Application submitted. Legal identity evidence must be reviewed by an authorized platform reviewer before operational access is granted." });
    } catch (error) { await client.query("rollback"); request.log.error(error); return reply.code(503).send({ error: "Stakeholder application could not be created", code: "ONBOARDING_UNAVAILABLE" }); } finally { client.release(); }
  });
  app.get("/api/v1/onboarding/applications", async (request, reply) => { const auth = await requireAuth(request, reply, pool); if (!auth || !pool) return; const rows = await pool.query(`select sa.id,sa.organization_id,sa.requested_role_key,sa.requested_organization_type,sa.geography_id,sa.status,sa.applicant_note,sa.created_at,sa.reviewed_at,sa.review_note,o.verification_status,o.verification_note,(select count(*) from organization_verification_evidence ove where ove.organization_id=o.id) evidence_count from stakeholder_applications sa join organizations o on o.id=sa.organization_id where sa.identity_id=$1 order by sa.created_at desc`, [auth.identityId]); return { source: "postgresql", syntheticData: false, applications: rows.rows }; });
  app.post("/api/v1/onboarding/applications/:applicationId/withdraw", async (request, reply) => {
    const auth = await requireAuth(request, reply, pool); if (!auth || !pool) return;
    const id = (request.params as { applicationId: string }).applicationId;
    const client = await pool.connect();
    try {
      await client.query("begin");
      const result = await client.query<{ organization_id: string }>(`update stakeholder_applications set status='WITHDRAWN',reviewed_at=now(),review_note=null where id=$1 and identity_id=$2 and status='PENDING' returning organization_id`, [id, auth.identityId]);
      const row = result.rows[0]; if (!row) { await client.query("rollback"); return reply.code(404).send({ error: "Pending stakeholder application not found", code: "APPLICATION_NOT_FOUND" }); }
      await client.query("update organization_memberships set status='REJECTED' where organization_id=$1 and identity_id=$2 and status='PENDING'", [row.organization_id, auth.identityId]);
      await client.query("update organization_geography_scopes set status='REJECTED' where organization_id=$1 and status='PENDING'", [row.organization_id]);
      await client.query("update organizations set status='REJECTED',verification_status='REJECTED',verification_note='Application withdrawn by applicant' where id=$1 and status='PENDING'", [row.organization_id]);
      await client.query("commit"); return { source: "postgresql", syntheticData: false, status: "WITHDRAWN", organizationId: row.organization_id };
    } catch (error) { await client.query("rollback"); request.log.error(error); return reply.code(503).send({ error: "Stakeholder withdrawal could not be finalized", code: "WITHDRAWAL_UNAVAILABLE" }); } finally { client.release(); }
  });
}
