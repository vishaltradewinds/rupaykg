#!/usr/bin/env node
import fs from "node:fs";

const source=fs.readFileSync("apps/src/sync-routes.ts","utf8");
const failures=[];

if(!/field_sync_envelopes where device_id=\$1 and idempotency_key=\$2 for update/.test(source))
  failures.push("envelope idempotency key must be locked before replay decision");
if(!/field_sync_envelopes where device_id=\$1 and client_sequence=\$2 for update/.test(source))
  failures.push("client sequence must be locked before collision decision");
if(!/row.status === "APPLIED"/.test(source))
  failures.push("APPLIED envelopes must return authoritative replay response");
if(!/row.status !== "RECEIVED"/.test(source))
  failures.push("non-RECEIVED envelopes must fail closed");
if(!/field_sync_envelopes e join field_devices fd on fd.id=e.device_id where e.id=\$1 for update/.test(source))
  failures.push("apply endpoint must lock envelope and resolve device tenant in one transaction");
if(!/row.identity_id !== auth.identityId/.test(source))
  failures.push("apply endpoint must bind envelope identity to authenticated identity");
if(!/row.organization_id !== auth.activeOrganizationId/.test(source))
  failures.push("apply endpoint must bind envelope organization to active tenant");
if(!/applyOperation\(client, tenantAuth, row.payload\)/.test(source))
  failures.push("applied operation must execute inside the locked tenant transaction");
if(!/update field_sync_envelopes set status='APPLIED',applied_at=now\(\),applied_entity_type=\$2,applied_entity_id=\$3 where id=\$1/.test(source))
  failures.push("successful application must atomically persist APPLIED result");
if(failures.length){
  console.error("Shakti field-sync idempotency/replay contract FAILED:\n"+failures.map(x=>"- "+x).join("\n"));
  process.exit(1);
}
console.log("Shakti field-sync idempotency/replay contract PASSED.");
