import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { databaseSslConfig } from "./database-ssl.js";

describe("database SSL policy", () => {
  it("disables TLS only when production config explicitly selects the internal database path", () => {
    assert.equal(databaseSslConfig({ DATABASE_SSL: "false" } as NodeJS.ProcessEnv), false);
  });

  it("verifies the server certificate and supplies the configured CA for TLS-required connections", () => {
    assert.deepEqual(
      databaseSslConfig({
        DATABASE_SSL: "require",
        DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----",
      } as NodeJS.ProcessEnv),
      {
        rejectUnauthorized: true,
        ca: "-----BEGIN CERTIFICATE-----\nca\n-----END CERTIFICATE-----",
      },
    );
  });

  it("fails closed when production database TLS was not normalized", () => {
    assert.throws(
      () => databaseSslConfig({ NODE_ENV: "production" } as NodeJS.ProcessEnv),
      /DATABASE_SSL must be normalized before database access/,
    );
  });

  it("preserves the existing non-production fallback when no explicit policy is set", () => {
    assert.deepEqual(databaseSslConfig({} as NodeJS.ProcessEnv), { rejectUnauthorized: false });
  });
});
