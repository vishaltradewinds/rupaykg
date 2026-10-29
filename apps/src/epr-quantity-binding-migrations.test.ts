import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const migration = async (name: string) =>
  (await readFile(path.resolve(process.cwd(), "migrations", name), "utf8")).toLowerCase();

test("EPR quantity-binding SQL retains fail-closed mapping and source provenance guards", async () => {
  const sql = await migration("097_epr_authoritative_quantity_binding.sql");
  assert.match(sql, /approval_status\s*<>\s*'approved'/);
  assert.match(sql, /source_hash\s*~\s*'\^\[0-9a-f\]\{64\}\$'/);
  assert.match(sql, /mapping\.effective_from/);
  assert.match(sql, /mapping\.effective_to/);
  assert.match(sql, /observation\.quality_status/);
  assert.match(sql, /verification_row\.decision/);
  assert.match(sql, /epr allocations exceed eligible source quantity/);
  assert.match(sql, /epr reversals exceed original allocation/);
});

test("EPR source-binding SQL retains null-safe organization, geography, and custody checks", async () => {
  const sql = await migration("099_epr_quantity_binding_geography_and_null_safety.sql");
  assert.match(sql, /is distinct from new\.organization_id/);
  assert.match(sql, /organization_has_geography_scope\(new\.organization_id, activity_geography\)/);
  assert.match(sql, /c\.from_geography_id is not distinct from activity_geography/);
  assert.match(sql, /c\.evidence_id = new\.evidence_id/);
  assert.match(sql, /c\.quantity >= new\.source_quantity/);
});

test("EPR allocation SQL serializes allocations at the physical resource-flow row", async () => {
  const sql = await migration("101_epr_allocation_unit_reconciliation_fix.sql");
  assert.match(sql, /from resource_flows where id = binding\.resource_flow_id for update/);
  assert.match(sql, /flow_allocated_source_equivalent/);
  assert.match(sql, /a\.quantity \/ m\.conversion_factor/);
  assert.match(sql, /epr allocations exceed total resource-flow quantity after unit conversion/);
  assert.match(sql, /epr allocations exceed remaining obligation balance/);
});

test("EPR reversal SQL ties reversal to original allocation, binding, obligation, and unit", async () => {
  const sql = await migration("101_epr_allocation_unit_reconciliation_fix.sql");
  assert.match(sql, /original\.action <> 'allocate'/);
  assert.match(sql, /original\.binding_id <> new\.binding_id/);
  assert.match(sql, /original\.obligation_id <> new\.obligation_id/);
  assert.match(sql, /original\.quantity_unit is distinct from new\.quantity_unit/);
  assert.match(sql, /already_reversed \+ new\.quantity > original\.quantity/);
});

test("EPR source bindings become immutable after eligibility, rejection, or allocation", async () => {
  const sql = await migration("102_epr_source_binding_immutability.sql");
  assert.match(sql, /old\.binding_status in \('eligible', 'rejected'\)/);
  assert.match(sql, /epr source bindings are retained as audit records and cannot be deleted/);
  assert.match(sql, /epr source-binding provenance is immutable/);
  assert.match(sql, /rejected epr source binding requires a reason/);
  assert.match(sql, /eligible epr source binding cannot have a rejection reason/);
});

test("EPR submission remains fail-closed until authoritative quantity binding is implemented", async () => {
  const route = (await readFile(path.resolve(process.cwd(), "apps/src/epr-return-routes.ts"), "utf8")).toLowerCase();
  assert.match(route, /epr_quantity_binding_not_implemented/);
  assert.match(route, /productiongate\s*:\s*["']hold["']/);
});

test("EPR obligation allocation refuses mixed target units until an authoritative obligation unit exists", async () => {
  const sql = await migration("103_epr_obligation_allocation_unit_consistency.sql");
  assert.match(sql, /prior\.obligation_id = new\.obligation_id/);
  assert.match(sql, /prior\.quantity_unit is distinct from new\.quantity_unit/);
  assert.match(sql, /epr obligation allocations must use one consistent target unit/);
});

test("EPR source observation cannot be bound twice and allocation ledger remains append-only", async () => {
  const schema = await migration("097_epr_authoritative_quantity_binding.sql");
  const allocationGuard = await migration("097_epr_authoritative_quantity_binding.sql");
  const immutability = await migration("102_epr_source_binding_immutability.sql");
  assert.match(schema, /unique\s*\(mrv_observation_id\)/);
  assert.match(allocationGuard, /idempotency_key text not null unique/);
  assert.match(allocationGuard, /epr quantity allocation events are append-only/);
  assert.match(immutability, /before update or delete on epr_quantity_source_bindings/);
});
