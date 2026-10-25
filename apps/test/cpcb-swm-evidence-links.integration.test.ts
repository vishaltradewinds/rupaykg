import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import test from "node:test";

const testDatabaseUrl = process.env.RUPAYKG_TEST_DATABASE_URL;

test("PostgreSQL rejects cross-tenant and mismatched evidence-version links and keeps links append-only", {
  skip: !testDatabaseUrl ? "RUPAYKG_TEST_DATABASE_URL must point to an isolated migrated test database" : false,
}, async () => {
  const pool = new Pool({ connectionString: testDatabaseUrl, ssl: false, max: 2 });
  const client = await pool.connect();
  try {
    await client.query("begin");
    const orgA = (await client.query<{id:string}>(
      "insert into organizations(name,organization_type) values($1,'TEST') returning id", ["CPCB Evidence Test A"],
    )).rows[0]!.id;
    const orgB = (await client.query<{id:string}>(
      "insert into organizations(name,organization_type) values($1,'TEST') returning id", ["CPCB Evidence Test B"],
    )).rows[0]!.id;
    const identityId = (await client.query<{id:string}>(
      "insert into identities(display_name) values('CPCB Evidence Test Identity') returning id",
    )).rows[0]!.id;
    const activityA = (await client.query<{id:string}>(
      "insert into activities(organization_id,actor_identity_id,activity_type) values($1,$2,'TEST') returning id",
      [orgA, identityId],
    )).rows[0]!.id;
    const activityB = (await client.query<{id:string}>(
      "insert into activities(organization_id,actor_identity_id,activity_type) values($1,$2,'TEST') returning id",
      [orgB, identityId],
    )).rows[0]!.id;
    const evidenceA = (await client.query<{id:string}>(
      "insert into evidence(activity_id,evidence_type,captured_at,content_hash) values($1,'TEST',now(),$2) returning id",
      [activityA, "a".repeat(64)],
    )).rows[0]!.id;
    const evidenceB = (await client.query<{id:string}>(
      "insert into evidence(activity_id,evidence_type,captured_at,content_hash) values($1,'TEST',now(),$2) returning id",
      [activityA, "b".repeat(64)],
    )).rows[0]!.id;
    const workspaceId = (await client.query<{id:string}>(
      "insert into cpcb_swm_stakeholder_workspaces(organization_id,stakeholder_type,title,created_by_identity_id,updated_by_identity_id) values($1,'ULB','Tenant A workspace',$2,$2) returning id",
      [orgA, identityId],
    )).rows[0]!.id;
    const seriesId = (await client.query<{id:string}>(
      "insert into evidence_artifact_series(organization_id,activity_id,evidence_type,created_by_identity_id) values($1,$2,'TEST',$3) returning id",
      [orgA, activityA, identityId],
    )).rows[0]!.id;
    const versionId = (await client.query<{id:string}>(
      "insert into evidence_artifact_versions(series_id,evidence_id,version_number,file_name,media_type,size_bytes,sha256,content,uploaded_by_identity_id) values($1,$2,1,'test.txt','text/plain',1,$3,$4,$5) returning id",
      [seriesId, evidenceA, "a".repeat(64), Buffer.from("x"), identityId],
    )).rows[0]!.id;

    const linkId = (await client.query<{id:string}>(
      "insert into cpcb_swm_workspace_evidence(workspace_id,organization_id,evidence_id,artifact_version_id,checklist_key,linked_by_identity_id) values($1,$2,$3,$4,'supporting_documents',$5) returning id",
      [workspaceId, orgA, evidenceA, versionId, identityId],
    )).rows[0]!.id;
    assert.ok(linkId);

    await client.query("savepoint tenant_guard");
    await assert.rejects(
      client.query(
        "insert into cpcb_swm_workspace_evidence(workspace_id,organization_id,evidence_id,artifact_version_id,checklist_key,linked_by_identity_id) values($1,$2,$3,$4,'cross_tenant',$5)",
        [workspaceId, orgB, evidenceA, versionId, identityId],
      ),
    );
    await client.query("rollback to savepoint tenant_guard");
    await client.query("release savepoint tenant_guard");

    await client.query("savepoint version_guard");
    await assert.rejects(
      client.query(
        "insert into cpcb_swm_workspace_evidence(workspace_id,organization_id,evidence_id,artifact_version_id,checklist_key,linked_by_identity_id) values($1,$2,$3,$4,'mismatched_version',$5)",
        [workspaceId, orgA, evidenceB, versionId, identityId],
      ),
    );
    await client.query("rollback to savepoint version_guard");
    await client.query("release savepoint version_guard");

    await client.query("savepoint update_guard");
    await assert.rejects(
      client.query("update cpcb_swm_workspace_evidence set checklist_key='changed_key' where id=$1", [linkId]),
      /append-only/,
    );
    await client.query("rollback to savepoint update_guard");
    await client.query("release savepoint update_guard");

    await client.query("savepoint delete_guard");
    await assert.rejects(
      client.query("delete from cpcb_swm_workspace_evidence where id=$1", [linkId]),
      /append-only/,
    );
    await client.query("rollback to savepoint delete_guard");
    await client.query("release savepoint delete_guard");

    // Keep the second activity referenced so this fixture also proves cross-org rows exist.
    assert.ok(activityB);
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
    await pool.end();
  }
});
