# Production tenant policy matrix — 67-table baseline

**Date:** 2026-11-04  
**Authority:** Read-only Neon production catalog, project `steep-mud-79906940`, branch `br-restless-base-b44cip2h`, database `rupaykg`.  
**Purpose:** Candidate policy-design inventory only. It is not approved SQL, not a rollout plan, and not authority to alter production.

## Catalog facts

- 67 public base tables and 181 public-schema foreign keys.
- All 67 tables are owned by `rupaykg`.
- 0/67 tables have RLS enabled; 0/67 have FORCE RLS.
- The owner role has LOGIN, CREATEROLE, CREATEDB, REPLICATION and BYPASSRLS, and is a member of `neon_superuser`.
- The production schema has no effective tenant-isolation boundary at the PostgreSQL RLS layer today.
- The 23 direct tenant-key tables are marked **DIRECT** below. Every other table has a derived, identity, bilateral, platform-governance or reference-data boundary; absence of `organization_id` is never interpreted as public access.

## Complete candidate policy matrix

| # | Table | Tenant / security derivation from live columns and FKs | Candidate access boundary and required consistency checks |
|---:|---|---|---|
| 1 | `activities` | **DIRECT** `organization_id`; actor identity; geography | Organization membership + explicit activity permissions; verify actor is authorized in the same org and geography is within active org scope; protect immutable/closed lifecycle fields. |
| 2 | `activity_assignments` | Activity → `activities.organization_id`; assigned identity and optional role | Inherit activity org; assignee must be valid identity; role must belong to activity org; assignment visibility limited to org members with activity-read permission. |
| 3 | `audit_events` | Nullable `organization_id`; actor identity; target type/id | Org-scoped reads when org is present; platform-only access for null-org events; append-only writes via trusted audit path; target access must not be inferred from target id alone. |
| 4 | `bwg_epr_reports` | Reporting period → BWG org; scheme; optional evidence/verification | Inherit reporting-period org; evidence and verification must resolve to same org/activity; scheme reference is controlled shared data. |
| 5 | `bwg_esg_reports` | Reporting period → BWG org; optional evidence/verification | Inherit reporting-period org; evidence/verification must match reporting boundary and org; protect submitted/assured snapshots. |
| 6 | `bwg_profiles` | **DIRECT** `organization_id`; jurisdiction geography | Org membership + BWG permissions; jurisdiction scope and regulatory evidence must match organization; external registration status is not inferred from local data. |
| 7 | `bwg_reporting_periods` | **DIRECT** `organization_id` | Org-scoped; period lifecycle and external submission references protected; reporting child rows inherit this org. |
| 8 | `bwg_waste_reports` | Reporting period → BWG org; processor org; evidence/verification | Multi-party: reporting org and processor org need explicit separate read/write permissions; evidence and verification bind to the reporting activity/org; quantity allocation consistency. |
| 9 | `carbon_calculations` | Activity → org; optional carbon project → project org; methodology/source references | Inherit activity org; carbon project must belong to same authorized project scope; methodology/source references read-only governed; calculation provenance immutable after assignment. |
| 10 | `carbon_market_mechanisms` | Shared mechanism reference; no tenant key | Candidate controlled reference read, governance-write only; do not make globally writable or public until authority/source/licensing review. |
| 11 | `carbon_projects` | **DIRECT** `organization_id`; geography; methodology and regulatory source | Org-scoped project permissions; geography scope and method eligibility validated; method/source changes governed and auditable. |
| 12 | `ccts_methodology_registry` | Shared regulatory methodology catalogue; no tenant key | Platform/regulatory governance write; public or tenant read only after explicit publication/source-status policy; preserve source snapshot/checksum and version lineage. |
| 13 | `chain_of_custody_links` | Resource flow → org; activity → org; actor organization; evidence; geographies | Multi-party/chain-of-custody boundary: require actor org authorization and consistency between resource flow, activity, actor org and evidence; do not inherit a single tenant blindly. |
| 14 | `cpcb_swm_stakeholder_workspaces` | **DIRECT** `organization_id`; geography; creator/updater identities | Org-scoped workspace; active-org and geography checks; creator/updater must be authorized actors; distinguish internal workflow from user-reported CPCB status. |
| 15 | `cpcb_swm_status_history` | **DIRECT** `organization_id`; workspace; actor identity | Inherit workspace org and verify stored org equals workspace org; append-only status history; actor authorization and source reference required. |
| 16 | `credentials` | Activity → org; issuer organization; verification | Separate activity owner and issuer authority; require issuer permission and same activity/evidence/verification binding; issued credential payload and status append-only/immutable. |
| 17 | `environmental_attribute_claims` | **DIRECT** `organization_id`; activity/evidence/verification | Org-scoped claim authority; all linked activity/evidence/verification must resolve consistently to same org; prevent double counting, transfer ambiguity and claim reuse. |
| 18 | `epr_credit_allocations` | EPR credit → issuer/recycler org; obligation → obligated org | Multi-party ledger: verify credit owner, obligation owner, scheme, quantity and remaining balance; payer/payee-like visibility, append-only allocation/release events. |
| 19 | `epr_credit_transfers` | From/to organizations; credit; evidence/verification | Bilateral: both counterparties have explicit rights; transfer must be authorized by current credit owner, recipient acceptance and quantity balance; evidence/verification bind to transfer. |
| 20 | `epr_credits` | Issuer and recycler org; activity/evidence/verification | Multi-party: issuer/recycler roles separately authorized; bind credit to activity/evidence/verification and scheme; status, quantity, validity and ownership history protected. |
| 21 | `epr_obligations` | Obligated organization; obligation; scheme; source evidence/verification | Org-scoped to obligated entity with controlled regulator/platform oversight; source evidence/verification and obligation ownership must match; balance updates transactional. |
| 22 | `epr_returns` | **DIRECT** `organization_id`; scheme; obligation; evidence/verification | Org-scoped return; obligation and evidence/verification must belong to same obligated org; draft vs submitted/external state distinct; submitted payload immutable. |
| 23 | `epr_schemes` | Shared scheme reference; jurisdiction geography | Candidate controlled reference read; governance-write only; jurisdiction and official status/version sourced; no assumption that all scheme metadata is public. |
| 24 | `esg_metrics` | Reporting period → org; source activity; evidence/verification | Inherit reporting-period org; source activity/evidence/verification must match reporting boundary or explicit value-chain exception; protect assurance and disclosure provenance. |
| 25 | `esg_reporting_periods` | **DIRECT** `organization_id` | Org-scoped reporting; reporting boundary, framework and assurance state governed; child metrics inherit org. |
| 26 | `evidence` | Activity → org; measurement; captured identity/device | Inherit activity org; measurement, device and captured identity must be bound consistently; evidence content/hash immutable after review; reviewer access separate from uploader. |
| 27 | `evidence_artifact_reviews` | Evidence → activity/org; artifact version; reviewer identity | Inherit evidence org; version must belong to evidence's series and same evidence; reviewer needs independent review permission; review record append-only. |
| 28 | `evidence_artifact_series` | **DIRECT** `organization_id`; activity; creator identity | Org-scoped; series org must equal activity org; creator authorized; no cross-org evidence series association. |
| 29 | `evidence_artifact_versions` | Series → org/activity; evidence; uploader identity | Inherit series org; evidence must belong to same activity/org; uploader authorized; immutable version content/hash and append-only version history. |
| 30 | `evidence_verification_requirements` | Activity → org; satisfying evidence/verification | Inherit activity org; satisfying evidence and verification must reference that same activity; requirements and satisfaction transitions controlled by methodology/workflow. |
| 31 | `field_devices` | **DIRECT** `organization_id`; enrolled identity; verifier/registrar | Org-scoped device administration; bind device to one org and enrolled identity; verified status and key lifecycle; platform provisioning is separate. |
| 32 | `field_sync_conflicts` | Envelope → device → org; resolver identity | Inherit envelope/device org; resolver must have conflict-resolution permission in that org; conflict payload and resolution history protected. |
| 33 | `field_sync_cursors` | Device → org | Device owner/org only; cursor updates only through authenticated sync worker/API; no cross-device enumeration. |
| 34 | `field_sync_envelopes` | Device → org; identity | Bind envelope identity to enrolled device identity and device org; owner-only reads; immutable payload/hash; replay/idempotency protection. |
| 35 | `geography` | Shared geography hierarchy; parent and source refs | Candidate shared reference read only under explicit published-data policy; write/maintenance restricted to platform governance; geography scope authorization must be separate from visibility. |
| 36 | `geography_sources` | Shared provenance/source catalogue | Platform governance only for writes; limited read access as required; source checksums/version history immutable and auditable. |
| 37 | `identities` | Identity principal; membership relationships | Self-access to safe profile fields; org admins only limited org-member attributes; platform authority for suspension/verification; never generic tenant-wide identity read. |
| 38 | `identity_credentials` | Identity → owner principal | Self and controlled verifier access; credential subject/issuer/expiry sensitive; verification and revocation are separate privileged operations. |
| 39 | `identity_password_credentials` | Identity → owner principal | Authentication service only; no user/admin SELECT; secret hashes/salts never exposed; credential updates via hardened auth path. |
| 40 | `identity_sessions` | Identity → owner principal | Authentication/session service only; identity self-revoke via narrow function; tokens/hashes never exposed; platform incident response access audited. |
| 41 | `measurements` | Activity → org; captured identity/device | Inherit activity org; captured identity/device must be bound; raw measurement/provenance append-only or versioned; location data requires purpose-limited access. |
| 42 | `methodology_governance_evidence` | Methodology version → controlled governance catalogue | Governance/independent-review authority only; evidence hashes, independent party and captured time immutable; not ordinary tenant write access. |
| 43 | `methodology_versions` | Shared methodology registry; mechanism | Platform/regulatory governance writes; tenant read only to published/eligible versions; source lock, numeric reconciliation and independent regression evidence immutable. |
| 44 | `mrv_observations` | Activity → org; measurement | Inherit activity org; measurement must belong to same activity; observations versioned/append-only with instrument, method, uncertainty and time provenance. |
| 45 | `mrv_provenance_events` | Activity/evidence/verification → org; Guardian/HCS metadata | Inherit activity org and validate evidence/verification match; external anchor identifiers and consensus evidence immutable; platform operator access narrowly scoped. |
| 46 | `obligations` | **DIRECT** `organization_id`; jurisdiction geography | Org-scoped obligation; jurisdiction within org scope; obligation creation/settlement permission and quantity balances transactional. |
| 47 | `operation_sync_envelopes` | Actor identity; device_id text (no FK in catalog) | Identity-scoped ingestion; resolve device_id against verified device registry and bind to same identity/org before accepting; quarantine unknown/unverified devices; idempotency and payload hash immutable. |
| 48 | `organization_bwg_assessments` | **DIRECT** `organization_id`; evidence/verification; determiner identity | Org-scoped assessment; evidence/verification and determiner authorization bound to org; determination history and threshold basis auditable. |
| 49 | `organization_epr_applicability` | **DIRECT** `organization_id`; evidence/verification; determiner | Org-scoped applicability and registration status; evidence/verification must bind to same org and claim; external CPCB status only as separately sourced evidence. |
| 50 | `organization_geography_scopes` | **DIRECT** org + geography | Org-admin/authority controlled; scope grants/revocations dual-control where appropriate; geography ancestry and effective state validated; no-scope must fail closed for protected operations. |
| 51 | `organization_memberships` | **DIRECT** org + identity + role | Self/limited member read; org admin and platform dual-control writes; role must belong to same org (composite FK candidate PR #252); verified membership activation/revocation protected. |
| 52 | `organization_statutory_profiles` | **DIRECT** `organization_id`; determiner identity | Org-scoped statutory applicability; external confirmation requires authoritative reference; determiner authorization and temporal applicability checked. |
| 53 | `organization_verification_evidence` | **DIRECT** `organization_id`; verifier identity | Org-scoped evidence of organization credentials; verifier permission, issuer and expiry validated; hashes and verification snapshots immutable. |
| 54 | `organizations` | Organization principal and verification attributes | Member-scoped profile read; sensitive legal/registration/verification fields limited to org admins and platform verifiers; public directory is a separate explicit projection, not table-wide read. |
| 55 | `platform_access_change_requests` | **DIRECT/nullable** org; target/requester/approver identities; role/membership | Platform-authority only; requester/approver separation and dual-control; role/membership/org all mutually consistent; request hash and decision history immutable. |
| 56 | `platform_audit_chain_head` | Singleton platform-wide chain state | Internal platform audit function only; no tenant direct writes; serialized append/update with chain-head integrity and restricted read. |
| 57 | `registry_events` | Credential → activity/issuer; from/to owners; verification; actor | Multi-party registry event; issuer/current owner/recipient and actor rights checked per event; append-only, immutable event hash and ownership continuity. |
| 58 | `regulatory_requirements` | Shared regulatory catalogue → source | Candidate published reference read; governance-only write; each requirement linked to verified source and effective date; source supersession preserved. |
| 59 | `regulatory_sources` | Shared regulatory source catalogue; supersedes self-reference | Governance-only source management; public/tenant read only to published sources; checksum, retrieval, verification and supersession chain immutable. |
| 60 | `resource_flows` | **DIRECT** `organization_id`; source/destination geography | Org-scoped flow; source/destination geography within permitted scope; child custody links actor and activity consistency validated. |
| 61 | `roles` | **DIRECT** `organization_id` | Org admin can manage non-reserved roles; platform controls reserved roles; role IDs must never be accepted across orgs; permission changes audited and dual-control for privileged roles. |
| 62 | `schema_migrations` | Platform database metadata | Migrator/DBA only; runtime API no access; ledger immutable except controlled migrator append; never rewrite history to reconcile source drift. |
| 63 | `settlement_events` | Settlement → payer/payee/obligation/credential; actor identity | Bilateral event access for payer/payee with role-specific projection; actor permission checked; append-only reconciliation and external confirmation provenance. |
| 64 | `settlements` | Payer and payee organizations; obligation; credential | Bilateral authorization: payer and payee independently scoped; protect amount, obligation, credential, confirmation and reconciliation; settlement finalization requires external authority evidence. |
| 65 | `stakeholder_application_approvals` | Application → applicant/org; geography; approver identity | Applicant may view own workflow projection; approver sees only assigned geography/level; approval chain is ordered, append-only and dual-control. |
| 66 | `stakeholder_applications` | **DIRECT** org; applicant identity; role; geography; reviewer | Applicant self-access plus org/platform review; requested role must belong to target org; geography and approval levels validated; status transitions controlled. |
| 67 | `verifications` | Evidence/activity → org; verifier identity; authorization membership/role snapshot | Inherit evidence activity org; verifier must have explicit permission in same org, independent from actor; decision snapshot immutable; cross-org APPROVED and REJECTED denied; append-only supersession. |

## Direct tenant-key list (23)

`activities`, `audit_events`, `bwg_profiles`, `bwg_reporting_periods`, `carbon_projects`, `cpcb_swm_stakeholder_workspaces`, `cpcb_swm_status_history`, `environmental_attribute_claims`, `epr_returns`, `esg_reporting_periods`, `evidence_artifact_series`, `field_devices`, `obligations`, `organization_bwg_assessments`, `organization_epr_applicability`, `organization_geography_scopes`, `organization_memberships`, `organization_statutory_profiles`, `organization_verification_evidence`, `platform_access_change_requests`, `resource_flows`, `roles`, `stakeholder_applications`.

## Design rules before policy SQL

1. **No generic `organization_id = current_org()` policy applied indiscriminately.** It is insufficient for identity tables, indirect descendants, multi-party transfers/settlements, audit events, global governance data and platform administration.
2. **Relationship consistency is mandatory.** A foreign key proves the referenced row exists, not that both tenant-bearing records belong to the same organization. Use composite tenant-aware keys where appropriate, or transactional checks/locks.
3. **Active organization is explicit.** Every request must bind to a verified membership in the selected organization. Multi-org identities do not get union-of-all-org access by default.
4. **Geography fails closed.** No verified scope must not mean unrestricted access. Scope changes must serialize against protected actions; geography hierarchy reads do not themselves grant operating authority.
5. **Bilateral means both parties.** Transfers, credits, settlements, registry events and processor relationships need separate party authorization, not just one owner org.
6. **Append-only is not owner-proof.** RLS and application immutability triggers do not stop a table owner or superuser. Owner separation, ACLs, audit controls and backup/restore governance are necessary.
7. **Runtime role must be non-owner and NOBYPASSRLS.** Separate one-shot migrator credential; no DDL/CREATEROLE/CREATEDB/REPLICATION or table ownership in API role. FORCE RLS only after role proof.
8. **Global reference data is explicit.** Geography, regulatory sources, requirements, CCTS methodologies, mechanisms and schemes need published-read vs governance-write rules; do not assume public access from absence of tenant key.
9. **Workers and service identities are principals.** Field sync, operation sync, async processors, cron jobs and external webhooks need the same organization/device binding and auditable service identity.
10. **Tests must use actual intended non-owner role.** Cover read, insert, update, delete, nested joins, cross-tenant foreign keys, concurrent revocation, pooled-connection context cleanup and background execution.

## Status and next gates

- This matrix is grounded in the current production catalog's columns and foreign keys. It is a candidate policy model, not a signed-off complete RLS design.
- No policy SQL is included or applied. All production tables remain without RLS/FORCE RLS at the catalog snapshot.
- Next: review every row with product/data owners and independent DBA/security; inspect every route/worker query; map function grants/search_path; build disposable tenant fixtures for all relationship families; only then author migration candidates.
- Production remains READ-ONLY / HOLD. No production writes, migrations, grants, ownership changes, RLS activation, deployments, merges or certification. TRL 9 NOT ACHIEVED.
