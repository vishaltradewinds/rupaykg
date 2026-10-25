import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { hederaStatus, integrityHash, submitHcsAnchor } from "./hedera-anchor.js";
import { guardianStatus } from "./guardian-mrv.js";

test("MRV integrations fail closed when external providers are not configured", async () => {
  const previous = { topic: process.env.HEDERA_TOPIC_ID, operatorId: process.env.HEDERA_OPERATOR_ID, operatorKey: process.env.HEDERA_OPERATOR_KEY, guardian: process.env.GUARDIAN_MRV_SUBMIT_URL };
  delete process.env.HEDERA_TOPIC_ID;
  delete process.env.HEDERA_OPERATOR_ID;
  delete process.env.HEDERA_OPERATOR_KEY;
  delete process.env.GUARDIAN_MRV_SUBMIT_URL;
  try {
    assert.equal(hederaStatus().writeStatus, "NOT_AVAILABLE");
    assert.equal(guardianStatus().configured, false);
    const result = await submitHcsAnchor({ schema: "rupaykg:mrv:v1", activityId: "a", verificationId: "v", evidenceId: "e", guardianPolicyId: "p", guardianExecutionId: "g", mrvStatus: "VERIFIED" });
    assert.equal(result.status, "NOT_CONFIGURED");
    assert.equal(result.transactionId, null);
    assert.equal(result.consensusTimestamp, null);
  } finally {
    for (const [key, value] of Object.entries({ HEDERA_TOPIC_ID: previous.topic, HEDERA_OPERATOR_ID: previous.operatorId, HEDERA_OPERATOR_KEY: previous.operatorKey, GUARDIAN_MRV_SUBMIT_URL: previous.guardian })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("MRV integrity hash is deterministic and key-order independent", () => {
  const a = { schema: "rupaykg:mrv:v1" as const, activityId: "a", verificationId: "v", evidenceId: "e", guardianPolicyId: "p", guardianExecutionId: "g", mrvStatus: "VERIFIED" as const, metadata: { z: 1, a: 2 } };
  const b = { ...a, metadata: { a: 2, z: 1 } };
  assert.equal(integrityHash(a), integrityHash(b));
});

test("MRV provenance persistence and audit event share one transaction", async () => {
  const source = await readFile(fileURLToPath(new URL("../../../apps/src/mrv-routes.ts", import.meta.url)), "utf8");
  const submitStart = source.indexOf('app.post("/api/v1/mrv/activities/:activityId/submit"');
  const submitEnd = source.indexOf('app.get("/api/v1/mrv/activities/:activityId/provenance"', submitStart);
  assert.ok(submitStart >= 0 && submitEnd > submitStart, "MRV submission route must exist");
  const route = source.slice(submitStart, submitEnd);

  assert.match(route, /const persistClient = await pool\.connect\(\)/);
  assert.match(route, /await persistClient\.query\("BEGIN"\)/);
  assert.match(route, /insert into mrv_provenance_events/);
  assert.match(route, /MRV_PROVENANCE_PERSISTED/);
  assert.match(route, /auth\.identityId, row\.organization_id, provenance\.id, request\.id/);
  assert.match(route, /await persistClient\.query\("COMMIT"\)/);
  assert.match(route, /await persistClient\.query\("ROLLBACK"\)/);
  assert.match(route, /persistClient\.release\(\)/);
});
