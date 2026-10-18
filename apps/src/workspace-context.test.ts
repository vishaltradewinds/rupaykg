import test from "node:test";
import assert from "node:assert/strict";
import { operatingContextGeographyKinds, operatingContextSqlClause } from "./workspace-routes.js";

test("urban operating context only includes municipal geography kinds", () => {
  assert.deepEqual(operatingContextGeographyKinds("urban"), ["ULB", "WARD"]);
  assert.equal(operatingContextGeographyKinds("urban").includes("LOCALITY"), false);
  assert.equal(operatingContextGeographyKinds("urban").includes("GRAM_PANCHAYAT"), false);
  assert.equal(operatingContextGeographyKinds("urban").includes("VILLAGE"), false);
});

test("rural operating context only includes panchayat and village geography kinds", () => {
  assert.deepEqual(operatingContextGeographyKinds("rural"), ["GRAM_PANCHAYAT", "VILLAGE", "CLUSTER"]);
  assert.equal(operatingContextGeographyKinds("rural").includes("ULB"), false);
  assert.equal(operatingContextGeographyKinds("rural").includes("WARD"), false);
});

test("urban and rural geography rails remain disjoint", () => {
  const urban = new Set(operatingContextGeographyKinds("urban"));
  const rural = new Set(operatingContextGeographyKinds("rural"));
  assert.equal([...urban].some((kind) => rural.has(kind)), false);
});

test("operating context SQL filter uses the correct bound parameter after optional geography scope", () => {
  assert.equal(operatingContextSqlClause("urban", 2), " and exists (select 1 from geography context_geo where context_geo.id=a.geography_id and context_geo.kind::text = any($2::text[]))");
  assert.equal(operatingContextSqlClause("rural", 3), " and exists (select 1 from geography context_geo where context_geo.id=a.geography_id and context_geo.kind::text = any($3::text[]))");
  assert.equal(operatingContextSqlClause(undefined, 1), "");
  assert.throws(() => operatingContextSqlClause("urban", 1), RangeError);
});
