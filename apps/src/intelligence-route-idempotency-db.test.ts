import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { registerIntelligenceRoutes, type WasteLogExtractionProvider } from "./intelligence-routes.js";

const enabled = process.env.RUPAYKG_RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const validExtraction = {
  recordType: "WASTE_MEASUREMENT",
  observedAt: "2026-10-19T08:30:00Z",
  quantity: 125.5,
  unit: "kg",
  wasteStream: "WET",
  facilityReference: "FAC-TEST",
  notes: "Synthetic integration fixture",
  confidence: 0.8,
  warnings: [],
};

type Fixture = {
  identityId: string; organizationId: string; roleId: string; geographyId: string; activityId: string;
  token: string; idempotencyKey: string;
};

async function createFixture(pool: Pool): Promise<Fixture> {
  const fixture: Fixture = {
    identityId: randomUUID(), organizationId: randomUUID(), roleId: randomUUID(),
    geographyId: randomUUID(), activityId: randomUUID(), token: randomBytes(32).toString("base64url"),
    idempotencyKey: `http-intake-${randomUUID()}`,
  };
  await pool.query("insert into identities(id, display_name) values($1,$2)", [fixture.identityId, "AI intake HTTP integration"]);
  await pool.query("insert into organizations(id,name,organization_type) values($1,$2,$3)", [fixture.organizationId, "AI intake HTTP integration", "TEST_FIXTURE"]);
  await pool.query("insert into roles(id,organization_id,name,permissions) values($1,$2,$3,$4::jsonb)",
    [fixture.roleId, fixture.organizationId, "AI_INTAKE_TEST", JSON.stringify(["evidence:upload"])]);
  await pool.query("insert into organization_memberships(identity_id,organization_id,role_id,status) values($1,$2,$3,'VERIFIED')",
    [fixture.identityId, fixture.organizationId, fixture.roleId]);
  await pool.query("insert into geography(id,kind,name) values($1,'STATE_UT',$2)", [fixture.geographyId, "AI intake synthetic geography"]);
  await pool.query("insert into activities(id,organization_id,actor_identity_id,geography_id,activity_type) values($1,$2,$3,$4,$5)",
    [fixture.activityId, fixture.organizationId, fixture.identityId, fixture.geographyId, "WASTE_MEASUREMENT"]);
  await pool.query("insert into identity_sessions(identity_id,expires_at,token_hash) values($1,now()+interval '1 hour',$2)",
    [fixture.identityId, createHash("sha256").update(fixture.token).digest("hex")]);
  return fixture;
}

async function cleanFixture(pool: Pool, fixture: Fixture): Promise<void> {
  await pool.query("delete from ai_evidence_intake_jobs where identity_id=$1 and organization_id=$2", [fixture.identityId, fixture.organizationId]).catch(() => undefined);
  await pool.query("delete from ai_intake_rate_limits where identity_id=$1 and organization_id=$2", [fixture.identityId, fixture.organizationId]).catch(() => undefined);
  await pool.query(
    `delete from evidence_artifact_versions where series_id in
       (select id from evidence_artifact_series where organization_id=$1 and activity_id=$2)`,
    [fixture.organizationId, fixture.activityId],
  ).catch(() => undefined);
  await pool.query("delete from evidence where activity_id=$1", [fixture.activityId]).catch(() => undefined);
  await pool.query("delete from evidence_artifact_series where organization_id=$1 and activity_id=$2", [fixture.organizationId, fixture.activityId]).catch(() => undefined);
  await pool.query("delete from identity_sessions where identity_id=$1", [fixture.identityId]).catch(() => undefined);
  await pool.query("delete from organization_memberships where identity_id=$1 and organization_id=$2", [fixture.identityId, fixture.organizationId]).catch(() => undefined);
  await pool.query("delete from activities where id=$1", [fixture.activityId]).catch(() => undefined);
  await pool.query("delete from roles where id=$1", [fixture.roleId]).catch(() => undefined);
  await pool.query("delete from organization_geography_scopes where organization_id=$1", [fixture.organizationId]).catch(() => undefined);
  await pool.query("delete from geography where id=$1", [fixture.geographyId]).catch(() => undefined);
  await pool.query("delete from identities where id=$1", [fixture.identityId]).catch(() => undefined);
  await pool.query("delete from organizations where id=$1", [fixture.organizationId]).catch(() => undefined);
}

async function withIntakeServer(
  pool: Pool,
  provider: WasteLogExtractionProvider,
  run: (app: ReturnType<typeof Fastify>, fixture: Fixture) => Promise<void>,
): Promise<void> {
  const fixture = await createFixture(pool);
  const app = Fastify();
  try {
    await registerIntelligenceRoutes(app, pool, provider);
    await app.ready();
    await run(app, fixture);
  } finally {
    await app.close();
    await cleanFixture(pool, fixture);
  }
}

function payload(fixture: Fixture, rawLog = "Synthetic scale log: net weight 125.5 kg"): Record<string, string> {
  return { activityId: fixture.activityId, sourceReference: "synthetic-fixture.txt", rawLog };
}

function post(app: ReturnType<typeof Fastify>, fixture: Fixture, body: Record<string, string>) {
  return app.inject({
    method: "POST",
    url: "/api/v1/intelligence/evidence-intake",
    headers: { authorization: `Bearer ${fixture.token}`, "idempotency-key": fixture.idempotencyKey },
    payload: body,
  });
}

test("AI intake HTTP idempotency replays success, rejects changed content, and deduplicates concurrent requests", {
  skip: !enabled ? "requires CI disposable PostgreSQL and applied migrations" : false,
}, async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 8,
  });
  try {
    await withIntakeServer(pool, {
      providerId: "synthetic-test-provider", modelId: "fixture-model", promptVersion: "fixture-v1",
      extract: async () => validExtraction,
    }, async (app, fixture) => {
      const body = payload(fixture);
      const concurrent = await Promise.all([post(app, fixture, body), post(app, fixture, body)]);
      assert.ok(concurrent.every((r) => [201, 200, 202].includes(r.statusCode)), concurrent.map((r) => r.body).join("\n"));
      assert.equal(concurrent.filter((r) => r.statusCode === 201).length, 1, "only one request may create a proposal");
      const replay = await post(app, fixture, body);
      assert.equal(replay.statusCode, 200);
      assert.equal(replay.json().idempotentReplay, true);
      const changed = await post(app, fixture, payload(fixture, "Changed source log: net weight 999 kg"));
      assert.equal(changed.statusCode, 409);
      assert.equal(changed.json().code, "AI_INTAKE_IDEMPOTENCY_CONFLICT");
      const counts = await pool.query<{ source_count: string; proposal_count: string }>(
        `select count(*) filter(where evidence_type='AI_SOURCE_LOG')::text source_count,
                count(*) filter(where evidence_type='AI_EXTRACTION_PROPOSAL')::text proposal_count
           from evidence where activity_id=$1`,
        [fixture.activityId],
      );
      assert.equal(counts.rows[0]!.source_count, "1", "same-key concurrent requests must store one source artifact");
      assert.equal(counts.rows[0]!.proposal_count, "1", "same-key concurrent requests must store one proposal artifact");
    });
  } finally {
    await pool.end();
  }
});

test("AI intake HTTP retries a provider failure without duplicating original source evidence", {
  skip: !enabled ? "requires CI disposable PostgreSQL and applied migrations" : false,
}, async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 8,
  });
  let calls = 0;
  try {
    await withIntakeServer(pool, {
      providerId: "synthetic-flaky-provider", modelId: "fixture-model", promptVersion: "fixture-v1",
      extract: async () => {
        calls += 1;
        if (calls === 1) throw new Error("synthetic transient provider failure");
        return validExtraction;
      },
    }, async (app, fixture) => {
      const body = payload(fixture);
      const failed = await post(app, fixture, body);
      assert.equal(failed.statusCode, 502);
      assert.equal(failed.json().code, "AI_EXTRACTION_FAILED");
      assert.ok(failed.json().sourceEvidenceId);
      const succeeded = await post(app, fixture, body);
      assert.equal(succeeded.statusCode, 201);
      assert.equal(calls, 2);
      assert.equal(succeeded.json().data.sourceEvidenceId, failed.json().sourceEvidenceId);
      const count = await pool.query<{ count: string }>(
        "select count(*)::text count from evidence where activity_id=$1 and evidence_type='AI_SOURCE_LOG'",
        [fixture.activityId],
      );
      assert.equal(count.rows[0]!.count, "1", "retry after provider failure must reuse source evidence");
    });
  } finally {
    await pool.end();
  }
});


test("AI intake recovers after Fastify instance restart using the durable idempotency ledger", {
  skip: !enabled ? "requires CI disposable PostgreSQL and applied migrations" : false,
}, async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 8,
  });
  const fixture = await createFixture(pool);
  let firstApp: ReturnType<typeof Fastify> | undefined;
  let restartedApp: ReturnType<typeof Fastify> | undefined;
  try {
    firstApp = Fastify();
    await registerIntelligenceRoutes(firstApp, pool, {
      providerId: "synthetic-restart-failure", modelId: "fixture-model", promptVersion: "fixture-v1",
      extract: async () => { throw new Error("synthetic failure before simulated restart"); },
    });
    await firstApp.ready();
    const first = await post(firstApp, fixture, payload(fixture));
    assert.equal(first.statusCode, 502);
    assert.ok(first.json().sourceEvidenceId);
    const sourceEvidenceId = first.json().sourceEvidenceId as string;

    // Close the first HTTP application instance, retaining only the database ledger.
    await firstApp.close();
    firstApp = undefined;

    restartedApp = Fastify();
    await registerIntelligenceRoutes(restartedApp, pool, {
      providerId: "synthetic-restart-recovery", modelId: "fixture-model", promptVersion: "fixture-v1",
      extract: async () => validExtraction,
    });
    await restartedApp.ready();
    const recovered = await post(restartedApp, fixture, payload(fixture));
    assert.equal(recovered.statusCode, 201);
    assert.equal(recovered.json().data.sourceEvidenceId, sourceEvidenceId);
    assert.equal(recovered.json().data.reviewStatus, "PENDING_HUMAN_REVIEW");
    assert.equal(recovered.json().data.authoritativeMutation, false);

    const counts = await pool.query<{ source_count: string; proposal_count: string }>(
      `select count(*) filter(where evidence_type='AI_SOURCE_LOG')::text source_count,
              count(*) filter(where evidence_type='AI_EXTRACTION_PROPOSAL')::text proposal_count
         from evidence where activity_id=$1`,
      [fixture.activityId],
    );
    assert.equal(counts.rows[0]!.source_count, "1", "restart recovery must reuse original source evidence");
    assert.equal(counts.rows[0]!.proposal_count, "1", "restart recovery must persist one proposal");
  } finally {
    await firstApp?.close().catch(() => undefined);
    await restartedApp?.close().catch(() => undefined);
    await cleanFixture(pool, fixture);
    await pool.end();
  }
});


test("AI intake rate limit does not leave empty durable jobs for denied unique keys", {
  skip: !enabled ? "requires CI disposable PostgreSQL and applied migrations" : false,
}, async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 8,
  });
  let providerCalls = 0;
  try {
    await withIntakeServer(pool, {
      providerId: "synthetic-rate-limit-provider", modelId: "fixture-model", promptVersion: "fixture-v1",
      extract: async () => { providerCalls += 1; return validExtraction; },
    }, async (app, fixture) => {
      for (let i = 0; i < 10; i += 1) {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/intelligence/evidence-intake",
          headers: { authorization: `Bearer ${fixture.token}`, "idempotency-key": `rate-limit-${i}-${randomUUID()}` },
          payload: payload(fixture, `Synthetic rate-limit fixture ${i}`),
        });
        assert.equal(response.statusCode, 201, response.body);
      }
      const denied = await app.inject({
        method: "POST",
        url: "/api/v1/intelligence/evidence-intake",
        headers: { authorization: `Bearer ${fixture.token}`, "idempotency-key": `rate-limit-denied-${randomUUID()}` },
        payload: payload(fixture, "Synthetic request beyond rate limit"),
      });
      assert.equal(denied.statusCode, 429);
      assert.equal(denied.json().code, "AI_INTAKE_RATE_LIMITED");
      const jobs = await pool.query<{ count: string }>(
        "select count(*)::text count from ai_evidence_intake_jobs where identity_id=$1 and organization_id=$2",
        [fixture.identityId, fixture.organizationId],
      );
      assert.equal(jobs.rows[0]?.count, "10", "rate-limited new request must not persist an empty job row");
      assert.equal(providerCalls, 10, "rate-limited request must not invoke inference");
    });
  } finally {
    await pool.end();
  }
});
