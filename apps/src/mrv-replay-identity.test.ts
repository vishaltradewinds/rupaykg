import test from "node:test";
import assert from "node:assert/strict";
import { mrvObservationSetHash, normalizeMrvActivityId } from "./mrv-routes.js";

test("MRV activity UUID normalization rejects invalid IDs and canonicalizes case", () => {
  const canonical = "a12b3456-7890-4abc-8def-1234567890ab";
  assert.equal(normalizeMrvActivityId(canonical), canonical);
  assert.equal(normalizeMrvActivityId(canonical.toUpperCase()), canonical);
  assert.equal(normalizeMrvActivityId("not-a-uuid"), null);
});

test("MRV observation identity is stable under row ordering", () => {
  const rows = [
    { id: "b", parameter_code: "mass_kg", observed_value: "12.0", unit: "kg", instrument_id: "scale-1", observed_at: "2026-10-20T10:00:00.000Z" },
    { id: "a", parameter_code: "mass_kg", observed_value: "10.0", unit: "kg", instrument_id: "scale-1", observed_at: "2026-10-20T09:00:00.000Z" },
  ];
  assert.equal(mrvObservationSetHash(rows), mrvObservationSetHash([...rows].reverse()));
});

test("MRV observation identity changes when a reading is added or mutated", () => {
  const baseline = [
    { id: "a", parameter_code: "mass_kg", observed_value: "10.0", unit: "kg", instrument_id: "scale-1", observed_at: "2026-10-20T09:00:00.000Z" },
  ];
  const addedBackdatedReading = [
    ...baseline,
    { id: "b", parameter_code: "mass_kg", observed_value: "2.0", unit: "kg", instrument_id: "scale-1", observed_at: "2026-10-19T09:00:00.000Z" },
  ];
  const mutatedReading = [{ ...baseline[0], observed_value: "11.0" }];
  assert.notEqual(mrvObservationSetHash(baseline), mrvObservationSetHash(addedBackdatedReading));
  assert.notEqual(mrvObservationSetHash(baseline), mrvObservationSetHash(mutatedReading));
});
