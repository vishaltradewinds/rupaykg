import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readDatabaseSslSetting } from "./database-ssl.js";

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
    if (ssl !== false) assert.match(ssl.ca, /BEGIN CERTIFICATE/);
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
});
