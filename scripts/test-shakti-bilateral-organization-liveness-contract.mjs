#!/usr/bin/env node
import fs from "node:fs";

const auth = fs.readFileSync("apps/src/auth.ts", "utf8").replace(/\s+/g, " ").trim();
const registry = fs.readFileSync("apps/src/registry-routes.ts", "utf8").replace(/\s+/g, " ").trim();
const failures = [];

function requirePattern(name, source, pattern) {
  if (!pattern.test(source)) failures.push(`${name}: required DB-authoritative liveness guard missing`);
}

requirePattern(
  "database bilateral membership helper",
  auth,
  /export async function canActForOrganizationInDatabase\(client: Pool \| PoolClient, auth: AuthContext, organizationId: string\): Promise<boolean>/
);
requirePattern("DB helper checks verified identity", auth, /i\.status = 'VERIFIED'/);
requirePattern("DB helper rejects suspended identity", auth, /i\.suspended_at is null/);
requirePattern("DB helper checks verified membership", auth, /om\.status = 'VERIFIED'/);
requirePattern("DB helper checks verified organization", auth, /o\.status = 'VERIFIED'/);
requirePattern("DB helper preserves in-memory scope gate", auth, /canActForOrganization\(auth, organizationId\)/);

const settlementRoutes = [
  ["/api/v1/settlements", "AUTHORIZE_SETTLEMENT"],
  ["/api/v1/settlements/:settlementId/authorize", "AUTHORIZE_SETTLEMENT"],
  ["/api/v1/settlements/:settlementId/settle", "SETTLE_FUNDS"],
  ["/api/v1/settlements/:settlementId/confirm", "SETTLE_FUNDS"],
];

for (const [route, permission] of settlementRoutes) {
  const marker = `app.post("${route}"`;
  const start = registry.indexOf(marker);
  if (start < 0) {
    failures.push(`${route}: route missing`);
    continue;
  }
  const next = registry.indexOf(" app.post(\"", start + marker.length);
  const block = registry.slice(start, next < 0 ? registry.length : next);
  requirePattern(`${route} payer DB liveness`, block, /canActForOrganizationInDatabase\(c,auth,r?\.rows\[0\]\.payer_id|canActForOrganizationInDatabase\(c,auth,payerId/);
  requirePattern(`${route} payee DB liveness`, block, /canActForOrganizationInDatabase\(c,auth,r?\.rows\[0\]\.payee_id|canActForOrganizationInDatabase\(c,auth,payeeId/);
  requirePattern(`${route} high-risk permission`, block, new RegExp(`canPerformHighRiskActionInDatabase\\(c,auth,(?:organizationId|payerId),"${permission}"\\)`));
}

requirePattern(
  "credential transfer locks verified destination membership",
  registry,
  /select id from organization_memberships where organization_id=\$1 and status='VERIFIED' order by id limit 1 for share/
);

if (failures.length) {
  console.error("Shakti bilateral organization liveness contract FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Shakti bilateral organization liveness contract PASSED: settlement payer/payee access is revalidated against live verified identity, membership and organization state inside the mutation transaction, and transfer target membership is locked.");
