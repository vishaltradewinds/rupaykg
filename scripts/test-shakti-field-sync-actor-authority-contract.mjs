#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("apps/src/sync-routes.ts", "utf8");
const failures = [];

const enrollmentStart = source.indexOf('app.post("/api/v1/field-devices/enroll"');
const applyStart = source.indexOf('app.post("/api/v1/field-sync/envelopes/:envelopeId/apply"');
const applyBlock = applyStart < 0 ? "" : source.slice(applyStart);

if (enrollmentStart < 0) failures.push("field-device enrollment route missing");
else {
  const block = source.slice(enrollmentStart, source.indexOf('app.post("/api/v1/field-devices/:deviceId/verify"', enrollmentStart));
  if (!block.includes("auth.activeOrganizationId")) failures.push("field-device enrollment must bind to authenticated active organization");
  if (!block.includes("withTenantTransaction(pool")) failures.push("field-device enrollment must use tenant transaction");
  if (!block.includes("const identityId = auth.identityId")) failures.push("field-device enrollment actor must derive identity from authenticated identity");
  if (!block.includes("payloadIdentityId") || !block.includes("payloadIdentityId !== identityId")) failures.push("field-device enrollment must treat request identityId only as a consistency check");
  if (!block.includes("manager")) failures.push("field-device enrollment must require management authority");
}

if (applyStart < 0) failures.push("field-sync apply route missing");
else {
  if (!applyBlock.includes("row.identity_id !== auth.identityId")) failures.push("field-sync apply must bind envelope identity to authenticated identity");
  if (!applyBlock.includes("row.organization_id !== auth.activeOrganizationId")) failures.push("field-sync apply must bind envelope organization to active tenant");
  if (!applyBlock.includes("withTenantTransaction(pool")) failures.push("field-sync apply must use tenant transaction");
  if (!applyBlock.includes("applyOperation(client, tenantAuth, row.payload)")) failures.push("field-sync apply must execute operations under authoritative tenant auth");
}

if (/registered_by_identity_id[^\n]*(?:text\(body,"identityId"\)|body\.identityId|body\["identityId"\])/.test(source)) {
  failures.push("field-device registration actor must not be sourced from request identityId");
}

if (failures.length) {
  console.error("Shakti field-sync actor authority contract FAILED:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("Shakti field-sync actor authority contract PASSED: device enrollment and sync application retain authenticated actor and active-tenant authority boundaries.");
