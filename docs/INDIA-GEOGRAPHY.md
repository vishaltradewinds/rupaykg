# India Geography Model

RupayKg must support Pan-India operations without assuming that every state, local body, source registry or programme uses one identical administrative hierarchy.

## Supported normalized geography kinds

- National and administrative: country, state/UT, district, sub-district, block, taluk and tehsil.
- Urban operating rails: urban local body (ULB), ward and locality.
- Rural operating rails: Gram Panchayat, village, habitation and cluster.

These are platform-level normalized kinds. They are not a claim that every kind exists in every state, that each parent-child edge is universally valid, or that this taxonomy replaces an authority's legal jurisdiction.

## Design principle

```text
India
  -> State / Union Territory
     -> District
        -> Source-specific administrative path
           -> Urban: ULB / ward / locality, where supported by that source
           -> Rural: Gram Panchayat / village / habitation / cluster, where supported by that source
```

## Mandatory rules

- **Source- and version-specific hierarchy:** validate parent-child edges against the relevant authoritative dataset and version. Do not treat `DEFAULT_GEOGRAPHY_HIERARCHY` in code as a universal India hierarchy or as authorization evidence.
- **Explicit profile required by API:** `isValidChild(parent, child, hierarchy)` requires the caller to pass a hierarchy. The development/test starter profile is never silently selected by the function.
- **Urban/rural separation:** preserve distinct urban and rural operating rails. A cross-rail edge must not be inferred from names, proximity or an AI suggestion.
- **Effective-dated geography:** retain source version, effective period and lineage because administrative boundaries and codes can change.
- **Authorization is separate:** a valid geography edge does not grant an organization access to that geography. Organization membership, explicit scope, activity ownership and permissions must be checked independently.
- **No invented government records:** LGD or another applicable authoritative government source is an external authority. Do not fabricate codes, jurisdictions, approval or a synchronization status.
- **Fail closed:** if the source, version, jurisdiction edge or organization scope cannot be verified, keep the mapping unresolved and block authoritative mutation or official submission.

## Current implementation boundary

The domain package provides a development/test starter hierarchy profile, but hierarchy validation requires an explicitly supplied profile. This compile-time/API safeguard prevents accidental fallback to the starter profile; it does not prove that caller-provided profiles are authoritative. Each production source profile still needs documented provenance, version/effective dates, validation tests and review evidence. This is a structural capability, not proof that authoritative nationwide datasets have been ingested, reconciled or validated. Programme-specific eligibility and regulatory applicability remain separate gates.

## Pan-India acceptance gates

1. Inventory the authoritative geography sources and their permitted usage for each integration.
2. Validate source-specific hierarchies and codes for representative states/UTs and urban/rural paths.
3. Test stale, missing, conflicting, cross-tenant and cross-jurisdiction records fail closed.
4. Demonstrate source updates, boundary changes, effective dating and audit lineage.
5. Approve the supported coverage matrix before claiming a geography or programme is production-ready.

## Official source starting points (reviewed 2026-10-21)

- **Local Government Directory (LGD), Ministry of Panchayati Raj:** https://lgdirectory.gov.in/demo/downloadDirectory.do — exposes separate directory downloads for districts, sub-districts, villages, PRI local bodies, ULBs, wards, Gram Panchayat-to-village mappings and development blocks. Use the specific entity and date range required; do not assume the directory's existence means RupayKg has API permission or an approved integration.
- **LGD village/Gram Panchayat mapping report:** https://lgdirectory.gov.in/staging/rptConsolidateVillageGramPanchayat.do — official lookup/report for village-to-Gram Panchayat and ULB mappings.
- **Office of the Registrar General & Census Commissioner, India, Census 2011 concepts and definitions:** https://censusindia.gov.in/nada/index.php/catalog/115/study-description — useful for the Census-specific distinction between town and village concepts. Census classification and LGD administrative/local-body records serve different purposes and must not be silently conflated.

These are source-discovery references, not an assertion that live records have been imported, that an API is available, or that the 2011 Census definitions are the applicable current rule for every programme. For each integration, retain the retrieved document/data snapshot, retrieval date, version or effective dates when supplied, content hash, usage terms, and review approval. If the source does not provide a stable version, record that limitation explicitly.


## Source snapshot and coverage manifest (2026-10-21)

The database now has an `authoritative_source_snapshots` manifest for recording the source owner, dataset code, source URL/version, jurisdiction scope, effective dates, retrieval timestamp, content SHA-256, record counts, usage-terms reference, and review state. An entry cannot be marked `APPROVED` without retrieved bytes, a content hash, complete counts, a usage-terms reference and named review metadata. No nationwide LGD snapshot is seeded by the migration; this is a data contract, not proof of ingestion or coverage.

For a real import, capture the exact official download artifact and its usage terms, record the source's from/to date range and state/entity scope, reconcile record counts, test codes/parent edges/duplicates and ambiguous mappings, and retain unresolved rows. Census classifications, LGD administrative records and programme-specific jurisdictions must remain distinct.
