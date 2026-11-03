# RupayKg Greenfield Platform Baseline

**Status:** Proposed engineering baseline — not production approval  
**Scope:** Pan-India platform; not a single-site pilot  
**Standard:** Shakti Standards  
**Decision owner:** Product/platform owner  
**Last updated:** 2026-10-26

## 1. Foundational decision

**Greenfield here refers primarily to the target data model and data-migration approach. It does not mean rebuilding the entire application from scratch.** RupayKg's intended outcome remains a pan-India digital operating platform for waste, resource recovery, circular-economy evidence, and governed environmental/MRV workflows.

The target data model is defined from the intended national operating requirements. Existing database schemas, migration history, demo/acceptance fixtures, and pilot-specific records must not constrain that target automatically. Existing application code, workflows, integrations, and real operational records are assessed independently for reuse, refactoring, replacement, migration, archival, or exclusion. Preserve genuine records when required and authorized; do not carry over legacy structure or data merely because it exists.

This baseline defines the target data and operating model. It does not claim that the current implementation satisfies it. Existing components may be reused only after their behavior, security, compliance fit, maintainability, and test evidence have been checked.

**Non-goals:** designing the national platform around one landfill or municipality; treating a pilot as the national data model; using synthetic acceptance records as operational evidence; representing software workflow states as statutory approvals, verified environmental outcomes, carbon-credit issuance, or completed financial settlement.

## 2. National operating scope

The platform must support multiple organizations, facilities, activities, locations, materials, regulatory regimes, and operating models across India, including:

- Bulk waste generators and other producers;
- Municipal/local bodies and facility operators;
- Aggregators, collection centres, and material recovery facilities;
- Transporters, fleet operators, and logistics intermediaries;
- Recyclers, processors, co-processors, treatment and disposal facilities;
- EPR obligated entities, brand owners, and authorized service providers where applicable;
- Field operators, weighbridge/device operators, and authorized instrument providers;
- Independent auditors/verifiers, scheme administrators, and regulators with scoped access;
- Buyers/offtakers and settlement counterparties where the workflow requires them.

The model must permit different waste/material streams, facility types, scales of operation, languages, connectivity conditions, and state/local requirements without hard-coding one geography or one pilot workflow.

## 3. Core domain boundaries

Keep these entities and decisions distinct and auditable:

1. **Organization and identity** — legal/operating identity, verified attributes, membership, roles, and scoped permissions.
2. **Facility and geography** — registered location, facility type, operator, lifecycle status, and separately recorded evidence of applicable authorizations.
3. **Activity and material** — activity type, material/waste classification, quantity and unit, time, source/destination, and applicable rule/methodology version.
4. **Custody and logistics** — hand-offs, transporter, vehicle/trip where applicable, dispatch, receipt, exceptions, and reconciliation.
5. **Measurement and instrument** — observation, calibration/maintenance status, source device, operator, timestamp, units, uncertainty/quality flags, and provenance.
6. **Evidence** — original artifact/reference, collection method, integrity metadata, access policy, retention, correction history, and chain of custody.
7. **Compliance applicability** — jurisdiction, effective dates, official source/version, applicability determination, required documents, reviewer and decision evidence.
8. **MRV and environmental accounting** — methodology version, boundaries, activity data, factors, equations, uncertainty, independent review, and reproducible calculations.
9. **Registry/claims/settlement** — separate eligibility, authorization, issuance, transfer, retirement, external confirmation, and reconciliation states. No internal status alone proves an external event.
10. **Audit and assurance** — append-only critical-event history, attributable changes, independent review, access monitoring, incident response, and periodic assurance.

A facility being registered does not establish a permit. Platform membership does not confer statutory authority. A measurement is not automatically verified. A calculated benefit is not a certified environmental claim or issued credit.

## 4. Product and workflow principles

- Build a common national core with jurisdiction-, scheme-, material-, and activity-specific rules configured through governed, versioned records.
- Design mobile-first and low-bandwidth workflows, offline capture with explicit reconciliation, plain-language prompts, and language support. Offline intake must not silently mutate authoritative records.
- Support organization and facility onboarding, authorization checks, material/activity registration, custody transfer, measurement/evidence capture, exception handling, verification, reporting, and controlled downstream actions.
- Make data provenance and correction history visible to authorized actors. Never overwrite source evidence silently.
- Avoid social-feed mechanics. Optimize for task completion, trust, accessibility, and accountable outcomes.
- Use synthetic fixtures only in isolated test environments, visibly identified as synthetic. Production startup must not seed acceptance/demo identities or evidence.
- Use open standards and interoperable APIs where feasible; document data export, migration, retention, and exit paths.

## 5. Security and data governance baseline

- Enforce tenant isolation and least privilege in both application and database boundaries where practical.
- Separate runtime application credentials from migration/administrative credentials.
- Validate TLS certificates; do not disable certificate verification to make connections succeed.
- Use reviewed, deterministic, forward-only migrations and test both fresh installation and upgrades from every supported baseline.
- Protect secrets from logs, issue reports, browser bundles, and user-facing artifacts.
- Apply purpose limitation, minimization, retention/deletion controls, and access logging to personal and commercially sensitive data.
- Use idempotency and transactional consistency for custody, evidence application, registry, and settlement mutations.
- Backups are not accepted as recovery capability until restore tests and recovery objectives are evidenced.
- Treat device data as untrusted input until device identity, provenance, calibration/quality, and the applicable approval requirements have been verified.

## 6. Hardware eligibility rule

For hardware integrated into RupayKg, identify the exact make/model, manufacturer, firmware, intended use, interface, calibration/maintenance needs, and evidence requirements. Verify applicable MeitY approval/empanelment or other relevant government requirements against an authoritative current source for the specific device and use case before treating it as eligible. Do not assume every IoT sensor category has a single universal MeitY approval list. If eligibility is unproven, mark the device **NOT APPROVED FOR PRODUCTION USE** and keep integration in a test/sandbox boundary.

## 7. Shakti Standards gates

No stage may be skipped. Evidence must be attached to each gate, and an unresolved gate remains visibly blocked.

1. **Reality and context discovery:** stakeholder journeys, field conditions, languages, connectivity, material flows, operating constraints.
2. **Evidence and source validation:** authoritative legal/technical sources, source dates, provenance, confidence, unresolved questions.
3. **Statutory/regulatory mapping:** applicability by actor, activity, material, jurisdiction, scheme, effective date; legal review where needed.
4. **Feasibility and risk:** operational, economic, technical, security, privacy, safety, environmental and adoption feasibility.
5. **Architecture and design:** domain boundaries, threat model, data model, API contracts, failure modes, access and retention rules.
6. **Engineering:** reviewed implementation, dependency hygiene, migrations, observability, accessibility, resilience and documented decisions.
7. **Verification:** unit, integration, authorization/tenant-isolation, migration-upgrade, browser/mobile, offline-sync, performance, security and recovery tests.
8. **Operational acceptance:** real authorized users, real approved devices and integrations, observed workflows, exceptions and signed acceptance evidence. Synthetic tests do not satisfy this gate.
9. **Approval/certification:** only the competent authority or scheme owner can grant statutory/scheme approval; platform status must not imply otherwise.
10. **Controlled deployment:** identified environment/data target, rollback plan, backup/restore evidence, security configuration and accountable authorization.
11. **Operations and measurement:** monitoring, incident response, support, service objectives, data quality, reconciliation and periodic assurance.
12. **Continuous assurance:** change-impact review, source/rule updates, regression evidence, vulnerability remediation and renewed approvals when required.

## 8. Engineering evidence and release policy

- CI pass means only that the tested commit passed the recorded checks.
- A pull request, review comment, green build, or deployed web service does not establish live operational acceptance.
- Never merge solely to make branches look tidy. Resolve dependencies, inspect exact commit contents, review security and data implications, and run required gates first.
- Never run migrations, reactivate databases, change billing/network exposure, or enable production certification without verified target identity, explicit authorization, and documented rollback/recovery readiness.
- Production certification remains **OFF / HOLD** until all applicable Shakti gates have evidence and the accountable approver authorizes the transition.

## 9. First implementation sequence

1. Map the current repository against this target and label each component **reuse**, **refactor**, **replace**, **missing**, or **not yet verified**.
2. Define pan-India actor, organization, facility, geography, activity, material, custody, measurement, evidence, and authorization schemas.
3. Build a source-of-truth regulatory applicability catalog with versioned official sources and effective dates.
4. Establish tenant isolation, identity/access control, evidence provenance, auditability, and environment boundaries.
5. Define API contracts and end-to-end journeys for each actor class, including offline and exception paths.
6. Establish migration ownership and test fresh installs plus upgrades from each explicitly supported baseline.
7. Verify hardware/integration eligibility before any production-device commitment.
8. Run independent security, compliance, operational and recovery reviews; record evidence and unresolved gaps.
9. Conduct controlled real-world acceptance only when the platform and all relevant participants are ready; do not use a pilot as a substitute for national architecture.
10. Make release decisions from gate evidence, not assumptions.

## 10. Current state and open questions

This document is a target baseline, not proof that the implementation meets it. The following must be established from repository and authorized environment evidence:

- Which code paths are suitable for reuse and which embody obsolete or pilot-specific assumptions;
- Whether any production data or external users exist and what must be retained;
- The authoritative database target and whether it is genuinely part of the greenfield target;
- Supported migration baselines and whether existing numbered migrations are historical implementation artifacts or target requirements;
- Current regulatory source verification and competent-authority review status;
- Actual approved device inventory and integration credentials;
- Real user acceptance, backup restoration, security and operational readiness evidence.

Until these are verified, classify the platform as **GREENFIELD ENGINEERING / NOT PRODUCTION-CERTIFIED**.
