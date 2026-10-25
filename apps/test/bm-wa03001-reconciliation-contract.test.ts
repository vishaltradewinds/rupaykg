import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("BM WA03.001 reconciliation endpoint is connected and fail-closed", async () => {
  const [route, migration, server] = await Promise.all([
    read("apps/src/bm-wa03001-reconciliation-routes.ts"),
    read("migrations/20261031_bm_wa03001_reconciliations.sql"),
    read("apps/src/server.ts"),
  ]);
  assert.match(server, /registerBmWa03001ReconciliationRoutes\(app, pool\)/);
  assert.match(route, /baseline\.status !== "APPROVED"/);
  assert.match(route, /BASELINE_HASH_MISMATCH/);
  assert.match(route, /status='VERIFIED'/);
  assert.ok(route.includes("content_hash ~ '^[0-9a-f]{64}$'"));
  assert.match(route, /calculateBmWa03001ProjectMethaneFromFlow/);
  assert.match(route, /calculateBmWa03001\(/);
  assert.match(route, /BM_WA03001_GWP_CH4_TCO2E_PER_TCH4/);
  assert.match(migration, /RECONCILED_PENDING_VERIFICATION/);
  assert.match(route, /not a verified reduction, registry approval, or issued Carbon Credit Certificate/);
  assert.match(migration, /foreign key \(baseline_record_id, activity_id, organization_id\)/);
  assert.match(migration, /unique\(activity_id, monitoring_period_id\)/);
  assert.match(migration, /before update or delete/);
  assert.match(migration, /append-only/);
});
