import test from "node:test";
import assert from "node:assert/strict";
import { ExternalIntegrationAdapterRegistry } from "./external-integration-adapter-registry.js";

test("rejects duplicate adapter registration", () => {
  const registry = new ExternalIntegrationAdapterRegistry();
  const adapter = {
    integrationId: "TEST",
    contractVersion: "1.0" as const,
    async execute(envelope: any) {
      return {
        accepted: true,
        authoritativeMutation: false,
        correlationId: envelope.correlationId,
        retryable: false,
      };
    },
  };
  registry.register(adapter);
  assert.throws(() => registry.register(adapter), /already registered/);
});

test("fails closed when adapter is missing", async () => {
  const registry = new ExternalIntegrationAdapterRegistry();
  const result = await registry.execute({
    contractVersion: "1.0",
    integrationId: "MISSING",
    correlationId: "corr-1",
    idempotencyKey: "idem-1",
    organizationId: "00000000-0000-4000-8000-000000000001",
    direction: "OUTBOUND",
    kind: "COMMAND",
    occurredAt: "2026-11-08T09:00:00Z",
    sourceSystem: "rupaykg",
    targetSystem: "missing",
    schema: "test.v1",
    payload: {},
  });
  assert.equal(result.accepted, false);
  assert.equal(result.authoritativeMutation, false);
  assert.equal(result.failureClass, "VALIDATION");
});

test("rejects adapter correlation mismatch", async () => {
  const registry = new ExternalIntegrationAdapterRegistry();
  registry.register({
    integrationId: "TEST",
    contractVersion: "1.0",
    async execute() {
      return {
        accepted: true,
        authoritativeMutation: false,
        correlationId: "wrong-correlation",
        retryable: false,
      };
    },
  });
  const result = await registry.execute({
    contractVersion: "1.0",
    integrationId: "TEST",
    correlationId: "corr-1",
    idempotencyKey: "idem-1",
    organizationId: "00000000-0000-4000-8000-000000000001",
    direction: "OUTBOUND",
    kind: "COMMAND",
    occurredAt: "2026-11-08T09:00:00Z",
    sourceSystem: "rupaykg",
    targetSystem: "test",
    schema: "test.v1",
    payload: {},
  });
  assert.equal(result.accepted, false);
  assert.equal(result.failureClass, "VALIDATION");
});
