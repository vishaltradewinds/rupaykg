import test from "node:test";
import assert from "node:assert/strict";
import { mapRupayKgMeasurementToSensorThings, validateSensorThingsDocument } from "./sensorthings-interoperability.js";

test("maps a RupayKg measurement to SensorThings entities without changing the source value", () => {
  const doc = mapRupayKgMeasurementToSensorThings({
    deviceId: "EDGE-001",
    measurementId: "measurement-001",
    organizationId: "org-001",
    observedProperty: {
      id: "mass-kg",
      name: "Mass",
      definition: "https://example.invalid/observed-property/mass-kg",
    },
    value: 125.5,
    unit: {
      name: "kilogram",
      symbol: "kg",
      definition: "https://unitsofmeasure.org/ucum.html#kilogram",
    },
    phenomenonTime: "2026-11-08T09:00:00Z",
    resultTime: "2026-11-08T09:00:02Z",
    quality: { state: "VALIDATED" },
    latitude: 23.2599,
    longitude: 77.4126,
  });

  assert.equal(doc.observation.result, 125.5);
  assert.equal(doc.observation.datastream["@iot.id"], "rupaykg:datastream:EDGE-001:mass-kg");
  assert.equal(doc.datastream.observedProperty["@iot.id"], "rupaykg:observed-property:mass-kg");
  assert.deepEqual(doc.location?.location.coordinates, [77.4126, 23.2599]);
  assert.deepEqual(validateSensorThingsDocument(doc), { ok: true });
});

test("rejects incomplete or invalid measurement identity", () => {
  assert.throws(() => mapRupayKgMeasurementToSensorThings({
    deviceId: "",
    measurementId: "m",
    organizationId: "o",
    observedProperty: { id: "p", name: "Property", definition: "urn:p" },
    value: 1,
    unit: { name: "unit", symbol: "u", definition: "urn:u" },
    phenomenonTime: "2026-11-08T09:00:00Z",
  }), /deviceId/);

  assert.throws(() => mapRupayKgMeasurementToSensorThings({
    deviceId: "d",
    measurementId: "m",
    organizationId: "o",
    observedProperty: { id: "p", name: "Property", definition: "urn:p" },
    value: 1,
    unit: { name: "unit", symbol: "u", definition: "urn:u" },
    phenomenonTime: "2026-11-08T09:00:00Z",
    latitude: Number.NaN,
  }), /latitude/);
});


test("rejects broken SensorThings relationship graph", () => {
  const doc = mapRupayKgMeasurementToSensorThings({
    deviceId: "EDGE-002",
    measurementId: "measurement-002",
    organizationId: "org-002",
    observedProperty: {
      id: "mass-kg",
      name: "Mass",
      definition: "urn:mass-kg",
    },
    value: 10,
    unit: { name: "kilogram", symbol: "kg", definition: "urn:kg" },
    phenomenonTime: "2026-11-08T09:00:00Z",
  });

  doc.observation.datastream["@iot.id"] = "rupaykg:datastream:tampered";

  assert.deepEqual(validateSensorThingsDocument(doc), {
    ok: false,
    error: "observation identity, datastream relationship and phenomenonTime are required",
  });
});
