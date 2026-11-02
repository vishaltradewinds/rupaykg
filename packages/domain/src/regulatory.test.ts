import test from "node:test";
import assert from "node:assert/strict";
import {
  REGULATORY_STATUS,
  assertProductionApplicable,
  isProductionApplicable,
  type RegulatorySource,
} from "./regulatory.js";

const source: RegulatorySource = {
  authority: "Ministry of Environment, Forest and Climate Change",
  title: "Solid Waste Management Rules, 2026",
  instrument: "RULE",
  reference: "S.O. 388(E)",
  publishedOn: "2026-01-27",
  effectiveFrom: "2026-04-01",
  jurisdiction: "India",
  sourceUrl: "https://moef.gov.in/rules-regulations-3",
  verifiedOn: "2026-09-02",
  status: REGULATORY_STATUS.IN_FORCE,
};

test("in-force regulatory sources are production applicable", () => {
  assert.equal(isProductionApplicable(source), true);
  assert.doesNotThrow(() => assertProductionApplicable(source));
});

test("draft regulatory sources are not production applicable", () => {
  const draft = { ...source, status: REGULATORY_STATUS.DRAFT };
  assert.equal(isProductionApplicable(draft), false);
  assert.throws(() => assertProductionApplicable(draft));
});

test("superseded regulatory sources are not production applicable", () => {
  const superseded = { ...source, status: REGULATORY_STATUS.SUPERSEDED };
  assert.equal(isProductionApplicable(superseded), false);
});
