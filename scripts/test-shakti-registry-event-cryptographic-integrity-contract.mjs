#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("apps/src/registry-routes.ts", "utf8");
const failures = [];

if (!source.includes('import { createHash } from "node:crypto";')) failures.push("registry evidence hashing must use Node cryptographic SHA-256");
if (!source.includes("const canonicalEventHash=")) failures.push("missing canonical registry event hash helper");
if (!/createHash\("sha256"\).*JSON\.stringify\(parts\).*digest\("hex"\)/s.test(source)) failures.push("registry event hash helper must hash canonical serialized event parts");
for (const required of [
  'canonicalEventHash(inserted.rows[0].id,"ISSUED",issuerOrganizationId,verificationId,auth.identityId)',
  'canonicalEventHash(id,"ACTIVATED",r.rows[0].issuer_organization_id,auth.identityId)',
  'canonicalEventHash(id,"TRANSFERRED",owner,toOwnerId,auth.identityId)',
  'canonicalEventHash(id,"RETIRED",o.rows[0].owner_id,auth.identityId)',
]) {
  if (!source.includes(required)) failures.push("missing cryptographic registry event binding: " + required);
}
if (/`(?:issue|activate|transfer|retire):\\$\\{id\\}/.test(source)) failures.push("registry provenance evidence must not use plain-text event identifiers as event_hash");
if (/Date\.now\(\)/.test(source)) failures.push("registry provenance event hashes must not depend on wall-clock timestamps");

if (failures.length) {
  console.error("Shakti registry event cryptographic integrity contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti registry event cryptographic integrity contract PASSED: provenance events use canonical SHA-256 hashes without wall-clock dependence.");
