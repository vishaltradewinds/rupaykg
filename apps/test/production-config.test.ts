import assert from "node:assert/strict";
import { test } from "node:test";
import { readProductionConfig } from "../src/production-config.js";

const baseEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://rupaykg:secret@db.example.com:5432/rupaykg",
  DATABASE_SSL: "require",
  DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\nproduction-test-ca\n-----END CERTIFICATE-----",
  RUPAYKG_AUTH_MODE: "real",
  RUPAYKG_ALLOWED_ORIGINS: "https://app.rupaykg.example,https://admin.rupaykg.example",
  RUPAYKG_SYNTHETIC_DATA: "false",
};

test("production config accepts the fail-closed production contract", () => {
  assert.deepEqual(readProductionConfig(baseEnv), {
    environment: "production",
    databaseUrl: baseEnv.DATABASE_URL,
    databaseSsl: "require",
    databaseCaCert: baseEnv.DATABASE_CA_CERT,
    allowedOrigins: ["https://app.rupaykg.example", "https://admin.rupaykg.example"],
    authMode: "real",
    syntheticData: false,
  });
});

test("production config rejects missing or unsafe production requirements", () => {
  const cases = [
    [{ ...baseEnv, NODE_ENV: "development" }, /PRODUCTION_CONFIG_NOT_ACTIVE.*NODE_ENV must be production/],
    [{ ...baseEnv, DATABASE_URL: "" }, /DATABASE_URL is required/],
    [{ ...baseEnv, DATABASE_URL: "not-a-url" }, /DATABASE_URL must be a valid PostgreSQL URL/],
    [{ ...baseEnv, DATABASE_URL: "https://db.example.com" }, /DATABASE_URL must use postgres:\/\/ or postgresql:\/\//],
    [{ ...baseEnv, DATABASE_URL: "postgresql://localhost/rupaykg" }, /must not target localhost/],
    [{ ...baseEnv, DATABASE_URL: "postgresql://127.0.0.1/rupaykg" }, /must not target localhost/],
    [{ ...baseEnv, DATABASE_SSL: "false" }, /DATABASE_SSL must be require/],
    [{ ...baseEnv, DATABASE_CA_CERT: "" }, /DATABASE_CA_CERT must contain a PEM certificate/],
    [{ ...baseEnv, RUPAYKG_AUTH_MODE: "session" }, /RUPAYKG_AUTH_MODE must be real/],
    [{ ...baseEnv, RUPAYKG_AUTH_MODE: "" }, /RUPAYKG_AUTH_MODE must be real/],
    [{ ...baseEnv, RUPAYKG_SYNTHETIC_DATA: "true" }, /synthetic data is forbidden/],
    [{ ...baseEnv, VITE_RUPAYKG_SESSION_TOKEN: "not-allowed" }, /VITE_RUPAYKG_SESSION_TOKEN must not be provided/],
    [{ ...baseEnv, RUPAYKG_ALLOWED_ORIGINS: "" }, /RUPAYKG_ALLOWED_ORIGINS must contain at least one origin/],
    [{ ...baseEnv, RUPAYKG_ALLOWED_ORIGINS: "http://app.rupaykg.example" }, /origin must use HTTPS/],
    [{ ...baseEnv, RUPAYKG_ALLOWED_ORIGINS: "https://app.rupaykg.example/path" }, /must not contain path/],
  ] as const;

  for (const [env, expected] of cases) {
    assert.throws(() => readProductionConfig(env), expected);
  }
});
