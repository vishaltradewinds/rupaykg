import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertProductionMigrationTarget, readProductionConfig, requiresExplicitMigrationTarget } from "./production-config.js";

const valid = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://prod.example.invalid:5432/rupaykg",
  DATABASE_SSL: "require",
  DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\nproduction-test-ca\n-----END CERTIFICATE-----",
  RUPAYKG_ALLOWED_ORIGINS: "https://app.rupaykg.example",
  RUPAYKG_AUTH_MODE: "real",
} as const;

describe("production configuration", () => {
  it("accepts the complete production contract", () => {
    const config = readProductionConfig(valid);
    assert.deepEqual(config, {
      environment: "production",
      databaseUrl: valid.DATABASE_URL,
      databaseSsl: "require",
      databaseCaCert: valid.DATABASE_CA_CERT,
      allowedOrigins: ["https://app.rupaykg.example"],
      authMode: "real",
      syntheticData: false,
    });
  });

  it("fails closed without real authentication", () => {
    assert.throws(() => readProductionConfig({ ...valid, RUPAYKG_AUTH_MODE: "" }), /RUPAYKG_AUTH_MODE must be real/);
  });

  it("fails closed when production mode is not explicit", () => {
    assert.throws(() => readProductionConfig({ ...valid, NODE_ENV: "development" }), /PRODUCTION_CONFIG_NOT_ACTIVE/);
  });

  it("fails closed without production database", () => {
    assert.throws(() => readProductionConfig({ ...valid, DATABASE_URL: "" }), /DATABASE_URL is required/);
  });

  it("fails closed for local database targets", () => {
    assert.throws(() => readProductionConfig({ ...valid, DATABASE_URL: "postgresql://localhost:5432/rupaykg" }), /must not target localhost/);
  });

  it("requires TLS database configuration", () => {
    assert.throws(() => readProductionConfig({ ...valid, DATABASE_SSL: "false" }), /DATABASE_SSL must be require/);
  });

  it("requires a production CA certificate for PostgreSQL TLS", () => {
    assert.throws(() => readProductionConfig({ ...valid, DATABASE_CA_CERT: "" }), /DATABASE_CA_CERT must contain a PEM certificate/);
  });

  it("requires real authentication", () => {
    assert.throws(() => readProductionConfig({ ...valid, RUPAYKG_AUTH_MODE: "demo" }), /RUPAYKG_AUTH_MODE must be real/);
  });

  it("forbids production synthetic-data mode", () => {
    assert.throws(() => readProductionConfig({ ...valid, RUPAYKG_SYNTHETIC_DATA: "true" }), /synthetic data is forbidden/);
  });

  it("forbids a client-bundled workspace session token in production", () => {
    assert.throws(() => readProductionConfig({ ...valid, VITE_RUPAYKG_SESSION_TOKEN: "secret" }), /VITE_RUPAYKG_SESSION_TOKEN must not be provided/);
  });

  it("requires HTTPS origins without paths", () => {
    assert.throws(() => readProductionConfig({ ...valid, RUPAYKG_ALLOWED_ORIGINS: "http://app.rupaykg.example" }), /origin must use HTTPS/);
    assert.throws(() => readProductionConfig({ ...valid, RUPAYKG_ALLOWED_ORIGINS: "https://app.rupaykg.example/path" }), /must not contain path/);
  });
});

describe("production migration target identity", () => {
  const expected = {
    expectedBranchId: "br-restless-base-b44cip2h",
    expectedDatabaseName: "rupaykg",
    expectedRoleName: "rupaykg",
  };
  const actual = {
    branchId: "br-restless-base-b44cip2h",
    databaseName: "rupaykg",
    roleName: "rupaykg",
  };

  it("accepts only the exact approved Neon branch, database, and role", () => {
    assert.doesNotThrow(() => assertProductionMigrationTarget(expected, actual));
  });

  it("fails closed for a different Neon branch", () => {
    assert.throws(
      () => assertProductionMigrationTarget(expected, { ...actual, branchId: "br-spring-hill-b4544vz5" }),
      /connected Neon branch does not match/,
    );
  });

  it("fails closed for a different database", () => {
    assert.throws(
      () => assertProductionMigrationTarget(expected, { ...actual, databaseName: "neondb" }),
      /connected database does not match/,
    );
  });

  it("fails closed for a different database role", () => {
    assert.throws(
      () => assertProductionMigrationTarget(expected, { ...actual, roleName: "rupaykg_app" }),
      /connected database role does not match/,
    );
  });

  it("fails closed when the connected server is not reporting a Neon branch ID", () => {
    assert.throws(
      () => assertProductionMigrationTarget(expected, { ...actual, branchId: null }),
      /connected Neon branch does not match/,
    );
  });

  it("requires every expected target field", () => {
    assert.throws(
      () => assertProductionMigrationTarget({ ...expected, expectedBranchId: "" }, actual),
      /expected Neon branch ID is required/,
    );
  });
});

describe("migration target identity enforcement", () => {
  it("requires an explicit branch target for every Neon connection, even outside production mode", () => {
    assert.equal(requiresExplicitMigrationTarget("postgresql://user:pass@ep-example.us-east-1.aws.neon.tech/rupaykg", "test"), true);
    assert.equal(requiresExplicitMigrationTarget("postgresql://user:pass@ep-example-pooler.us-east-1.aws.neon.tech/rupaykg", "development"), true);
  });

  it("requires target identity for every production database", () => {
    assert.equal(requiresExplicitMigrationTarget("postgresql://localhost:5432/rupaykg", "production"), true);
  });

  it("allows disposable local PostgreSQL migration tests without a Neon branch ID", () => {
    assert.equal(requiresExplicitMigrationTarget("postgresql://localhost:5432/rupaykg", "test"), false);
  });
});
