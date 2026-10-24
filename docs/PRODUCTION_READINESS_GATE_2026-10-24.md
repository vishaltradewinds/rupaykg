# RupayKg Production Readiness Gate — 2026-10-24

## AIM

Make RupayKg operational, secure, auditable, recoverable, and compliant before any production release. Production deployment remains the last gate.

## Shakti controls

- Do not deploy, migrate, modify provider settings, change billing, or certify production without explicit release approval.
- Separate CI evidence from production evidence.
- Use read-only provider checks for discovery.
- Do not infer the active database solely from a matching name. The live service-to-database environment mapping still needs authoritative confirmation.
- Do not treat a successful health endpoint as proof of pilot readiness, real user onboarding, or external MRV acceptance.

## Evidence collected

### Application endpoint

At 2026-10-24 12:41 UTC, a non-mutating GET to https://rupaykg.onrender.com/health returned HTTP 200 with:

- status: READY
- database: AVAILABLE
- syntheticData: false

The root page also returned HTTP 200. These observations prove endpoint reachability at that time only; they do not prove complete workflow acceptance.

### Render provider metadata

- Web service rupaykg is configured for repository vishaltradewinds/rupaykg, branch main, with auto-deploy enabled.
- The latest listed live deploy uses commit 0ddcf6087620880e21ea60f954c9f05d6b759469 (2026-10-19).
- Render database rupaykg-db (dpg-dakhdv95efls73e1974g-a) is suspended by billing; provider metadata lists an expiry of 2026-10-15.
- Its IP allowlist is 0.0.0.0/0.
- No SQL was attempted against the suspended Render database. No billing or provider settings were changed.

Because the public health endpoint reported its database as available while this Render database is suspended, the Render database should not be assumed to be the active database. The service's actual database target must be confirmed from authoritative deployment configuration without exposing credentials.

### Neon provider metadata and read-only schema checks

The strongest current candidate for the active database is Neon project rupaykg-production-fresh, project ID steep-mud-79906940, branch main (br-restless-base-b44cip2h), database rupaykg, PostgreSQL 18.6. This is a high-confidence inference from recent compute activity and the successful live health endpoint, not yet a definitive environment-variable mapping.

Read-only SQL against that candidate reported:

- Latest migration marker: 20261021; 91 migration records.
- platform_audit_chain_head exists with one row.
- platform_audit_chain_anchor does not exist.
- No non-internal triggers are attached to public.audit_events.
- Counts at inspection time: identities 0, organizations 0, activities 0, evidence 0, audit events 0.
- The migration-088 global audit chain is therefore not yet present on this candidate database.
- Neon project settings show public connections are allowed (block_public_connections=false) and no IP allowlist entries are configured.
- Neon project history retention is 21,600 seconds (6 hours); the provider snapshot listing returned no snapshots.

These are point-in-time observations. Confirm the service-to-project mapping before treating this candidate as definitively production.

## Release blockers

1. Database identity: conclusively map the running service's configured database target to the provider project/branch/database without disclosing credentials.
2. Recovery: six-hour history retention and no listed snapshots are insufficient evidence of an approved recovery plan. Define and test backup retention, restore procedures, RPO/RTO, access control, and restore verification.
3. Audit-chain cutover: migration 088 is not present on the candidate database. It must not be applied until the target is conclusively identified, a backup/restore is proven, a maintenance/change window is approved, and the lock-ordering migration passes CI.
4. Network exposure: public database connections are allowed with no IP allowlist. Determine feasible application egress restrictions and apply a least-privilege network policy only after connectivity is mapped and an approved change plan exists.
5. Operational onboarding: the candidate database currently has zero identities, organizations, activities, evidence, and audit events. The platform's live endpoint is reachable, but a real pilot is not evidenced by these counts.
6. External trust chain: Guardian, Hedera HCS, and Mirror Node end-to-end acceptance remains unproven. No successful external production acceptance is claimed.
7. Release governance: PR #44 remains draft/unmerged. Production certification stays HOLD.

## Engineering evidence

- Latest successful CI before the current lock-order follow-up: run #2003 on commit f4c31462d6ff39b65ddc0bd3adc90d82082361c0.
- Current change be0ff543cfe64883aca6feaadc117bf6b64ed50a fixes migration 088 lock ordering and adds a regression test. The migration now quiesces audit_events inserts before locking the chain head, avoiding the relation-lock/head-lock inversion with in-flight inserts.
- Local validation before the current commit: 97 migrations / 79 schema objects validated; workspace typecheck passed; API 104 passed / 0 failed / 12 skipped; carbon 30 passed; compliance 2 passed; domain 29 passed; ESG 1 passed; intelligence 2 passed.
- CI run #2004 for the current commit passed.
- CI backup/restore rehearsal applies only to disposable CI PostgreSQL databases; it is not production backup/recovery evidence.

## Decision

Engineering validation: PASS for the tested branch/CI evidence.

Production operational readiness: HOLD. Production certification: HOLD.

No production database migration, data mutation, provider setting change, billing change, deployment, or external Guardian/Hedera/Mirror Node acceptance was performed during this review.
