import test from "node:test";
import assert from "node:assert/strict";
import { databaseTlsConfig } from "./database-tls.js";

test("PostgreSQL TLS verifies certificates by default", () => {
  assert.deepEqual(databaseTlsConfig(undefined), { rejectUnauthorized: true });
});

test("PostgreSQL TLS verifies certificates when require mode is explicit", () => {
  assert.deepEqual(databaseTlsConfig("require"), { rejectUnauthorized: true });
});

test("PostgreSQL TLS passes through an explicitly supplied CA certificate", () => {
  assert.deepEqual(databaseTlsConfig("require", "  PEM-CA  "), {
    rejectUnauthorized: true,
    ca: "PEM-CA",
  });
});

test("PostgreSQL TLS can be disabled only by an explicit validated false mode", () => {
  assert.equal(databaseTlsConfig("false"), undefined);
});
