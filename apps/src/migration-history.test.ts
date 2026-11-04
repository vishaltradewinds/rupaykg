import test from "node:test";
import assert from "node:assert/strict";
import { assertMigrationCatalogConsistent, assertMigrationHistoryConsistent, findMigrationCatalogVersionConflicts, findMigrationHistoryConflicts } from "./migration-history.js";

test("catalog accepts unique numeric prefixes", () => {
  assert.doesNotThrow(() => assertMigrationCatalogConsistent(["088_first.sql", "089_second.sql"]));
});

test("catalog rejects an empty migration set", () => {
  assert.throws(() => assertMigrationCatalogConsistent([]), /MIGRATION_CATALOG_EMPTY/);
});

test("catalog rejects duplicate numeric prefixes", () => {
  assert.deepEqual(findMigrationCatalogVersionConflicts(["088_first.sql", "088_second.sql"]), ["088:088_first.sql|088_second.sql"]);
  assert.throws(() => assertMigrationCatalogConsistent(["088_first.sql", "088_second.sql"]), /MIGRATION_CATALOG_CONFLICT/);
});

test("history rejects missing source files and version/prefix mismatches", () => {
  const records = [
    { version: "096", filename: "096_missing.sql" },
    { version: "999", filename: "088_present.sql" },
  ];
  assert.deepEqual(findMigrationHistoryConflicts(records, ["088_present.sql"]), [
    { version: "096", filename: "096_missing.sql", reason: "SOURCE_MISSING" },
    { version: "999", filename: "088_present.sql", reason: "VERSION_FILENAME_MISMATCH" },
  ]);
  assert.throws(() => assertMigrationHistoryConsistent(records, ["088_present.sql"]), /MIGRATION_HISTORY_UNRESOLVED/);
});

test("history accepts existing sources with matching prefixes", () => {
  assert.doesNotThrow(() => assertMigrationHistoryConsistent([{ version: "088", filename: "088_present.sql" }], ["088_present.sql"]));
});
