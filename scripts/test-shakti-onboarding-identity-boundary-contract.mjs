import fs from "node:fs";

const source = fs.readFileSync("apps/src/auth-routes.ts", "utf8");
const routeStart = source.indexOf('app.post("/api/v1/onboarding/applications"');
if (routeStart < 0) throw new Error("Onboarding application route not found");

const routeEnd = source.indexOf('\n app.', routeStart + 5);
const route = source.slice(routeStart, routeEnd < 0 ? source.length : routeEnd);

if (!route.includes("withIdentityTransaction(pool,auth.identityId")) {
  throw new Error("Onboarding application route is not bound to identity transaction context");
}
if (!route.includes("await client.query(\"select id from geography")) {
  throw new Error("Geography validation is not inside the identity transaction");
}
if (!route.includes("await client.query(`select id from stakeholder_applications")) {
  throw new Error("Duplicate application check is not inside the identity transaction");
}
if (!route.includes("insert into organizations")) {
  throw new Error("Organization creation is not inside the identity transaction");
}
if (!route.includes("insert into organization_memberships")) {
  throw new Error("Membership creation is not inside the identity transaction");
}
if (!route.includes("insert into stakeholder_applications")) {
  throw new Error("Application creation is not inside the identity transaction");
}
if (/await pool\\.(query|connect)\\(/.test(route)) {
  throw new Error("Onboarding application route contains a direct pool query/connect");
}
console.log("Shakti onboarding identity-boundary contract PASSED");
