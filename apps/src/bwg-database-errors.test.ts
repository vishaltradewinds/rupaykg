import assert from "node:assert/strict";
import test from "node:test";
import { classifyBwgDatabaseError } from "./value-routes.js";

test("classifies only the exact BWG applicability trigger as a client conflict", () => {
  assert.deepEqual(
    classifyBwgDatabaseError({
      code: "23514",
      message: "BWG applicability must be verified before creating a reporting period",
    }),
    {
      status: 409,
      error: "Verified BWG applicability is required before creating a reporting period",
      code: "BWG_APPLICABILITY_NOT_VERIFIED",
    },
  );
});

test("classifies only the exact EPR fulfilled-versus-obligated check constraint", () => {
  assert.deepEqual(
    classifyBwgDatabaseError({
      code: "23514",
      constraint: "bwg_epr_reports_fulfilled_le_obligated",
      message: "new row violates check constraint",
      detail: "private database detail",
    }),
    {
      status: 409,
      error: "Fulfilled EPR quantity cannot exceed obligated quantity",
      code: "BWG_EPR_FULFILLED_EXCEEDS_OBLIGATED",
    },
  );
});

test("does not translate unrelated PostgreSQL errors or constraints", () => {
  assert.equal(classifyBwgDatabaseError({ code: "23514", constraint: "other_check" }), null);
  assert.equal(classifyBwgDatabaseError({ code: "23505", constraint: "bwg_epr_reports_fulfilled_le_obligated" }), null);
  assert.equal(classifyBwgDatabaseError({ code: "23514", message: "other trigger failure" }), null);
  assert.equal(classifyBwgDatabaseError("23514"), null);
  assert.equal(classifyBwgDatabaseError(null), null);
});
