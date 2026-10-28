# RupayKg Fundamental Rule: Pan-India by Design

**Status:** Fundamental product and architecture rule  
**Applies to:** Every RupayKg product, service, data model, integration, workflow, pilot, release and operating procedure  
**Effective:** 2026-10-21

## The rule

> **RupayKg must be designed and built as a pan-India digital infrastructure platform from the outset—not as a single-site, single-city, single-state or pilot-only solution.**

A pilot is only a controlled validation environment for a limited set of capabilities. It is not the platform's intended scope, architecture, product boundary, or definition of success. The Jabalpur/Kathonda work is one potential validation context within a nationally extensible platform; it must not hard-code RupayKg around that location or stakeholder.

## Mandatory implementation consequences

1. **National, multi-tenant scope:** Support organizations, authorities, facilities, operators, processors, producers, waste streams and other eligible stakeholder types across India, with explicit tenant and jurisdiction boundaries.
2. **Configurable jurisdiction and rules:** Model central, state, local-body and authority-specific requirements as versioned, evidence-backed configuration where legally appropriate. Never assume that one state's rules or one authority's workflow applies nationwide.
3. **Reusable onboarding:** Use configurable organization/site/activity registration and approved identifier mapping. Never hard-code pilot IDs, city names, authorities, waste streams or counterparties into core business logic.
4. **Methodology and scheme separation:** Maintain versioned applicability and eligibility for each relevant statutory scheme, EPR obligation, MRV methodology and crediting route. Do not imply that every activity or location is eligible for every scheme.
5. **Interoperability by adapter:** Keep government and registry connections behind authority-specific, versioned adapters. Enable an integration only after its official contract, authorization, sandbox/production credentials and operating conditions are verified.
6. **Evidence and provenance everywhere:** Preserve source identity, geography, time, chain of custody, units, corrections, approvals, calculation versions and audit history consistently across regions. Unmapped, unauthenticated or inconsistent records must fail closed.
7. **Scale and resilience:** Engineer for growth in tenants, locations, concurrent ingestion, data retention, regional connectivity and operational load. Validate performance and recovery with measured load tests rather than assuming scale from a pilot.
8. **Local realities, common platform:** Support appropriate Indian languages, low-bandwidth/ordinary-phone workflows, offline capture where safe, unit normalization and local operating contexts without weakening evidence or authorization controls.
9. **No false authority:** A successful internal workflow is not official filing acceptance, statutory compliance certification, independent verification, registry registration or carbon-credit issuance. Those statuses require the relevant authoritative evidence.
10. **Pilot exit criteria:** A pilot may validate a bounded workflow, but every result must identify what is proven, what remains untested nationally, and the evidence needed before broader rollout. Pilot success alone never certifies pan-India readiness.
11. **Shakti Standards gate:** Every release must assess nationwide applicability, state/local variation, legal and regulatory boundaries, security, accessibility, capacity, disaster recovery, monitoring, support ownership and controlled rollback.
12. **No narrowing by convenience:** Temporary limitations imposed by available data, credentials, a pilot partner, a deployment environment or development capacity must be documented as limitations—not silently converted into product scope.

## Definition of progress

RupayKg is progressing toward its aim when the same governed platform can onboard additional eligible stakeholders and jurisdictions through configuration and approved adapters, retain evidence lineage, apply the correct versioned rules, and produce auditable outputs without rewriting the core system for each geography.

**Pan-India intent is a permanent design requirement. Pan-India operational readiness is an evidence-based claim that must be earned through staged validation, authorized integrations, capacity testing, and jurisdiction-by-jurisdiction acceptance.**

This rule does not authorize nationwide deployment, establish any official API access, or claim that statutory approvals, verification, or credit issuance have been obtained.
