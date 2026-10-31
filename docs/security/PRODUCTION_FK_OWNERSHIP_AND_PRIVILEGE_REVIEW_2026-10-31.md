# RupayKg database ownership graph and privilege review — 2026-10-31

**Status:** Evidence-backed design input; read-only production catalog inspection plus source review.  
**Production target:** Neon project `rupaykg-production-fresh` / `steep-mud-79906940`, branch `main` / `br-restless-base-b44cip2h`, database `rupaykg`.  
**Repository branch:** `shakti/atomic-inbox-claim-2026-10-31`.

## 1. Confirmed catalog scale

- 67 public base tables.
- 181 foreign-key constraints in the production catalog.
- 109 trigger rows across 33 tables, invoking 67 distinct trigger functions.
- Earlier verified state: 0/67 public tables with RLS enabled; 0 public RLS policies.
- Earlier verified state: 92 migration ledger rows, maximum version `20261021`.
- Public views were previously inventoried as zero.
- Production remains unchanged by this review.

These are production catalog counts, not counts inferred from repository migrations.

## 2. Ownership graph — verified examples and policy implications

The 181 FK constraints establish that many tables without a direct organization/identity key inherit or participate in ownership through parent records. FK existence alone does not define authorization; semantic role must also be considered.

| Child table / group | FK-linked parents observed | Required authorization interpretation |
|---|---|---|
| `activity_assignments` | activities, identities, roles | Both activity-organization scope and assigned identity scope; validate that identity is eligible in the activity's organization |
| `bwg_epr_reports` | evidence, BWG reporting periods, EPR schemes, verifications | Tenant ownership through reporting period and evidence; scheme is reference data; verification has independent reviewer authority |
| `bwg_esg_reports` | evidence, BWG reporting periods, verifications | Tenant-owned report with independent evidence/reviewer checks |
| `bwg_waste_reports` | evidence, reporting periods, processor organization, verifications | Multi-party producer/processor context; do not collapse to reporting-period owner alone |
| `carbon_calculations` | activities, carbon projects, methodologies, mechanisms, regulatory sources | Tenant scope through activity/project; methodology/mechanism/source are governed reference snapshots |
| `carbon_projects` | organization, geography, methodology, mechanism, regulatory source | Direct tenant owner plus controlled national reference data |
| `chain_of_custody_links` | activity, actor organization, evidence, resource flow, from/to geography | Actor and flow owner plus origin/destination context; custody may cross organizations |
| `cpcb_swm_status_history` | workspace, organization, actor identity | Append-only tenant history; actor must be authorized for workspace transition |
| `credentials` | activity, issuer organization, methodology, verification | Issuer/holder/subject and verifier roles; not a single-tenant record |
| `environmental_attribute_claims` | activity, evidence, organization, verification | Tenant claim with evidence and verification lineage; enforce double-claim constraints |
| `epr_credit_allocations` | EPR credits, EPR obligations | Child ownership must be consistent across credit issuer/holder and obligated organization |
| `epr_credit_transfers` | credits, evidence, from-organization, to-organization, verification | Explicit bilateral transfer authorization and independent verification |
| `epr_credits` | activity, evidence, issuer, recycler, scheme, verification | Issuer/recycler/beneficiary semantics; not one organization by default |
| `epr_obligations` | organization, obligation, scheme, source evidence | Obligor tenant plus national scheme and evidence provenance |

The inventory above is a representative policy-critical subset. The full 181-edge catalog must be retained in the generated source evidence or re-queried from Neon during the next review; do not infer unlisted FK edges from this summary.

## 3. Trigger and lifecycle enforcement already present

The production catalog has 109 trigger rows on 33 tables and 67 distinct trigger functions. The observed trigger function inventory includes controls for:

- Membership activation and verified role permissions.
- Device identity binding, field-sync envelope binding, operation-sync device binding, payload hashing and conflict-resolution audit.
- Evidence vault pointer immutability, evidence version/review immutability and provenance mutation controls.
- Methodology governance immutability and required governance evidence.
- Carbon methodology/mechanism consistency and provenance mutation.
- EPR quantity, transfer evidence, allocation capacity, external registration integrity and double-claim prevention.
- Credential issue/retirement lifecycle and verifier independence.
- Registry transfer recipient checks, event permission, hash anchoring and append-only event protection.
- Settlement party integrity, credential owner authorization, lifecycle, external confirmation and append-only event protection.
- Hierarchical stakeholder approval, authority checks, completion and self-approval prevention.
- Geography scope enforcement for activities and resource flows.

**Important:** These triggers are valuable integrity/lifecycle controls, not substitutes for row-level access control. Trigger execution can be reached by any role with sufficient table DML rights. Review must prove they remain effective under the future least-privilege roles and RLS policies.

## 4. Role inventory — critical finding

The production role catalog returned the following privileged roles:

| Role | LOGIN | SUPERUSER | BYPASSRLS | CREATEDB | CREATEROLE | REPLICATION |
|---|---:|---:|---:|---:|---:|---:|
| `cloud_admin` | yes | yes | yes | yes | yes | yes |
| `neon_service` | yes | no | yes | yes | yes | yes |
| `rupaykg` | yes | no | yes | yes | yes | yes |
| `neon_superuser` | no | no | yes | yes | yes | yes |

The production SQL inspection principal `rupaykg` is a member of `neon_superuser`. The current catalog does not establish a dedicated least-privilege API, authentication, worker, event-writer or read-only operations login.

**Release-blocking decision:** do not deploy application traffic using any role with `BYPASSRLS`, `SUPERUSER`, `CREATEROLE` or broad DDL privileges. Create and validate least-privilege roles only through a reviewed migration on a disposable Neon production-derived branch first. Do not change production roles in this batch.

## 5. Function review — first pass only

A production function catalog listing was inspected. The returned application functions were owned predominantly by `rupaykg`; extension-provided cryptographic functions were owned by `cloud_admin`. The listing did not show a SECURITY DEFINER application function or per-function `search_path` setting in the displayed rows.

This is **not yet a complete proof** that no SECURITY DEFINER path exists. A final review must:
- Re-query all functions with schema, signature, owner, `prosecdef`, language, volatility, configuration and ACL.
- Inspect full definitions for dynamic SQL, object qualification and search-path assumptions.
- Inspect trigger function definitions and their table access.
- Review execute grants, PUBLIC execute defaults and extension-owned routines.
- Confirm that no trigger/function assumes elevated application-role privileges.

## 6. ACL / sequence review limitation

The catalog query for full relation ACLs/default privileges was blocked by the connected inspection layer's safety checks in this session. No conclusion about effective table, schema, sequence or function grants is asserted from that failed query. This is a recorded evidence gap, not evidence of safe permissions.

Next review must inspect, with a narrowly scoped read-only catalog query:
- Schema USAGE/CREATE privileges.
- Table SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER privileges.
- Sequence USAGE/SELECT/UPDATE privileges.
- Function EXECUTE grants.
- Default privileges for future objects.
- Object ownership and role memberships.
- Effective privileges inherited through memberships and PUBLIC grants.

## 7. Recommended target authorization architecture

Do not implement a blanket `organization_id = current_setting(...)` policy. The shared API helper's transaction-local GUCs are useful context transport but are caller-forgeable by a database client that can execute arbitrary SQL.

Target design principles:

1. **Separate service roles:** API read/write, authentication/session, government ingestion, tenant worker, event writer, migration owner and read-only operations. Runtime roles must be NOINHERIT where appropriate, non-owner, non-superuser, no BYPASSRLS, no CREATEROLE/CREATEDB/REPLICATION, and no DDL.
2. **Verified context:** tenant/identity/device/platform context must be derived from a cryptographically authenticated short-lived capability issued by a trusted identity authority, or an equivalent non-forgeable boundary. Do not treat client-supplied IDs or plain custom GUC values as proof.
3. **Database verification:** use a narrowly scoped, audited verifier that validates capability signature, issuer, audience, expiry, nonce/replay rules, identity, active membership, organization, device and permitted operation. Signing keys must not be readable by ordinary SQL runtime roles. Select a verification mechanism only after verifying extension/provider support and threat model.
4. **Table-specific RLS:** direct organization-owned, identity-private, FK-child, bilateral/multi-party, device-sync, control-plane, global-reference and append-only provenance tables need different policies.
5. **Bilateral authority:** issuer, holder, payer, payee, sender, receiver, recycler, verifier and regulator roles must be modeled explicitly. A row can be visible to multiple parties under distinct operations.
6. **Control-plane separation:** platform admin and national ingestion cannot use ordinary tenant policies as a backdoor. Use explicit service capabilities, narrow table grants, approval and append-only audit.
7. **Fail closed:** missing, expired, malformed, replayed, ambiguous or revoked context returns no rows and rejects writes.
8. **Defense in depth:** application authorization remains mandatory; database RLS/grants provide an independent enforcement layer.

## 8. Mandatory test gates before production

- Cross-tenant SELECT/INSERT/UPDATE/DELETE denial for every tenant-owned table.
- FK-child access through every parent path, including orphan/ambiguous rows.
- Identity-private credential/session isolation.
- Bilateral party access and denial for every transfer/settlement transition.
- Forged GUC, forged tenant ID, expired signature, wrong audience, wrong issuer and replayed capability.
- Pooled connection reuse after commit, rollback, timeout and cancellation.
- Membership revocation during active sessions.
- Device reassignment, revoked device, offline replay, duplicate envelope and cross-organization device attack.
- Platform-admin least privilege, break-glass approval and audit.
- Trigger/function behavior under the new runtime roles.
- Migration rollback/recovery and independent restore rehearsal.

## 9. Safety and next action

This batch was read-only against Neon. No production DDL/DML, migration, role/grant/RLS change, credential change, branch operation, deployment or worker activation occurred.

**Production remains HOLD.** Tenant isolation is NOT ESTABLISHED. Backup/restore RPO/RTO is NOT VERIFIED. Government worker remains OFF. Certification remains OFF. TRL 9 is NOT ESTABLISHED.

Next: complete exhaustive route-handler-to-query-to-table mapping; finish ACL/sequence/function grant review; create the first least-privilege role/RLS migration proposal and test it only on a disposable production-derived Neon branch.
