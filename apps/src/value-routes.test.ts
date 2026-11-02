import test from "node:test";
import assert from "node:assert/strict";
import type { Pool, PoolClient } from "pg";
import { assertActivityGeographyScope } from "./value-routes.js";

const identityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const organizationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherOrganizationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const geographyId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

class FakeClient {
  calls: Array<{ sql: string; values: unknown[] | undefined }> = [];
  result = true;
  async query(sql: string, values?: unknown[]) {
    this.calls.push({ sql, values });
    return { rows: [{ ok: this.result }] };
  }
}

test("activity geography authorization binds the verified membership to the activity organization", async () => {
  const client = new FakeClient();
  const result = await assertActivityGeographyScope(client as unknown as PoolClient, organizationId, geographyId, identityId);
  assert.deepEqual(result, { ok: true });
  assert.match(client.calls[0]!.sql, /om\.organization_id\s*=\s*\$2/);
  assert.deepEqual(client.calls[0]!.values, [identityId, organizationId, geographyId]);
  assert.notEqual(client.calls[0]!.values?.[1], otherOrganizationId);
});

test("activity geography authorization fails closed when the activity has no geography", async () => {
  const client = new FakeClient();
  const result = await assertActivityGeographyScope(client as unknown as Pool, organizationId, null, identityId);
  assert.deepEqual(result, { ok: false, code: "ACTIVITY_GEOGRAPHY_REQUIRED" });
  assert.equal(client.calls.length, 0);
});

test("activity geography authorization denies when the owning organization has no matching verified scope", async () => {
  const client = new FakeClient();
  client.result = false;
  const result = await assertActivityGeographyScope(client as unknown as Pool, organizationId, geographyId, identityId);
  assert.deepEqual(result, { ok: false, code: "GEOGRAPHY_FORBIDDEN" });
  assert.deepEqual(client.calls[0]!.values, [identityId, organizationId, geographyId]);
});
