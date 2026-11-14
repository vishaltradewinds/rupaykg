import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

test("CPCB status history cannot be attributed to another organization's workspace", async () => {
  if (!databaseUrl) return;
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  const suffix = randomUUID();
  let orgA = "";
  let orgB = "";
  let identityId = "";
  let workspaceId = "";
  try {
    await client.query("begin");
    orgA = (await client.query<{ id: string }>(
      "insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id",
      [`cpcb-tenant-a-${suffix}`],
    )).rows[0]!.id;
    orgB = (await client.query<{ id: string }>(
      "insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id",
      [`cpcb-tenant-b-${suffix}`],
    )).rows[0]!.id;
    identityId = (await client.query<{ id: string }>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id",
      [`cpcb-tenant-actor-${suffix}`, "CPCB Tenant Integrity Test"],
    )).rows[0]!.id;
    workspaceId = (await client.query<{ id: string }>(
      "insert into cpcb_swm_stakeholder_workspaces(organization_id,stakeholder_type,title,created_by_identity_id,updated_by_identity_id) values($1,'ULB',$2,$3,$3) returning id",
      [orgA, `CPCB workspace ${suffix}`, identityId],
    )).rows[0]!.id;

    await client.query(
      "insert into cpcb_swm_status_history(workspace_id,organization_id,previous_reported_status,reported_status,actor_identity_id) values($1,$2,'NOT_REPORTED','DRAFT',$3)",
      [workspaceId, orgA, identityId],
    );

    await assert.rejects(
      client.query(
        "insert into cpcb_swm_status_history(workspace_id,organization_id,previous_reported_status,reported_status,actor_identity_id) values($1,$2,'DRAFT','UNDER_REVIEW',$3)",
        [workspaceId, orgB, identityId],
      ),
      (error: { code?: string; constraint?: string }) =>
        error.code === "23503" && error.constraint === "cpcb_swm_status_history_workspace_org_fk",
    );
    await client.query("rollback");
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});
