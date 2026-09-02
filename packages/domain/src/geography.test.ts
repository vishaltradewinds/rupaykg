import test from "node:test";
import assert from "node:assert/strict";
import { geographyMode, isValidChild, type GeographyKind } from "./geography.js";

test("urban and rural geography modes are explicit", () => {
  assert.equal(geographyMode("ULB"), "URBAN");
  assert.equal(geographyMode("WARD"), "URBAN");
  assert.equal(geographyMode("GRAM_PANCHAYAT"), "RURAL");
  assert.equal(geographyMode("VILLAGE"), "RURAL");
  assert.equal(geographyMode("COUNTRY"), "NATIONAL");
  assert.equal(geographyMode("DISTRICT"), "ADMINISTRATIVE");
});

test("national hierarchy permits only valid parent-child relationships", () => {
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
  for (const [parent, child] of valid) assert.equal(isValidChild(parent, child), true, `${parent} -> ${child}`);
});

test("urban and rural branches cannot cross at leaf levels", () => {
  assert.equal(isValidChild("ULB", "VILLAGE"), false);
  assert.equal(isValidChild("GRAM_PANCHAYAT", "WARD"), false);
  assert.equal(isValidChild("WARD", "CLUSTER"), false);
  assert.equal(isValidChild("LOCALITY", "CLUSTER"), false);
});
