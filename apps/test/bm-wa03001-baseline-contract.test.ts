import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const migrationPath = fileURLToPath(new URL("../../../migrations/20261023_bm_wa03001_baseline_records.sql", import.meta.url));
const routePath = fileURLToPath(new URL("../../../apps/src/bm-wa03001-baseline-routes.ts", import.meta.url));
const serverPath = fileURLToPath(new URL("../../../apps/src/server.ts", import.meta.url));

test("BM WA03.001 baseline persistence binds activity and organization and permits only one decision transition", async () => {
  const sql = (await readFile(migrationPath, "utf8")).toLowerCase();
  assert.match(sql, /organization_id uuid not null references organizations\(id\)/);
  assert.match(sql, /activity_id uuid not null references activities\(id\)/);
  assert.match(sql, /baseline_fch4_tch4 numeric\(20,8\) not null check \(baseline_fch4_tch4 >= 0\)/);
  assert.match(sql, /record_sha256 text not null check \(record_sha256 ~ '\^\[a-f0-9\]\{64\}\$'/);
  assert.match(sql, /approved_by_identity_id is distinct from submitted_by_identity_id/);
  assert.match(sql, /old\.status <> 'submitted'/);
  assert.match(sql, /new\.status not in \('approved','rejected'\)/);
  assert.match(sql, /before update or delete on bm_wa03001_baseline_records/);
  assert.match(sql, /only a one-time independent approval\/rejection transition is permitted/);
});

test("BM WA03.001 baseline API fails closed on unverified evidence and enforces independent review", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /status='VERIFIED'/);
  assert.match(source, /submitted_by_identity_id === auth\.identityId/);
  assert.match(source, /BASELINE_SEPARATION_OF_DUTIES/);
  assert.match(source, /hash\(core\) !== row\.record_sha256/);
  assert.match(source, /projects:verify.*VERIFY_EVIDENCE/);
  assert.match(source, /not approved and does not establish methodology eligibility/i);
  const server = await readFile(serverPath, "utf8");
  assert.match(server, /registerBmWa03001BaselineRoutes\(app, pool\)/);
});
