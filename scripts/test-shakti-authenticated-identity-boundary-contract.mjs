import fs from "node:fs";

const source = fs.readFileSync("apps/src/auth-routes.ts", "utf8");
const routeStart = source.indexOf('app.post("/api/v1/onboarding/applications"');
if (routeStart < 0) throw new Error("Onboarding application route not found");
const routeEnd = source.indexOf('\n app.', routeStart + 5);
const route = source.slice(routeStart, routeEnd < 0 ? source.length : routeEnd);

if (!route.includes("const auth=await requireAuth(request,reply,pool)")) {
  throw new Error("Onboarding route must authenticate before establishing identity context");
}
if (!route.includes("withIdentityTransaction(pool,auth.identityId")) {
  throw new Error("Onboarding route must derive identity context from authenticated auth.identityId");
}
if (/body[^\n]*identityId|text\(body,"identityId"\)|body\.identityId/.test(route)) {
  throw new Error("Request body must not establish onboarding identity context");
}
if (!route.includes("insert into organizations") || !route.includes("insert into organization_memberships") || !route.includes("insert into stakeholder_applications")) {
  throw new Error("Onboarding organization, membership, and application writes must remain inside the identity transaction");
}
if (/await pool\\.(query|connect)\\(/.test(route)) {
  throw new Error("Onboarding application route contains a direct pool query/connect");
}
console.log("Shakti onboarding authenticated-identity boundary contract PASSED");
