# Shakti Standards Rule: Batch Coherent Engineering Changes, Then Validate

**Status:** Mandatory engineering execution rule  
**Applies to:** All AllianceVentures projects and every project-specific operating system governed by Shakti Standards  
**Effective:** 2026-10-21  
**Implementation note:** This document records the rule for this repository. It does not replace the portfolio's overarching Shakti Standards or any project-specific statutory, safety, security, or release controls.

## Binding rule

> **Audit the complete related problem first; implement the coherent set of safe, dependency-linked changes together; then run comprehensive validation against the final combined change set. Do not create unnecessary cycles of one small change followed by a full test run.**

The objective is to optimize for complete, correct engineering work—not for the number of intermediate commits or test runs.

## Required workflow

1. **Discover and scope:** Inspect the relevant code paths, data models, schemas, migrations, permissions, integrations, operational procedures, existing tests, official sources and project constraints before deciding the solution.
2. **Map dependencies and risks:** Group findings into coherent workstreams. Identify shared interfaces, database/API compatibility, security boundaries, statutory obligations, rollout dependencies and rollback requirements.
3. **Plan the batch:** Define the intended files/components, migration order, acceptance criteria, negative cases, evidence needed and external blockers. Prefer one coherent implementation batch over unrelated piecemeal edits.
4. **Implement together:** Where safe, implement the related code, database migrations, constraints, authorization, regression tests, documentation, telemetry and runbook changes as one reviewed batch. Preserve backwards compatibility or provide an explicit migration/transition plan.
5. **Use targeted checks selectively:** A narrow test, typecheck, static check or security probe may be run during implementation when it materially reduces risk, helps isolate a dangerous change, or is needed to establish a safe design. Such checks are not a reason to restart the entire validation cycle after every minor edit.
6. **Validate the final combined state:** After the planned batch is complete, run the full applicable validation suite against the exact final commit: dependency/security checks, formatting/lint where configured, typecheck, unit/integration tests, migration validation and disposable-database application, API/authorization and tenant-isolation acceptance, build, browser/runtime smoke tests, container build, and relevant operational tests.
7. **Fix by root cause:** If validation fails, investigate the failure and related failure clusters, correct the root cause in a coherent follow-up batch, and rerun the affected checks plus the full required release suite. Never claim a previous commit's green result validates a later commit.
8. **Record evidence:** Record the tested commit SHA, exact commands/CI run, pass/fail counts, skipped tests, environment boundaries, migration outcome, known limitations and remaining external approvals. Keep the change unmerged/undeployed when release gates are not closed.
9. **Release only through gates:** A green engineering suite is necessary where applicable, but is not statutory approval, independent certification, production authorization, successful official integration, or proof of real-world readiness. Deployment, destructive data changes, external submissions and production migrations remain subject to explicit authorization and project-specific Shakti gates.

## Exceptions and safeguards

- **Never batch away safety:** Targeted checks are permitted and required where a change touches security, authorization, data integrity, financial/environmental calculations, safety-critical logic, destructive migrations, secrets or external side effects.
- **Never defer discovery until after implementation:** Related requirements and dependencies must be mapped before the batch is considered complete.
- **Do not over-batch unrelated work:** Keep the batch coherent, reviewable, reversible and traceable. Split work when independent risk, ownership, release timing or a prerequisite makes one batch unsafe.
- **Protect real data:** Use disposable or explicitly approved isolated environments for migration and worker lifecycle acceptance. Do not mutate inherited staging or production records merely to make tests pass.
- **Do not invent completion:** If a tool, environment, credential, official source or approval is unavailable, document the blocker and continue with safe work that can actually be completed.

## Definition of done for an engineering batch

A batch is complete only when:
- the related implementation and its migration/configuration changes are present together;
- positive, negative, boundary, authorization and regression cases appropriate to the risk are included;
- the full required suite has been run on the final combined commit and its actual results recorded;
- documentation and operating instructions match the implementation;
- unresolved risks and external dependencies are explicitly listed; and
- release state reflects the evidence, not optimism.

## Application to RupayKg

For RupayKg, this rule must be applied alongside **Pan-India by Design**. Related jurisdiction/geography, stakeholder taxonomy, organization authorization, statutory applicability, evidence lineage and government-worker changes should be audited as connected workstreams and implemented in coherent safe batches. The starter geography profile is not national authority data; taxonomy expansion must not weaken database constraints or authorization; official API access and live Guardian/Hedera/Mirror Node proof must not be fabricated. National readiness remains unproven until supported by jurisdiction coverage, multi-tenant and operational evidence.

**Golden rule:** One Shakti Standard, many project-specific operating systems. Batch coherent engineering work; validate the final state; release only on evidence.
