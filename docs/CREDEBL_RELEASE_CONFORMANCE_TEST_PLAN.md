# CREDEBL Release Conformance and Adoption Gate

**RupayKg scope:** evaluation-only interoperability candidate for portable external credentials.  
**Status:** design/test plan; no CREDEBL deployment, dependency, key, credential or production integration is authorised.  
**Authority boundary:** RupayKg remains the authoritative tenant, facility, activity, evidence, MRV and compliance system. CREDEBL must not become a parallel RupayKg identity, registry, evidence or statutory-decision system.

## 1. Decision to be made

Determine whether a pinned CREDEBL release can safely issue, present, verify and revoke a narrowly scoped portable credential for an external subject such as a facility, operator, recycler or independent verifier.

A cryptographically valid credential proves only that a particular issuer signed particular claims under a particular profile. It does **not** establish that the claims are true, that field evidence is genuine, that a facility is legally authorised, or that a statutory obligation is satisfied. RupayKg policy and authorised human review remain responsible for those decisions.

Initial recommendation: **do not adopt or embed CREDEBL yet**. Complete release-specific conformance, security, licence and operational review first. A standards-compatible boundary adapter is preferred over coupling RupayKg core services to CREDEBL internals.

## 2. Preconditions / evidence required

Before running a release conformance suite, record and independently review:

- Exact upstream release tag, immutable commit SHA, container image digest and build provenance.
- Release-specific OpenAPI document, request/response DTOs, supported credential formats, proof suites, DID methods and status/revocation mechanisms.
- Root licence and every distributed service/package licence, including the observed root Apache-2.0 versus API Gateway package metadata MIT discrepancy. Resolve with authoritative upstream evidence or legal review; do not infer permission from package metadata alone.
- Complete dependency SBOM, vulnerability scan, supported runtime versions, maintenance/security policy and release notes.
- Deployment topology, tenant/org isolation model, data flows, outbound network requirements, telemetry, logs, retention and deletion behavior.
- Key generation, custody, backup, rotation, compromise recovery and separation of issuer/verifier keys.
- Webhook signing, timestamp tolerance, replay protection, retry behavior, delivery ordering and secret rotation.
- Export, migration and exit plan so RupayKg can remove CREDEBL without losing authoritative records.

No release is eligible while a material item is unknown or contradicted.

## 3. Permitted and prohibited boundary

**Potentially permitted after approval**
- Issue a portable credential representing an independently approved, time-bounded claim.
- Verify issuer signature, proof purpose, schema/profile, subject binding, validity interval and status.
- Return a structured verification result with issuer, profile, status, timestamp and reason codes.
- Publish a minimum, non-sensitive verification receipt into RupayKg through an authenticated adapter.

**Prohibited**
- Replacing RupayKg login, session, membership, RBAC, tenant isolation or organization selection.
- Becoming the authoritative facility/operator/recycler registry or canonical evidence store.
- Self-approving credentials from ODK submission fields, external webhooks or CREDEBL status.
- Treating credential validity as statutory approval, carbon-credit issuance, EPR fulfilment, MRV validation or proof of field truth.
- Allowing a credential subject or webhook to choose RupayKg tenant, site, activity or reviewer identity.
- Direct CREDEBL writes to RupayKg Neon or direct database access from an external service.

## 4. Conformance test suites

Run only against an isolated, disposable test environment with synthetic identities and claims.

### A. Issuance and schema
1. Approved issuer can issue only an allowlisted credential profile.
2. Unknown, unapproved or retired schema/profile is rejected.
3. Required claims, types, units, vocabularies and version are validated.
4. Issuer cannot create a claim outside its assigned authority/scope.
5. Subject identifier is bound to the RupayKg-approved external entity mapping; client-supplied tenant/site IDs are ignored.
6. Credential lifetime, notBefore, expiry and clock-skew boundaries are enforced.
7. Duplicate issuance is idempotent or returns a deterministic conflict; it never silently overwrites a prior credential.
8. Unsupported proof suite or DID method is rejected.

### B. Verification and presentation
9. Valid signature and approved proof suite verify successfully.
10. Modified claim, signature, proof purpose or canonicalized payload fails verification.
11. Unknown, untrusted or wrong issuer fails closed.
12. Wrong subject, wrong audience, wrong challenge/nonce or replayed presentation fails.
13. Expired, not-yet-valid, revoked or suspended credential is not accepted.
14. Status-list/status-service outage returns **indeterminate/unavailable**, never valid-by-default.
15. Schema substitution, profile downgrade and unsupported context/version fail closed.
16. Verification result exposes a stable reason code and the exact policy/profile version used.

### C. Tenant, roles and authority
17. Organization A cannot read, issue, revoke or verify private resources belonging to organization B.
18. Non-owner/non-authorised role cannot administer issuer, verifier, templates, keys or status configuration.
19. Webhook IDs and credential IDs cannot be used to cross tenant boundaries.
20. A CREDEBL administrator or service principal cannot mutate RupayKg authoritative records.
21. RupayKg mapping is resolved server-side from a reviewed binding; submission claims cannot nominate a tenant or site.
22. Credential validity cannot automatically set RupayKg evidence review, compliance, MRV or statutory approval states.

### D. Webhook and integration resilience
23. Correct HMAC/signature, timestamp and body are accepted under the documented contract.
24. Body tampering, signature tampering, stale/future timestamp and unknown key are rejected.
25. Replayed event ID is idempotently ignored; duplicate delivery cannot duplicate a state transition.
26. Out-of-order events cannot roll back a newer credential status or version.
27. 429, timeout, 5xx and transient network failure use bounded retry with jitter and a dead-letter/alert path.
28. Permanent 4xx, invalid signature and repeated authentication failure stop retries and alert.
29. Secret rotation accepts the documented overlap window and rejects retired keys after expiry.
30. Webhook payload is schema-validated, size-bounded and treated as untrusted input.

### E. Key custody, privacy and operations
31. Private keys are not returned by APIs, logged, exported or stored in RupayKg.
32. Issuer and verifier keys are separated; key rotation and compromise revocation are demonstrable.
33. Backup/restore does not restore revoked credentials to active status.
34. Logs redact personal data, tokens, private keys and sensitive claim values.
35. Retention/deletion requests propagate according to an approved policy without erasing legally required audit history.
36. Service restart, database outage, status outage and clock skew fail safely.
37. SBOM and vulnerability scan have no unresolved critical/high findings without formally approved mitigation.
38. RupayKg adapter timeout/failure cannot block core MRV operations or create partial authoritative writes.

### F. Exit and portability
39. Export of credential, proof, status and verification receipts is complete and documented.
40. RupayKg can verify/export retained credentials after CREDEBL service termination, or an explicit verifier continuity plan is approved.
41. No proprietary CREDEBL identifier becomes the sole key for a RupayKg entity or evidence record.
42. Removing the adapter leaves RupayKg's authoritative tenant, evidence, MRV and audit records intact.

## 5. Acceptance evidence

For each test retain:
- Test ID, test version, exact CREDEBL commit/image digest and configuration fingerprint.
- Synthetic input fixture and expected result.
- Actual result, timestamp, environment and redacted logs.
- Pass/fail/blocked disposition and linked defect.
- Reviewer identity and independent sign-off for security-sensitive suites.

A test plan or passing unit test is not evidence of production readiness. Conformance must be demonstrated against the exact release and deployment topology proposed for adoption.

## 6. Adoption gates

| Gate | Required evidence | Decision |
|---|---|---|
| G0 Source and licence | Pinned release, resolved licence discrepancy, SBOM | Stop if unresolved |
| G1 API and profile | Versioned API/DTO/proof/schema/status contract | No adapter before completion |
| G2 Security | Threat model, key custody, tenant/role, webhook and privacy review | Independent security approval |
| G3 Synthetic conformance | All applicable tests pass; failures dispositioned | No live data |
| G4 RupayKg adapter | Server-side mapping, least privilege, idempotency, audit, no DB access | Rehearsal only |
| G5 Pilot authorisation | Data protection, field/legal approval, operational runbook and explicit founder approval | Limited pilot only |
| G6 Operational acceptance | Monitoring, incident response, backup/restore, exit test and independent review | Separate decision; not automatic certification |

## 7. RupayKg integration contract

If all gates pass, integrate through a narrow adapter with:
- mTLS or an equivalent service identity plus short-lived, audience-bound credentials.
- Server-side tenant and entity mapping.
- Explicit allowlisted credential profiles and issuer trust registry controlled by RupayKg policy.
- Request signing, nonce/replay protection, idempotency keys and immutable audit events.
- Strict request/response schemas, timeouts, bounded payloads and fail-closed status handling.
- No direct database connection, shared user token, credential private key or general-purpose CREDEBL admin token in RupayKg.
- Human review for claims that affect evidence, MRV, compliance or statutory status.

The adapter stores only the minimum verification receipt and external reference needed for audit. The authoritative evidence and regulatory decision remain within RupayKg's existing governed workflow.

## 8. Current disposition

**Evaluation only — not selected, not integrated, not production approved.**

Immediate next actions:
1. Resolve exact upstream release and licence metadata discrepancy.
2. Capture release-specific OpenAPI/DTO and proof/status profiles.
3. Build a synthetic conformance harness outside the production application.
4. Complete independent security, privacy and legal review.
5. Revisit adoption only after all applicable gates have evidence.

No production deployment, database migration, credential issuance to real parties, private-key transfer, or statutory/regulatory claim is authorised by this document.
