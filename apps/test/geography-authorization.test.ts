import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { canReadGeography, type AuthContext } from "../src/auth.js";

const organizationA = "11111111-1111-4111-8111-111111111111";
const organizationB = "22222222-2222-4222-8222-222222222222";
const geographyId = "33333333-3333-4333-8333-333333333333";

function fakeClient(answer: boolean) {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const client = {
    query: async (sql: string, values: unknown[]) => {
      calls.push({ sql, values });
      return { rows: [{ ok: answer }] };
    },
  } as unknown as PoolClient;
  return { client, calls };
}

function context(activeOrganizationId: string | undefined): AuthContext {
  return {
    identityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    memberships: [
      { organization_id: organizationA, role_id: "role-a", status: "VERIFIED" },
      { organization_id: organizationB, role_id: "role-b", status: "VERIFIED" },
    ],
    ...(activeOrganizationId ? { activeOrganizationId } : {}),
  };
}

test("geography access is restricted to the selected active organization", async () => {
  const { client, calls } = fakeClient(true);
  assert.equal(await canReadGeography(client, context(organizationA), organizationB, geographyId), false);
  assert.equal(calls.length, 0);
});

test("geography access query binds identity and selected organization", async () => {
  const { client, calls } = fakeClient(true);
  assert.equal(await canReadGeography(client, context(organizationA), organizationA, geographyId), true);
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /om\.organization_id\s*=\s*\$2/);
  assert.deepEqual(calls[0]!.values, [context(organizationA).identityId, organizationA, geographyId]);
});

test("geography access fails closed without an active organization", async () => {
  const { client, calls } = fakeClient(true);
  assert.equal(await canReadGeography(client, context(undefined), organizationA, geographyId), false);
  assert.equal(calls.length, 0);
});

test("geography access fails closed for malformed geography identifiers", async () => {
  const { client, calls } = fakeClient(true);
  assert.equal(await canReadGeography(client, context(organizationA), organizationA, "not-a-uuid"), false);
  assert.equal(calls.length, 0);
});

test("geography access returns false when the selected organization has no verified scope", async () => {
  const { client, calls } = fakeClient(false);
  assert.equal(await canReadGeography(client, context(organizationA), organizationA, geographyId), false);
  assert.equal(calls.length, 1);
});
