import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
const protectedMigrator = fileURLToPath(
  new URL("../../../scripts/run-protected-migrator.mjs", import.meta.url),
);
const configValidator = fileURLToPath(
  new URL("../../../scripts/validate-protected-migrator-config.mjs", import.meta.url),
);

function run(script: string, env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [script], {
    encoding: "utf8",
    cwd: projectRoot,
    env: { ...process.env, ...env },
  });
}

describe("protected production migration execution boundary", () => {
  it("never falls back to the API DATABASE_URL", () => {
    const result = run(protectedMigrator, {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://api-runtime.invalid/rupaykg",
      MIGRATOR_DATABASE_URL: "",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /MIGRATOR_DATABASE_URL is required/);
    assert.doesNotMatch(result.stderr, /api-runtime\.invalid/);
  });

  it("rejects an API DATABASE_URL even when a migrator URL is supplied", () => {
    const result = run(protectedMigrator, {
      NODE_ENV: "production",
      MIGRATOR_DATABASE_URL: "postgresql://migrator.invalid/rupaykg",
      MIGRATOR_MODE: "true",
      DATABASE_URL: "postgresql://api-runtime.invalid/rupaykg",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DATABASE_URL must not be supplied to the protected migrator job/);
  });

  it("requires strict TLS for production protected migrations", () => {
    const result = run(configValidator, {
      NODE_ENV: "production",
      MIGRATOR_DATABASE_URL: "postgresql://migrator.invalid/rupaykg",
      MIGRATOR_MODE: "true",
      MIGRATOR_MANIFEST_PATH: "migrations/manifest.json",
      MIGRATOR_EXPECTED_DATABASE: "rupaykg",
      MIGRATOR_EXPECTED_USER: "rupaykg_migrator",
      DATABASE_SSL_CA_CERT: "/tmp/test-ca.pem",
      MIGRATOR_DATABASE_SSL_STRICT: "false",
      DATABASE_URL: "",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Production protected migrations require MIGRATOR_DATABASE_SSL_STRICT=true/);
  });
});
