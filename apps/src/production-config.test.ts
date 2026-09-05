import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readProductionConfig } from "./production-config.js";

const valid = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://prod.example.invalid:5432/rupaykg",
  DATABASE_SSL: "require",
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
      allowedOrigins: ["https://app.rupaykg.example"],
      authMode: "real",
      syntheticData: false,
    });
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
