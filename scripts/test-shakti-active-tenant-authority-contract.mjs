import { readFileSync } from "node:fs";

function read(path) { return readFileSync(path, "utf8"); }
function fail(message) { console.error(message); process.exit(1); }

const statutory = read("apps/src/statutory-routes.ts");
const sync = read("apps/src/sync-routes.ts");

const forbiddenStatutory = [
  /const organizationId = text\(body, "organizationId"\)/,
  /const requested = text\(bodyOf\(request\), "organizationId"\)/,
];
for (const pattern of forbiddenStatutory) {
  if (pattern.test(statutory)) fail(`Statutory tenant-authority contract FAILED: forbidden body-derived tenant authority remains: ${pattern}`);
}

const statutoryOrganizationHelper = statutory.match(/async function organizationFor[\\s\\S]*?\\n}\\n/);
if (!statutoryOrganizationHelper || !statutoryOrganizationHelper[0].includes("auth.activeOrganizationId") || statutoryOrganizationHelper[0].includes('bodyOf(request)')) {
  fail("Statutory tenant-authority contract FAILED: organizationFor must derive authority only from auth.activeOrganizationId.");
}

for (const route of [
  'app.post("/api/v1/statutory/bwg/assess"',
  'app.post("/api/v1/statutory/epr"',
  'app.post("/api/v1/statutory/epr/:id/external-registration"',
]) {
  if (!statutory.includes(route)) fail(`Statutory tenant-authority contract FAILED: expected route missing: ${route}`);
}
if (!/app\.post\("\/api\/v1\/statutory\/epr"[\\s\\S]*?const organizationId = auth\.activeOrganizationId;/.test(statutory)) {
  fail("Statutory tenant-authority contract FAILED: EPR mutation must bind organizationId to auth.activeOrganizationId.");
}

if (/const organizationId = stringValue\(payload, "organizationId"\)/.test(sync)) {
  fail("Field-sync tenant-authority contract FAILED: sync mutation derives organization authority directly from payload organizationId.");
}
if (!/const organizationId = auth\.activeOrganizationId; const payloadOrganizationId = stringValue\(payload, "organizationId"\)/.test(sync)) {
  fail("Field-sync tenant-authority contract FAILED: activity/resource-flow mutations must derive tenant from auth.activeOrganizationId and treat payload organizationId only as a consistency check.");
}
if (!/payloadOrganizationId &&?/.test("noop")) { /* keep this contract source intentionally simple */ }
if (!/payloadOrganizationId &&/.test(sync) && false) fail("unreachable");
const mismatchGuards = (sync.match(/payloadOrganizationId && payloadOrganizationId !== organizationId/g) || []).length;
if (mismatchGuards !== 2) fail(`Field-sync tenant-authority contract FAILED: expected 2 payload-vs-active-tenant mismatch guards, found ${mismatchGuards}.`);

if (!/auth\.activeOrganizationId && auth\.activeOrganizationId !== organizationId/.test(sync)) {
  fail("Field-sync tenant-authority contract FAILED: field-device enrollment must reject organizationId that differs from the authenticated active organization.");
}

console.log("Shakti active-tenant authority contract PASSED: statutory and field-sync mutation authority derives from authenticated active tenant context.");
