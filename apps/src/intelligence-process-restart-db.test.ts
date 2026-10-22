import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
type Fixture = {
  identityId: string; organizationId: string; roleId: string; geographyId: string; activityId: string;
  token: string; idempotencyKey: string;
};

async function createFixture(pool: Pool): Promise<Fixture> {
  const f: Fixture = {
    identityId: randomUUID(), organizationId: randomUUID(), roleId: randomUUID(),
    geographyId: randomUUID(), activityId: randomUUID(), token: randomBytes(32).toString("base64url"),
    idempotencyKey: `os-process-restart-${randomUUID()}`,
  };
  await pool.query("insert into identities(id,display_name) values($1,$2)", [f.identityId, "AI intake OS process restart synthetic"]);
  await pool.query("insert into organizations(id,name,organization_type) values($1,$2,$3)", [f.organizationId, "AI intake OS process restart synthetic", "TEST_FIXTURE"]);
  await pool.query("insert into roles(id,organization_id,name,permissions) values($1,$2,$3,$4::jsonb)",
    [f.roleId, f.organizationId, "AI_INTAKE_OS_PROCESS_RESTART_TEST", JSON.stringify(["evidence:upload"])]);
  await pool.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')",
    [f.identityId, f.organizationId, f.roleId]);
  await pool.query("insert into geography(id,kind,name) values($1,'STATE_UT',$2)", [f.geographyId, "AI intake OS restart synthetic geography"]);
  await pool.query("insert into organization_geography_scopes(organization_id,geography_id,status) values($1,$2,'VERIFIED')", [f.organizationId, f.geographyId]);
  await pool.query("insert into activities(id,organization_id,actor_identity_id,geography_id,activity_type) values($1,$2,$3,$4,$5)",
    [f.activityId, f.organizationId, f.identityId, f.geographyId, "WASTE_MEASUREMENT"]);
  await pool.query("insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2)",
    [f.identityId, createHash("sha256").update(f.token).digest("hex")]);
  return f;
}

async function cleanFixture(pool: Pool, f: Fixture): Promise<void> {
  await pool.query("delete from ai_evidence_intake_jobs where identity_id=$1 and organization_id=$2", [f.identityId, f.organizationId]).catch(() => undefined);
  await pool.query(`delete from evidence_artifact_versions where series_id in
    (select id from evidence_artifact_series where organization_id=$1 and activity_id=$2)`, [f.organizationId, f.activityId]).catch(() => undefined);
  await pool.query("delete from evidence where activity_id=$1", [f.activityId]).catch(() => undefined);
  await pool.query("delete from evidence_artifact_series where organization_id=$1 and activity_id=$2", [f.organizationId, f.activityId]).catch(() => undefined);
  await pool.query("delete from identity_sessions where identity_id=$1", [f.identityId]).catch(() => undefined);
  await pool.query("delete from organization_memberships where identity_id=$1 and organization_id=$2", [f.identityId, f.organizationId]).catch(() => undefined);
  await pool.query("delete from activities where id=$1", [f.activityId]).catch(() => undefined);
  await pool.query("delete from roles where id=$1", [f.roleId]).catch(() => undefined);
  await pool.query("delete from organization_geography_scopes where organization_id=$1", [f.organizationId]).catch(() => undefined);
  await pool.query("delete from geography where id=$1", [f.geographyId]).catch(() => undefined);
  await pool.query("delete from identities where id=$1", [f.identityId]).catch(() => undefined);
  await pool.query("delete from organizations where id=$1", [f.organizationId]).catch(() => undefined);
}

test("AI intake recovers across separate OS processes using the durable PostgreSQL idempotency ledger", {
  skip: !enabled ? "requires CI disposable PostgreSQL and applied migrations" : false,
}, async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 8,
  });
  let fixture: Fixture | undefined;
  try {
    fixture = await createFixture(pool);
    const harness = fileURLToPath(new URL("./intelligence-process-restart-harness.js", import.meta.url));
    const runPhase = (phase: "first" | "second", sourceEvidenceId?: string) => {
      const stdout = execFileSync(process.execPath, [harness, phase], {
        encoding: "utf8",
        timeout: 30_000,
        env: {
          ...process.env,
          RUPAYKG_PROCESS_RESTART_FIXTURE: JSON.stringify(fixture),
          ...(sourceEvidenceId ? { RUPAYKG_PROCESS_RESTART_SOURCE_ID: sourceEvidenceId } : {}),
        },
      });
      const resultLine = stdout.trim().split("\n").at(-1);
      assert.ok(resultLine, `phase ${phase} emitted no result`);
      return JSON.parse(resultLine) as { phase: string; sourceEvidenceId?: string; recovered?: boolean };
    };
    const first = runPhase("first");
    assert.equal(first.phase, "first");
    assert.ok(first.sourceEvidenceId, "first OS process must persist source evidence before provider failure");
    const second = runPhase("second", first.sourceEvidenceId);
    assert.equal(second.phase, "second");
    assert.equal(second.recovered, true);
  } finally {
    if (fixture) await cleanFixture(pool, fixture);
    await pool.end();
  }
});
