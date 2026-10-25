import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { findMigrationFilenameConflicts } from "./migration-inventory.js";

test("migration inventory reports every filename/version collision", () => {
  const conflicts = findMigrationFilenameConflicts(
    [
      "20261022_cpcb_swm_evidence_links.sql",
      "20261023_bm_wa03001_baseline_records.sql",
      "20261029_cpcb_swm_evidence_links.sql",
    ],
    [
      { version: "20261022", filename: "20261022_async_mirror_inbox.sql" },
      { version: "20261023", filename: "20261023_async_mirror_worker_leases.sql" },
      { version: "20261029", filename: "20261029_cpcb_swm_evidence_links.sql" },
    ],
  );
  assert.deepEqual(conflicts, [
    {
      version: "20261022",
      recorded: "20261022_async_mirror_inbox.sql",
      expected: "20261022_cpcb_swm_evidence_links.sql",
    },
    {
      version: "20261023",
      recorded: "20261023_async_mirror_worker_leases.sql",
      expected: "20261023_bm_wa03001_baseline_records.sql",
    },
  ]);
});

test("migration inventory accepts preserved identities and fresh unique versions", () => {
  assert.deepEqual(
    findMigrationFilenameConflicts(
      ["20261022_async_mirror_inbox.sql", "20261029_cpcb_swm_evidence_links.sql"],
      [{ version: "20261022", filename: "20261022_async_mirror_inbox.sql" }],
    ),
    [],
  );
});

test("runner checks all migration filename conflicts before the first migration can apply", () => {
  const source = readFileSync(fileURLToPath(new URL("../../src/migrate.ts", import.meta.url)), "utf8");
  const preflight = source.indexOf("if (conflicts.length > 0)");
  const firstMigrationLoop = source.indexOf("for (const filename of files)");
  assert.ok(preflight >= 0, "runner must reject detected conflicts");
  assert.ok(firstMigrationLoop > preflight, "the complete conflict preflight must precede migration application");
});
