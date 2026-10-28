import test from "node:test";
import assert from "node:assert/strict";
import { initialSwmChecklist } from "@rupaykg/domain";
import { resolveStakeholderTaxonomy } from "./cpcb-swm-routes.js";
import { safeChecklist, safeObservations, isCpcbReportedStatus, isSwmLocalStage } from "./cpcb-swm-routes.js";

const baseChecklist = initialSwmChecklist("BWG").map(item => ({
  ...item,
  status: item.key === "water_consumption_bill" ? "PROVIDED_UNVERIFIED" : "MISSING",
}));

const baseObservations = {
  floorAreaM2: { value: null, unit: "m2", sourceReference: "", periodStart: "", periodEnd: "" },
  waterConsumptionLitresPerDay: { value: 40000, unit: "L/day", sourceReference: "evidence://water-bill", periodStart: "2026-09-01", periodEnd: "2026-09-30" },
  wasteGenerationKgPerDay: { value: 100, unit: "kg/day", sourceReference: "evidence://weighbridge", periodStart: "2026-09-01", periodEnd: "2026-09-30" },
};

test("CPCB SWM checklist accepts canonical BWG checklist with unverified evidence states", () => {
  assert.equal(safeChecklist(baseChecklist, "BWG")?.find(item => item.key === "water_consumption_bill")?.status, "PROVIDED_UNVERIFIED");
});

test("CPCB SWM checklist rejects client-supplied verification", () => {
  assert.equal(safeChecklist(baseChecklist.map(item => item.key === "water_consumption_bill" ? { ...item, status: "VERIFIED" } : item), "BWG"), null);
});

test("CPCB SWM checklist rejects duplicate keys, unknown states and client-invented requirements", () => {
  assert.equal(safeChecklist([...baseChecklist, baseChecklist[0]!], "BWG"), null);
  assert.equal(safeChecklist(baseChecklist.map(item => item.key === "water_consumption_bill" ? { ...item, status: "CPCB_APPROVED" } : item), "BWG"), null);
  assert.equal(safeChecklist(baseChecklist.map(item => item.key === "water_consumption_bill" ? { ...item, officialRequirement: "GUIDE_LISTED", label: "Invented official requirement" } : item), "BWG"), null);
});

test("CPCB SWM checklist requires the canonical items for the selected stakeholder", () => {
  assert.equal(safeChecklist(baseChecklist.slice(0, 1), "BWG"), null);
  assert.equal(safeChecklist(baseChecklist, "ULB"), null);
});

test("CPCB SWM observation payload permits unresolved draft values with explicit units", () => {
  assert.equal(safeObservations(baseObservations), true);
});

test("CPCB SWM observation payload rejects negative, non-finite and invalid-period values", () => {
  assert.equal(safeObservations({ ...baseObservations, wasteGenerationKgPerDay: { ...baseObservations.wasteGenerationKgPerDay, value: -1 } }), false);
  assert.equal(safeObservations({ ...baseObservations, waterConsumptionLitresPerDay: { ...baseObservations.waterConsumptionLitresPerDay, value: Number.POSITIVE_INFINITY } }), false);
  assert.equal(safeObservations({ ...baseObservations, floorAreaM2: { ...baseObservations.floorAreaM2, periodStart: "2026-02-31" } }), false);
});

test("CPCB SWM observation payload rejects unexpected keys and reversed periods", () => {
  assert.equal(safeObservations({ ...baseObservations, invented: {} }), false);
  assert.equal(safeObservations({ ...baseObservations, floorAreaM2: { ...baseObservations.floorAreaM2, periodStart: "2026-10-01", periodEnd: "2026-09-01" } }), false);
});

test("reported CPCB status accepts only the documented user-reported state set", () => {
  assert.equal(isCpcbReportedStatus("UNDER_REVIEW"), true);
  assert.equal(isCpcbReportedStatus("APPROVED"), true);
  assert.equal(isCpcbReportedStatus("CPCB_VERIFIED"), false);
  assert.equal(isCpcbReportedStatus("SUBMITTED_TO_CPCB"), false);
});

test("local workflow stages are separate from reported CPCB statuses", () => {
  assert.equal(isSwmLocalStage("CORRECTION_PREPARATION"), true);
  assert.equal(isSwmLocalStage("APPROVED"), false);
  assert.equal(isSwmLocalStage("INTEGRATED_API_SYNCED"), false);
});

test("stakeholder taxonomy resolver accepts registered classes and rejects unknown codes", async () => {
  const fakePool = { query: async (_sql: string, values: unknown[]) => ({
    rows: values[0] === "COMMUNITY_COMPOSTER" ? [{ code: "COMMUNITY_COMPOSTER", checklist_profile: "PROCESSOR" }] : [],
  }) };
  assert.deepEqual(await resolveStakeholderTaxonomy(fakePool as never, "COMMUNITY_COMPOSTER"), { code: "COMMUNITY_COMPOSTER", checklistProfile: "PROCESSOR" });
  assert.equal(await resolveStakeholderTaxonomy(fakePool as never, "UNKNOWN_CLASS"), null);
  assert.equal(await resolveStakeholderTaxonomy(fakePool as never, "bad class"), null);
  assert.equal(await resolveStakeholderTaxonomy(fakePool as never, null), null);
});
