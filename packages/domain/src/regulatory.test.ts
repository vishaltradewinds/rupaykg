import test from "node:test";
import assert from "node:assert/strict";
import {
  REGULATORY_STATUS,
  assertProductionApplicable,
  evaluateRegulatorySource,
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

test("in-force sources within effective dates are production applicable", () => {
  assert.equal(isProductionApplicable(source, { asOfDate: "2026-10-27" }), true);
  assert.doesNotThrow(() => assertProductionApplicable(source, { asOfDate: "2026-10-27" }));
  assert.deepEqual(evaluateRegulatorySource(source, { asOfDate: "2026-10-27", jurisdiction: "Maharashtra" }), {
    applicable: true,
    reason: "IN_FORCE_AND_WITHIN_EFFECTIVE_DATES",
  });
});

test("draft regulatory sources are not production applicable", () => {
  const draft = { ...source, status: REGULATORY_STATUS.DRAFT };
  assert.equal(isProductionApplicable(draft, { asOfDate: "2026-10-27" }), false);
  assert.throws(() => assertProductionApplicable(draft, { asOfDate: "2026-10-27" }), /SOURCE_NOT_IN_FORCE/);
});

test("superseded regulatory sources are not production applicable", () => {
  const superseded = { ...source, status: REGULATORY_STATUS.SUPERSEDED };
  assert.equal(isProductionApplicable(superseded, { asOfDate: "2026-10-27" }), false);
});

test("future effective date fails closed", () => {
  const future = { ...source, effectiveFrom: "2027-01-01" };
  assert.deepEqual(evaluateRegulatorySource(future, { asOfDate: "2026-10-27" }), {
    applicable: false,
    reason: "NOT_YET_EFFECTIVE",
  });
});

test("source outside its end date fails closed", () => {
  const expired = { ...source, effectiveTo: "2026-10-26" };
  assert.deepEqual(evaluateRegulatorySource(expired, { asOfDate: "2026-10-27" }), {
    applicable: false,
    reason: "NO_LONGER_EFFECTIVE",
  });
});

test("missing or invalid effective date fails closed", () => {
  const missing = { ...source, effectiveFrom: "" };
  assert.deepEqual(evaluateRegulatorySource(missing, { asOfDate: "2026-10-27" }), {
    applicable: false,
    reason: "MISSING_OR_INVALID_EFFECTIVE_FROM",
  });
  const malformed = { ...source, effectiveFrom: "2026-02-31" };
  assert.equal(evaluateRegulatorySource(malformed, { asOfDate: "2026-10-27" }).applicable, false);
});

test("state-specific source does not silently apply to another state", () => {
  const maharashtraOnly = { ...source, jurisdiction: "Maharashtra" };
  assert.deepEqual(evaluateRegulatorySource(maharashtraOnly, {
    asOfDate: "2026-10-27",
    jurisdiction: "Madhya Pradesh",
  }), {
    applicable: false,
    reason: "JURISDICTION_MISMATCH",
  });
});

test("invalid source metadata fails closed", () => {
  const invalid = { ...source, sourceUrl: "http://example.invalid/rule" };
  assert.deepEqual(evaluateRegulatorySource(invalid, { asOfDate: "2026-10-27" }), {
    applicable: false,
    reason: "MISSING_OR_INVALID_SOURCE_METADATA",
  });
});
