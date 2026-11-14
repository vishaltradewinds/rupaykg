# CREDEBL interoperability review for RupayKg

**Repository reviewed:** `credebl/platform`, default branch `main`  
**Review date:** 2026-11-04  
**Status:** Source-level compatibility review only; not approved for deployment or adoption.

## 1. What the source confirms

- GitHub repository metadata reports Apache-2.0.
- Root `LICENSE` contains the Apache License 2.0 text.
- The root `package.json` identifies the API Gateway package as version 2.3.0 and declares `"license": "MIT"`.
- The API gateway contains separate OID4VC issuance and OID4VP verification controllers, credential issuance/verification controllers, organization-scoped routes, and JWT + organization-role guards.
- The inspected OID4VC issuer-management routes use `/orgs/:orgId/oid4vc/issuers` and require an authenticated JWT and organization OWNER role. Issuer templates are managed under the issuer path.
- The OID4VP verifier-management routes use `/orgs/:orgId/oid4vp/verifier` and also require JWT + organization OWNER.
- The conventional credential API includes organization-scoped credential listing and retrieval, and credential-definition management.
- The platform is a multi-service TypeScript/NestJS application with a substantial dependency set and infrastructure requirements. It is not a small embeddable library.

## 2. Licensing decision — unresolved

The repository-level Apache-2.0 declaration and root LICENSE do not agree with the API Gateway package's MIT metadata. This is a material licence metadata discrepancy, not proof that the whole project is MIT or that every component is Apache-2.0.

Before any adoption or distribution:
1. Obtain maintainer clarification on the intended licence for the repository and each relevant package/service.
2. Inspect every workspace package manifest and any nested LICENSE/NOTICE files.
3. Generate an SBOM for the exact pinned release and review transitive dependency licences and notices.
4. Record attribution, NOTICE and modification obligations in RupayKg's third-party register.
5. Obtain legal sign-off. Until then, CREDEBL remains evaluation-only.

## 3. Fit with RupayKg

Potentially useful role: an external credential issuer / holder / verifier interoperability service for portable claims such as:
- facility/operator identity claims;
- recycler/processor registration claims;
- validator or auditor professional/organizational claims;
- evidence-package references and status/revocation references.

CREDEBL must not become:
- RupayKg's identity provider or source of user authentication;
- the authoritative RupayKg organization, facility, activity or statutory registry;
- the source of truth for permissions, tenant boundaries or MRV calculations;
- the authority that determines CCTS, CPCB, EPR or other Indian statutory eligibility.

RupayKg remains the system that resolves organization/facility IDs, authorizes actions, records evidence and determines whether a claim is accepted for a particular workflow. A cryptographically valid credential is not proof of statutory approval.

## 4. Integration boundary

If the PoC proceeds after licence and security review:

1. Deploy CREDEBL only in an isolated non-production environment, pinned to an exact release and digest.
2. Configure a dedicated RupayKg issuer/verifier tenant with narrowly scoped administrative ownership.
3. Define a versioned W3C VC Data Model 2.0 profile and supported proof format; do not assume every CREDEBL feature is interoperable with the chosen profile.
4. Bind credential subject claims to immutable RupayKg organization/facility identifiers through an administrator-approved mapping.
5. Keep signing keys and credential lifecycle secrets in the credential service/HSM or approved secret manager; never copy private keys into RupayKg.
6. Verify issuer trust, signature/proof, schema, subject binding, expiry, status/revocation, challenge/audience and replay protections.
7. Store only the minimum credential reference, issuer, schema/profile version, verification result, status reference and audit provenance in RupayKg.
8. Require a separate RupayKg decision for operational or statutory acceptance.

## 5. Required proof before selecting CREDEBL

- Exact release and container image digests pinned.
- Licence discrepancy resolved and full dependency SBOM reviewed.
- OpenAPI contract and exact issue, present, verify, status and revocation flows tested against that release.
- W3C VC Data Model 2.0 profile, proof suites, DID methods and status mechanism explicitly selected and interoperably tested.
- Tenant isolation and API authorization tested, including cross-tenant credential retrieval and issuer misconfiguration.
- Key custody, rotation, backup, recovery, revocation, incident response and service exit/export tested.
- Webhook authenticity, replay protection, retries, idempotency and outage behaviour verified.
- Independent security review and privacy/data-protection assessment completed.

## 6. Decision

**Conditional evaluation only.** CREDEBL is a plausible external VC interoperability candidate, but its licence metadata discrepancy, service footprint, exact release-specific API contract, proof-profile interoperability and operational security remain open gates. Do not install it into RupayKg, issue live credentials, connect it to production, or alter RupayKg identity/auth/registry until those gates are closed.

No RupayKg runtime code, dependencies, database schema, credentials or deployment were changed by this review.
