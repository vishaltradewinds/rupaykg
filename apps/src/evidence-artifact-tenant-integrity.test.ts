import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

test("evidence vault enforces activity, organization, series and version ownership", async () => {
  if (!databaseUrl) return;
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  const suffix = randomUUID();
  const ids: Record<string, string> = {};
  const expectFk = async (name: string, sql: string, values: unknown[]) => {
    await client.query("savepoint " + name);
    await assert.rejects(
      client.query(sql, values),
      (error: { code?: string }) => error.code === "23503",
    );
    await client.query("rollback to savepoint " + name);
    await client.query("release savepoint " + name);
  };
  try {
    await client.query("begin");
    for (const key of ["orgA", "orgB"]) {
      ids[key] = (await client.query<{id:string}>(
        "insert into organizations(name,organization_type) values($1,'COLLECTOR') returning id",
        [`evidence-tenant-${key}-${suffix}`],
      )).rows[0]!.id;
    }
    ids.actor = (await client.query<{id:string}>(
      "insert into identities(external_subject,display_name) values($1,$2) returning id",
      [`evidence-tenant-actor-${suffix}`, "Evidence Tenant Test"],
    )).rows[0]!.id;
    for (const key of ["activityA", "activityB"]) {
      const org = key === "activityA" ? ids.orgA : ids.orgB;
      ids[key] = (await client.query<{id:string}>(
        "insert into activities(organization_id,activity_type) values($1,'WASTE_PROCESSING') returning id",
        [org],
      )).rows[0]!.id;
    }
    ids.seriesA = (await client.query<{id:string}>(
      "insert into evidence_artifact_series(organization_id,activity_id,evidence_type,created_by_identity_id) values($1,$2,'WEIGHBRIDGE',$3) returning id",
      [ids.orgA, ids.activityA, ids.actor],
    )).rows[0]!.id;
    ids.evidenceA = (await client.query<{id:string}>(
      "insert into evidence(activity_id,evidence_type,status,captured_at,content_uri,content_hash) values($1,'WEIGHBRIDGE','CAPTURED',now(),'test://a',$2) returning id",
      [ids.activityA, "a".repeat(64)],
    )).rows[0]!.id;
    ids.evidenceA2 = (await client.query<{id:string}>(
      "insert into evidence(activity_id,evidence_type,status,captured_at,content_uri,content_hash) values($1,'WEIGHBRIDGE','CAPTURED',now(),'test://a2',$2) returning id",
      [ids.activityA, "c".repeat(64)],
    )).rows[0]!.id;
    ids.evidenceB = (await client.query<{id:string}>(
      "insert into evidence(activity_id,evidence_type,status,captured_at,content_uri,content_hash) values($1,'WEIGHBRIDGE','CAPTURED',now(),'test://b',$2) returning id",
      [ids.activityB, "b".repeat(64)],
    )).rows[0]!.id;
    ids.versionA = (await client.query<{id:string}>(
      "insert into evidence_artifact_versions(series_id,evidence_id,activity_id,version_number,file_name,media_type,size_bytes,sha256,content,uploaded_by_identity_id) values($1,$2,$3,1,'a.txt','text/plain',1,$4,$5,$6) returning id",
      [ids.seriesA, ids.evidenceA, ids.activityA, "a".repeat(64), Buffer.from("a"), ids.actor],
    )).rows[0]!.id;

    await expectFk("wrong_series_activity",
      "insert into evidence_artifact_versions(series_id,evidence_id,activity_id,version_number,file_name,media_type,size_bytes,sha256,content,uploaded_by_identity_id) values($1,$2,$3,2,'b.txt','text/plain',1,$4,$5,$6)",
      [ids.seriesA, ids.evidenceA2, ids.activityB, "c".repeat(64), Buffer.from("b"), ids.actor],
    );
    await expectFk("wrong_evidence_activity",
      "insert into evidence_artifact_versions(series_id,evidence_id,activity_id,version_number,file_name,media_type,size_bytes,sha256,content,uploaded_by_identity_id) values($1,$2,$3,2,'b.txt','text/plain',1,$4,$5,$6)",
      [ids.seriesA, ids.evidenceB, ids.activityA, "b".repeat(64), Buffer.from("b"), ids.actor],
    );
    await client.query(
      "insert into evidence_artifact_reviews(evidence_id,artifact_version_id,reviewer_identity_id,decision,rationale) values($1,$2,$3,'APPROVED','Valid same-tenant evidence')",
      [ids.evidenceA, ids.versionA, ids.actor],
    );
    await expectFk("wrong_review_evidence",
      "insert into evidence_artifact_reviews(evidence_id,artifact_version_id,reviewer_identity_id,decision,rationale) values($1,$2,$3,'APPROVED','Cross-evidence reference rejected')",
      [ids.evidenceB, ids.versionA, ids.actor],
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
