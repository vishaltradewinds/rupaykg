#!/usr/bin/env node
import fs from "node:fs";
const migration=fs.readFileSync("migrations/088_field_sync_append_only_integrity.sql","utf8");
const source=fs.readFileSync("apps/src/sync-routes.ts","utf8");
const failures=[];
if(!/prevent_field_sync_envelope_mutation/.test(migration)) failures.push("append-only trigger function missing");
if(!/set search_path = public, app/.test(migration)) failures.push("fixed search_path missing");
if(!/tg_op = 'DELETE'/.test(migration)) failures.push("DELETE mutation guard missing");
if(!/before update or delete on field_sync_envelopes/.test(migration)) failures.push("update/delete trigger missing");
if(!/processed sync envelope provenance is append-only/.test(migration)) failures.push("processed envelope provenance guard missing");
if(!/field_sync_envelopes where device_id=\$1 and idempotency_key=\$2 for update/.test(source)) failures.push("idempotency replay lock missing");
if(!/field_sync_envelopes where device_id=\$1 and client_sequence=\$2 for update/.test(source)) failures.push("sequence collision lock missing");
if(failures.length){console.error("Shakti field-sync append-only integrity contract FAILED:\n"+failures.map(x=>"- "+x).join("\n"));process.exit(1)}
console.log("Shakti field-sync append-only integrity contract PASSED.");
