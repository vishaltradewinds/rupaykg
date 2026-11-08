#!/usr/bin/env node
import fs from "node:fs";

const failures = [];
const workflow = fs.readFileSync(".github/workflows/tenant-isolation-live-acceptance.yml", "utf8");
const boundary = fs.readFileSync("ops/tenant-isolation/VERIFY_SECURITY_DEFINER_BOUNDARIES.sql", "utf8");

if (/psql "\$RUPAYKG_RUNTIME_DATABASE_URL" \\\\/.test(workflow)) {
  failures.push("SECURITY DEFINER acceptance step contains a double-backslash shell continuation; this passes a literal backslash instead of continuing the command.");
}
if (!/psql "\$RUPAYKG_RUNTIME_DATABASE_URL" \\\n\s+-v ON_ERROR_STOP=1 \\\n\s+-f ops\/tenant-isolation\/VERIFY_SECURITY_DEFINER_BOUNDARIES\.sql/.test(workflow)) {
  failures.push("SECURITY DEFINER acceptance step must invoke psql with ON_ERROR_STOP and the boundary verification SQL.");
}
if (!/where version in \('097','098','099'\)/.test(workflow)) {
  failures.push("Live acceptance must verify the Shakti 097-099 migration baseline.");
}
if (!/Required Shakti migration \$\{version\} is not applied/.test(workflow)) {
  failures.push("Live acceptance must fail closed when a required Shakti migration is missing.");
}
for (const fn of ["app.set_request_context", "app.is_verified_org_member", "app.authenticate_bearer_session"]) {
  if (!boundary.includes(fn)) failures.push(`Boundary verification missing function: ${fn}`);
}
if (!/not has_function_privilege\('public', 'app\.set_request_context/.test(boundary)
 || !/not has_function_privilege\('public', 'app\.is_verified_org_member/.test(boundary)
 || !/not has_function_privilege\('public', 'app\.authenticate_bearer_session/.test(boundary)) {
  failures.push("Boundary verification must fail closed on PUBLIC EXECUTE.");
}

if (failures.length) {
  console.error("Shakti live-acceptance workflow contract FAILED:");
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Shakti live-acceptance workflow contract PASSED.");
