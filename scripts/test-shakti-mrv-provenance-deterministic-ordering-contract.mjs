#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("apps/src/mrv-routes.ts", "utf8");
const normalized = source.replace(/\s+/g, " ").trim();
const failures = [];

const provenanceQueries = normalized.match(/from mrv_provenance_events[\s\S]*?order by created_at desc,id desc limit 1/g) ?? [];
if (provenanceQueries.length < 2) {
  failures.push("MRV provenance latest-record queries must use deterministic created_at DESC, id DESC ordering");
}
if (/from mrv_provenance_events[\s\S]*?order by created_at desc(?!,id desc)/.test(normalized)) {
  failures.push("MRV provenance query still contains a non-deterministic created_at-only ordering");
}

if (failures.length) {
  console.error("Shakti MRV provenance deterministic-ordering contract FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Shakti MRV provenance deterministic-ordering contract PASSED.");
