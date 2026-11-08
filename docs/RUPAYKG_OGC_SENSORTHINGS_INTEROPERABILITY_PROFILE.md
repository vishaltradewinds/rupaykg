# RupayKg OGC SensorThings Interoperability Profile

## Status

**Engineering status: PARTIAL — deterministic SensorThings-compatible measurement mapping implemented.**

RupayKg keeps its existing field-device enrollment, measurement provenance and authoritative measurement records. This profile exposes those measurements through the OGC SensorThings conceptual model rather than creating a second measurement database.

## Mapping

`RupayKg field device → Thing + Sensor`

`RupayKg observed property → ObservedProperty`

`RupayKg measurement stream → Datastream`

`RupayKg measurement → Observation`

`RupayKg coordinates → Location`

The mapper preserves the source measurement value and timestamp and can carry measurement quality metadata.

## Integrity boundary

SensorThings interoperability does not make a measurement authoritative, verified MRV, or regulatory evidence by itself. Existing RupayKg device enrollment, identity binding, evidence lineage, validation and MRV controls remain authoritative.

No source measurement is replaced by a normalized SensorThings value.

## Acceptance boundary

Before claiming production interoperability, RupayKg must still validate:

1. mapping coverage against the complete authoritative measurement schema;
2. SensorThings API/JSON conformance against the target server/profile;
3. unit and observed-property vocabulary governance;
4. tenant isolation and export authorization;
5. malformed/out-of-range/time-quality negative tests;
6. field-device and production integration evidence.

This therefore remains **PARTIAL** until an actual SensorThings consumer/server integration is validated.

**Shakti rule:** reuse the existing measurement authority; expose interoperable views; do not build a parallel measurement system.
