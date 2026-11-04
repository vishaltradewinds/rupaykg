# CDPI upstream source, licence and adoption audit

**Date:** 2026-11-04  
**Repository:** `vishaltradewinds/rupaykg`  
**Stacked on:** `shakti/wave1-cdpi-rupaykg-foundation-2026-11-03` at `a64facf71b19768068ff03cfbd8993634e8d29ad`  
**Status:** Engineering research and adoption disposition; NOT a software approval, production integration, DPI qualification or security certification.  
**Scope:** RupayKg Wave 1 only. Other AVGAT INFRASYS platforms remain out of scope.

## 1. Executive decision

Continue with CDPI as a vendor-neutral architecture and implementation reference. Do not deploy CDPI's reference projects as a bundled platform and do not add a second identity, credential, registry or database authority to RupayKg.

The immediate implementation is a contract-first, evidence-first adoption path:

1. retain RupayKg's existing domain workflows and authoritative Neon database;
2. standardise the API, identifier, provenance and trust contracts;
3. keep participant/government source authority federated;
4. prove tenant isolation and least-privilege access before exposing any partner API;
5. select a credential backend only after a separate, bounded technical and legal review;
6. demonstrate interoperability with a synthetic independent client before a controlled field pilot.

This audit is a new supplement to the existing Wave 1 RFC and route inventory. It does not replace them.

## 2. Primary CDPI references reviewed

| Source | Evidence observed | RupayKg disposition |
|---|---|---|
| [CDPI official website](https://cdpi.dev/) | CDPI describes vendor-neutral DPI architecture advisory, country execution and reusable knowledge; says it does not offer proprietary software products. | Treat CDPI as an architecture/research source, not a vendor or certification authority. |
| [CDPI Curated Specifications](https://docs.cdpi.dev/references/home) | Living reference of open specifications and implementations; page explicitly says implementation claims have not been verified by CDPI and adopters should independently verify. | Use for discovery only; pin official standards and verify conformance independently. |
| [Is My System a DPI?](https://docs.cdpi.dev/the-dpi-wiki/is-my-system-a-dpi) | Open source alone is insufficient; interoperability, open APIs/specifications and third-party reusability are material tests. | Add third-party implementer and conformance evidence to the DPI qualification gate. |
| [Verifiable Credentials](https://docs.cdpi.dev/technical-notes/data-and-credentialing-infra/verifiable-credentials) | Describes issuer/consumer API exchange, consent, wallets/e-lockers and federated verification patterns. | Use the pattern only where an authoritative issuer, lawful sharing basis and verifiable subject/claims are defined. |
| [DPG for DPI Collection announcement](https://cdpi.dev/blog/digital-public-goods-alliance-launches-dpgs-for-dpi-collection/) | CDPI reported the DPGA collection launch on 2026-10-07, with 18 DPGs independently assessed against DPI-specific criteria across identity, payments, data exchange, registries and trust. | Candidate discovery signal; still perform project-specific legal, security, operational and fit review. |

## 3. Upstream repository inspection and licence disposition

The repository references below were inspected through GitHub repository metadata and README content on 2026-11-04. Commit SHAs pin the inspected source snapshot; re-check before any future adoption.

| Upstream | Inspected commit | Licence evidence | Observed purpose / constraints | Decision |
|---|---|---|---|---|
| [centre-for-dpi/docs](https://github.com/centre-for-dpi/docs) | `b4a3344fe601480d211fe5dd5742e30eb2036e77` | GitHub metadata: CC-BY-SA-4.0 | Shared technical, policy and operational DPI materials. | Reference/adapt selectively with attribution and share-alike compliance review. Do not copy without preserving provenance. |
| [centre-for-dpi/dpi-architecture](https://github.com/centre-for-dpi/dpi-architecture) | `a671cab9645bcb48786b06ef315f65efb1bc6cb0` | GitHub metadata: MIT | React 18 + Vite reference diagrams for DPI ecosystem, X-Road, API gateway, ID/eKYC/SSO, VCs and payments. | Suitable as a visual/learning reference; preserve MIT notice if code/assets are reused. Not an executable architecture for RupayKg. |
| [centre-for-dpi/delegated-access-poc](https://github.com/centre-for-dpi/delegated-access-poc) | `9defb082dc6f4aabd6b4b51448a995e9d7c94571` | GitHub metadata: Apache-2.0 | Kotlin/walt.id proof of concept using linked credentials, independent revocation and a delegation credential. README identifies it as a PoC and requires Docker; test lifecycle covers issue, verify, revoke and reinstate. | Pattern reference only. Do not import runtime. RupayKg delegation remains a design contract until legal authority, mandate scope, revocation, actor binding and adversarial tests are approved. |
| [centre-for-dpi/verifiably](https://github.com/centre-for-dpi/verifiably) | `66735273a3fc960013cf81e01d620730939a9866` | GitHub API repository metadata reports no recognised licence; root listing inspected did not show a LICENSE file. | Go + HTMX backend-agnostic interface for issuing, holding and verifying credentials across walt.id, Inji Certify/Wallet/Verify and CREDEBL. README describes Docker Compose dependencies, roughly 8 GB free RAM for walt.id/Inji and 12 GB for the full CREDEBL stack, plus numerous exposed ports. | **NO CODE REUSE / NO DEPLOYMENT** until an explicit licence/permission is verified. Architecture may be studied. Any later technical evaluation must isolate it and review images, supply chain, secrets, network exposure and resource needs. |
| [centre-for-dpi/ai-skills](https://github.com/centre-for-dpi/ai-skills) | `041a9e2faa0c2f7fbb5caac89c104e6d9fd4e9ff` | GitHub API metadata reports no recognised licence. | Knowledge skills are documented for Claude Code; README covers DPI foundations, safeguards, data exchange, trust, VC, registries, discovery/fulfilment, cloud, AI and DPGs. | Read-only research reference. Do not copy skill files into RupayKg or redistribute until licence is established. Translate applicable principles into Shakti-owned controls with original wording and citations. |

### 3.1 Important Verifiably finding

The current Verifiably README includes pre-seeded demonstration usernames/passwords and mock identity/OTP values for local demo flows. These are explicitly described as demo credentials, not production identities. This is an additional reason not to deploy the stack as-is or expose it to the internet. A future isolated evaluation must remove demo identities, rotate all secrets, review default accounts and verify that mock identity services cannot be enabled in a production profile.

The project is also operationally heavy relative to RupayKg's current infrastructure and the user's low recurring-cost constraint. Do not introduce its multi-container stack as a dependency for the Jabalpur pilot.

### 3.2 Licence rule

A GitHub repository with no recognised licence is not open for reuse by default. A README, public visibility, successful build, or upstream demonstration does not grant redistribution or deployment rights. No source code, binary, container image, workflow, credential schema or copied documentation from an unlicensed upstream may enter RupayKg until legal permission is recorded.

## 4. Standards and protocol adoption register — Wave 1

| Capability | Candidate | Decision now | Evidence required before implementation |
|---|---|---|---|
| API contracts | OpenAPI 3.x + JSON Schema 2020-12 | Adopt as contract direction. | Pin exact supported versions; derive schemas from actual validators/serializers; publish partner contract only after route auth review. |
| Verifiable credentials | W3C VC Data Model 2.0 | Candidate profile, not blanket adoption. | Define issuer authority, subject, claims, schema, proof format, status, holder binding, correction and verifier trust. |
| Credential issuance/presentation | OpenID4VCI 1.0 / OpenID4VP 1.0 | Candidate interoperability protocols. | Select one tested credential format/profile; conformance and cross-wallet tests; key custody, replay, status and revocation tests. |
| Identifier layer | DID Core / did:web / PKI | Evaluate per issuer and trust model. | Document identifier control, key rotation, recovery, revocation and trust-list governance. Do not make DID mandatory for every entity or event. |
| Consent and data sharing | MeitY Electronic Consent Artefact; DEPA patterns; X-Road reference | Adopt purpose/recipient/time-bound and auditable design patterns where legally applicable. | Legal basis assessment, consent artefact schema, withdrawal, retention and non-consent lawful-basis handling. |
| Discovery and fulfilment | Beckn / ONDC-compatible patterns | Research candidate for waste collection, logistics, lab and recycling discovery. | Real participant demand, network governance, domain schema mapping, transaction lifecycle, dispute and fraud controls. |
| Payment interoperability | UPI/NPCI; ISO 20022 where applicable | No payment rail build. | Regulated/authorised partner, product scope, reconciliation, refunds/disputes and explicit approval. |
| Evidence integrity | SHA-256 content hashes, signed provenance, trusted timestamps, append-only audit | Extend existing lineage and audit model. | Verify hash at ingress/egress, signer authority, clock source, immutable audit and evidence retention. Integrity is not truth. |

Version pinning must cite the normative publisher, publication status and exact profile. A CDPI catalogue entry is not itself a normative standard.

## 5. RupayKg implementation map

| DPI capability | Existing RupayKg area to reconcile | Gap / next work | Release gate |
|---|---|---|---|
| Participant and asset registries | Registry, onboarding, organisations, facilities, field devices | Define stable identifiers, issuer namespaces, steward/authority metadata and external-reference semantics. Avoid duplicating statutory registries. | No partner registry API until tenant and source-authority tests pass. |
| Data exchange | Fastify route modules, sync, MRV, EPR, evidence | Build OpenAPI from actual runtime schemas; add standard error, pagination, idempotency, versioning and partner conformance tests. | P0 route/auth inventory and same-client tenant context. |
| Trust and credentials | Existing credential and evidence domain; Hedera Guardian integration | Separate evidence integrity, credential authenticity, verifier authority and environmental truth. Define issuer trust and credential status lifecycle. | No real VC issuance until key custody, status, issuer authority and independent review pass. |
| Discovery and fulfilment | Marketplace/value/resource-flow and partner workflows | First define waste/service discovery use cases and common identifiers; assess Beckn only if network interoperability is required. | No external discovery/transaction network before participant and dispute governance. |
| Payments | Settlement domain | Keep internal and disabled for external participants until authorised payment provider and reconciliation are evidenced. | No payment/settlement release under this CDPI wave. |

## 6. SITE-JBP-01 pilot sequence

Use the Jabalpur Kathonda facility as a controlled validation context, not as a claim of a live institutional integration.

1. **Synthetic organisation/facility registry record:** validate identifier issuer, authority source, status/freshness and duplicate handling.
2. **Synthetic weighbridge/device credential profile:** model device identity and calibration evidence without claiming statutory certification.
3. **Waste receipt evidence package:** bind receipt event, material code, measured quantity/unit, capture time, device and evidence hashes.
4. **Verifier attestation profile:** bind the verifier's independently established authority, scope and decision; keep reviewer identity and approval permission separate.
5. **Independent client test:** consume published OpenAPI/schema without database access; prove positive and negative tenant cases.
6. **Field validation:** only after facility permission, real instrument integration, calibration evidence, data-sharing authority and field protocol are approved.

A signed credential or hash must never be presented as proof that a mass balance, methane estimate, emission reduction or carbon credit is correct. Methodology, measurement quality, uncertainty, chain of custody and independent verification remain separate controls.

## 7. Cross-cutting security and regulatory boundaries

- Existing P0 issues #214 (migration source/ledger parity) and #215 (tenant-bound, fail-closed verification authorization) remain ahead of any production-facing DPI integration.
- The existing audit reports 0/67 RLS and 0/67 FORCE RLS on the inspected production candidate tables and a BYPASSRLS database owner. Revalidate read-only; do not enable RLS globally or alter production roles through this work.
- No API may trust tenant/organisation IDs supplied by an untrusted client without resolving them against verified actor, membership, device and resource authority in the same transaction.
- Consent is not a substitute for statutory authority, contract, public task or another valid legal basis.
- CPCB/EPR/CCTS statutory duties, voluntary carbon methodology requirements, verifier accreditation and government determinations remain distinct.
- No external partner API, credential issuance, payment integration, production database mutation, migration, role/grant change, RLS activation, deployment or certification is authorised by this document.
- Do not claim DPI status or TRL 9 from standards mapping, documentation, CI or a demo.

## 8. Acceptance checklist for closing CDPI Wave 1

- [ ] Source/standard register has pinned versions, publisher URLs, licence disposition and review date.
- [ ] Every reused component has exact commit/tag, licence file/hash, attribution obligations, SBOM and security review.
- [ ] Participant/data-authority map identifies authoritative source, steward, purpose, lawful basis, classification, retention and dispute owner.
- [ ] OpenAPI and JSON Schema match actual runtime validation and response serialization.
- [ ] Partner contracts are tested by an independent client without direct database access.
- [ ] Every external-facing route has actor, tenant, permission, geography, transaction, idempotency and audit semantics documented.
- [ ] Two-tenant/two-device PostgreSQL negative and positive tests pass under the actual least-privilege runtime role.
- [ ] Credential profiles define issuer authority, holder binding, status/revocation, key rotation, correction and verifier trust.
- [ ] Delegation is distinct from authentication, authorisation, consent and legal authority.
- [ ] Independent security, privacy, statutory and domain reviews are recorded.
- [ ] SITE-JBP-01 field permission, instrument evidence and actual data lineage are independently evidenced.
- [ ] Release gate is approved separately; production remains HOLD until all non-CDPI P0/P1 blockers are closed.

## 9. Work sequencing and coordination

This document is stacked on the existing CDPI foundation PR branch. It does not modify the existing foundation branch, repository main, the repository AIM reconciliation PR, EPR/MRV/pilot branches, database, deployment or production configuration.

Next execution batches:
1. Review this source/licence register with the existing Wave 1 RFC and correct any inconsistent dispositions.
2. Generate a route contract matrix from runtime schemas and handler serializers, beginning with the P0 authorization findings.
3. Define registry identifiers and evidence/credential profiles as design artefacts only.
4. Add independent-client contract tests after route security and tenant context are proven.
5. Reconcile all work against the current repository AIM, PR dependency topology and P0 issues #214/#215.

**Release status: HOLD.**  
**DPI qualification: NOT QUALIFIED.**  
**TRL 9: NOT ESTABLISHED.**
