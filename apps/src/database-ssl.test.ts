import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readDatabaseConnectionOptions, readDatabaseSslSetting } from "./database-ssl.js";

describe("PostgreSQL TLS policy", () => {
  it("allows explicitly disabled TLS for a configured local/test database", () => {
    assert.equal(readDatabaseSslSetting({
      DATABASE_URL: "postgresql://localhost:5432/rupaykg",
      DATABASE_SSL: "false",
    }), false);
  });

  it("requires a trusted CA for public TLS connections", () => {
    const ssl = readDatabaseSslSetting({
      DATABASE_URL: "postgresql://db.example.invalid:5432/rupaykg",
      DATABASE_SSL: "require",
      DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\nfixture-ca\n-----END CERTIFICATE-----",
    });
    assert.equal(ssl === false ? true : ssl.rejectUnauthorized, true);
    assert.notEqual(ssl, false);
    if (ssl !== false) assert.match(String(ssl.ca), /BEGIN CERTIFICATE/);
  });

  it("keeps certificate verification enabled for sslmode=require using system trust", () => {
    const ssl = readDatabaseSslSetting({
      DATABASE_URL: "postgresql://db.example.invalid:5432/rupaykg?sslmode=require",
      DATABASE_SSL: "require",
    });
    assert.notEqual(ssl, false);
    if (ssl !== false) assert.equal(ssl.rejectUnauthorized, true);
  });

  it("removes URL SSL parameters so they cannot override the verified TLS object", () => {
    const options = readDatabaseConnectionOptions({
      DATABASE_URL: "postgresql://db.example.invalid:5432/rupaykg?sslmode=require&sslrootcert=%2Ftmp%2Froot.pem&application_name=rupaykg",
      DATABASE_SSL: "require",
      DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\\nfixture-ca\\n-----END CERTIFICATE-----",
    });
    const parsed = new URL(options.connectionString);
    assert.equal(parsed.searchParams.has("sslmode"), false);
    assert.equal(parsed.searchParams.has("sslrootcert"), false);
    assert.equal(parsed.searchParams.get("application_name"), "rupaykg");
    assert.notEqual(options.ssl, false);
    if (options.ssl !== false) assert.equal(options.ssl.rejectUnauthorized, true);
  });

  it("fails closed when TLS mode is missing", () => {
    assert.throws(() => readDatabaseSslSetting({
      DATABASE_URL: "postgresql://db.example.invalid:5432/rupaykg",
    }), /DATABASE_SSL must be explicitly set/);
  });

  it("fails closed when TLS CA is missing", () => {
    assert.throws(() => readDatabaseSslSetting({
      DATABASE_URL: "postgresql://db.example.invalid:5432/rupaykg",
      DATABASE_SSL: "require",
    }), /DATABASE_CA_CERT must contain a PEM certificate/);
  });

  it("uses the provider-internal Render database path only for a dpg host without sslmode", () => {
    assert.equal(readDatabaseSslSetting({
      DATABASE_URL: "postgresql://dpg-example-a/rupaykg",
      DATABASE_SSL: "require",
    }), false);
  });

  it("rejects disabled TLS for a non-provider database in production", () => {
    assert.throws(() => readDatabaseSslSetting({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://db.example.invalid:5432/rupaykg",
      DATABASE_SSL: "false",
    }), /PRODUCTION_DATABASE_TLS_REQUIRED/);
  });

  it("rejects loopback database targets in production before allowing TLS opt-out", () => {
    assert.throws(() => readDatabaseSslSetting({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://localhost:5432/rupaykg",
      DATABASE_SSL: "false",
    }), /PRODUCTION_DATABASE_TARGET_FORBIDDEN/);
  });

  it("retains the provider-internal non-TLS exception for production Render database hosts", () => {
    assert.equal(readDatabaseSslSetting({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://dpg-example-a/rupaykg",
      DATABASE_SSL: "false",
    }), false);
  });
});
