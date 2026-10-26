import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const seedScript = fileURLToPath(new URL("./acceptance-seed.js", import.meta.url));

test("disabled synthetic acceptance seed exits normally so production startup can continue", () => {
  const env = { ...process.env };
  delete env.RUPAYKG_ACCEPTANCE_SEED_ON_START;

  const result = spawnSync(process.execPath, [seedScript], {
    env,
    encoding: "utf8",
  });

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.signal, null);
});

test("legacy synthetic acceptance seed fails closed when explicitly enabled", () => {
  const result = spawnSync(process.execPath, [seedScript], {
    env: { ...process.env, RUPAYKG_ACCEPTANCE_SEED_ON_START: "true" },
    encoding: "utf8",
  });

  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Synthetic acceptance seeding is disabled for authoritative MRV/i);
});
