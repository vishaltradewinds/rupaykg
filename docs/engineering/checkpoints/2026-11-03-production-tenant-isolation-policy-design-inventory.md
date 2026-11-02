# RupayKg — production tenant-isolation policy design inventory

Checkpoint: 2026-11-03
Evidence: read-only PostgreSQL catalog inspection of Neon production project steep-mud-79906940, production branch br-restless-base-b44cip2h, database rupaykg.
Status: design inventory only. No production DDL/DML, RLS activation, role changes or deployment.

## 1. Observed baseline
- 67 public application tables; 0/67 with RLS enabled; 0/67 with FORCE RLS; 0 policies on inspected public tables.
- Application login role rupaykg has LOGIN, BYPASSRLS, CREATEDB, CREATEROLE, REPLICATION and INHERIT.
- 67 distinct public trigger functions were observed without pinned search_path in the production catalog audit.
- November candidate migrations are not present in the production migration ledger.
- Tenant isolation is not established. Adding policies without first separating ownership and runtime privileges would leave the current BYPASSRLS role able to evade them.

## 2. Policy classes
| Class | Scope anchor | Required design |
|---|---|---|
| A — direct tenant root | Row contains organization ownership/party column | Match signed request organization to active VERIFIED membership; explicit rules for multiple parties. |
| B — parent-derived child | Foreign key to tenant root/child | EXISTS chain to authoritative parent; reject mismatched parents on writes. |
| C — identity-private | Identity/session/credential rows | Default deny; self-scope and narrowly controlled authentication/account-recovery functions. |
| D — shared reference/catalog | Geography, regulation, methodology and scheme catalogues | Runtime read-only; governed publication writes only. |
| E — control plane | Migration ledger, audit chain, reserved authority | Separate owner/function and control-plane roles; no ordinary tenant writes. |
| F — multi-party | Transfers, settlements, registry and custody | Per-party and per-action matrix; no blanket cross-tenant OR rule. |

## 3. Table-by-table initial anchor map
These are initial classifications from live column and foreign-key metadata, not final grants or policy SQL. Every row still needs route/worker call-site mapping and a reviewed read/write matrix.

### A — direct tenant roots and party ownership
| Table | Observed anchor | Policy direction |
|---|---|---|
| activities | organization_id | Membership plus activity permission |
| audit_events | organization_id | Tenant read; append-only audited write |
| bwg_profiles | organization_id | Membership |
| bwg_reporting_periods | organization_id | Membership |
| carbon_projects | organization_id | Membership; governed catalog links |
| chain_of_custody_links | actor_organization_id | Actor tenant plus linked activity/resource-flow collaboration |
| cpcb_swm_stakeholder_workspaces | organization_id | Membership; creator/updater are attribution only |
| cpcb_swm_status_history | organization_id | Workspace tenant; actor is attribution |
| credentials | issuer_organization_id | Issuer tenant; holder/registry disclosure separately governed |
| environmental_attribute_claims | organization_id | Membership plus activity/evidence scope |
| epr_credit_transfers | from_organization_id, to_organization_id | Sender/recipient access by lifecycle action |
| epr_credits | issuer_organization_id, recycler_organization_id | Explicit issuer/recycler access matrix |
| epr_obligations | obligated_organization_id | Obligated tenant; regulator access separately authorized |
| epr_returns | organization_id | Membership |
| esg_reporting_periods | organization_id | Membership |
| evidence_artifact_series | organization_id | Membership plus activity linkage |
| field_devices | organization_id | Membership; device identity does not replace tenant |
| obligations | organization_id | Membership; geography is scope, not tenant |
| organization_bwg_assessments | organization_id | Membership; determination identity is attribution |
| organization_epr_applicability | organization_id | Membership; regulator review separately authorized |
| organization_geography_scopes | organization_id | Membership; geography is scope, not tenant |
| organization_memberships | organization_id, identity_id | Own membership plus narrowly permissioned membership administration |
| organization_statutory_profiles | organization_id | Membership; regulator access separately authorized |
| organization_verification_evidence | organization_id | Membership plus verifier/reviewer function |
| platform_access_change_requests | organization_id plus requester/approver/target identities | Control-plane two-person workflow only |
| registry_events | from_owner_id, to_owner_id | Explicit transfer parties, credential owner and registry reader scope |
| resource_flows | organization_id | Membership; geography fields are not tenant keys |
| roles | organization_id | Membership; reserved platform roles isolated to control plane |

### B — parent-derived tenant children
| Table | Parent lineage | Policy direction |
|---|---|---|
| activity_assignments | activity_id → activities.organization_id | Inherit activity tenant; own assignment unless manager permission |
| bwg_epr_reports | reporting_period_id → bwg_reporting_periods.organization_id | Inherit reporting period; validate scheme/evidence links |
| bwg_esg_reports | reporting_period_id → bwg_reporting_periods.organization_id | Inherit reporting period |
| bwg_waste_reports | reporting_period_id and processor_organization_id | Validate reporting tenant and processor party |
| carbon_calculations | activity_id and/or carbon_project_id | Require consistent tenant lineage across all supplied parents |
| epr_credit_allocations | epr_credit_id and obligation_id | Validate both credit and obligation party scopes |
| esg_metrics | reporting_period_id and source_activity_id | Inherit period; validate source activity tenant |
| evidence | activity_id → activities.organization_id | Inherit activity tenant; captured_by is attribution |
| evidence_artifact_reviews | evidence_id / artifact_version_id → artifact series | Inherit artifact/evidence tenant; reviewer is attribution |
| evidence_artifact_versions | series_id → evidence_artifact_series.organization_id | Inherit artifact series |
| evidence_verification_requirements | activity_id → activities.organization_id | Inherit activity tenant |
| field_sync_conflicts | envelope_id → field_sync_envelopes → field_devices.organization_id | Inherit device tenant |
| field_sync_cursors | device_id → field_devices.organization_id | Inherit device tenant |
| field_sync_envelopes | device_id → field_devices.organization_id | Inherit device tenant; authorize envelope identity |
| measurements | activity_id → activities.organization_id | Inherit activity tenant; captured_by is attribution |
| mrv_observations | activity_id → activities.organization_id | Inherit activity; measurement must match activity |
| mrv_provenance_events | activity/evidence/verification links | All linked objects must resolve to same tenant/activity |
| settlement_events | settlement_id → settlements | Inherit explicit payer/payee matrix |
| stakeholder_application_approvals | application_id → stakeholder_applications | Inherit target organization; approver separately authorized |
| verifications | activity_id → activities.organization_id and evidence | Inherit subject activity; verifier authority separately checked |

### C — identity-private and account-security data
| Table | Anchor | Policy direction |
|---|---|---|
| identities | id | Self-only by default; privileged disclosure through narrow functions |
| identity_credentials | identity_id | Own identity only; no secret exposure to ordinary roles |
| identity_password_credentials | identity_id | Authentication owner only; no general runtime SELECT |
| identity_sessions | identity_id | Authentication owner only; token/session state not broadly readable |
| operation_sync_envelopes | actor_identity_id | Own actor stream plus explicit device/organization authorization |

### D — shared reference and governed catalogues
| Table | Policy direction |
|---|---|
| carbon_market_mechanisms | Runtime read-only; governed publication only |
| ccts_methodology_registry | Runtime read-only; governed publication only |
| epr_schemes | Runtime read-only; governed publication only |
| geography | Runtime read-only; privileged reference-data publication |
| geography_sources | Runtime read-only; privileged reference-data publication |
| methodology_governance_evidence | Authorized methodology workflow; governance-owner writes |
| methodology_versions | Runtime read-only; governed methodology lifecycle |
| regulatory_requirements | Runtime read-only; governed publication only |
| regulatory_sources | Runtime read-only; governed publication only |

### E — control-plane/system tables
| Table | Policy direction |
|---|---|
| organizations | Controlled directory; self/membership details and safe verified public view |
| platform_audit_chain_head | Control-plane owner/function only |
| schema_migrations | Migration principal only |

### F — multi-party settlement and registry
| Table | Policy direction |
|---|---|
| settlements | Payer and payee see only permitted side; lifecycle transitions through authorized functions |
| settlement_events | Inherit settlement party scope; append-only writes through authorized function |

## 4. Cross-table consistency requirements
1. A child row must not be visible merely because one FK points to an accessible parent if another tenant-bearing parent points elsewhere.
2. INSERT/UPDATE must reject mismatched parent tenant IDs; hiding a row on SELECT is insufficient.
3. Multi-party tables need an explicit action matrix (read/create/accept/reject/settle/dispute); blanket party_a OR party_b policies are insufficient for state-changing actions.
4. actor_identity_id, captured_by_identity_id, reviewer_identity_id and approved_by_identity_id are attribution/authorization inputs, not general substitutes for organization tenancy.
5. Reference/catalog tables must be separated from tenant operational data; runtime roles receive read-only access only where required.
6. RLS helper functions need reviewed ownership, pinned search_path, narrow EXECUTE grants, no caller-controlled dynamic SQL and no recursive policy dependency.
7. Runtime roles must be dedicated, NOBYPASSRLS, non-owner, non-superuser, without CREATEDB/CREATEROLE/REPLICATION, and have only required table/sequence/function privileges.
8. Table/migration owners should be NOLOGIN where feasible. FORCE RLS only after maintenance-owner and SECURITY DEFINER behavior is rehearsed.
9. All trigger and SECURITY DEFINER functions need pinned search_path and PUBLIC EXECUTE inventory.
10. Route authentication, permission checks and protected reads/writes must use the same transaction-bound client. RLS is defense in depth, not a replacement for route authorization.

## 5. Required acceptance matrix
- Two verified organizations A and B; identities in A, B and neither.
- A and B can access only their direct-root rows.
- Negative access by guessed UUID, parent FK, evidence FK, device ID, settlement ID and registry ID.
- Mismatched cross-tenant parent IDs rejected on INSERT and UPDATE.
- Multi-party positive/negative tests for EPR transfers, credits, registry events, credentials and settlements, separately for each lifecycle action.
- Pending/revoked memberships, suspended identities and non-VERIFIED organizations denied.
- Global catalogues readable only where required; runtime cannot mutate catalog/control-plane tables.
- Runtime role cannot bypass RLS, own protected tables, SET ROLE to owner, or access private auth/bootstrap schemas.
- PUBLIC and unintended EXECUTE grants inventoried.
- Tests run with actual production runtime credentials, not migration owner/superuser.
- Production-shaped disposable-clone rehearsal includes row counts, lock/timeout analysis, recovery plan and post-migration catalog diff.

## 6. Release blockers
- No production RLS is enabled today.
- Existing rupaykg role has BYPASSRLS and elevated role attributes.
- Complete per-table policy/privilege matrix is not approved.
- Candidate route/worker inventory and same-client transaction proof are incomplete.
- Independent DBA/security review and production-shaped two-tenant acceptance remain outstanding.

No production migration, grant, role change, policy activation, deployment or certification is authorized by this design inventory.

## 7. Additional live function and ownership ACL findings

A second read-only production catalog query, on the same Neon production branch, observed:

- 115 public-schema functions/procedures total; 37 extension-owned and 78 application-owned.
- All 78 application-owned functions have PUBLIC EXECUTE in the catalog ACL.
- All 78 application-owned functions lack a pinned search_path.
- None of the inspected public functions are SECURITY DEFINER.
- All 67 public application tables are owned by the same login role rupaykg.

These counts are catalog facts, not proof that every trigger function is directly callable; trigger invocation has separate PostgreSQL semantics. They do establish a mandatory per-signature review. Do not blanket REVOKE PUBLIC EXECUTE until SQL call sites, trigger dependencies, views and function-to-function calls are mapped. The remediation artifact must record function signature, owner, extension/application ownership, SECURITY DEFINER flag, search_path, ACL, trigger bindings, call sites, required runtime roles and proposed grants.

The target design is not “grant all application functions to the runtime.” Use explicit per-signature EXECUTE grants only where an application route or approved database routine calls the function. Trigger functions should be protected by ownership and table DML privileges; do not treat trigger-function EXECUTE ACLs as a replacement for trigger-table authorization. Pin search_path on every application-owned function using a reviewed migration and rehearse effects on extension-owned functions separately.

This section does not authorize production ACL changes.