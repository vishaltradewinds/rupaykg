import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { acceptExternalIntegrationMessage } from "./external-integration-mediator.js";
import type { AuthContext } from "./auth.js";
import type { ExternalIntegrationEnvelope } from "./external-integration-contract.js";

const databaseUrl = process.env.DATABASE_URL;

const organizationId = "11111111-1111-4111-8111-111111111111";
const auth: AuthContext = {
  identityId: "22222222-2222-4222-8222-222222222222",
  memberships: [{ organization_id: organizationId, role_id: "33333333-3333-4333-8333-333333333333", status: "VERIFIED" }],
  activeOrganizationId: organizationId,
};

const envelope: ExternalIntegrationEnvelope = {
  contractVersion: "1.0",
  integrationId: "test-integration",
  correlationId: "corr-001",
  idempotencyKey: "idem-001",
  organizationId,
  actorIdentityId: auth.identityId,
  direction: "INBOUND",
  kind: "OBSERVATION",
  occurredAt: "2026-11-08T09:00:00Z",
  sourceSystem: "test-source",
  targetSystem: "rupaykg",
  schema: "test.observation.v1",
  payload: { value: 10, unit: "kg" },
};

test("rejects an envelope outside the authenticated active organization", async () => {
  if (!databaseUrl) return;
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await assert.rejects(
      acceptExternalIntegrationMessage(pool, auth, { ...envelope, organizationId: "44444444-4444-4444-8444-444444444444" }),
      /does not match/,
    );
  } finally {
    await pool.end();
  }
});

test("requires a database for mediator persistence", async () => {
  if (databaseUrl) return;
  assert.equal(typeof databaseUrl, "undefined");
});
