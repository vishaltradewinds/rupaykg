import test from "node:test";
import assert from "node:assert/strict";
import { canAIMutateAuthoritativeState, flagMeasurementAnomaly } from "./index.js";

test("AI findings remain advisory and source-grounded", () => {
  const finding = flagMeasurementAnomaly("Measurement differs materially from expected range", ["measurement-1"], 0.91);
  assert.equal(finding.action, "REVIEW");
  assert.deepEqual(finding.sourceRecordIds, ["measurement-1"]);
  assert.equal(canAIMutateAuthoritativeState(), false);
});

test("AI confidence is bounded", () => {
  assert.throws(() => flagMeasurementAnomaly("anomaly", ["m1"], 1.2));
});
