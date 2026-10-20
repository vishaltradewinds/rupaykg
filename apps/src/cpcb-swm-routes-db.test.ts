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

    const headers = { authorization: "Bearer " + token, "x-rupaykg-organization-id": organizationId };
    const checklist = initialSwmChecklist("BWG").map(item => ({ ...item, status: "MISSING" }));
    const payload = {
      stakeholderType: "BWG",
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
    await pool.query("delete from identity_sessions where identity_id=$1", [identityId]).catch(() => undefined);
    await pool.query("delete from organization_memberships where identity_id=$1 and organization_id=$2", [identityId, organizationId]).catch(() => undefined);
    await pool.query("delete from roles where id=$1", [roleId]).catch(() => undefined);
    // Keep the synthetic identity and organization because the append-only audit event references them.
    await pool.end();
  }
});
