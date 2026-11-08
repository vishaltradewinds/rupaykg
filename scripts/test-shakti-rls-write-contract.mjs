#!/usr/bin/env node
import fs from "node:fs";
const test = fs.readFileSync("apps/src/tenant-isolation.integration.test.ts", "utf8");
const failures = [];
for (const name of [
  "Shakti RLS runtime role isolates core tenant rows",
  "Shakti RLS child-row scope follows the parent activity tenant",
  "Shakti RLS evidence rows are tenant-isolated for insert and read",
  "Shakti RLS carbon calculations are tenant-isolated on parent activity scope",
  "Shakti RLS EPR obligations are tenant-isolated for insert, read and update",
]) if (!test.includes('test("' + name + '"')) failures.push(name + " missing");
const protectedTables = ["activities","measurements","evidence","carbon_calculations","epr_obligations"];
for (const table of protectedTables) {
  if (!test.includes("insert into " + table)) failures.push("RLS write coverage missing for " + table);
}
if (!test.includes("row-level security|policy")) failures.push("cross-tenant RLS rejection assertions missing");
if (!test.includes("epr_obligations") || !test.includes("update epr_obligations")) failures.push("EPR obligation RLS mutation coverage missing");
if (failures.length) {
  console.error("Shakti RLS write contract FAILED:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}
console.log("Shakti RLS write contract PASSED");
