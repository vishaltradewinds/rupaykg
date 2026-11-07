# RupayKg — National Deployment Architecture and Jabalpur Validation

**Effective:** 2026-11-07  
**Authority:** Controlling architecture priority for engineering and deployment planning  
**Status:** Architecture direction. This document does not certify that national-scale capacity, security, compliance, field operations or production acceptance have been achieved.

## 1. Controlling decision

**National deployment objectives are the primary architecture objective. The Jabalpur SITE-JBP-01 Kathonda deployment is the first field implementation and validation instance of that same national architecture.**

RupayKg must be designed, engineered and operated as one pan-India platform from the outset. Jabalpur is not a separate pilot product, reduced architecture, temporary code fork or competing design target. Pilot requirements and national deployment requirements are one architecture focus; when a local shortcut conflicts with nationwide operability, the national requirement takes priority.

The Jabalpur implementation must use the same shared platform capabilities, data contracts, security model, tenancy model, integration boundaries, release process and operational controls intended for wider deployment. Deployment-specific values, local workflows and site equipment details belong in governed configuration and adapters—not in a Jabalpur-only code path.

## 2. Architecture rules

1. **One national platform, one authoritative product codebase.** Do not create a Jabalpur-only fork, database model, API contract or workflow engine. Reusable capabilities belong in the shared product.
2. **National scope governs design decisions.** Evaluate each design against state, district, ULB, enterprise, facility and project deployment needs before accepting a local implementation shortcut.
3. **Configuration, not hard-coding.** Jurisdictional rules, organisation structures, facility identifiers, site equipment, measurement sources, reporting calendars and customer-specific workflows must be represented through governed configuration or replaceable adapters wherever appropriate.
4. **Hierarchical and isolated access.** The architecture must support national, state, district, ULB, organisation, project, facility and site scopes with enforceable tenant and data isolation. Required RLS, database-role and authorization controls remain evidence gates; this statement is not proof that they are already correctly deployed.
5. **Federated ingestion; governed common core.** National and local systems may supply data through distinct adapters and integration contracts. All inputs must pass source, organisation, geography, schema, authorization, idempotency, quality and evidence checks before they can affect authoritative records or verification/value states.
6. **Common MRV and compliance control plane.** Resource-flow records, measurements, evidence, methodology execution, verification states, regulatory mappings, registry actions and audit trails must follow shared, versioned domain contracts. Applicable jurisdiction and methodology differences must remain explicit and traceable.
7. **Field-capable by design.** Site-level operations must support unreliable connectivity and controlled synchronisation where required, without creating a separate pilot-only field architecture.
8. **Environment separation without architecture divergence.** Development, test, staging and production may use different isolated resources and deployment settings, but they must exercise the same architecture and release artefacts. Jabalpur-specific settings must not become hidden production dependencies.
9. **Interoperability at national scale.** Use documented, versioned APIs and data contracts for government, ULB, enterprise, laboratory, weighbridge, device, verifier and ecosystem integrations. External systems remain independently governed; integration does not imply their approval or availability.
10. **Commercial and operational continuity.** The shared architecture must support multi-customer onboarding, subscriptions/contracts, service tiers, support, monitoring, backup, restoration, security response and customer data export without weakening statutory or public-sector controls.

## 3. National operating model

The target model is a common national platform with configurable jurisdictional and organisational execution:

- **National layer:** common platform governance, identity and access policy, shared reference data, versioned standards/methodology catalogue, audit controls, service operations and integration governance.
- **State and district layers:** jurisdictional configuration, programme oversight, geographic organisation hierarchy, reporting and delegated administration.
- **ULB / organisation layer:** onboarding, permissions, resource-flow operations, compliance responsibilities, facility and partner relationships.
- **Project / facility / site layer:** activity capture, measurement, evidence, field-device ingestion, reconciliation, operational review and attributable records.

These are target architecture scopes. They are not a claim that every administrative hierarchy, integration or deployment has already been implemented or accepted.

## 4. Role of Jabalpur SITE-JBP-01 Kathonda

Jabalpur is the first field implementation and a real-world validation environment for the national platform. It should validate representative end-to-end operation of the shared architecture, including:

- organisation, facility and site onboarding with correct scope and access controls;
- resource-flow and activity capture with attributable source records;
- weighbridge, measurement and other equipment integration through reusable adapters;
- evidence capture, quality controls, reconciliation and traceable corrections;
- applicable methodology and regulatory workflow execution with explicit versioning;
- verification and external trust/ledger workflows only where real independent evidence is available;
- offline/poor-connectivity handling and controlled synchronisation where needed;
- operational monitoring, support, backup/restore and incident procedures.

Site-specific parameters, equipment mappings, local permissions and the Jabalpur acceptance dataset may be unique. The platform architecture and reusable product capabilities must not be unique to Jabalpur.

**Validation boundary:** successful Jabalpur field operation is evidence for the tested site, workflows, integrations, user roles and operating conditions. It is not, by itself, proof of national coverage, nationwide legal applicability, multi-state acceptance, production capacity, or TRL 9.

## 5. National readiness gates

Do not label the system nationally deployable merely because the Jabalpur site works or because a build and deployment succeed. National readiness requires evidence appropriate to the intended release, including:

- tested multi-tenant isolation and organisation/geography scope enforcement;
- migration lineage, authoritative database selection, least-privilege runtime roles and database access controls;
- cross-jurisdiction and multi-organisation test coverage;
- load, capacity, resilience, availability and performance tests based on stated national operating assumptions;
- backup, restoration, disaster recovery, monitoring, alerting and incident-response evidence;
- independent security testing and vulnerability closure;
- validated external integrations and cryptographic/ledger/credential proof where claimed;
- statutory applicability analysis and approvals for each relevant deployment context;
- field acceptance, operating procedures, training, support ownership and cost-to-serve evidence;
- staged rollout, rollback and change-management controls.

Every gate must have an owner, acceptance criterion, evidence reference, status and residual risk. A planned feature or documented design is not completion evidence.

## 6. Decision test for engineering work

Before accepting a pilot-originated change, ask:

1. Does it serve a reusable national platform capability or a clearly bounded site configuration?
2. Can another state, ULB, organisation or facility use it without a code fork?
3. Are data ownership, tenant boundaries, regulatory scope and auditability explicit?
4. Are integration failures, retries, duplicate inputs and offline synchronisation governed?
5. Can it be tested and operated through the standard release and support model?
6. Does it preserve commercial IP boundaries while exposing appropriate open interfaces?
7. What evidence proves the implementation, and what remains unverified?

If the answer reveals a Jabalpur-only shortcut that would need replacement for national deployment, redesign it before treating it as the target architecture.

## 7. Relationship to existing controls

This document sets the architecture priority; it does not override SHAKTI production gates, applicable laws, regulatory obligations, security controls, customer contracts or independent approvals. The current production/certification gate remains authoritative for verified release status. The national architecture objective must be pursued while those gates remain fail-closed.

**Controlling rule:** Build the national platform once. Deploy and validate it first at Jabalpur. Scale through governed configuration, federation and repeatable operations—not through a second architecture.
