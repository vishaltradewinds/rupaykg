# Core Domain Model

## Organization
A governed participant such as ULB, Gram Panchayat, processor, producer, verifier, regulator, enterprise or service provider.

## Person and identity
A person or service identity authenticated by the platform and assigned governed roles. Roles are configurable and scoped to organizations/geographies.

## Asset
A physical resource stream or material batch with type, quantity, unit, origin, destination and custody history.

## Activity
A real-world operation: generation, aggregation, measurement, transport, processing or other domain action. Every activity has actor, time, geography and lifecycle state.

## Measurement
A quantity observation linked to an activity, measurement method, device/source, unit, timestamp and quality state.

## Evidence
A durable record supporting an activity or measurement. Evidence has type, source, captured time, hash/content reference, metadata and review state.

## Verification
A decision by an authorized verifier over defined evidence and rules. It records verifier identity, decision, scope, timestamp and reason.

## Methodology
Versioned calculation rules used for carbon/MRV or compliance. Calculations always record the methodology/version and inputs.

## Environmental credential
A cryptographically verifiable statement derived from verified activity. Issuance requires configured trust roots and required approvals.

## Registry record
Authoritative lifecycle state for an issued environmental asset or credential, including issuance, ownership, transfer and retirement events.

## Obligation
A compliance requirement such as EPR responsibility, reporting obligation or regulatory submission, linked to jurisdiction, period and accountable entity.

## Settlement
A governed financial obligation created only from eligible verified records. Settlement has its own authorization, reconciliation and completion states.

## Audit event
Tamper-evident record of important state changes, actor, request/correlation identifier, timestamp and before/after summary.
