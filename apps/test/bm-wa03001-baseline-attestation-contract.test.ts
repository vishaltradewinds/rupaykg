import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("baseline attestation bridge is signed, approved-only, scoped and fail-closed", async () => {
  const [route, migration, server] = await Promise.all([
    read("apps/src/bm-wa03001-baseline-attestation-routes.ts"),
    read("migrations/20261032_bm_wa03001_baseline_attestations.sql"),
    read("apps/src/server.ts"),
  ]);
  assert.match(server, /registerBmWa03001BaselineAttestationRoutes\(app, pool\)/);
  assert.match(route, /baseline\.status !== "APPROVED"/);
  assert.match(route, /BASELINE_HASH_MISMATCH/);
  assert.match(route, /status='VERIFIED'/);
  assert.ok(route.includes("content_hash ~ '^[0-9a-f]{64}$'"));
  assert.match(route, /guardian:write/);
  assert.match(route, /projects:verify/);
  assert.match(route, /signBaselineAttestation/);
  assert.match(route, /\.well-known\/rupaykg-baseline-jwks\.json/);
  assert.match(route, /not a carbon-credit credential/);
  assert.match(migration, /unique references bm_wa03001_baseline_records/);
  assert.match(migration, /before update or delete/);
  assert.match(migration, /append-only/);
});
