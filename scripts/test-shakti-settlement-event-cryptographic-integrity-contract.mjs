#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("apps/src/registry-routes.ts", "utf8");
const failures = [];

if (!source.includes('import { createHash } from "node:crypto";')) failures.push("settlement evidence hashing must use Node cryptographic SHA-256");
if (!source.includes("const settlementEventHash=")) failures.push("missing canonical settlement event hash helper");
if (!/createHash\("sha256"\).*digest\("hex"\)/s.test(source)) failures.push("settlement event hash helper must produce a SHA-256 hexadecimal digest");
for (const required of [
  'settlementEventHash(id,"AUTHORIZED",auth.identityId,ref)',
  'settlementEventHash(id,"EXECUTING",auth.identityId,ref)',
  'settlementEventHash(id,"SETTLED",auth.identityId,confirmationReference)',
]) {
  if (!source.includes(required)) failures.push("missing cryptographic hash binding: " + required);
}
if (/`(?:authorize|execute|settled):\$\{id\}/.test(source)) failures.push("settlement lifecycle evidence must not use plain-text event identifiers as event_hash");

if (failures.length) {
  console.error("Shakti settlement event cryptographic integrity contract FAILED:\n" + failures.map((x) => "- " + x).join("\n"));
  process.exit(1);
}
console.log("Shakti settlement event cryptographic integrity contract PASSED: lifecycle evidence uses canonical SHA-256 event hashes.");
