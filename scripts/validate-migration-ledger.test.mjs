import test from "node:test";
import assert from "node:assert/strict";

function compare(sourceFiles, rows, exceptions = []) {
  const expected = rows.map((row) => row.filename).filter((name) => !exceptions.includes(name)).sort();
  const actual = [...sourceFiles].sort();
  return {
    missing: expected.filter((name) => !actual.includes(name)),
    unexpected: actual.filter((name) => !expected.includes(name)),
    duplicateVersions: rows.filter((row, i) => rows.findIndex((other) => other.version === row.version) !== i).map((row) => row.version),
  };
}

test("accepts exact source-to-ledger parity with a documented historical exception", () => {
  const rows = [{ version: "001", filename: "001_core.sql" }, { version: "096", filename: "096_legacy.sql" }];
  const result = compare(["001_core.sql"], rows, ["096_legacy.sql"]);
  assert.deepEqual(result, { missing: [], unexpected: [], duplicateVersions: [] });
});

test("detects a ledger row whose source file is missing", () => {
  const result = compare([], [{ version: "001", filename: "001_core.sql" }]);
  assert.deepEqual(result.missing, ["001_core.sql"]);
});

test("detects a repository migration absent from the ledger", () => {
  const result = compare(["002_new.sql"], [{ version: "001", filename: "001_core.sql" }]);
  assert.deepEqual(result.unexpected, ["002_new.sql"]);
});

test("detects duplicate ledger versions", () => {
  const result = compare([], [{ version: "001", filename: "001_a.sql" }, { version: "001", filename: "001_b.sql" }]);
  assert.deepEqual(result.duplicateVersions, ["001"]);
});
