import test from "node:test";
import assert from "node:assert/strict";
import { buildDisclosure } from "./index.js";

test("ESG disclosure preserves verification provenance", () => {
  const result = buildDisclosure([
    { code: "SCOPE3-WASTE", scope: "3", value: 12.5, unit: "tCO2e", evidenceId: "e1", verificationId: "v1" },
    { code: "SCOPE3-TRANSPORT", scope: "3", value: 4, unit: "tCO2e" },
  ]);
  assert.equal(result.metrics[0].state, "VERIFIED");
  assert.equal(result.metrics[1].state, "PENDING");
});
