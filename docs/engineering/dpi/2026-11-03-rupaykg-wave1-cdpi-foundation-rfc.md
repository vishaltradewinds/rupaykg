# RupayKg Wave 1 — CDPI/DPI Foundation and Adoption RFC

**Status:** Draft for engineering and independent security review  
**Date:** 2026-11-03  
**Repository:** `vishaltradewinds/rupaykg`  
**Branch:** `shakti/wave1-cdpi-rupaykg-foundation-2026-11-03`  
**Base:** `a3fecc0abd2c46549a201058d3963afc0e3a73c9` (`main`)  
**Scope:** RupayKg only. Other AVGAT INFRASYS platforms are explicitly out of scope for this wave.  
**Authority:** Shakti Standards and the RupayKg production/release gates govern all decisions in this RFC.

## 1. Executive decision

Adopt CDPI's open, interoperable, federated DPI principles as architecture guidance for RupayKg. Do not treat CDPI as a software vendor, certification authority, regulator, or turnkey product supplier. Do not import every repository or deploy a new credential platform as a prerequisite.

**Decision rule: reuse standards and patterns; own RupayKg's domain workflows, evidence, data stewardship, user experience and operational controls.**

Wave 1 is a design-and-contract foundation. It does not activate new production integrations, issue real credentials, change database schema/roles, enable RLS, or claim DPI qualification. Code adoption follows only after licensing, security, dependency, runtime and acceptance reviews.

## 2. Current verified posture and constraints

The current mainline baseline is `a3fecc0abd2c46549a201058d3963afc0e3a73c9`. The repository's DPI acceptance assessment is recorded in `docs/engineering/assurance/2026-11-03-dpi-acceptance-gap-assessment.md` on the separate assessment branch.

The assessment records:
- DPI acceptance: **PARTIAL / NOT QUALIFIED**.
- Database-enforced tenant isolation: **FAIL / P0**. The recorded production audit found 0/67 inspected public tables with RLS or FORCE RLS, and an overprivileged application role. Revalidate read-only before any future release decision.
- Independent assurance: **FAIL / P1**.
- Release authority: **HOLD**.
- Active application security work is in stacked draft PRs. In particular, #218 and #229 are dependent MRV changes; #213 and #228 are EPR changes; #219 is stacked on #218; #227 is the DPI assessment. None is to be presumed merged because a branch or its CI passed.

Hard constraints:
1. Preserve the authoritative Neon project/database and branch. No database creation, branch promotion/deletion, DDL/DML, role/grant changes, RLS activation or migration execution under this RFC.
2. Do not merge, rebase, retarget or rewrite active PR branches as part of this work. Keep this RFC on its isolated branch.
3. No production or staging secrets, live participant data, government integrations, carbon issuance or external claims are in scope.
4. Never use a shared central database as a substitute for federation or tenant isolation.
5. Statutory EPR/CPCB/CCTS requirements, voluntary carbon methodologies, technical MRV evidence and external approval remain distinct.
6. CI, documentation, diagrams and mock tests are not proof of production readiness, independent assurance or TRL 9.

## 3. CDPI adoption principles translated into Shakti controls

The following principles become mandatory design review questions for any RupayKg DPI-facing feature:

| Principle | RupayKg interpretation | Required evidence |
|---|---|---|
| Interoperability | Open, documented APIs and portable data formats; no private DB coupling for participants | Versioned OpenAPI, JSON Schemas, compatibility policy, independent-client test |
| Reusable building blocks | Identity, trust, consent, discovery and payments are not reimplemented per workflow without a reason | Shared contracts and ADRs; domain services remain bounded |
| Federated/decentralised | Each participant or authorised institution retains authority over its source data and registry | Data authority map, source-of-truth register, authenticated federation tests |
| Inclusive innovation | Cooperatives, small operators, local bodies and field agents can participate through accessible, low-bandwidth and assisted channels | Mobile/offline/local-language/accessibility tests and field feedback |
| Privacy/security by design | Purpose limitation, least privilege, minimisation, auditable access and bounded retention | Data inventory, threat model, tenant tests, access logs, retention schedule |
| Ecosystem qualification | Open-source code alone is insufficient; independent reuse and ecosystem participation must be demonstrated | Independent participant implementation and conformance evidence |

These controls extend the existing Shakti DPI acceptance gates; they do not replace statutory controls or security gates.

## 4. Wave 1 deliverables

### W1.1 — Standards and protocol register

Maintain a versioned register with: capability, standard/specification, exact version/status, RupayKg use case, adoption status, owner, source URL, implementation candidate, security/privacy implications, conformance tests, and review date.

Initial decisions:

| Capability | Candidate standard/pattern | Wave 1 decision |
|---|---|---|
| API description | OpenAPI 3.x; JSON Schema | Adopt for published partner contracts; exact versions pinned in implementation ADR |
| Authentication | OAuth 2.0 / OpenID Connect | Use only for supported external federation; do not replace existing session/auth stack without migration design |
| Verifiable credentials | W3C VC Data Model 2.0; OID4VCI 1.0; OID4VP 1.0; SD-JWT VC | Adopt as candidate interoperability profile after issuer, holder, verifier and revocation threat-model review |
| Issuer identity/trust | DID Core, X.509/PKI, signed issuer metadata/trust registry | Evaluate by trust model; do not require DID for every participant or data record |
| Consent | MeitY Electronic Consent Artefact / DEPA patterns where legally and technically applicable | Adopt purpose-bound, revocable and auditable consent patterns; consent is not a substitute for another lawful basis |
| Data exchange | Federated API patterns; X-Road as a reference architecture | Adopt source-owned exchange; evaluate X-Road only if institutional federation needs justify its operational footprint |
| Discovery/fulfilment | Beckn Protocol | Candidate for service discovery/fulfilment (collection, transport, labs, recycling); not for statutory determinations |
| Payments | UPI/NPCI and ISO 20022 where authorised | Integrate only through authorised regulated/payment partners; do not build a payment rail |
| Evidence integrity | Content hashes, signed event/provenance records, trusted timestamps and append-only audit | Extend existing evidence lineage; cryptographic integrity does not prove the truth of source observations |
| Health/data standards | FHIR/ABDM only for a later, specifically authorised health-data use case | Out of current Wave 1 scope |

A standard is not adopted merely because it appears in a CDPI catalogue. Pin the official specification and run a version/conformance review before implementation.

### W1.2 — Reuse and licence register

| Resource | Intended use | Current disposition | Gate before code reuse |
|---|---|---|---|
| CDPI DPI Wiki / implementation articles | Architecture and implementation guidance | Reference material | Attribution, source/version record; independently verify technical and legal claims |
| CDPI `docs` repository | Adapted guidance/checklists | CC-BY-SA-4.0 reported in repository metadata | Preserve attribution and comply with share-alike for adapted material |
| CDPI `dpi-architecture` | Architecture diagrams/training | MIT reported in repository metadata | Preserve licence notice; verify exact file and upstream version |
| CDPI `delegated-access-poc` | Delegation pattern reference | Apache-2.0 reported in repository metadata | Preserve notices; threat-model and rewrite/productionise before use |
| CDPI `verifiably` | Multi-DPG VC interface and adapter architecture | No recognised licence was confirmed in the inspected repository metadata | **Do not copy, fork, redistribute or deploy until explicit licence/permission is verified** |
| CDPI `DPI-Assistant` | Research/knowledge reference | Licence not confirmed | Research only; no code reuse until licence, provenance and security review |
| CDPI `ai-skills` | Knowledge/skill reference | Licence not confirmed | Research only; no copying into product until licence review |
| Inji / walt.id / CREDEBL | Candidate VC implementation backends | Separate upstream projects with independent licences and operational footprints | Review each upstream licence, SBOM, release cadence, CVEs, data flows, resource needs and interoperability tests |

**Licence rule:** absence of a recognised licence is not permission. Record exact upstream commit/tag, licence file/hash, notices, transitive licences, modifications, SBOM and approval before any dependency enters the product.

### W1.3 — RupayKg domain and data-authority map

The initial participant classes are:
- Waste generator / producer / bulk waste generator.
- Collection and aggregation operator.
- Transporter / logistics provider.
- Material recovery / processing / recycling facility.
- Weighbridge and measurement-device operator.
- Laboratory / sampling organisation.
- Independent verifier / auditor.
- Producer Responsibility Organisation and obligated producer, where applicable.
- Local body, regulator and government authority.
- Platform operator and authorised support personnel.

For each dataset, Wave 1 must record:
- authoritative source and steward;
- subject and organisation to which it relates;
- purpose and lawful basis;
- fields classified as public, partner-restricted, organisation-confidential or sensitive;
- permitted readers/writers and onward-sharing constraints;
- retention, correction, export and deletion rules;
- dispute/grievance owner;
- source timestamp, provenance and quality limitations.

RupayKg must not silently become the authoritative owner of a government, municipal, facility, laboratory or participant registry. Where an external authority is authoritative, store a reference, source/version and verification result; cache only what is necessary and permitted.

### W1.4 — Shared API contract baseline

All external/partner-facing APIs must document:

- stable resource identifiers and identifier issuer/namespace;
- API version and compatibility/deprecation policy;
- authentication method and audience/scope;
- organisation/tenant scope derived from verified server context, never trusted from an arbitrary request header;
- idempotency key and replay behaviour for writes;
- pagination, filtering and deterministic sorting;
- standard error envelope and machine-readable error codes;
- rate limits, retry/backoff and timeout behaviour;
- timestamps in RFC 3339 UTC and explicit units/time zones for measurements;
- data classification, purpose and retention;
- audit event and correlation ID;
- export and portability behaviour;
- OpenAPI and JSON Schema conformance tests.

**No participant receives direct database credentials or private database access.** APIs must not leak cross-tenant data or reveal whether a foreign tenant's protected record exists.

### W1.5 — Credential and trust contract (design only)

Potential RupayKg credentials, subject to source authority and legal review:

1. Organisation / facility registration credential.
2. Facility authorisation or operating-status credential (only where issued by a competent authority).
3. Weighbridge/device identity and calibration credential.
4. Waste collection / transfer / receipt evidence credential.
5. Laboratory sample/result provenance credential.
6. Independent verifier role/qualification credential.
7. Evidence package integrity/verification attestation.

Each credential profile must define:
- issuer authority and proof of authority;
- subject and subject binding;
- claims, units, evidence references and provenance;
- schema and profile version;
- issuance, validity and status/revocation method;
- holder delivery and presentation protocol;
- selective disclosure and minimum necessary claims;
- correction, suspension and dispute process;
- verifier trust policy and failure behaviour.

Do not issue a credential that implies government approval, statutory compliance, carbon-credit ownership or verified environmental impact unless the competent authority/process has actually made that determination. A hash or VC signature proves integrity/issuer attribution under a key; it does not prove the underlying measurement is true.

### W1.6 — Consent and delegated-access contract (design only)

Separate the concepts:
- **Authentication:** who is acting?
- **Authorisation:** what may that actor do?
- **Delegation:** on whose behalf may the actor act, and under what bounded mandate?
- **Consent:** has the data subject/authorised party agreed to a specified data use where consent is the appropriate legal basis?
- **Legal authority:** is the action independently permitted or required by law/contract/regulatory mandate?

Delegation must be explicit, scoped, time-bound, revocable and auditable. It must not transfer the principal's identity or grant broader permissions than the principal holds. Record principal, delegate, authority basis, allowed actions/resources, geography, start/end, revocation and evidence of grant. High-risk actions (issuance, retirement, submission, approval) require separate permission and, where appropriate, independent review.

Consent records must identify purpose, data categories, recipient, duration, notice/version, grant/withdrawal time and evidence. Withdrawal must stop future consent-based access but does not automatically erase records that must lawfully be retained.

### W1.7 — Federation and registry boundary

Use a federated model:
- RupayKg owns its operational workflow and its own records.
- Participants remain authoritative for their submitted source records unless a contract or law establishes otherwise.
- Government/municipal registries remain authoritative for official registrations and determinations.
- External registries are queried through authenticated, scoped APIs or verified signed exports.
- Cached copies carry source, fetch time, source version, expiry/freshness and integrity metadata.
- Conflicting values are not silently overwritten; create a discrepancy and correction workflow.

A central RupayKg participant directory may support discovery, but must not impersonate a statutory registry or become a universal source of truth.

## 5. Target logical architecture

```text
Participants / facilities / authorities / verifiers
                    |
        RupayKg web, mobile, offline UX
                    |
     API gateway + authn/authz + rate limits
                    |
       Signed tenant request context
                    |
    +---------------+----------------+
    |               |                |
 Domain workflows  Evidence       Partner adapters
 EPR / MRV / ESG   & provenance    Government / DPGs
 Registry / BWG    review          Beckn / VC / APIs
    |               |                |
    +---------------+----------------+
                    |
       Domain-owned Neon data stores
       + table-specific access controls
                    |
       Audit / monitoring / export
```

This is a logical target, not a permission to add infrastructure. The current Neon tenant-isolation blocker remains P0. No new credential hub, trust registry or federation database is to be provisioned until the security and operational case is approved.

## 6. Security and privacy acceptance requirements

Before any Wave 1 contract is implemented:
1. Complete route-to-table and actor-to-data access inventory.
2. Establish exact runtime database identity and least-privilege role separation.
3. Prove tenant isolation using two organisations with adversarial positive/negative tests under the exact NOBYPASSRLS runtime role.
4. Ensure every protected query uses the same authenticated request-scoped transaction/client; no pool-level fallback.
5. Test pooled connection reuse and transaction-local context cleanup.
6. Define service-to-service identity, mTLS/OAuth audience, secret rotation and revocation.
7. Define credential issuer key custody, rotation, status/revocation and compromise response before VC implementation.
8. Threat-model delegated access, confused deputy, replay, privilege escalation, cross-tenant leakage and consent withdrawal.
9. Minimise PII; avoid storing raw identity documents/biometrics unless strictly necessary and lawfully authorised.
10. Maintain immutable, access-controlled audit trails without logging secrets or unnecessary personal data.

**Fail closed:** missing/expired context, unknown issuer, invalid signature, stale/revoked credential, unknown schema, unavailable authoritative source, ambiguous tenant or failed authorisation must not be converted into an approval.

## 7. Coherent implementation sequence

| Batch | Work | Exit criteria |
|---|---|---|
| W1-A | Standards, licence and source register | All proposed components have pinned source/version/licence disposition |
| W1-B | Participant, dataset and authority map | Every first-scope dataset has steward, purpose, legal basis, classification and sharing rules |
| W1-C | API and schema contracts | OpenAPI/JSON Schema drafts reviewed; identifier, tenant, error and compatibility rules fixed |
| W1-D | Credential, trust, consent and delegation profiles | Threat model, issuer authority, status, revocation and dispute rules approved |
| W1-E | Security/tenant conformance plan | Route/table matrix and real PostgreSQL A/B acceptance plan reviewed |
| W1-F | Independent design review | Security, privacy, domain and statutory reviewers sign the scoped design; unresolved items remain HOLD |

Implementation after Wave 1 is split into separate, reviewed pull requests. First pilot candidates should be limited to a non-statutory, low-risk facility/organisation credential and evidence-integrity attestation using synthetic test participants, followed by authorised real-participant validation only after all gates pass. This is a candidate sequence, not current approval to issue credentials.

## 8. Wave 1 acceptance checklist

- [ ] CDPI principles mapped to Shakti controls and versioned.
- [ ] Standards register has exact official specification URLs, versions and lifecycle status.
- [ ] Licence register includes exact upstream commits/tags, notices and transitive SBOM review.
- [ ] Unlicensed/unclear CDPI code is excluded from product dependencies.
- [ ] Participant and dataset authority register is complete for the first RupayKg scope.
- [ ] OpenAPI and JSON Schema contract drafts are machine-readable and versioned.
- [ ] Authentication, authorisation, delegation, consent and legal authority are distinct in the data model.
- [ ] Credential profiles identify competent issuers and status/revocation rules.
- [ ] Data federation does not duplicate or claim authority over external registries.
- [ ] Threat model covers tenant isolation, replay, delegation, key compromise and privacy.
- [ ] Two-tenant disposable PostgreSQL acceptance is specified and later executed under the actual least-privilege role.
- [ ] Independent security/privacy/domain review completed.
- [ ] No production changes or claims are made based solely on this RFC.

## 9. Explicit exclusions

Wave 1 does not:
- deploy Verifiably, Inji, walt.id, CREDEBL, X-Road or Beckn;
- copy or redistribute CDPI code with unclear licensing;
- replace current authentication or introduce a second identity store;
- create a central participant database or centralise all participant data;
- implement payments, UPI, government benefit routing or financial account mapping;
- issue statutory certificates, EPR credits, carbon credits or regulatory approvals;
- enable production RLS or modify Neon roles/schema;
- merge existing engineering PRs or change their branch ancestry;
- begin implementation on any other AVGAT INFRASYS platform.

## 10. Source register

- CDPI home and institutional posture: https://cdpi.dev/
- CDPI resources: https://cdpi.dev/resources
- DPI Wiki: https://wiki.dpi.dev/
- CDPI GitHub organisation: https://github.com/centre-for-dpi
- Verifiably repository: https://github.com/centre-for-dpi/verifiably
- Delegated access PoC: https://github.com/centre-for-dpi/delegated-access-poc
- DPI architecture repository: https://github.com/centre-for-dpi/dpi-architecture
- W3C Verifiable Credentials Data Model: https://www.w3.org/TR/vc-data-model-2.0/
- OpenID for Verifiable Credential Issuance: https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html
- OpenID for Verifiable Presentations: https://openid.net/specs/openid-4-verifiable-presentations-1_0.html
- Beckn Protocol: https://becknprotocol.io/
- X-Road: https://x-road.global/
- OpenAPI: https://spec.openapis.org/oas/latest.html
- JSON Schema: https://json-schema.org/

**Source validation rule:** CDPI's curated standards and DPG listings are discovery aids, not independent certification of every listed implementation. Validate upstream maintenance, security, conformance, operational cost and legal permission independently before adoption.

---

**CTO disposition:** Wave 1 design baseline only. RupayKg remains DPI PARTIAL / NOT QUALIFIED and production HOLD until the existing P0 tenant-isolation, external evidence, operational and independent assurance gates are closed.
