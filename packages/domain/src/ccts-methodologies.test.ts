import test from "node:test";
import assert from "node:assert/strict";
import {
  CCTS_OFFICIAL_REGISTRY_SNAPSHOT,
  cctsMethodologyReadiness,
  getCctsRegistryItem,
  listCctsRegistryItems,
} from "./ccts-methodologies.js";

test("registry snapshot contains all 12 methodologies published by BEE on 2026-07-07", () => {
  const methods = listCctsRegistryItems({ kind: "METHODOLOGY" });
  assert.equal(methods.length, 12);
  assert.equal(new Set(methods.map((item) => item.code)).size, 12);
  assert.ok(methods.every((item) => item.implementationStatus === "REGISTRY_ONLY"));
});

test("registry snapshot includes the 17 approved tools listed by BEE", () => {
  const tools = listCctsRegistryItems({ kind: "TOOL" });
  assert.equal(tools.length, 17);
  assert.equal(new Set(tools.map((item) => item.code)).size, 17);
  assert.ok(tools.some((item) => item.code === "BM-T-011"));
  assert.ok(tools.some((item) => item.code === "BMT-T-AR-0006"));
});

test("registry lookup is case-insensitive and trims whitespace", () => {
  assert.equal(getCctsRegistryItem(" bm wa03.001 ")?.title, "Landfill methane recovery");
});

test("sector filters do not conflate BWG role with project methodology", () => {
  const waste = listCctsRegistryItems({ kind: "METHODOLOGY", sector: "WASTE_HANDLING_AND_DISPOSAL" });
  assert.deepEqual(waste.map((item) => item.code), ["BM WA03.001", "BM WA03.002", "BM WA03.003"]);
});

test("methodology readiness fails closed even for a listed approved methodology", () => {
  const readiness = cctsMethodologyReadiness("BM WA03.001");
  assert.equal(readiness.status, "UNRESOLVED");
  assert.equal(readiness.registryItem?.implementationStatus, "REGISTRY_ONLY");
  assert.match(readiness.reason, /NOT_VALIDATED/);
});

test("unknown method and tool identifiers cannot be treated as eligible methodologies", () => {
  assert.equal(cctsMethodologyReadiness("BM UNKNOWN").status, "UNRESOLVED");
  assert.equal(cctsMethodologyReadiness("BM-T-011").registryItem, null);
  assert.equal(CCTS_OFFICIAL_REGISTRY_SNAPSHOT.length, 29);
});
