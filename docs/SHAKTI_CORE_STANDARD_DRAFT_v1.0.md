# Shakti Core Standard — Controlled Draft v1.0

- **Document ID:** SHAKTI-CORE-STD-001
- **Version:** 1.0-draft
- **Status:** Proposed for review; not approved, certified, or effective as an organizational policy until formally approved by the designated owner.
- **Owner:** Shakti Standards owner (to be formally named)
- **Applies to:** All AllianceVentures projects and systems where Shakti Standards are adopted.
- **Review trigger:** Material incident, legal/regulatory change, architecture or supplier change, release-gate failure, or at least annually.
- **Golden rule:** **ONE SHAKTI STANDARD. MANY PROJECT-SPECIFIC OPERATING SYSTEMS.**

## 1. Purpose and governing principle

Shakti is a lifecycle assurance standard. It is intended to prevent a project from advancing on assumptions, incomplete evidence, unapproved risk, or a successful build that has not been validated in its real operating context. The core gates are universal; the evidence, controls, risks, and acceptance criteria are project-specific.

This document is a controlled proposal. It does not claim legal certification, statutory approval, third-party approval, or formal organizational adoption.

## 2. Mandatory lifecycle

Every project shall maintain traceability across the following lifecycle. A gate may be marked not applicable only with a documented rationale and authorized approval; it must not silently disappear.

1. Reality — establish what actually exists; distinguish observed facts from assumptions.
2. Context — identify users, sites, environment, dependencies, operating conditions and affected parties.
3. Need — define the problem, intended outcomes, non-goals and success measures.
4. Evidence — capture sources, dates, versions, provenance and limitations.
5. Understanding — validate interpretation with relevant stakeholders and domain experts.
6. Relevance — show why each requirement and control applies to this project.
7. Boundaries — identify legal, regulatory, safety, privacy, security, contractual, ethical and provider constraints.
8. Options — compare viable approaches, including no-build and free/low-cost alternatives where appropriate.
9. Feasibility — demonstrate technical, operational, financial, supply-chain and maintenance feasibility.
10. Validation — test assumptions and critical claims against evidence and representative conditions.
11. Decision — record the selected option, rejected alternatives, risks, approver and rationale.
12. Design — define architecture, interfaces, threat model, data model, operations and acceptance criteria.
13. Production engineering — implement in reviewable, version-controlled changes.
14. Verification — run appropriate unit, integration, security, migration, performance, accessibility and end-to-end tests.
15. Compliance and approvals — obtain applicable statutory, regulatory, contractual, site, safety and third-party approvals.
16. Shakti certification decision — assess all applicable gates and residual risks; do not self-certify an external approval.
17. Live release — deploy only after the release gate is authorized.
18. Continuous assurance — monitor, back up, recover, patch, respond to incidents and periodically revalidate.
19. Learning — document outcomes, failures, corrective actions and changes required for the next cycle.

## 3. Gate states and semantics

Every requirement and gate shall use exactly one state:
- **PASS:** The acceptance criterion is met and current, reviewable evidence is linked.
- **FAIL:** Evidence demonstrates the criterion is not met.
- **BLOCKED:** A prerequisite, dependency, approval or evidence item prevents a valid decision.
- **NOT VERIFIED:** Evidence is absent, stale, incomplete, inaccessible or not independently validated. This is not a pass.
- **NOT APPLICABLE:** The requirement genuinely does not apply; rationale, scope, evidence and authorized approver are recorded.

“Open”, “in progress”, “planned” and “waived” may be workflow labels, but must not be represented as gate states or as PASS. A waiver is an exception record, not a PASS.

## 4. Evidence and traceability contract

Each requirement shall have a stable identifier and record at least:
- Requirement ID, text, rationale, source and source version/date.
- Applicability and risk classification.
- Acceptance criterion and verification method.
- Evidence reference, timestamp, environment/site/configuration and tested version.
- Result, limitations, reviewer, approver and review date.
- Owner, corrective action, due date and dependency/blocker.
- Revalidation trigger or expiry, where evidence can become stale.

Required traceability chain: **Requirement → Evidence → Analysis → Decision → Owner → Status → Traceability.**

Evidence must be attributable and reproducible to a reasonable extent. Screenshots, a green CI badge, HTTP 200, a successful build, a supplier claim, or an AI-generated explanation alone are not proof of full operational acceptance. Record what the evidence proves and what it does not prove. Never fabricate evidence, test results, approvals, signatures, calibration, or deployment status.

## 5. Risk classification and proportional controls

Projects shall define risk classes before design approval. At minimum assess human safety, statutory/regulatory exposure, financial loss, security/privacy, data integrity, environmental impact, operational continuity, third-party dependence and reputational impact.
- **Critical / P0:** Could cause severe harm, unlawful operation, irreversible data loss, material integrity compromise or uncontrolled production exposure. Block release until resolved and independently verified.
- **High / P1:** Material security, compliance, financial or operational risk. Block affected release scope unless an authorized, documented exception is lawful and demonstrably safe; statutory requirements cannot be waived.
- **Moderate / P2:** Manage with owner, mitigation, due date and acceptance criteria; determine whether it blocks release based on documented risk.
- **Low / P3:** Track and resolve proportionately; disclose residual risk where relevant.

A project may adopt stricter controls. It may not downgrade a risk merely to pass a gate.

## 6. Independence, approvals and exceptions

The implementer must not be the sole approver of a critical/high-risk control or release. Use independent review appropriate to the risk and project size. Record conflicts of interest.

An exception must specify the requirement, reason, scope, duration, compensating controls, residual risk, owner, expiry, rollback/containment plan and authorized approver. Exceptions expire and must be re-reviewed. No exception may waive law, regulation, mandatory third-party approval, safety-critical acceptance or a requirement imposed by a competent authority. If safe/legal operation cannot be demonstrated, remain BLOCKED.

## 7. Free-first and procurement rule

Prefer a fit-for-purpose free option when it meets documented functional, security, reliability, privacy, compliance and support requirements. Compare total cost, limits, lock-in, exportability, operational burden and exit path; “free” does not mean risk-free.

No paid upgrade, billing activation, recovery charge, purchase or paid service change without explicit user/owner approval of cost and consequences. Do not enable surprise billing. If no viable free option meets minimum requirements, document the gap and alternatives and request a decision before incurring cost. Never bypass a mandatory control to preserve a zero-cost target.

## 8. Hardware, sensors, IoT and edge systems

For every physical device and sensor, record manufacturer, exact model/SKU, hardware revision, firmware, origin/supplier, intended use, site/environment, measurement range, accuracy/uncertainty, calibration requirements, installation, power, communications, security update path, maintenance, ownership and replacement plan.

Determine which legal and conformity obligations apply to the exact device and deployment. Depending on device and use, assess relevant MeitY procurement/approval conditions, BIS/Indian Standards, WPC/radio permissions, electrical safety, EMC, Legal Metrology, calibration/accreditation, environmental and sector-specific requirements. Do not assert that every sensor universally requires the same MeitY approval; establish applicability from authoritative current requirements and procurement terms. A generic product listing or supplier assertion is not approval evidence.

Test loss of power/connectivity, clock drift, replay/duplication, tampering, calibration expiry, out-of-range readings, firmware changes and secure recovery. Raw readings, derived values, corrections and provenance must remain distinguishable.

## 9. Software, data, AI and security controls

- Identify the authoritative source of truth for every critical business state.
- Enforce authentication, authorization and tenant/site/geographic scope server-side.
- Use least-privilege, separated runtime and migration identities where appropriate, verified TLS, managed secrets, rotation and redaction.
- Protect data integrity, audit history, idempotency, backup and restoration.
- Define retention, access, deletion, export, privacy and incident obligations.
- Pin and review dependencies; scan vulnerabilities and establish patch/remediation policy.
- For AI outputs, distinguish advice from authoritative decisions; test failure modes, prompt/data injection, privacy, bias and unsupported claims relevant to the use case.
- Never represent synthetic/demo/test data as real field evidence or live business activity.
- Fail closed where missing evidence or invalid configuration could cause unauthorized, unsafe or misleading state transitions.

## 10. Verification and release sequence

Use small, reviewable batches: **Audit current state → preserve existing work/data → define acceptance → implement one coherent batch → run focused tests → run regression tests → inspect evidence and diff → remediate failures → independent review → next batch.**

Release sequence: **CODE READY → CONFIGURATION READY → RUNTIME ACCEPTANCE → EXTERNAL ACCEPTANCE → APPROVAL → SHAKTI RELEASE DECISION → DEPLOYMENT → POST-DEPLOY VERIFICATION.**

Deployment is the final controlled step, not a test substitute. Keep rollback and incident containment plans ready. A deployment can be technically live while the product remains uncertified for production use.

## 11. Operational assurance

Before production acceptance, define and test monitoring/logs/alerts and incident escalation; backup access, retention and restore; rollback and migration compatibility; vulnerability patching and secret rotation; capacity/rate limiting and degraded-mode behavior; support, maintenance, supplier continuity, data export and exit strategy; periodic revalidation and audit review; and change control for code, models, prompts, configuration, firmware, sensors, methodology, suppliers and legal sources.

## 12. Certification decision and reporting

The release record must identify exact scope, version/commit, environment/site, evidence set, applicable external approvals, residual risks, independent reviewers and decision date. Use one of:
- **CERTIFIED FOR DEFINED SCOPE:** all applicable mandatory gates pass and approvals are evidenced.
- **ENGINEERING PASS — PRODUCTION HOLD:** software checks pass but real-world or external acceptance is incomplete.
- **BLOCKED:** a material gate fails or lacks a prerequisite.
- **NOT ASSESSED:** evidence is insufficient to make a reliable decision.

Certification is scoped and time-bound; it is not a blanket guarantee. It never substitutes for a regulator, statutory authority, accredited body, customer acceptance or service-provider approval.

## 13. Minimum controlled artifacts

Each project should maintain: (1) Project Operating System/applicability profile; (2) requirements and evidence register; (3) risk and exception registers; (4) architecture, data-flow and threat model; (5) verification and acceptance plan/results; (6) compliance/approval register; (7) release decision and rollback record; (8) operations, backup/restore and incident runbooks; and (9) continuous-assurance and change log.

## 14. Approval and change control

This draft becomes effective only after a named owner reviews it, resolves comments, approves a version, records an effective date and defines controlled distribution. Project-specific documents must reference the adopted version and may add stricter controls. Conflicts must be escalated; do not silently choose the weaker rule.

**Approval status: DRAFT — owner approval and formal adoption not evidenced.**