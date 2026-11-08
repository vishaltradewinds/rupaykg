#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("apps/src/sync-routes.ts", "utf8");
const schema = fs.readFileSync("migrations/009_field_sync.sql", "utf8");
const failures = [];

if (!/unique \(device_id, idempotency_key\)/.test(schema))
  failures.push("device/idempotency-key uniqueness must be database-enforced");
if (!/unique \(device_id, client_sequence\)/.test(schema))
  failures.push("device/client-sequence uniqueness must be database-enforced");
if (!/field_sync_envelopes where device_id=\$1 and idempotency_key=\$2 for update/.test(source))
  failures.push("idempotency replay must be locked before replay decision");
if (!/field_sync_envelopes where device_id=\$1 and client_sequence=\$2 for update/.test(source))
  failures.push("client sequence collision must be locked before collision decision");
if (!/dbError\.code === "23505"/.test(source))
  failures.push("database uniqueness races must be classified as PostgreSQL 23505");
if (!/dbError\.constraint.*startsWith\("field_sync_envelopes_device_id_"/.test(source))
  failures.push("only field-sync device uniqueness conflicts may be classified as replay conflicts");
if (!/FIELD_SYNC_REPLAY_CONFLICT/.test(source))
  failures.push("concurrent replay conflict must have deterministic API code");

if (failures.length) {
  console.error("Shakti field-sync concurrency conflict contract FAILED:\n" + failures.map(x => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti field-sync concurrency conflict contract PASSED.");
