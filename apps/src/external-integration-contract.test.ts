import assert from "node:assert/strict";
import test from "node:test";
import { validateIntegrationEnvelope, type ExternalIntegrationEnvelope } from "./external-integration-contract.js";

const valid: ExternalIntegrationEnvelope = {
  contractVersion: "1.0",
  integrationId: "india-dpi-example",
  correlationId: "corr-001",
  idempotencyKey: "idem-001",
  organizationId: "11111111-1111-4111-8111-111111111111",
  actorIdentityId: "22222222-2222-4222-8222-222222222222",
  direction: "OUTBOUND",
  kind: "COMMAND",
  occurredAt: "2026-11-08T09:00:00Z",
  sourceSystem: "rupaykg",
  targetSystem: "external-system",
  schema: "rupaykg.example.command.v1",
  payload: { reference: "ABC-1" },
};

test("accepts a valid external integration envelope", () => {
  assert.deepEqual(validateIntegrationEnvelope(valid), { ok: true });
});

test("rejects missing idempotency key", () => {
  const result = validateIntegrationEnvelope({ ...valid, idempotencyKey: "" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "INVALID_INTEGRATION_ENVELOPE");
});

test("rejects unsupported contract version", () => {
  const result = validateIntegrationEnvelope({ ...valid, contractVersion: "2.0" as "1.0" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "UNSUPPORTED_CONTRACT_VERSION");
});

test("rejects invalid timestamps", () => {
  const result = validateIntegrationEnvelope({ ...valid, occurredAt: "not-a-date" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "INVALID_OCCURRED_AT");
});

test("rejects array payloads", () => {
  const result = validateIntegrationEnvelope({ ...valid, payload: [] as unknown as Record<string, unknown> });
  assert.equal(result.ok, false);
  assert.equal(result.code, "INVALID_PAYLOAD");
});
