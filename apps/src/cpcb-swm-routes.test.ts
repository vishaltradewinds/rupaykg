import test from "node:test";
import assert from "node:assert/strict";
import { safeChecklist, safeObservations } from "./cpcb-swm-routes.js";

const baseChecklist = [{
  key: "water_consumption_bill",
  label: "Water consumption bill",
  status: "PROVIDED_UNVERIFIED",
  officialRequirement: "GUIDE_LISTED",
}];

const baseObservations = {
  floorAreaM2: { value: null, unit: "m2", sourceReference: "", periodStart: "", periodEnd: "" },
  waterConsumptionLitresPerDay: { value: 40000, unit: "L/day", sourceReference: "evidence://water-bill", periodStart: "2026-09-01", periodEnd: "2026-09-30" },
  wasteGenerationKgPerDay: { value: 100, unit: "kg/day", sourceReference: "evidence://weighbridge", periodStart: "2026-09-01", periodEnd: "2026-09-30" },
};

test("CPCB SWM checklist accepts unverified evidence states", () => {
  assert.equal(safeChecklist(baseChecklist)?.[0]?.status, "PROVIDED_UNVERIFIED");
});

test("CPCB SWM checklist rejects client-supplied verification", () => {
  assert.equal(safeChecklist([{ ...baseChecklist[0], status: "VERIFIED" }]), null);
});

test("CPCB SWM checklist rejects duplicate keys and unknown states", () => {
  assert.equal(safeChecklist([baseChecklist[0], baseChecklist[0]]), null);
  assert.equal(safeChecklist([{ ...baseChecklist[0], status: "CPCB_APPROVED" }]), null);
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
