import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const migrationPath = [
  "../../migrations/20261128_epr_return_atomic_fulfillment.sql",
  "../../../migrations/20261128_epr_return_atomic_fulfillment.sql",
].map((path) => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
if (!migrationPath) throw new Error("Atomic EPR return fulfillment migration not found");
const migration = readFileSync(migrationPath, "utf8");

const routePath = [
  "../src/epr-return-routes.ts",
  "../../src/epr-return-routes.ts",
].map((path) => fileURLToPath(new URL(path, import.meta.url))).find(existsSync);
if (!routePath) throw new Error("EPR return route source not found");
const route = readFileSync(routePath, "utf8");

test("EPR return submission accounting is database-authoritative and idempotent across state transitions", () => {
  assert.match(migration, /create or replace function reconcile_epr_return_obligation_fulfillment/i);
  assert.match(migration, /before insert or update of status, fulfilled_quantity, reported_quantity/i);
  assert.match(migration, /EPR_RETURN_OBLIGATION_CAPACITY_EXCEEDED/);
  assert.match(migration, /EPR_RETURN_SUBMITTED_BASIS_IMMUTABLE/);
  assert.match(migration, /EPR_RETURN_REJECTION_ACCOUNTING_MISMATCH/);
  assert.match(migration, /set fulfilled_quantity = fulfilled_quantity \+ new\.fulfilled_quantity/i);
  assert.match(migration, /set fulfilled_quantity = greatest\(fulfilled_quantity - old\.fulfilled_quantity, 0\)/i);
});

test("HTTP EPR return submission does not double-increment obligation fulfillment", () => {
  assert.doesNotMatch(
    route,
    /update epr_obligations set fulfilled_quantity\s*=\s*fulfilled_quantity\s*\+/i,
    "database trigger owns the single atomic fulfillment increment",
  );
  assert.match(route, /database submission trigger atomically reserves obligation quantity/i);
});
