import test from "node:test";
import assert from "node:assert/strict";
import { assertNoOrphanedMigrations, classifyRecordedMigration, sha256Hex } from "./migration-integrity.js";

const bytes = Buffer.from("select 1;\n", "utf8");
const checksum = sha256Hex(bytes);
const source = { version: "001", filename: "001_core.sql", checksum };
const row = { version: "001", filename: "001_core.sql", checksum_sha256: checksum };

test("SHA-256 is deterministic over exact bytes, including line endings", () => {
  assert.equal(checksum, "4a45092ccf992ea92250053a80b931b787924ba61648f420555511b84f10ab6c");
  assert.notEqual(checksum, sha256Hex(Buffer.from("select 1;", "utf8")));
});

test("accepts an exact filename and checksum match", () => {
  assert.equal(classifyRecordedMigration(row, source), "VERIFIED");
});

test("fails closed for legacy rows without a checksum", () => {
  assert.throws(() => classifyRecordedMigration({ ...row, checksum_sha256: null }, source), /LEGACY_UNVERIFIED/);
});

test("rejects changed migration bytes under the same filename", () => {
  assert.throws(() => classifyRecordedMigration(row, { ...source, checksum: "0".repeat(64) }), /MIGRATION_CHECKSUM_DRIFT/);
});

test("rejects filename drift and orphaned ledger rows", () => {
  assert.throws(() => classifyRecordedMigration(row, { ...source, filename: "001_renamed.sql" }), /MIGRATION_FILENAME_DRIFT/);
  assert.throws(() => assertNoOrphanedMigrations([row], new Map()), /MIGRATION_LEDGER_ORPHAN/);
});

test("rejects malformed checksum metadata", () => {
  assert.throws(() => classifyRecordedMigration({ ...row, checksum_sha256: "not-a-hash" }, source), /MIGRATION_CHECKSUM_INVALID/);
});
