import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { initialSwmChecklist } from "@rupaykg/domain";
import { registerCpcbSwmRoutes } from "./cpcb-swm-routes.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

test("CPCB SWM workspace routes enforce permissions and persist only user-reported unverified status", {
  skip: !enabled ? "requires CI disposable PostgreSQL and applied migrations" : false,
}, async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 8,
  });
  const app = Fastify({ logger: { level: "error" } });
  const suffix = randomBytes(8).toString("hex");
  const token = randomBytes(32).toString("base64url");
  const identityId = randomUUID();
  const organizationId = randomUUID();
  const roleId = randomUUID();
  let workspaceId = "";
  let outsideGeographyId = "";
  let crosswalkId = "";
  try {
    await registerCpcbSwmRoutes(app, pool);
    await app.ready();
    await pool.query("insert into identities(id,display_name) values($1,$2)", [identityId, "CPCB SWM integration " + suffix]);
    await pool.query("insert into organizations(id,name,organization_type) values($1,$2,$3)", [organizationId, "CPCB SWM integration " + suffix, "TEST_FIXTURE"]);
    await pool.query("insert into roles(id,organization_id,name,permissions) values($1,$2,$3,$4::jsonb)",
      [roleId, organizationId, "CPCB_SWM_INTEGRATION_TEST", JSON.stringify(["waste:record", "swm:read", "audit:read"])]);
    await pool.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')",
      [identityId, organizationId, roleId]);
    await pool.query("insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2)",
      [identityId, hash(token)]);

    await assert.rejects(
      pool.query(
        "insert into cpcb_swm_stakeholder_workspaces(organization_id,stakeholder_type,title,created_by_identity_id,updated_by_identity_id) values($1,'BWG',$2,$3,$3)",
        [organizationId, "Direct database null geography attempt " + suffix, identityId],
      ),
      /SWM_WORKSPACE_GEOGRAPHY_REQUIRED/,
      "database trigger must reject direct insertion without geography",
    );

    const headers = { authorization: "Bearer " + token, "x-rupaykg-organization-id": organizationId };
    const geography = await pool.query<{ id: string }>("select id from geography where kind='CLUSTER' and code='RUPAYKG-ACCEPTANCE-V1'");
    assert.ok(geography.rows[0]?.id, "opt-in acceptance geography fixture must be installed");
    const geographyId = geography.rows[0]!.id;
    await assert.rejects(
      pool.query(
        `insert into government_jurisdiction_crosswalks
          (authority_code,municipal_code,source_version,organization_id,geography_id,evidence_reference,evidence_sha256,
           requested_by_identity_id,approved_by_identity_id,approval_reason,status,effective_from,verified_at)
         values('SYNTHETIC_AUTHORITY','SYNTHETIC-MUNICIPAL-CODE','v1',$1,$2,'synthetic://unapproved-crosswalk',$3,
           $4,$4,'Synthetic direct approval bypass attempt','VERIFIED',now(),now())`,
        [organizationId, geographyId, hash("synthetic unapproved geography crosswalk"), identityId],
      ),
      /GOVERNMENT_CROSSWALK_REQUIRES_DUAL_CONTROL/,
      "database must reject a VERIFIED government geography crosswalk without an approved dual-control request",
    );

    const checklist = initialSwmChecklist("BWG").map(item => ({ ...item, status: "MISSING" }));
    const payload = {
      stakeholderType: "BWG",
      geographyId,
      title: "Synthetic BWG workspace " + suffix,
      checklist,
      eligibilityObservations: {
        floorAreaM2: { value: null, unit: "m2", sourceReference: "", periodStart: "", periodEnd: "" },
        waterConsumptionLitresPerDay: { value: 40000, unit: "L/day", sourceReference: "synthetic://water-bill", periodStart: "2026-09-01", periodEnd: "2026-09-30" },
        wasteGenerationKgPerDay: { value: 100, unit: "kg/day", sourceReference: "synthetic://weighbridge", periodStart: "2026-09-01", periodEnd: "2026-09-30" },
      },
    };

    await pool.query("update roles set permissions='[]'::jsonb where id=$1", [roleId]);
    const denied = await app.inject({ method: "POST", url: "/api/v1/cpcb-swm/workspaces", headers, payload });
    assert.equal(denied.statusCode, 403, denied.body);
    const absent = await pool.query("select count(*)::int count from cpcb_swm_stakeholder_workspaces where organization_id=$1", [organizationId]);
    assert.equal(absent.rows[0]?.count, 0, "unauthorized workspace creation must not persist data");

    await pool.query("update roles set permissions=$2::jsonb where id=$1", [roleId, JSON.stringify(["waste:record", "swm:read", "audit:read"])]);
    const invalidClaim = await app.inject({
      method: "POST", url: "/api/v1/cpcb-swm/workspaces", headers,
      payload: { ...payload, cpcbReportedStatus: "CPCB_APPROVED", cpcbStatusSourceReference: "synthetic://claimed" },
    });
    assert.equal(invalidClaim.statusCode, 400, invalidClaim.body);

    const missingMapping = await app.inject({ method: "POST", url: "/api/v1/cpcb-swm/workspaces", headers, payload });
    assert.equal(missingMapping.statusCode, 403, missingMapping.body);
    assert.equal(missingMapping.json().code, "SWM_STAKEHOLDER_AUTHORIZATION_REQUIRED");
    const absentMapping = await pool.query("select count(*)::int count from organization_stakeholder_authorizations where organization_id=$1", [organizationId]);
    assert.equal(absentMapping.rows[0]?.count, 0, "no organization-to-stakeholder mapping must fail closed");

    await pool.query("update organizations set verification_status='VERIFIED',verified_at=now(),verified_by_identity_id=$2 where id=$1", [organizationId, identityId]);
    await assert.rejects(
      pool.query(
        "insert into organization_stakeholder_authorizations(organization_id,stakeholder_type,status,evidence_reference,evidence_sha256,verified_by_identity_id,verified_at) values($1,'BWG','VERIFIED','synthetic://bypass-attempt',$2,$3,now())",
        [organizationId, hash("synthetic bypass attempt"), identityId],
      ),
      /STAKEHOLDER_AUTHORIZATION_REQUIRES_DUAL_CONTROL/,
      "database must reject a verified mapping without an approved dual-control request",
    );
    const requesterId = randomUUID();
    await pool.query("insert into identities(id,display_name) values($1,$2)", [requesterId, "Synthetic independent requester " + suffix]);
    const approvalRequest = await pool.query<{ id: string }>(
      `insert into organization_stakeholder_authorization_requests
        (organization_id,stakeholder_type,status,evidence_reference,evidence_sha256,request_reason,request_hash,requested_by_identity_id,decided_by_identity_id,decision_reason,decided_at,applied_at)
       values($1,'BWG','APPROVED','synthetic://organization-type-approval',$2,'Synthetic test-only approval fixture',$3,$4,$5,'Synthetic independent test decision',now(),now()) returning id`,
      [organizationId, hash("synthetic organization stakeholder authorization"), hash("synthetic dual-control test request"), requesterId, identityId],
    );
    await pool.query(
      "insert into organization_stakeholder_authorizations(organization_id,stakeholder_type,status,evidence_reference,evidence_sha256,verified_by_identity_id,verified_at,approval_request_id) values($1,'BWG','VERIFIED','synthetic://organization-type-approval',$2,$3,now(),$4)",
      [organizationId, hash("synthetic organization stakeholder authorization"), identityId, approvalRequest.rows[0]!.id],
    );
    const wrongStakeholderPayload = {
      ...payload,
      stakeholderType: "PROCESSOR",
      checklist: initialSwmChecklist("PROCESSOR").map(item => ({ ...item, status: "MISSING" })),
    };
    const wrongStakeholder = await app.inject({ method: "POST", url: "/api/v1/cpcb-swm/workspaces", headers, payload: wrongStakeholderPayload });
    assert.equal(wrongStakeholder.statusCode, 403, wrongStakeholder.body);
    assert.equal(wrongStakeholder.json().code, "SWM_STAKEHOLDER_AUTHORIZATION_REQUIRED");

    const missingGeography = await app.inject({
      method: "POST", url: "/api/v1/cpcb-swm/workspaces", headers,
      payload: { ...payload, geographyId: undefined },
    });
    assert.equal(missingGeography.statusCode, 400, missingGeography.body);
    assert.equal(missingGeography.json().code, "SWM_WORKSPACE_INVALID");

    const unscopedOrganization = await app.inject({ method: "POST", url: "/api/v1/cpcb-swm/workspaces", headers, payload });
    assert.equal(unscopedOrganization.statusCode, 403, unscopedOrganization.body);
    assert.equal(unscopedOrganization.json().code, "GEOGRAPHY_FORBIDDEN", "an organization with no verified geography root must fail closed");

    const strictScopeBeforeProvisioning = await pool.query<{ ok: boolean }>(
      "select organization_has_explicit_geography_scope($1,$2) as ok",
      [organizationId, geographyId],
    );
    assert.equal(strictScopeBeforeProvisioning.rows[0]?.ok, false, "strict helper must not inherit the legacy no-root allow fallback");

    await pool.query("insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')", [organizationId, geographyId]);
    const strictScopeInsideRoot = await pool.query<{ ok: boolean }>(
      "select organization_has_explicit_geography_scope($1,$2) as ok",
      [organizationId, geographyId],
    );
    assert.equal(strictScopeInsideRoot.rows[0]?.ok, true, "strict helper must authorize a geography under an explicit verified root");

    const pendingCrosswalk = await pool.query<{ id: string }>(
      `insert into government_jurisdiction_crosswalks
        (authority_code,municipal_code,source_version,organization_id,geography_id,status,evidence_reference,evidence_sha256,requested_by_identity_id,effective_from)
       values('TEST-AUTHORITY','TEST-MUNICIPAL','synthetic-v1',$1,$2,'PENDING','synthetic://crosswalk-test',$3,$4,now()-interval '1 day')
       returning id`,
      [organizationId, geographyId, hash("synthetic crosswalk evidence"), identityId],
    );
    crosswalkId = pendingCrosswalk.rows[0]!.id;
    await assert.rejects(
      pool.query(
        "update government_jurisdiction_crosswalks set status='VERIFIED', approved_by_identity_id=$2, approval_reason='Synthetic same-actor attempt', verified_at=now() where id=$1",
        [crosswalkId, identityId],
      ),
      /GOVERNMENT_CROSSWALK_VERIFICATION_INVALID/,
      "crosswalk verification must reject same-actor approval",
    );
    const outsideGeography = await pool.query<{ id: string }>(
      "insert into geography(kind,code,name,source,source_version) values('CLUSTER',$1,$2,'RupayKG synthetic integration test','v1') returning id",
      ["TEST-OUTSIDE-" + suffix, "Synthetic out-of-scope geography " + suffix],
    );
    outsideGeographyId = outsideGeography.rows[0]!.id;
    const strictScopeOutsideRoot = await pool.query<{ ok: boolean }>(
      "select organization_has_explicit_geography_scope($1,$2) as ok",
      [organizationId, outsideGeographyId],
    );
    assert.equal(strictScopeOutsideRoot.rows[0]?.ok, false, "strict helper must reject unrelated geographies even when a root exists");
    await assert.rejects(
      pool.query(
        "insert into cpcb_swm_stakeholder_workspaces(organization_id,geography_id,stakeholder_type,title,created_by_identity_id,updated_by_identity_id) values($1,$2,'BWG',$3,$4,$4)",
        [organizationId, outsideGeographyId, "Direct database out-of-scope geography attempt " + suffix, identityId],
      ),
      /SWM_WORKSPACE_GEOGRAPHY_FORBIDDEN/,
      "database trigger must reject direct insertion into unrelated geography",
    );
    const outOfScope = await app.inject({
      method: "POST", url: "/api/v1/cpcb-swm/workspaces", headers,
      payload: { ...payload, geographyId: outsideGeography.rows[0]!.id },
    });
    assert.equal(outOfScope.statusCode, 403, outOfScope.body);
    assert.equal(outOfScope.json().code, "GEOGRAPHY_FORBIDDEN", "verified geography root must not authorize unrelated geography");

    const created = await app.inject({ method: "POST", url: "/api/v1/cpcb-swm/workspaces", headers, payload });
    assert.equal(created.statusCode, 201, created.body);
    assert.equal(created.json().workspace.cpcb_status_claim, "USER_REPORTED_UNVERIFIED");
    assert.equal(created.json().workspace.cpcb_reported_status, "NOT_REPORTED");
    workspaceId = created.json().workspace.id;
    const persisted = await pool.query<{ id: string; cpcb_status_claim: string; cpcb_reported_status: string; local_workflow_stage: string }>(
      "select id,cpcb_status_claim,cpcb_reported_status,local_workflow_stage from cpcb_swm_stakeholder_workspaces where id=$1 and organization_id=$2",
      [workspaceId, organizationId],
    );
    assert.deepEqual(persisted.rows[0], {
      id: workspaceId,
      cpcb_status_claim: "USER_REPORTED_UNVERIFIED",
      cpcb_reported_status: "NOT_REPORTED",
      local_workflow_stage: "LOCAL_PREPARATION",
    });

    const listed = await app.inject({ method: "GET", url: "/api/v1/cpcb-swm/workspaces", headers });
    assert.equal(listed.statusCode, 200, listed.body);
    assert.ok(listed.json().workspaces.some((workspace: { id: string }) => workspace.id === workspaceId));

    const audit = await pool.query<{ action: string; event_hash: string | null }>(
      "select action,event_hash from audit_events where actor_identity_id=$1 and organization_id=$2 and target_id=$3",
      [identityId, organizationId, workspaceId],
    );
    assert.equal(audit.rows.length, 1);
    assert.equal(audit.rows[0]?.action, "CPCB_SWM_WORKSPACE_CREATED");
    assert.ok(audit.rows[0]?.event_hash, "workspace creation must append a hash-chained audit event");
    const head = await pool.query<{ last_event_hash: string | null }>("select last_event_hash from platform_audit_chain_head where singleton=true");
    assert.equal(head.rows[0]?.last_event_hash, audit.rows[0]?.event_hash, "authoritative audit head must point to workspace event");
  } finally {
    await app.close();
    if (workspaceId) await pool.query("delete from cpcb_swm_status_history where workspace_id=$1", [workspaceId]).catch(() => undefined);
    if (workspaceId) await pool.query("delete from cpcb_swm_stakeholder_workspaces where id=$1", [workspaceId]).catch(() => undefined);
    await pool.query("delete from organization_geography_scopes where organization_id=$1", [organizationId]).catch(() => undefined);
    if (crosswalkId) await pool.query("delete from government_jurisdiction_crosswalks where id=$1", [crosswalkId]).catch(() => undefined);
    if (outsideGeographyId) await pool.query("delete from geography where id=$1", [outsideGeographyId]).catch(() => undefined);
    await pool.query("delete from identity_sessions where identity_id=$1", [identityId]).catch(() => undefined);
    await pool.query("delete from organization_memberships where identity_id=$1 and organization_id=$2", [identityId, organizationId]).catch(() => undefined);
    await pool.query("delete from roles where id=$1", [roleId]).catch(() => undefined);
    // Keep the synthetic identity and organization because the append-only audit event references them.
    await pool.end();
  }
});
