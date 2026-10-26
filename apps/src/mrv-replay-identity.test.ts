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

test("MRV observation identity includes quality status and canonicalized metadata", () => {
  const baseline = [{
    id: "reading-1",
    parameter_code: "mass_kg",
    observed_value: "10.0",
    unit: "kg",
    instrument_id: "scale-1",
    observed_at: "2026-10-20T09:00:00.000Z",
    quality_status: "VERIFIED",
    metadata: { source: "edge", details: { z: 1, a: 2 } },
  }];
  const reorderedMetadata = [{
    ...baseline[0],
    metadata: { details: { a: 2, z: 1 }, source: "edge" },
  }];
  const changedQuality = [{ ...baseline[0], quality_status: "REJECTED" }];
  const changedMetadata = [{ ...baseline[0], metadata: { ...baseline[0].metadata, source: "manual-override" } }];
  assert.equal(mrvObservationSetHash(baseline), mrvObservationSetHash(reorderedMetadata));
  assert.notEqual(mrvObservationSetHash(baseline), mrvObservationSetHash(changedQuality));
  assert.notEqual(mrvObservationSetHash(baseline), mrvObservationSetHash(changedMetadata));
});
