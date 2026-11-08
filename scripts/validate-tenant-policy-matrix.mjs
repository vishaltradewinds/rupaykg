import { readFile } from "node:fs/promises";

const matrix = JSON.parse(await readFile("docs/engineering/tenant-isolation-policy-matrix.json", "utf8"));
if (matrix?.denyByDefault !== true) throw new Error("Tenant policy matrix must be deny-by-default");
for (const key of ["identity_id","organization_id","service_mode","bilateral_scope"]) {
  if (matrix?.contextRequired?.[key] === undefined) throw new Error(`${key} context requirement missing`);
}
const inventory = new Set(matrix.verifiedPublicBaseTables ?? []);
if (matrix.verifiedPublicBaseTableCount !== inventory.size) throw new Error("Verified public base-table count does not match inventory");
if (inventory.size !== 67) throw new Error(`Expected verified public base-table inventory of 67; found ${inventory.size}`);
const single = new Set(matrix.singleOrganizationTables ?? []);
const bilateral = new Set(Object.keys(matrix.bilateralTables ?? {}));
const derived = new Set(matrix.derivedTenantTables ?? []);
const roots = new Set(matrix.rootOrCrossTenantTablesRequiringSeparateReview ?? []);
const overlapSets = [
  ["single", single], ["bilateral", bilateral], ["derived", derived], ["root", roots],
];
for (let i=0;i<overlapSets.length;i++) for (let j=i+1;j<overlapSets.length;j++) {
  const overlap = [...overlapSets[i][1]].filter(name => overlapSets[j][1].has(name));
  if (overlap.length) throw new Error(`Table appears in both ${overlapSets[i][0]} and ${overlapSets[j][0]} policy sets: ${overlap.join(", ")}`);
}
const classified = new Set([...single, ...bilateral, ...derived, ...roots]);
const missing = [...inventory].filter(name => !classified.has(name));
const unknown = [...classified].filter(name => !inventory.has(name));
if (missing.length) throw new Error(`Verified table inventory has no policy classification/review bucket: ${missing.join(", ")}`);
if (unknown.length) throw new Error(`Policy matrix references tables absent from verified inventory: ${unknown.join(", ")}`);
for (const name of roots) if (single.has(name) || bilateral.has(name) || derived.has(name)) throw new Error(`Root/cross-tenant table also appears in tenant policy set: ${name}`);
const required = ["organization A cannot SELECT organization B rows","organization A cannot INSERT a row claiming organization B","organization A cannot UPDATE a row into organization B","organization A cannot DELETE organization B rows","revoked membership immediately loses database visibility","suspended identity loses database visibility","pooled connections cannot retain previous request's organization context","service/migrator context is explicit and cannot be supplied by ordinary API request headers"];
for (const item of required) if (!matrix.requiredPolicyTests?.includes(item)) throw new Error(`Required policy test missing: ${item}`);
if (matrix.status !== "PROPOSED_POLICY_MATRIX__NOT_YET_IMPLEMENTED") throw new Error("Policy matrix status must remain explicit until SQL policy implementation is independently validated");
console.log(`Tenant policy matrix validation: PASS (inventory=${inventory.size}, single=${single.size}, bilateral=${bilateral.size}, derived=${derived.size}, roots=${roots.size})`);
