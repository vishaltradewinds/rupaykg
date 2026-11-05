import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const migrator = fileURLToPath(new URL("./migrate.js", import.meta.url));

function run(env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [migrator], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

describe("production migration execution boundary", () => {
  it("never falls back to the API DATABASE_URL", () => {
    const result = run({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://api-runtime.invalid/rupaykg",
      RUPAYKG_MIGRATOR_DATABASE_URL: "",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /RUPAYKG_MIGRATOR_DATABASE_URL is required/);
    assert.doesNotMatch(result.stderr, /api-runtime\.invalid/);
  });

  it("requires explicit TLS for production migration execution", () => {
    const result = run({
      NODE_ENV: "production",
      RUPAYKG_MIGRATOR_DATABASE_URL: "postgresql://migrator.invalid/rupaykg",
      RUPAYKG_MIGRATOR_DATABASE_SSL: "",
      RUPAYKG_MIGRATOR_DATABASE_CA_CERT: "",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Production migrations require RUPAYKG_MIGRATOR_DATABASE_SSL=require/);
  });

  it("requires a CA certificate when production TLS is enabled", () => {
    const result = run({
      NODE_ENV: "production",
      RUPAYKG_MIGRATOR_DATABASE_URL: "postgresql://migrator.invalid/rupaykg",
      RUPAYKG_MIGRATOR_DATABASE_SSL: "require",
      RUPAYKG_MIGRATOR_DATABASE_CA_CERT: "",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /RUPAYKG_MIGRATOR_DATABASE_CA_CERT must contain a PEM certificate/);
  });
});
