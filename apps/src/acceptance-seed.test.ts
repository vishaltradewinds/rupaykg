import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const seedScript = fileURLToPath(new URL("./acceptance-seed.js", import.meta.url));

test("production rejects acceptance fixture seeding before database access", () => {
  const result = spawnSync(process.execPath, [seedScript], {
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "production",
      RUPAYKG_ACCEPTANCE_SEED_ON_START: "true",
      DATABASE_URL: "",
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /RUPAYKG_ACCEPTANCE_SEED_FORBIDDEN/);
});

test("acceptance seed is a no-op when the explicit opt-in is absent", () => {
  const result = spawnSync(process.execPath, [seedScript], {
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "test",
      RUPAYKG_ACCEPTANCE_SEED_ON_START: "false",
      DATABASE_URL: "",
    },
  });

  assert.equal(result.status, 0, result.stderr);
});
