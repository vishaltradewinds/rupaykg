# RupayKg Environmental Operating System Control Matrix

## Purpose

This matrix converts the canonical Environmental Operating System architecture into executable Shakti controls for the authoritative `vishaltradewinds/rupaykg` repository.

Status values:

- **GREEN** — implementation and supporting repository evidence exist.
- **AMBER** — implementation exists but a runtime/external/operational gate remains.
- **RED** — material defect or unresolved release blocker.
- **OPEN** — control is defined but closure evidence is still required.

A status must not be inferred from legacy/reference repositories.

| Layer | Control | Current evidence | Status |
|---|---|---|---|
| Regulatory | Source/version/provenance | Regulatory source and methodology migrations/docs exist | AMBER |
| Regulatory | Applicability gate | Statutory applicability routes/tests and DB controls exist | GREEN |
| Evidence | Evidence vault | Evidence-vault routes, integration tests and artifact-vault migration exist | GREEN |
| Evidence | Evidence-to-activity lineage | Evidence routes and MRV tests enforce activity linkage | GREEN |
| MRV | Deterministic provenance | Carbon provenance tests/migrations and MRV routes exist | GREEN |
| MRV | Methodology governance | Governance lifecycle and methodology tests exist | AMBER |
| MRV | External methodology approval | Repository controls cannot substitute for external approval | OPEN |
| IoT/Measurement | Field-device enrollment | Device enrollment/provenance migrations and runtime tests exist | GREEN |
| IoT/Measurement | Physical instrumentation | Field-device software exists; physical site acceptance remains external | AMBER |
| Data | Authoritative PostgreSQL path | Migration validation and DB-backed CI are present | GREEN |
| Data | Tenant isolation | Runtime contract migration exists; RLS/runtime deployment evidence remains | OPEN |
| Data | Cross-tenant negative proof | Tenant isolation integration test exists; production evidence remains required | AMBER |
| AI | Advisory boundary | Intelligence routes and lifecycle tests preserve authoritative state | GREEN |
| AI | Model provenance/uncertainty | Advisory boundary exists; full model governance evidence requires expansion | AMBER |
| Registry/Integrity | Append-only registry controls | Registry migrations/routes/tests exist | GREEN |
| Registry/Integrity | Hedera anchoring | Hedera anchor implementation/tests and live acceptance workflow exist | AMBER |
| Registry/Integrity | Independent external consensus proof | Current Shakti gate records this as outstanding | OPEN |
| Workflow | Lifecycle/state controls | State-machine and lifecycle integration tests exist | GREEN |
| Workflow | High-risk authorization | Registry/settlement permission controls and tests exist | GREEN |
| Reporting | Regulatory/ESG reporting | BWG/EPR/ESG routes and panels exist | GREEN |
| Reporting | Report traceability | Evidence/MRV provenance controls support authoritative reporting | AMBER |
| Ecosystem | CPCB/EPR integration | CPCB/EPR routes and migrations exist | AMBER |
| Ecosystem | BEE/CCTS integration | CCTS methodology registry and carbon governance exist | AMBER |
| Ecosystem | External system acceptance | External provider/government interfaces remain separately gated | OPEN |
| Ecosystem | Reference ecosystem adoption control | Shakti adoption matrix plus repository-to-reference implementation crosswalk now exist; external conformance/field acceptance remains outstanding | AMBER |
| Security | Production identity | Production identity provisioning controls exist | AMBER |
| Security | Runtime least privilege | Tenant isolation contract defines non-BYPASSRLS runtime role; deployment proof remains | OPEN |
| Operations | Backup/restore | Production gate requires demonstrated backup/restore evidence | OPEN |
| Operations | Monitoring/rollback | Production gate requires demonstrated monitoring/rollback evidence | OPEN |
| TRL | Engineering readiness | Strong repository/CI evidence exists | GREEN |
| TRL | Field readiness | Physical/site evidence not fully established in repository | AMBER |
| TRL | Operational readiness | Live deployment exists but sustained-operation evidence remains | AMBER |
| TRL | Regulatory acceptance | Software controls do not equal regulatory approval | OPEN |
| TRL | TRL 9 | Not established by code/CI alone | OPEN |

## Release rule

No GREEN row permits a production-readiness claim by itself.

The release decision is controlled by the highest-severity unresolved applicable gate, especially tenant isolation, external trust rails, physical measurement, production operations and regulatory/independent acceptance.

## Required next evidence gates

1. Complete runtime tenant isolation using a non-BYPASSRLS production role and transaction-local context.
2. Execute live Guardian/Hedera acceptance with real production identities and external consensus verification.
3. Validate physical measurement integration for the defined field deployment.
4. Demonstrate backup/restore, monitoring and rollback.
5. Reconcile methodology source/version and obtain/record required external acceptance.
6. Repeat end-to-end acceptance after these controls are closed.

| External integration mediator runtime intake | **GREEN/AMBER** | Versioned contract, tenant-safe persistence, idempotency and authenticated API intake implemented. Provider-specific external connector, remote conformance and production acceptance remain open. |
