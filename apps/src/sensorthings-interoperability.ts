/**
 * OGC SensorThings-compatible interoperability profile.
 *
 * This is an interoperability view over existing RupayKg field-device and
 * measurement records. It is deliberately not a second measurement store.
 */

export type SensorThingsThing = {
  "@iot.id": string;
  name: string;
  description?: string;
  properties?: Record<string, unknown>;
};

export type SensorThingsLocation = {
  "@iot.id": string;
  name: string;
  encodingType: "application/vnd.geo+json";
  location: { type: "Point"; coordinates: [number, number] };
};

export type SensorThingsSensor = {
  "@iot.id": string;
  name: string;
  description?: string;
  encodingType: "application/vnd.geo+json";
  metadata?: string;
};

export type SensorThingsObservedProperty = {
  "@iot.id": string;
  name: string;
  definition: string;
  description?: string;
};

export type SensorThingsDatastream = {
  "@iot.id": string;
  name: string;
  description?: string;
  unitOfMeasurement: {
    name: string;
    symbol: string;
    definition: string;
  };
  observationType: string;
  thing: { "@iot.id": string };
  sensor: { "@iot.id": string };
  observedProperty: { "@iot.id": string };
};

export type SensorThingsObservation = {
  "@iot.id": string;
  phenomenonTime: string;
  result: unknown;
  resultTime?: string;
  resultQuality?: unknown;
  datastream: { "@iot.id": string };
  featureOfInterest?: { "@iot.id": string };
};

export type RupayKgSensorThingsDocument = {
  thing: SensorThingsThing;
  location?: SensorThingsLocation;
  sensor: SensorThingsSensor;
  observedProperty: SensorThingsObservedProperty;
  datastream: SensorThingsDatastream;
  observation: SensorThingsObservation;
};

export type RupayKgMeasurementMappingInput = {
  deviceId: string;
  measurementId: string;
  organizationId: string;
  observedProperty: {
    id: string;
    name: string;
    definition: string;
    description?: string;
  };
  value: unknown;
  unit: { name: string; symbol: string; definition: string };
  phenomenonTime: string;
  resultTime?: string;
  quality?: unknown;
  latitude?: number;
  longitude?: number;
  metadata?: Record<string, unknown>;
};

function id(kind: string, value: string): string {
  return `rupaykg:${kind}:${value}`;
}

function assertCoordinate(value: number | undefined, name: string): void {
  if (value !== undefined && (!Number.isFinite(value))) {
    throw new Error(`${name} must be a finite number`);
  }
}

export function mapRupayKgMeasurementToSensorThings(
  input: RupayKgMeasurementMappingInput,
): RupayKgSensorThingsDocument {
  assertCoordinate(input.latitude, "latitude");
  assertCoordinate(input.longitude, "longitude");

  if (!input.deviceId.trim() || !input.measurementId.trim() || !input.organizationId.trim()) {
    throw new Error("deviceId, measurementId and organizationId are required");
  }
  if (!input.observedProperty.id.trim() || !input.observedProperty.name.trim()) {
    throw new Error("observedProperty id and name are required");
  }
  if (!input.unit.symbol.trim() || !input.unit.name.trim()) {
    throw new Error("unit name and symbol are required");
  }

  const thingId = id("thing", input.deviceId);
  const sensorId = id("sensor", input.deviceId);
  const propertyId = id("observed-property", input.observedProperty.id);
  const datastreamId = id("datastream", input.deviceId + ":" + input.observedProperty.id);
  const observationId = id("observation", input.measurementId);

  const document: RupayKgSensorThingsDocument = {
    thing: {
      "@iot.id": thingId,
      name: `RupayKg field device ${input.deviceId}`,
      properties: {
        organizationId: input.organizationId,
        ...(input.metadata ?? {}),
      },
    },
    sensor: {
      "@iot.id": sensorId,
      name: `RupayKg sensor ${input.deviceId}`,
      encodingType: "application/vnd.geo+json",
    },
    observedProperty: {
      "@iot.id": propertyId,
      name: input.observedProperty.name,
      definition: input.observedProperty.definition,
      description: input.observedProperty.description,
    },
    datastream: {
      "@iot.id": datastreamId,
      name: `RupayKg ${input.observedProperty.name} datastream`,
      unitOfMeasurement: input.unit,
      observationType: "http://www.opengis.net/sta/1.1/OM_Observation",
      thing: { "@iot.id": thingId },
      sensor: { "@iot.id": sensorId },
      observedProperty: { "@iot.id": propertyId },
    },
    observation: {
      "@iot.id": observationId,
      phenomenonTime: input.phenomenonTime,
      ...(input.resultTime ? { resultTime: input.resultTime } : {}),
      result: input.value,
      ...(input.quality !== undefined ? { resultQuality: input.quality } : {}),
      datastream: { "@iot.id": datastreamId },
    },
  };

  if (input.latitude !== undefined && input.longitude !== undefined) {
    document.location = {
      "@iot.id": id("location", input.deviceId),
      name: `RupayKg field location ${input.deviceId}`,
      encodingType: "application/vnd.geo+json",
      location: {
        type: "Point",
        coordinates: [input.longitude, input.latitude],
      },
    };
  }

  return document;
}
