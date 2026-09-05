import assert from "node:assert/strict";
import { test } from "node:test";
import { readProductionConfig } from "../src/production-config.js";

const baseEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://rupaykg:secret@db.example.com:5432/rupaykg",
  DATABASE_SSL: "require",
  RUPAYKG_AUTH_MODE: "real",
  RUPAYKG_ALLOWED_ORIGINS: "https://app.rupaykg.example,https://admin.rupaykg.example",
  RUPAYKG_SYNTHETIC_DATA: "false",
};

test("production config accepts the fail-closed production contract", () => {
  assert.deepEqual(readProductionConfig(baseEnv), {
    environment: "production",
    databaseUrl: baseEnv.DATABASE_URL,
    databaseSsl: "require",
    allowedOrigins: ["https://app.rupaykg.example", "https://admin.rupaykg.example"],
    authMode: "real",
    syntheticData: false,
  });
});

test("production config rejects missing or unsafe production requirements", () => {
  const cases = [
    [{ ...baseEnv, NODE_ENV: "development" }, /NODE_ENV must be production/],
    [{ ...baseEnv, DATABASE_URL: "postgresql://localhost/rupaykg" }, /must not target localhost/],
    [{ ...baseEnv, DATABASE_SSL: "false" }, /DATABASE_SSL must be require/],
    [{ ...baseEnv, RUPAYKG_AUTH_MODE: "session" }, /RUPAYKG_AUTH_MODE must be real/],
    [{ ...baseEnv, RUPAYKG_ALLOWED_ORIGINS: "http://app.rupaykg.example" }, /origin must use HTTPS/],
    [{ ...baseEnv, RUPAYKG_ALLOWED_ORIGINS: "https://app.rupaykg.example/path" }, /must not contain path/],
    [{ ...baseEnv, RUPAYKG_SYNTHETIC_DATA: "true" }, /synthetic data is forbidden/],
    [{ ...baseEnv, VITE_RUPAYKG_SESSION_TOKEN: "not-allowed" }, /VITE_RUPAYKG_SESSION_TOKEN must not be provided/],
  ] as const;

  for (const [env, expected] of cases) assert.throws(() => readProductionConfig(env), expected);
});
