# Organization-to-Stakeholder Authorization Gate

Status: fail-closed engineering control; not official CPCB registration or statutory certification.

## Runtime rule

CPCB SWM workspace create and update operations require both:

1. `organizations.verification_status = 'VERIFIED'`, backed by the platform's organization-verification process; and
2. a matching, unexpired row in `organization_stakeholder_authorizations` with `status = 'VERIFIED'`, a reviewer identity, a verification timestamp, and an evidence reference.

The mapping is exact: an authorization for `BWG` does not authorize `PROCESSOR`, `ULB`, or any other stakeholder type. No default mapping is seeded and `organizations.organization_type` alone is not treated as sufficient evidence. Missing, pending, revoked, or expired mappings return HTTP 403 `SWM_STAKEHOLDER_AUTHORIZATION_REQUIRED` before persistence.

## Approval controls and remaining gap

The table intentionally has no public self-service route that can mark a mapping verified. This PR does not create an approval API or infer legal organization types from names, user declarations, or organization_type strings. The authorized review workflow must be specified and implemented with appropriate independent reviewer permissions, evidence validation, audit logging, revocation, expiry, and dual-control checks before real mappings are created.

A `VERIFIED` platform mapping is an internal authorization decision only. It does not mean the organization is registered with CPCB, approved under the Solid Waste Management Rules, accredited by BEE, or eligible for carbon credit issuance. Government portal acceptance and statutory status must continue to be represented separately as user-reported-unverified unless confirmed through an authorized official integration.

## Acceptance test

The PostgreSQL-backed CPCB endpoint test proves that a workspace creation attempt with no verified organization-to-stakeholder mapping is denied with HTTP 403 and leaves no workspace row. It then seeds a synthetic verified organization and BWG mapping inside the disposable test database and proves the authorized synthetic path can proceed. This is test fixture evidence only, not a real organization's approval.

## Production release gate

Do not populate this table with real organizations or enable production workflows until the reviewer authority, independent review/dual-control process, evidence types, expiry/revocation, audit and appeals are approved under Shakti Standards. Do not claim official CPCB integration or statutory compliance from this internal gate.
