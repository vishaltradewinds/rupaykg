import assert from "node:assert/strict";
import { test } from "node:test";
import { missingMigrationSources } from "../src/migration-history.js";

test("migration history accepts applied rows when exact source files exist", () => {
  const applied = [
    { version: "001", filename: "001_initial.sql" },
    { version: "002", filename: "002_evidence.sql" },
  ];
  assert.deepEqual(
    missingMigrationSources(applied, new Set(["001_initial.sql", "002_evidence.sql", "003_next.sql"])),
    [],
  );
});

test("migration history fails closed when an applied source file is missing", () => {
  const applied = [
    { version: "096", filename: "096_verification_authorization_provenance.sql" },
    { version: "20261022", filename: "20261022_async_intake.sql" },
  ];
  assert.deepEqual(
    missingMigrationSources(applied, new Set(["001_initial.sql", "002_evidence.sql"])),
    applied,
  );
});
