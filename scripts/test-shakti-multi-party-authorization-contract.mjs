#!/usr/bin/env node
import fs from "node:fs";

const source = fs.readFileSync("apps/src/registry-routes.ts", "utf8");
const normalized = source.replace(/\s+/g, " ").trim();
const failures = [];

function routeBlock(route) {
  const marker = `app.post("${route}"`;
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const next = source.indexOf("\n  app.", start + marker.length);
  return source.slice(start, next < 0 ? source.length : next).replace(/\s+/g, " ").replace(/,\s*/g, ", ").trim();
}

function requirePattern(name, block, pattern) {
  if (!block || !pattern.test(block)) failures.push(`${name}: required guard missing`);
}

const credentialRoutes = {
  issue: routeBlock("/api/v1/credentials"),
  transfer: routeBlock("/api/v1/credentials/:credentialId/transfer"),
  retire: routeBlock("/api/v1/credentials/:credentialId/retire"),
};

requirePattern("credential issuance", credentialRoutes.issue, /canPerformHighRiskActionInDatabase\(c, auth, issuerOrganizationId, "ISSUE_CREDENTIAL"\)/);
requirePattern("credential transfer", credentialRoutes.transfer, /canPerformHighRiskActionInDatabase\(c, auth, owner, "TRANSFER_CREDENTIAL"\)/);
requirePattern("credential retirement", credentialRoutes.retire, /canPerformHighRiskActionInDatabase\(c, auth, o\.rows\[0\]\.owner_id, "RETIRE_CREDENTIAL"\)/);

const settlementRoutes = {
  create: routeBlock("/api/v1/settlements"),
  authorize: routeBlock("/api/v1/settlements/:settlementId/authorize"),
  execute: routeBlock("/api/v1/settlements/:settlementId/settle"),
  confirm: routeBlock("/api/v1/settlements/:settlementId/confirm"),
};

requirePattern("settlement creation", settlementRoutes.create, /canPerformHighRiskActionInDatabase\(c, auth, payerId, "AUTHORIZE_SETTLEMENT"\)/);
requirePattern("settlement authorization", settlementRoutes.authorize, /canPerformHighRiskActionInDatabase\(c, auth, organizationId, "AUTHORIZE_SETTLEMENT"\)/);
requirePattern("settlement execution", settlementRoutes.execute, /canPerformHighRiskActionInDatabase\(c, auth, organizationId, "SETTLE_FUNDS"\)/);
requirePattern("settlement confirmation", settlementRoutes.confirm, /canPerformHighRiskActionInDatabase\(c, auth, organizationId, "SETTLE_FUNDS"\)/);

requirePattern("settlement creation binds payer to current registry owner", settlementRoutes.create, /payerId\s*!==\s*currentOwner/);
requirePattern("settlement parties are distinct", settlementRoutes.create, /payerId\s*===\s*payeeId/);
requirePattern("settlement creation checks both organizations", settlementRoutes.create, /canActForOrganization\(auth, payerId\).*canActForOrganization\(auth, payeeId\)/);
requirePattern("settlement authorization checks both organizations", settlementRoutes.authorize, /canActForOrganization\(auth, r\.rows\[0\]\.payer_id\).*canActForOrganization\(auth, r\.rows\[0\]\.payee_id\)/);
requirePattern("settlement execution checks both organizations", settlementRoutes.execute, /canActForOrganization\(auth, r\.rows\[0\]\.payer_id\).*canActForOrganization\(auth, r\.rows\[0\]\.payee_id\)/);
requirePattern("settlement confirmation checks both organizations", settlementRoutes.confirm, /canActForOrganization\(auth, r\.rows\[0\]\.payer_id\).*canActForOrganization\(auth, r\.rows\[0\]\.payee_id\)/);
requirePattern("credential transfer requires verified destination organization", credentialRoutes.transfer, /select id from organizations where id=\$1 and status='VERIFIED'/);
requirePattern("credential issuance selects latest provenance deterministically", credentialRoutes.issue, /order by m\.created_at desc,\s*id desc limit 1/);

requirePattern("settlement authorization state gate", settlementRoutes.authorize, /status\s*!==\s*"CREATED"/);
requirePattern("settlement execution state gate", settlementRoutes.execute, /status\s*!==\s*"AUTHORIZED"/);
requirePattern("settlement confirmation state gate", settlementRoutes.confirm, /status\s*!==\s*"RECONCILING"/);
requirePattern("settlement confirmation requires external execution reference", settlementRoutes.confirm, /EXTERNAL_REFERENCE_REQUIRED/);
requirePattern("settlement confirmation rejects duplicate confirmation reference", settlementRoutes.confirm, /CONFIRMATION_REFERENCE_EXISTS/);
requirePattern("settlement confirmation rejects duplicate reconciliation reference", settlementRoutes.confirm, /RECONCILIATION_REFERENCE_EXISTS/);

if (!/insert into registry_events\(credential_id,event_type,from_owner_id,to_owner_id/.test(normalized)) {
  failures.push("registry credential transfer does not record provenance event");
}
if (!/insert into settlement_events\(settlement_id,event_type,actor_identity_id,external_reference,event_hash/.test(normalized)) {
  failures.push("settlement lifecycle does not record immutable event trail");
}

const settlementEndpointCount = [
  settlementRoutes.create,
  settlementRoutes.authorize,
  settlementRoutes.execute,
  settlementRoutes.confirm,
  routeBlock("/api/v1/settlements/:settlementId/cancel"),
].filter(Boolean).length;

if (settlementEndpointCount < 4) {
  failures.push(`Expected at least 4 settlement lifecycle endpoints; found ${settlementEndpointCount}`);
}

if (failures.length) {
  console.error("Shakti multi-party authorization contract FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Shakti multi-party authorization contract PASSED: registry ownership, bilateral settlement authorization, lifecycle state transitions, high-risk permissions and settlement provenance guards are present.");
