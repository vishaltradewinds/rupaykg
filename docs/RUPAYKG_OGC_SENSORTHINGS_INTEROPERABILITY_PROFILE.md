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


## Runtime integration

A tenant-scoped read-only endpoint now exposes an authoritative measurement through the SensorThings-compatible representation:

`GET /api/v1/interoperability/sensorthings/measurements/:measurementId`

The endpoint authenticates the caller, requires an active organization, executes the source query inside `withTenantTransaction()`, and restricts the measurement to that organization. It reads the existing `measurements` and `activities` records and does not persist a second SensorThings representation.

The endpoint is an interoperability export boundary, not a regulatory or MRV decision endpoint. The source PostgreSQL record remains authoritative.

Repository route-level coverage now exercises authenticated organization-scoped export, cross-organization measurement denial, missing authentication, organization-header rejection, missing-measurement 404 behavior, and the non-synthetic response boundary. These tests use a controlled fake database boundary and therefore do not substitute for live production evidence.

Runtime acceptance remains open until this endpoint is exercised against the target production database and the resulting representation is validated by an actual SensorThings consumer/conformance test suite.

## Consumer conformance gate

A deterministic `validateSensorThingsDocument()` gate now verifies the exported interoperability document's core entity identities and relationship graph, including Thing/Sensor/ObservedProperty/Datastream/Observation linkage and GeoJSON location validity.

This is a repository-side consumer-contract gate. It does not establish official OGC certification or prove acceptance by a third-party SensorThings implementation. Target-consumer interoperability and production acceptance remain separate evidence gates.