import assert from "node:assert/strict";
import { test } from "node:test";
import { migrationHistoryConflicts, missingMigrationSources } from "../src/migration-history.js";

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


test("migration preflight rejects version/filename mismatches before applying new SQL", () => {
  const applied = [
    { version: "088", filename: "089_esg_methodology_binding.sql" },
    { version: "089", filename: "089_esg_methodology_binding.sql" },
  ];
  assert.deepEqual(
    migrationHistoryConflicts(applied, new Set(["088_epr_authoritative_quantity_binding.sql", "089_esg_methodology_binding.sql"])),
    [{ version: "088", filename: "089_esg_methodology_binding.sql", reason: "VERSION_FILENAME_MISMATCH" }],
  );
});

test("migration preflight reports missing source files and filename mismatches together", () => {
  const applied = [
    { version: "096", filename: "096_verification_authorization_provenance.sql" },
    { version: "089", filename: "088_epr_authoritative_quantity_binding.sql" },
  ];
  assert.deepEqual(
    migrationHistoryConflicts(applied, new Set(["088_epr_authoritative_quantity_binding.sql", "089_esg_methodology_binding.sql"])),
    [
      { version: "096", filename: "096_verification_authorization_provenance.sql", reason: "SOURCE_MISSING" },
      { version: "089", filename: "088_epr_authoritative_quantity_binding.sql", reason: "VERSION_FILENAME_MISMATCH" },
    ],
  );
});
