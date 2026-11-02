import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("acceptance seed refuses to run in production even when explicitly enabled", () => {
  const seedPath = fileURLToPath(new URL("./acceptance-seed.js", import.meta.url));
  const result = spawnSync(process.execPath, [seedPath], {
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "production",
      RUPAYKG_ACCEPTANCE_SEED_ON_START: "true",
      DATABASE_URL: "",
      RUPAYKG_ACCEPTANCE_SESSION_TOKEN: "",
    },
  });

  assert.notEqual(result.status, 0, "production invocation must fail closed");
  assert.match(result.stderr, /Acceptance seeding is forbidden in production/);
});
