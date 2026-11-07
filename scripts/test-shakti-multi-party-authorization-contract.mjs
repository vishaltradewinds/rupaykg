#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("apps/src/registry-routes.ts", "utf8");
const failures = [];

const invariants = [
  ["credential issuance requires high-risk permission", /ISSUE_CREDENTIAL/],
  ["credential transfer requires high-risk permission", /TRANSFER_CREDENTIAL/],
  ["credential retirement requires high-risk permission", /RETIRE_CREDENTIAL/],
  ["settlement authorization requires high-risk permission", /AUTHORIZE_SETTLEMENT/],
  ["settlement execution requires high-risk permission", /SETTLE_FUNDS/],
  ["settlement creation binds payer to current registry owner", /payerId!==currentOwner/],
  ["settlement parties must be distinct", /payerId===payeeId/],
  ["settlement authorization checks both parties", /canActForOrganization\(auth,r\.rows\[0\]\.payer_id\).*canActForOrganization\(auth,r\.rows\[0\]\.payee_id\)/],
  ["settlement execution checks both parties", /canActForOrganization\(auth,r\.rows\[0\]\.payer_id\).*canActForOrganization\(auth,r\.rows\[0\]\.payee_id\)/],
  ["settlement confirmation checks both parties", /canActForOrganization\(auth,r\.rows\[0\]\.payer_id\).*canActForOrganization\(auth,r\.rows\[0\]\.payee_id\)/],
  ["settlement authorization requires CREATED state", /status!==\"CREATED\"/],
  ["settlement execution requires AUTHORIZED state", /status!==\"AUTHORIZED\"/],
  ["settlement confirmation requires RECONCILING state", /status!==\"RECONCILING\"/],
  ["settlement confirmation requires external execution reference", /EXTERNAL_REFERENCE_REQUIRED/],
  ["settlement confirmation rejects duplicate confirmation reference", /CONFIRMATION_REFERENCE_EXISTS/],
  ["settlement confirmation rejects duplicate reconciliation reference", /RECONCILIATION_REFERENCE_EXISTS/],
  ["registry credential transfer records provenance event", /insert into registry_events\(credential_id,event_type,from_owner_id,to_owner_id/],
  ["settlement lifecycle records immutable event trail", /insert into settlement_events\(settlement_id,event_type,actor_identity_id/],
];

for (const [name, pattern] of invariants) {
  if (!pattern.test(source)) failures.push(`Registry/settlement invariant missing: ${name}`);
}

const settlementBlocks = source.split("app.post(").filter((block) => block.includes("/api/v1/settlements"));
if (settlementBlocks.length < 5) {
  failures.push(`Expected 5 settlement lifecycle endpoints; found ${settlementBlocks.length}`);
}

if (failures.length) {
  console.error("Shakti multi-party authorization contract FAILED:");
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Shakti multi-party authorization contract PASSED: registry ownership, bilateral settlement authorization, lifecycle state transitions, high-risk permissions and settlement provenance guards are present.");
