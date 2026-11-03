import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDatabasePoolConfig } from "./database-pool-config.js";

describe("database pool TLS policy", () => {
  it("verifies external production PostgreSQL certificates and removes URL TLS overrides", () => {
    const config = createDatabasePoolConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://db.example.invalid:5432/rupaykg?sslmode=disable&sslrootcert=%2Ftmp%2Fattacker.pem",
      DATABASE_SSL: "require",
      DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\ntrusted-ca\n-----END CERTIFICATE-----",
    });
    assert.equal(config.ssl && typeof config.ssl === "object" && config.ssl.rejectUnauthorized, true);
    assert.equal(config.ssl && typeof config.ssl === "object" && config.ssl.ca, "-----BEGIN CERTIFICATE-----\ntrusted-ca\n-----END CERTIFICATE-----");
    assert.equal(new URL(config.connectionString!).searchParams.has("sslmode"), false);
    assert.equal(new URL(config.connectionString!).searchParams.has("sslrootcert"), false);
  });

  it("uses system certificate trust when sslmode=require was the declared trust policy", () => {
    const config = createDatabasePoolConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://db.example.invalid:5432/rupaykg?sslmode=require",
      DATABASE_SSL: "require",
    });
    assert.deepEqual(config.ssl, { rejectUnauthorized: true });
    assert.equal(new URL(config.connectionString!).searchParams.has("sslmode"), false);
  });

  it("permits plaintext production only for explicitly normalized Render private hosts", () => {
    const config = createDatabasePoolConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://dpg-example-abc:5432/rupaykg",
      DATABASE_SSL: "false",
    });
    assert.equal(config.ssl, false);
  });

  it("rejects an external production endpoint configured for plaintext", () => {
    assert.throws(() => createDatabasePoolConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://db.example.invalid:5432/rupaykg",
      DATABASE_SSL: "false",
    }), /Plaintext PostgreSQL is forbidden/);
  });

  it("rejects production TLS downgrade through a URL query parameter", () => {
    const config = createDatabasePoolConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://db.example.invalid:5432/rupaykg?sslmode=disable",
      DATABASE_SSL: "require",
    });
    assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  });

  it("preserves native non-production connection-string TLS settings when no explicit policy is set", () => {
    const config = createDatabasePoolConfig({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://db.example.invalid:5432/rupaykg?sslmode=require&sslrootcert=%2Ftmp%2Fdev-ca.pem",
    });
    assert.equal(config.ssl, undefined);
    assert.equal(new URL(config.connectionString!).searchParams.get("sslmode"), "require");
    assert.equal(new URL(config.connectionString!).searchParams.get("sslrootcert"), "/tmp/dev-ca.pem");
  });

  it("uses an explicit non-production DATABASE_SSL policy over URL parameters", () => {
    const config = createDatabasePoolConfig({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://db.example.invalid:5432/rupaykg?sslmode=require",
      DATABASE_SSL: "false",
    });
    assert.equal(config.ssl, false);
    assert.equal(new URL(config.connectionString!).searchParams.has("sslmode"), false);
  });

  it("rejects unsupported explicit DATABASE_SSL values", () => {
    assert.throws(() => createDatabasePoolConfig({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://db.example.invalid:5432/rupaykg",
      DATABASE_SSL: "prefer",
    }), /DATABASE_SSL must be either require or false/);
  });

  it("rejects non-PostgreSQL connection URLs", () => {
    assert.throws(() => createDatabasePoolConfig({
      DATABASE_URL: "https://db.example.invalid",
    }), /must use postgres/);
  });
});
