import test from "node:test";
import assert from "node:assert/strict";
import { ExternalIntegrationAdapterRegistry } from "./external-integration-adapter-registry.js";
import type { ExternalIntegrationEnvelope } from "./external-integration-contract.js";

const envelope = (): ExternalIntegrationEnvelope => ({
  contractVersion: "1.0",
  integrationId: "CONFORMANCE",
  correlationId: "corr-conformance-1",
  idempotencyKey: "idem-conformance-1",
  organizationId: "00000000-0000-4000-8000-000000000001",
  direction: "OUTBOUND",
  kind: "COMMAND",
  occurredAt: "2026-11-08T09:00:00Z",
  sourceSystem: "rupaykg",
  targetSystem: "conformance-provider",
  schema: "conformance.v1",
  payload: { command: "ping" },
});

test("adapter conformance preserves correlation and non-authoritative boundary", async () => {
  const registry = new ExternalIntegrationAdapterRegistry();
  registry.register({
    integrationId: "CONFORMANCE",
    contractVersion: "1.0",
    async execute(input) {
      return {
        accepted: true,
        authoritativeMutation: false,
        correlationId: input.correlationId,
        retryable: false,
        externalReference: "provider-ref-1",
      };
    },
  });

  const result = await registry.execute(envelope());

  assert.equal(result.accepted, true);
  assert.equal(result.authoritativeMutation, false);
  assert.equal(result.correlationId, envelope().correlationId);
  assert.equal(result.retryable, false);
  assert.equal(result.externalReference, "provider-ref-1");
});

test("adapter exception is isolated and classified retryable without authoritative mutation", async () => {
  const registry = new ExternalIntegrationAdapterRegistry();
  registry.register({
    integrationId: "CONFORMANCE",
    contractVersion: "1.0",
    async execute() {
      throw new Error("simulated remote timeout");
    },
  });

  const result = await registry.execute(envelope());

  assert.equal(result.accepted, false);
  assert.equal(result.authoritativeMutation, false);
  assert.equal(result.correlationId, envelope().correlationId);
  assert.equal(result.retryable, true);
  assert.equal(result.failureClass, "TRANSIENT");
});

test("adapter correlation mismatch is rejected as validation failure", async () => {
  const registry = new ExternalIntegrationAdapterRegistry();
  registry.register({
    integrationId: "CONFORMANCE",
    contractVersion: "1.0",
    async execute() {
      return {
        accepted: true,
        authoritativeMutation: false,
        correlationId: "unexpected-correlation",
        retryable: false,
      };
    },
  });

  const result = await registry.execute(envelope());

  assert.equal(result.accepted, false);
  assert.equal(result.authoritativeMutation, false);
  assert.equal(result.correlationId, envelope().correlationId);
  assert.equal(result.retryable, false);
  assert.equal(result.failureClass, "VALIDATION");
});

test("missing provider fails closed without claiming external acceptance", async () => {
  const registry = new ExternalIntegrationAdapterRegistry();

  const result = await registry.execute(envelope());

  assert.equal(result.accepted, false);
  assert.equal(result.authoritativeMutation, false);
  assert.equal(result.retryable, false);
  assert.equal(result.failureClass, "VALIDATION");
});
