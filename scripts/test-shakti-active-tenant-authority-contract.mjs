import { readFileSync } from "node:fs";

function read(path) { return readFileSync(path, "utf8"); }
function fail(message) { console.error(message); process.exit(1); }

const statutory = read("apps/src/statutory-routes.ts");
const sync = read("apps/src/sync-routes.ts");

if (statutory.includes('const organizationId = text(body, "organizationId")')) {
  fail("Statutory tenant-authority contract FAILED: EPR mutation still derives tenant authority from request body.");
}
if (statutory.includes('const requested = text(bodyOf(request), "organizationId")')) {
  fail("Statutory tenant-authority contract FAILED: organizationFor still derives tenant authority from request body.");
}

const helperStart = statutory.indexOf("async function organizationFor");
const helperEnd = statutory.indexOf("\n\nasync function tenantQuery", helperStart);
const helper = helperStart >= 0 && helperEnd >= 0 ? statutory.slice(helperStart, helperEnd + 3) : "";
if (!helper.includes("auth.activeOrganizationId") || helper.includes("bodyOf(request)")) {
  fail("Statutory tenant-authority contract FAILED: organizationFor must derive authority only from auth.activeOrganizationId.");
}

for (const route of [
  'app.post("/api/v1/statutory/bwg/assess"',
  'app.post("/api/v1/statutory/epr"',
  'app.post("/api/v1/statutory/epr/:id/external-registration"',
]) {
  if (!statutory.includes(route)) fail(`Statutory tenant-authority contract FAILED: expected route missing: ${route}`);
}
const eprRouteStart = statutory.indexOf('app.post("/api/v1/statutory/epr"');
const eprRouteEnd = statutory.indexOf('app.post("/api/v1/statutory/epr/:id/external-registration"', eprRouteStart);
const eprRoute = eprRouteStart >= 0 && eprRouteEnd >= 0 ? statutory.slice(eprRouteStart, eprRouteEnd) : "";
if (!eprRoute.includes("const organizationId = auth.activeOrganizationId;")) {
  fail("Statutory tenant-authority contract FAILED: EPR mutation must bind organizationId to auth.activeOrganizationId.");
}

if (sync.includes('const organizationId = stringValue(payload, "organizationId")')) {
  fail("Field-sync tenant-authority contract FAILED: sync mutation derives organization authority directly from payload organizationId.");
}
if (!sync.includes('const organizationId = auth.activeOrganizationId; const payloadOrganizationId = stringValue(payload, "organizationId")')) {
  fail("Field-sync tenant-authority contract FAILED: activity/resource-flow mutations must derive tenant from auth.activeOrganizationId and treat payload organizationId only as a consistency check.");
}
const mismatchGuards = sync.split("payloadOrganizationId && payloadOrganizationId !== organizationId").length - 1;
if (mismatchGuards !== 2) {
  fail(`Field-sync tenant-authority contract FAILED: expected 2 payload-vs-active-tenant mismatch guards, found ${mismatchGuards}.`);
}
if (!sync.includes('if (!auth.activeOrganizationId || auth.activeOrganizationId !== organizationId)')) {
  fail("Field-sync tenant-authority contract FAILED: field-device enrollment must reject organizationId that differs from the authenticated active organization.");
}

console.log("Shakti active-tenant authority contract PASSED: statutory and field-sync mutation authority derives from authenticated active tenant context.");
