import test from "node:test";
import assert from "node:assert/strict";
import {
  WASTE_PARTICIPANT_ROLES,
  WASTE_STREAM_FAMILIES,
  WASTE_TAXONOMY,
  assertKnownWasteStream,
  assertParticipantRole,
  isWasteParticipantRole,
  isWasteStreamFamily,
} from "./waste-chain.js";

test("participant roles distinguish collection, aggregation, transport and processing", () => {
  for (const role of ["GENERATOR", "COLLECTOR", "AGGREGATOR", "MATERIAL_RECOVERY_FACILITY", "TRANSPORTER", "RECYCLER", "PROCESSOR", "DOWNSTREAM_BUYER"]) {
    assert.equal(isWasteParticipantRole(role), true, role);
  }
  assert.equal(isWasteParticipantRole("COLLECTOR_TRANSPORTER"), false);
  assert.equal(isWasteParticipantRole("SUPER_ADMIN"), false);
  assert.throws(() => assertParticipantRole("UNRECOGNISED"), /WASTE_PARTICIPANT_ROLE_UNKNOWN/);
  assert.equal(new Set(WASTE_PARTICIPANT_ROLES).size, WASTE_PARTICIPANT_ROLES.length);
});

test("national waste taxonomy is unique, versioned and explicitly requires legal applicability review", () => {
  assert.equal(new Set(WASTE_STREAM_FAMILIES).size, WASTE_STREAM_FAMILIES.length);
  assert.deepEqual(WASTE_TAXONOMY.map((item) => item.code).sort(), [...WASTE_STREAM_FAMILIES].sort());
  for (const item of WASTE_TAXONOMY) {
    assert.equal(item.taxonomyVersion, "IN-WASTE-1.0");
    assert.equal(item.legalApplicability, "MUST_BE_ASSESSED");
    assert.ok(item.label.length > 0);
  }
});

test("unknown waste families fail closed rather than silently mapping to a permissive category", () => {
  assert.equal(isWasteStreamFamily("E_WASTE"), true);
  assert.equal(isWasteStreamFamily("UNDECLARED_MATERIAL"), false);
  assert.throws(() => assertKnownWasteStream("UNDECLARED_MATERIAL"), /WASTE_CLASSIFICATION_REQUIRED/);
  assert.doesNotThrow(() => assertKnownWasteStream("OTHER_UNCLASSIFIED"));
});
