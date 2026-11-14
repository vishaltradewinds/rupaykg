# RupayKg Commercial IP Boundary — DPG Optionality Assessment

**Assessment date:** 2026-11-07  
**Repository assessed:** vishaltradewinds/rupaykg (main)  
**Assessment commit:** 3e2643e4ed1e0232f214c80223ddf1d1bb2aca46  
**Decision:** Preserve proprietary commercial core. Do not create or release a separate Open MRV Core at this stage.

## 1. Strategic decision

The business objective is to monetise RupayKg through commercial software, implementation, integration, managed operations, reporting, support and ecosystem services.

DPGA recognition is optional and must never be the reason to give away proprietary code, customer relationships, operational know-how, deployment systems, regulatory workflows or commercially valuable methodology orchestration.

The earlier Open MRV Core concept is **on hold**. The immediate direction is a commercial product boundary plus selectively open interoperability specifications. No extraction, public release, public licence or separate open-source repository is authorised.

## 2. Current repository evidence

A source review of the canonical repository at commit 3e2643e4ed1e0232f214c80223ddf1d1bb2aca46 found:

- no root LICENSE/COPYING file in the inspected tree;
- root package.json declares private true;
- packages/domain/package.json declares private true;
- packages/carbon/package.json declares private true;
- domain and carbon workspaces include product-specific workflows and/or methodology references;
- the carbon workspace includes BEE methodology-specific implementation and applicability logic;
- the current product includes production identity, organisation/geography controls, MRV, evidence, verification, registry, regulatory, reporting and external-provider boundaries.

A public repository does not automatically grant rights to reuse source code. No licence may be added and no package made public without rights-holder and contributor-rights review.

## 3. Proprietary commercial core — protected by default

- production application, source, user experience and workflow orchestration;
- tenant, identity, organisation, geography and access control;
- statutory applicability and compliance workflow implementation;
- methodology adapters, calculation orchestration and audit trace implementation;
- evidence vault, quality gates and verification workflow;
- registry, credential, transfer, retirement and settlement orchestration;
- analytics, commercial reporting and customer-specific configuration;
- device, trust-provider and external-system adapters;
- deployment, monitoring, backup, support and managed-operation playbooks;
- pricing, packaging, billing and partner-management services.

This is an IP boundary policy, not a legal conclusion that all listed assets are owned by RupayKg. Third-party data, public standards, government publications, open-source dependencies and customer-owned information remain governed by their own rights and contracts.

## 4. Selectively open assets

Consider publishing only after explicit review:
- OpenAPI specifications and API contracts;
- neutral activity/resource-flow/measurement/evidence-reference schemas;
- interoperability mappings;
- synthetic test fixtures that contain no customer data;
- non-confidential data dictionaries and integration guides;
- conformance-test descriptions.

Open specifications can support adoption without releasing their proprietary implementations. Any public artefact needs its own rights, licence, versioning and maintenance decision.

## 5. DPGA implications

DPGA recognition requires an approved open licence and evidence across the DPG Standard. An open-source release can be used and commercially offered by other parties under its licence; recognition does not create exclusivity.

An optional DPG nomination may be considered only when:
- the nominated product boundary is genuinely separate;
- intellectual-property ownership and contributor rights are clean;
- the licence and dependency obligations are accepted;
- the benefit to distribution, ecosystem adoption, procurement or strategic partnerships is evidenced;
- the open release does not expose customer information, security-sensitive internals or trade secrets;
- the component can be maintained independently with a funded support model.

The DPGA Registry can also be used to source existing DPG building blocks for RupayKg. See docs/DPG_REGISTRY_COMPONENT_EVALUATION_RUPAYKG.md.

## 6. Recommended commercial architecture

Proprietary RupayKg Platform:
- operational lifecycle, regulatory workflows, evidence, verification, reporting, analytics, customer configurations and managed services.

Open Interoperability Surface:
- published APIs, schemas, mappings and non-confidential integration contracts.

Selected External DPG Components:
- separately deployed/connected software such as OpenFn, ODK, Sunbird RC, CREDEBL, CKAN or X-Road only where a customer use case, licence review, security assessment and cost-to-serve justify them.

Paid Services:
- SaaS subscriptions, enterprise deployments, connector packs, onboarding, managed operations, support, training and SLAs.

No third-party DPG becomes the authoritative RupayKg system of record unless a separately approved architecture decision explicitly establishes that role and the migration/rollback plan is proven.

## 7. Commercial go/no-go

| Decision | Current status |
|---|---|
| Keep RupayKg proprietary | APPROVED DIRECTION |
| Add a public open-source licence to root repository | NO-GO |
| Change private package flags for release | NO-GO |
| Extract existing domain/carbon workspaces wholesale | NO-GO |
| Publish neutral API/schema specifications | CONDITIONAL — rights/security review |
| Source selected DPGs for integration | APPROVED FOR DISCOVERY |
| DPGA nomination for RupayKg as a whole | NO-GO |
| Separate Open MRV Core public release | ON HOLD |
| Change production/TRL status | NONE |

## 8. Immediate next steps

1. Maintain a commercial product capability versus customer-promise matrix.
2. Validate the DPGA registry API and curate only tools relevant to named customers/use cases.
3. Resolve upstream licence/version and security posture for any chosen DPG.
4. Prove one low-risk, non-production integration with synthetic data.
5. Measure implementation hours, infrastructure cost, maintenance burden and customer value.
6. Convert only commercially validated integrations into supported connectors or managed service offers.

**Final rule:** Monetise RupayKg's product and services. Use open standards and existing DPGs to reduce duplication and improve market access. Do not donate the commercial core to obtain recognition.

---

## References

- DPGA Registry: https://www.digitalpublicgoods.net/registry
- DPGA Registry API: https://github.com/DPGAlliance/dpg-api
- DPGA DPG Standard: https://www.digitalpublicgoods.net/standard
- DPGA DPGs for DPI: https://www.digitalpublicgoods.net/dpgs-for-dpi
- RupayKg canonical source: vishaltradewinds/rupaykg main.

**Status:** Internal commercial IP and DPG optionality assessment. Not a legal opinion, licence decision, product release, DPGA approval, regulator endorsement or TRL determination.
