import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readProductionConfig } from "./production-config.js";

const valid = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://rupaykg_app_runtime:app-secret@prod.example.invalid:5432/rupaykg",
  AUTH_DATABASE_URL: "postgresql://rupaykg_auth_runtime:auth-secret@prod.example.invalid:5432/rupaykg",
  DATABASE_SSL: "require",
  DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\nproduction-test-ca\n-----END CERTIFICATE-----",
  RUPAYKG_ALLOWED_ORIGINS: "https://app.rupaykg.example",
  RUPAYKG_AUTH_MODE: "real",
  RUPAYKG_AUTH_RESOLVER_MODE: "security_definer",
  RUPAYKG_REQUEST_CONTEXT_SECRET: "production-test-request-context-secret-material",
  RUPAYKG_REQUEST_CONTEXT_KEY_ID: "v1",
  RUPAYKG_EPR_RETURN_READ_ENABLED: "false",
} as const;

describe("production configuration", () => {
  it("accepts the complete production contract", () => {
    const config = readProductionConfig(valid);
    assert.deepEqual(config, {
      environment: "production",
      databaseUrl: valid.DATABASE_URL,
      authDatabaseUrl: valid.AUTH_DATABASE_URL,
      authResolverMode: "security_definer",
      requestContextSecret: valid.RUPAYKG_REQUEST_CONTEXT_SECRET,
      requestContextKeyId: valid.RUPAYKG_REQUEST_CONTEXT_KEY_ID,
      eprReturnReadEnabled: false,
      databaseSsl: "require",
      databaseCaCert: valid.DATABASE_CA_CERT,
      allowedOrigins: ["https://app.rupaykg.example"],
      authMode: "real",
      syntheticData: false,
    });
  });

  it("keeps the EPR read route disabled by default", () => {
    const withoutFlag = Object.fromEntries(Object.entries(valid).filter(([key]) => key !== "RUPAYKG_EPR_RETURN_READ_ENABLED"));
    assert.equal(readProductionConfig(withoutFlag).eprReturnReadEnabled, false);
  });

  it("accepts explicit EPR read enablement only as a strict boolean", () => {
    assert.equal(readProductionConfig({ ...valid, RUPAYKG_EPR_RETURN_READ_ENABLED: "true" }).eprReturnReadEnabled, true);
    assert.throws(
      () => readProductionConfig({ ...valid, RUPAYKG_EPR_RETURN_READ_ENABLED: "yes" }),
      /RUPAYKG_EPR_RETURN_READ_ENABLED must be true or false/,
    );
  });

  it("requires a sufficiently strong signed request-context secret", () => {
    assert.throws(() => readProductionConfig({ ...valid, RUPAYKG_REQUEST_CONTEXT_SECRET: "short" }), /RUPAYKG_REQUEST_CONTEXT_SECRET must be at least 32 bytes/);
  });

  it("requires a valid request-context key identifier", () => {
    assert.throws(() => readProductionConfig({ ...valid, RUPAYKG_REQUEST_CONTEXT_KEY_ID: "INVALID KEY ID" }), /RUPAYKG_REQUEST_CONTEXT_KEY_ID is invalid/);
  });

  it("fails closed when request-context signing material is absent", () => {
    assert.throws(() => readProductionConfig({ ...valid, RUPAYKG_REQUEST_CONTEXT_SECRET: "" }), /RUPAYKG_REQUEST_CONTEXT_SECRET is required/);
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

  it("never permits the request-context signing secret in a Vite client variable", () => {
    assert.throws(() => readProductionConfig({ ...valid, VITE_RUPAYKG_REQUEST_CONTEXT_SECRET: "must-not-be-client-bundled" }), /must never be client-bundled/);
  });

  it("never permits the request-context key identifier in a Vite client variable", () => {
    assert.throws(() => readProductionConfig({ ...valid, VITE_RUPAYKG_REQUEST_CONTEXT_KEY_ID: "v1" }), /must not be provided to the browser/);
  });

  it("requires HTTPS origins without paths", () => {
    assert.throws(() => readProductionConfig({ ...valid, RUPAYKG_ALLOWED_ORIGINS: "http://app.rupaykg.example" }), /origin must use HTTPS/);
    assert.throws(() => readProductionConfig({ ...valid, RUPAYKG_ALLOWED_ORIGINS: "https://app.rupaykg.example/path" }), /must not contain path/);
  });
});
