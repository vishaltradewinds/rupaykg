import assert from "node:assert/strict";
import { test } from "node:test";
import { readProductionConfig } from "../src/production-config.js";

const baseEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://runtime_role:secret@db.example.com:5432/rupaykg",
  MIGRATION_DATABASE_URL: "postgresql://migration_role:secret@db.example.com:5432/rupaykg",
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
    migrationDatabaseUrl: baseEnv.MIGRATION_DATABASE_URL,
    databaseSsl: "require",
    databaseCaCert: baseEnv.DATABASE_CA_CERT,
    allowedOrigins: ["https://app.rupaykg.example", "https://admin.rupaykg.example"],
    authMode: "real",
    syntheticData: false,
  });
});

test("production config rejects missing or unsafe production requirements", () => {
  const cases = [
    [{ ...baseEnv, NODE_ENV: "development" }, /NODE_ENV must be production/],
    [{ ...baseEnv, DATABASE_URL: "postgresql://localhost/rupaykg" }, /must not target localhost/],
    [{ ...baseEnv, MIGRATION_DATABASE_URL: "postgresql://migration_role:secret@db.example.com:5433/rupaykg" }, /same database host, port, and database name/],
    [{ ...baseEnv, DATABASE_URL: baseEnv.DATABASE_URL + "?sslmode=disable" }, /remove sslmode from the database URL/],\n    [{ ...baseEnv, MIGRATION_DATABASE_URL: baseEnv.MIGRATION_DATABASE_URL + "?sslrootcert=%2Ftmp%2Fca.pem" }, /remove sslrootcert from the database URL/],\n    [{ ...baseEnv, DATABASE_SSL: "false" }, /DATABASE_SSL must be require/],
    [{ ...baseEnv, DATABASE_CA_CERT: "" }, /DATABASE_CA_CERT must contain a PEM certificate/],
    [{ ...baseEnv, RUPAYKG_AUTH_MODE: "session" }, /RUPAYKG_AUTH_MODE must be real/],
    [{ ...baseEnv, RUPAYKG_AUTH_MODE: "" }, /RUPAYKG_AUTH_MODE must be real/],
    [{ ...baseEnv, RUPAYKG_ALLOWED_ORIGINS: "http://app.rupaykg.example" }, /origin must use HTTPS/],
    [{ ...baseEnv, RUPAYKG_ALLOWED_ORIGINS: "https://app.rupaykg.example/path" }, /must not contain path/],
    [{ ...baseEnv, RUPAYKG_SYNTHETIC_DATA: "true" }, /synthetic data is forbidden/],
    [{ ...baseEnv, VITE_RUPAYKG_SESSION_TOKEN: "not-allowed" }, /VITE_RUPAYKG_SESSION_TOKEN must not be provided/],
  ] as const;

  for (const [env, expected] of cases) assert.throws(() => readProductionConfig(env), expected);
});
