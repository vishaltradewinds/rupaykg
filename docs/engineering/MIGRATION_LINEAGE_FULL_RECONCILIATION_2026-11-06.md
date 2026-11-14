# Shakti Migration Lineage Reconciliation — 2026-11-06

## Status

**Engineering evidence only. Production remains READ-ONLY / HOLD.**

Authoritative production inspection:
- Neon project: `steep-mud-79906940`
- branch: `br-restless-base-b44cip2h`
- database: `rupaykg`
- production ledger rows: **92**
- active repository migration SQL files: **91**
- exact historical production-only source absent from active `migrations/`: **096**
- recovered staging-only sources: **4**, kept outside active `migrations/`

## Ledger parity result

Production ledger versions are:
`001`, `002`, `003`, `004`, `005`, `006`, `007`, `008`, `009`, `010`, `011`, `012`, `013`, `014`, `015`, `016`, `017`, `018`, `019`, `020`, `021`, `022`, `023`, `024`, `025`, `026`, `027`, `028`, `029`, `030`, `031`, `032`, `033`, `034`, `035`, `036`, `037`, `038`, `039`, `040`, `041`, `042`, `043`, `044`, `045`, `046`, `047`, `048`, `049`, `050`, `051`, `052`, `053`, `054`, `055`, `056`, `057`, `058`, `059`, `060`, `061`, `062`, `063`, `064`, `065`, `066`, `067`, `068`, `069`, `070`, `071`, `072`, `073`, `074`, `075`, `076`, `077`, `078`, `079`, `080`, `081`, `082`, `083`, `084`, `085`, `086`, `087`, `096`, `20261018`, `20261019`, `20261020`, `20261021`

The active repository contains:
- versions `001`–`087`: 87 files
- date migrations `20261018`–`20261021`: 4 files
- total active migration SQL: **91**

Therefore the 92-row production ledger is reconciled at version identity as **91 active sources + historical 096**.

No additional production ledger version was found beyond those 92 rows in the read-only inspection.

## Active source manifest

| Version/file | Git blob SHA | Bytes |
|---|---|---:|
| `001_core.sql` | `455cb31f817bc64f35bae850c5c6ad22d63941ed` | 6486 |
| `002_regulatory.sql` | `10722160ef8bb06a238ffb55286f528c144ee35a` | 3711 |
| `003_identity_geography_operations.sql` | `967cf4c444c7832cd7afe5c425c1022a4e561e49` | 3521 |
| `004_security_auth.sql` | `975933cc9e8d4a3105f8a36d5bd7d77ab4cb7dd1` | 1418 |
| `005_carbon_epr_esg.sql` | `730d91d95aa80aec5b8f31cf52a80a38fa7db961` | 3628 |
| `006_registry_settlement_guardrails.sql` | `848e912d771d3c88926ec1c14ab23f089b42cce1` | 2611 |
| `007_resource_flow_mrv.sql` | `70091a21f87b6cf0924f95eb02a814febb3e5e40` | 2735 |
| `008_verification_integrity.sql` | `55a2f6a74285b252a4fcca8303f9f61106846f5d` | 3981 |
| `009_field_sync.sql` | `1db63aacc111eab6f446284e17832d638dbfbf58` | 2777 |
| `010_integrity_controls.sql` | `27b67e4f8983728bca943c9b1e5aa7015cb38cc4` | 3497 |
| `011_field_sync_application.sql` | `84a0e92b155c0bad9ce29aa7fd397a44c1219ab4` | 465 |
| `012_geography_authorization.sql` | `a500b278ba5305ba9a19a057b1e45e07ca1913b4` | 3249 |
| `013_settlement_external_confirmation.sql` | `b18e33cc80da98d2319953f3c0e55f3f288d188e` | 2057 |
| `014_registry_settlement_idempotency.sql` | `a5fc87d7e7a29c2755d655ff481ff9a84914f21c` | 1353 |
| `015_guardian_hedera_mrv.sql` | `f2ea1d8e27d7c8a626d0694c4c6156f8ec9146b4` | 2250 |
| `016_field_device_enrollment.sql` | `e92908c5573a55f9ff10e1a2c5432b7f6ca795b4` | 1799 |
| `017_field_device_provenance.sql` | `66f6dad87e97a59691159235786af4eb521578c0` | 764 |
| `018_value_mutation_permissions.sql` | `c983db334d516ec547573bfd4ada5d7d1e62dbc6` | 1598 |
| `019_settlement_reconciliation_immutability.sql` | `98ff46c0bf1d95b5d01954da81644ee41cd73064` | 1505 |
| `020_carbon_calculation_provenance.sql` | `ad87ec0c857934ddfc11558186b8363d16d44907` | 2088 |
| `021_methodology_governance.sql` | `990126fe2e5715c57cb3164309fc0e63e63cc598` | 4400 |
| `022_carbon_provenance_integrity.sql` | `b3b0b775ad5f96aab4f535ed336a56cc89a5c70c` | 2033 |
| `023_lifecycle_state_guards.sql` | `3d94a6b46e5ffef9790348c7aa51fe3d855a9064` | 2469 |
| `024_methodology_governance_immutability.sql` | `4d9c4406afa4d6d0944e0e02ea4b81df66aaf9ef` | 2446 |
| `025_methodology_reconciliation_evidence.sql` | `e6e4b844aa476abd867f3fbb9af7ad2d57e0e88d` | 4405 |
| `026_regulatory_source_provenance.sql` | `09c599c16debc68320fe570b5f7f1b1a6ac77f25` | 1491 |
| `027_verification_permission_hardening.sql` | `c626a7aad10a31a620b5d814af1330f00c54def4` | 670 |
| `028_settlement_retired_credential_guard.sql` | `ac743f3135a94751c98531aac1ac0875514f403d` | 1791 |
| `029_stakeholder_onboarding.sql` | `b6f86f9d79d2cdaf643f1941078d93e11862101f` | 1563 |
| `030_authorization_role_defaults.sql` | `bf118ce5c53cea830601d03092d170d469e09a11` | 7042 |
| `031_settlement_credential_owner_authorization.sql` | `67d477c9e3f37b41a6bbf548a976bc33f1f9a3fa` | 1695 |
| `032_authorization_lifecycle_hardening.sql` | `5fc7aab13c301dd9ef15a32dbb000a576447c294` | 2018 |
| `033_field_sync_tenant_integrity.sql` | `0a263767d486b24ec255dcdef5faeff3b8c706b5` | 1522 |
| `034_operation_sync_device_binding.sql` | `619d5044709fe44e15916c7a791f2e06c67e6d91` | 1568 |
| `035_cpcb_epr_portal_baseline.sql` | `df5007e2c63ea12e46bb716fc3b14d80c75e28d0` | 1366 |
| `036_bwg_epr_esg_reporting.sql` | `37aa6209a36c00d635397a13314feed91808f51f` | 4212 |
| `037_bwg_regulatory_registration_state.sql` | `bbb8003125c0c4f0d3c96ae26fcd1f170d46af27` | 851 |
| `038_bwg_registration_unknown_default.sql` | `e181dc9346f907e8f7ece6e4d61ef111c6c581b2` | 375 |
| `039_india_regulatory_requirements.sql` | `ebbfb713c9722601c0920507bba201e1e6e233e0` | 6675 |
| `040_india_regulatory_extensions.sql` | `17dda3763c2908060f206670b2691ba273f620c9` | 4500 |
| `041_high_risk_action_permissions.sql` | `29fdec408a32787dab1d90eaa550c1a6b4b14658` | 2750 |
| `042_india_regulatory_requirement_catalog.sql` | `4aa2263180880e5567ce7327ceb6befd2cbc37dd` | 6652 |
| `043_bwg_epr_invariants.sql` | `89ed63647bbfdc9fd928c0fc306dfbc14eeb9753` | 488 |
| `044_bwg_reporting_requires_applicability.sql` | `efa78a545c526f1837cca1d61d7f95df8770ecdb` | 1076 |
| `045_guardian_mrv_registry_provenance_integrity.sql` | `398db7bc55535cf7e302961dd6b09fe88918d037` | 1617 |
| `046_epr_credit_allocation_integrity.sql` | `d87793ac2f6ba7713315933b39d8e5cd8509e31c` | 5067 |
| `047_settlement_party_integrity.sql` | `f4bfd13be39bac7bc7ddd972874b50977d444c49` | 1376 |
| `048_settlement_party_integrity_compatibility.sql` | `f9bc892775f69d937dc51aa1bfafb07cd1a95dfd` | 1770 |
| `049_credential_geography_integrity.sql` | `e0799d6c667b6b051e78f5b6570a923c42d0f8c0` | 1395 |
| `050_field_sync_conflict_audit.sql` | `fb15dda8c8ddd5698eddbd5ebad4557b9f4353db` | 2070 |
| `051_registry_transfer_recipient_integrity.sql` | `6b5d6b8640e4862ee1c073ccebe6d0aa883a809e` | 1224 |
| `052_stakeholder_approval_guard.sql` | `b01470833c084bec79bc18e45518f5615902c1e9` | 1365 |
| `053_authoritative_regulatory_baseline.sql` | `9d1c519cd43519d44b12092c1e6889f9401292a2` | 3315 |
| `054_circular_economy_carbon_regulatory_baseline.sql` | `91ec93947316a809119c8f0a5076b3df861ed33f` | 2751 |
| `055_carbon_market_mechanisms.sql` | `03e20e140bd3ca97b33dc2ade3874d1a7cbaa636` | 3949 |
| `056_environmental_attribute_claim_controls.sql` | `2545e2e904cff8723b66021d1d7988a04ade1b7d` | 3589 |
| `057_environmental_attribute_allocation_api.sql` | `1da75ac4a3b937bd8d6ee390f42d8c8b213b2fa1` | 3136 |
| `058_environmental_attribute_reporting_references.sql` | `cd03d6a5c35d0edb31863c2283fd8bc38d8cd777` | 1646 |
| `059_epr_credit_environmental_claims.sql` | `c7ca4e44bad51e59205d5ab570b4e5f1cd902f7b` | 1902 |
| `060_brsr_structured_reporting.sql` | `c485741ff22f87ea0a918ff12457c03989e7952e` | 3168 |
| `061_brsr_metadata_projection.sql` | `52f7bfb46e8e373e529c3e55f404cdc7afba9094` | 1939 |
| `062_stakeholder_onboarding_governance.sql` | `2fb19eb5ecdd0b05d14e8b81132f5c660942711f` | 447 |
| `063_organization_legal_verification.sql` | `2c073f38d6c5f9f0f5d9acba39b90fd9d867e4e4` | 1729 |
| `064_statutory_applicability_controls.sql` | `bea039308c93be5086cd3d844a33a841033f47fb` | 4863 |
| `065_governance_integrity_and_profile_seeding.sql` | `894c1adf96dee11025a01fb782415d4881455b96` | 5116 |
| `066_organization_governance_cleanup.sql` | `1fdf0a0b63b61fa57166a8e21e2adbc442d0f0c7` | 1750 |
| `067_epr_scheme_catalog.sql` | `c221b2263de4efe1d8ff9ce67ab59f0edb28539f` | 2774 |
| `068_epr_lifecycle_controls.sql` | `c0b6a74712331d7ec8c2bfacf8ce393d90bdc708` | 2844 |
| `069_epr_evidence_guards.sql` | `5f83231eea227af52eb1fb7b45755093c7a1c545` | 3272 |
| `070_epr_obligations_returns.sql` | `c36b104a24781adad26deb8f08ec37a9c4cd9787` | 2992 |
| `071_epr_return_obligation_binding.sql` | `09526129fc54aeae12217fd11a28f007b994275a` | 1782 |
| `072_epr_external_reference_uniqueness.sql` | `9ff683bde2fab7d2d4ef055f15a441e763dd9c63` | 332 |
| `073_settlement_integrity.sql` | `16ec4d2de9ace0c0963aaf8b1184a1e101ba0401` | 552 |
| `074_settlement_party_integrity.sql` | `33b3cd84d4c089b581453a3ce775939152206a68` | 1622 |
| `075_settlement_registry_owner_integrity.sql` | `af9d16a341661d78fd2474f38d04767a8a86fc96` | 2678 |
| `076_settlement_reconciliation_reference_uniqueness.sql` | `9cbb8084c1448c12f40d9a650cca71555417ce53` | 383 |
| `077_hierarchical_stakeholder_onboarding.sql` | `f4e623c2c405edc471b6a46c99cef70e7444c244` | 4608 |
| `078_stakeholder_approval_separation.sql` | `db5292d7f6ef5809995396f3add1a9240f4e8b79` | 783 |
| `079_native_password_auth.sql` | `e892cb885ff39b193e84ef1fbb04d90f90761763` | 677 |
| `080_geography_created_at.sql` | `1fa75f9936dfb5d848b96f4b12fd89dcd636ff3b` | 254 |
| `081_acceptance_fixture_geography.sql` | `b838d713fe1317edac320120d5357ae5a2639235` | 889 |
| `082_super_admin_identity_governance.sql` | `63c74b6e37b30b3a04677d91fdddd1d00c4bdb54` | 878 |
| `083_mrv_mirror_node_registry_gate.sql` | `0476db7d37a2902a048918f354cf1f9bf178569c` | 3811 |
| `084_platform_audit_chain_head.sql` | `d6257774488dd807f4b0ae342df71744b189a04a` | 1117 |
| `085_platform_access_dual_control.sql` | `d6f512c8b9a4550026743839b072c764c79006c8` | 2108 |
| `086_reserved_role_restoration_db_guard.sql` | `deda94f9b18a7c729eb91566ddd36a9e6491558d` | 4180 |
| `087_acceptance_fixture_registry_exclusion.sql` | `b5e7a6e6934724f961012727900875b995159e5c` | 3307 |
| `20261018_cpcb_swm_stakeholder_workspaces.sql` | `be8f77f091fe0ef27a7753f15b7638e1e43908b3` | 1358 |
| `20261019_cpcb_bwg_workflow_tracking.sql` | `962b0fa2bb09b28ec00631a201dc119a539a8cb2` | 1914 |
| `20261020_ccts_methodology_registry.sql` | `472b8234c9dcc7746bc9a1d21aa751c1a255201c` | 9127 |
| `20261021_evidence_artifact_vault.sql` | `b422e13c0eb0cba011854cd41934f931528a437f` | 4431 |

## Historical 096

Production ledger contains `096` applied at `2026-10-27T13:46:14.262Z`.

Recovered source:
- `096_verification_authorization_provenance.sql`
- Git blob SHA: `258b1f4534efbf915688f78aa84d4ec24a47cbc0`
- recovery commit: `ca8f4100782e13f8d72106187fafc8e1e446214f`

The source is preserved as historical evidence and is **not** reintroduced into the active migration directory or replayed blindly.

## Staging-only 20261022–20261025

Historical staging sources were independently recovered and archived outside the active migration directory:

| Migration | Blob SHA | Bytes | Production presence |
|---|---|---:|---|
| `20261022_async_mirror_inbox.sql` | `4d08607e03561b9fbb4ce502b4c4211127237050` | 1004 | **Absent** |
| `20261023_async_mirror_worker_leases.sql` | `33cb4d5d2e29a4a111340e5a0ac34170a0081895` | 3408 | **Absent** |
| `20261024_ai_intake_rate_limits.sql` | `87b51fe60a96a4e0752c8b0a9a170c81f9936dbb` | 872 | **Absent** |
| `20261025_ai_evidence_intake_jobs.sql` | `6a0ae54530b7b756dac33589eaf18df3b071d8f2` | 1785 | **Absent** |

Read-only production catalog inspection found none of the four corresponding tables:
`async_mirror_inbox`, `async_mirror_worker_leases`, `ai_intake_rate_limits`, `ai_evidence_intake_jobs`.

These sources remain audit evidence only. They must not be copied into active production migrations without a separate forward-only design/review.

## Verification authorization reconciliation

Production `verifications` currently contains all four 096 authorization snapshot columns:
- `authorization_membership_id`
- `authorization_role_id`
- `authorization_permissions_snapshot`
- `authorization_checked_at`

However, production still has two active verification triggers:
- `verification_independence_guard` → `enforce_verification_independence()`
- `verifications_integrity_guard` → `prevent_invalid_verification()`

Read-only function inspection confirms the legacy independence function contains role-name fallback `VERIFIER` / `AUDITOR` and does not bind its membership lookup to the activity organization.

This is a live P0 security divergence and is not considered reconciled merely because migration 096 exists in the ledger.

## Required next forward-only work

1. Complete exact source/application/schema-object reconciliation for 096.
2. Design one canonical verification guard using the converged #252/#251/#272/#284 semantics.
3. Remove contradictory legacy authorization only through independently reviewed forward-only migration.
4. Complete all 67-table tenant isolation implementation/rehearsal coverage, including multi-party authorization.
5. Independently verify production roles, grants, ownership, RLS/FORCE RLS and runtime BYPASSRLS posture.
6. Keep staging-only 20261022–20261025 sources outside production until separately approved.
7. Obtain independent DBA/security review before production mutation.

**Release decision: HOLD.**

CI success is engineering evidence only; it is not production RLS/role/grant proof, field acceptance, regulatory approval, certification, or TRL 9.
