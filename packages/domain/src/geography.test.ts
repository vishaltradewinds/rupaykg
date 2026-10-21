import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GEOGRAPHY_HIERARCHY, geographyMode, isValidChild, type GeographyKind } from "./geography.js";

test("urban and rural geography modes are explicit", () => {
  assert.equal(geographyMode("ULB"), "URBAN");
  assert.equal(geographyMode("WARD"), "URBAN");
  assert.equal(geographyMode("GRAM_PANCHAYAT"), "RURAL");
  assert.equal(geographyMode("VILLAGE"), "RURAL");
  assert.equal(geographyMode("COUNTRY"), "NATIONAL");
  assert.equal(geographyMode("DISTRICT"), "ADMINISTRATIVE");
});

test("starter profile permits only its documented parent-child relationships", () => {
  const valid: Array<[GeographyKind, GeographyKind]> = [
    ["COUNTRY", "STATE_UT"],
    ["STATE_UT", "DISTRICT"],
    ["DISTRICT", "SUB_DISTRICT"],
    ["SUB_DISTRICT", "ULB"],
    ["SUB_DISTRICT", "GRAM_PANCHAYAT"],
    ["ULB", "WARD"],
    ["WARD", "LOCALITY"],
    ["GRAM_PANCHAYAT", "VILLAGE"],
    ["VILLAGE", "CLUSTER"],
  ];
  for (const [parent, child] of valid) {
    assert.equal(isValidChild(parent, child, DEFAULT_GEOGRAPHY_HIERARCHY), true, `${parent} -> ${child}`);
  }
});

test("urban and rural branches cannot cross at leaf levels", () => {
  assert.equal(isValidChild("ULB", "VILLAGE", DEFAULT_GEOGRAPHY_HIERARCHY), false);
  assert.equal(isValidChild("GRAM_PANCHAYAT", "WARD", DEFAULT_GEOGRAPHY_HIERARCHY), false);
  assert.equal(isValidChild("WARD", "CLUSTER", DEFAULT_GEOGRAPHY_HIERARCHY), false);
  assert.equal(isValidChild("LOCALITY", "CLUSTER", DEFAULT_GEOGRAPHY_HIERARCHY), false);
});

test("additional India geography kinds are classified without collapsing urban and rural rails", () => {
  assert.equal(geographyMode("BLOCK"), "ADMINISTRATIVE");
  assert.equal(geographyMode("TALUK"), "ADMINISTRATIVE");
  assert.equal(geographyMode("TEHSIL"), "ADMINISTRATIVE");
  assert.equal(geographyMode("HABITATION"), "RURAL");
  assert.equal(isValidChild("BLOCK", "GRAM_PANCHAYAT", DEFAULT_GEOGRAPHY_HIERARCHY), true);
  assert.equal(isValidChild("GRAM_PANCHAYAT", "HABITATION", DEFAULT_GEOGRAPHY_HIERARCHY), true);
});

test("source-specific hierarchy is mandatory and overrides the starter profile", () => {
  const sourceVersionedHierarchy = {
    COUNTRY: ["STATE_UT"],
    STATE_UT: ["DISTRICT"],
    DISTRICT: ["BLOCK"],
    BLOCK: ["GRAM_PANCHAYAT"],
    GRAM_PANCHAYAT: ["VILLAGE"],
  } as const;

  assert.equal(isValidChild("DISTRICT", "BLOCK", sourceVersionedHierarchy), true);
  assert.equal(isValidChild("DISTRICT", "SUB_DISTRICT", sourceVersionedHierarchy), false);
  assert.equal(isValidChild("BLOCK", "GRAM_PANCHAYAT", sourceVersionedHierarchy), true);
  assert.equal(isValidChild("ULB", "VILLAGE", sourceVersionedHierarchy), false);
});
