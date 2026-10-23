import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import { Pool } from "pg";
import { registerIntelligenceRoutes } from "./intelligence-routes.js";

const phase = process.argv[2];
const fixtureRaw = process.env.RUPAYKG_PROCESS_RESTART_FIXTURE;
if (!fixtureRaw || !["first", "second"].includes(phase ?? "")) throw new Error("Missing fixture or invalid phase");
const fixture = JSON.parse(fixtureRaw);
const expectedSourceId = process.env.RUPAYKG_PROCESS_RESTART_SOURCE_ID;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: 4,
});
const extraction = {
  recordType: "WASTE_MEASUREMENT", observedAt: "2026-10-19T08:30:00Z",
  quantity: 125.5, unit: "kg", wasteStream: "WET", facilityReference: "FAC-TEST",
  notes: "Synthetic OS-process restart fixture", confidence: 0.8, warnings: [],
};
const body = { activityId: fixture.activityId, sourceReference: "synthetic-process-restart.txt", rawLog: "Synthetic scale log: net weight 125.5 kg" };
async function post(app: FastifyInstance) {
  return app.inject({
    method: "POST", url: "/api/v1/intelligence/evidence-intake",
    headers: { authorization: "Bearer " + fixture.token, "idempotency-key": fixture.idempotencyKey },
    payload: body,
  });
}
try {
  const app = Fastify();
  try {
    await registerIntelligenceRoutes(app, pool, phase === "first" ? {
      providerId: "synthetic-os-process-failure", modelId: "fixture-model", promptVersion: "fixture-v1",
      extract: async () => { throw new Error("synthetic provider failure before process exit"); },
    } : {
      providerId: "synthetic-os-process-recovery", modelId: "fixture-model", promptVersion: "fixture-v1",
      extract: async () => extraction,
    });
    await app.ready();
    const response = await post(app);
    if (phase === "first") {
      assert.equal(response.statusCode, 502, response.body);
      const sourceEvidenceId = response.json().sourceEvidenceId;
      assert.ok(sourceEvidenceId);
      process.stdout.write(JSON.stringify({ phase, sourceEvidenceId }) + "\n");
    } else {
      assert.ok(expectedSourceId, "phase two requires source ID captured from phase one");
      assert.equal(response.statusCode, 201, response.body);
      assert.equal(response.json().data.sourceEvidenceId, expectedSourceId);
      assert.equal(response.json().data.reviewStatus, "PENDING_HUMAN_REVIEW");
      assert.equal(response.json().data.authoritativeMutation, false);
      const counts = await pool.query(
        "select count(*) filter(where evidence_type='AI_SOURCE_LOG')::int source_count, count(*) filter(where evidence_type='AI_EXTRACTION_PROPOSAL')::int proposal_count from evidence where activity_id=$1",
        [fixture.activityId],
      );
      assert.equal(counts.rows[0].source_count, 1);
      assert.equal(counts.rows[0].proposal_count, 1);
      process.stdout.write(JSON.stringify({ phase, recovered: true, sourceCount: 1, proposalCount: 1, authoritativeMutation: false }) + "\n");
    }
  } finally {
    await app.close();
  }
} finally {
  await pool.end();
}
