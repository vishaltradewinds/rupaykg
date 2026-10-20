# Organization-to-Stakeholder Authorization Gate

Status: fail-closed engineering control; not official CPCB registration or statutory certification.

## Runtime rule

CPCB SWM workspace create and update operations require both:

1. `organizations.verification_status = 'VERIFIED'`, backed by the platform's organization-verification process; and
2. a matching, unexpired row in `organization_stakeholder_authorizations` with `status = 'VERIFIED'`, a reviewer identity, a verification timestamp, and an evidence reference.

The mapping is exact: an authorization for `BWG` does not authorize `PROCESSOR`, `ULB`, or any other stakeholder type. No default mapping is seeded and `organizations.organization_type` alone is not treated as sufficient evidence. Missing, pending, revoked, or expired mappings return HTTP 403 `SWM_STAKEHOLDER_AUTHORIZATION_REQUIRED` before persistence.

## Approval controls

The platform-admin API now provides a two-person workflow: `POST /api/v1/admin/stakeholder-authorization-requests` creates a pending evidence-backed request (`action` defaults to `VERIFY`; use `REVOKE` for a proposed revocation); `GET /api/v1/admin/stakeholder-authorization-requests` lists the queue and action; and `POST /api/v1/admin/stakeholder-authorization-requests/:requestId/approve` or `/reject` records the independent decision. Requester and approver must be different active Super Admin identities with `admin:users`; the target organization must remain verified; the request hash, evidence reference and SHA-256 are checked; expiry is enforced; and the decision plus mapping write and hash-linked audit event occur in one transaction.

Migration `20261027_stakeholder_authorization_dual_control.sql` adds the durable request ledger and a PostgreSQL trigger that rejects any VERIFIED mapping without a matching approved VERIFY request and distinct requester/approver. REVOKE requests require a separate approver and move the existing mapping to REVOKED in the same transaction as the approval and audit event. This protects against accidental route-level bypass. A rejected request does not create a mapping. Existing verified mappings are not automatically generated or grandfathered by this migration. This workflow records internal platform authorization only; the authority, evidence acceptance policy and operational review still require independent governance approval under Shakti Standards.

A `VERIFIED` platform mapping is an internal authorization decision only. It does not mean the organization is registered with CPCB, approved under the Solid Waste Management Rules, accredited by BEE, or eligible for carbon credit issuance. Government portal acceptance and statutory status must continue to be represented separately as user-reported-unverified unless confirmed through an authorized official integration.

## Acceptance test

The PostgreSQL-backed CPCB endpoint test proves that a workspace creation attempt with no verified organization-to-stakeholder mapping is denied with HTTP 403 and leaves no workspace row. It then seeds a synthetic verified organization and BWG mapping inside the disposable test database and proves the authorized synthetic path can proceed. This is test fixture evidence only, not a real organization's approval.

## Production release gate

Do not populate this table with real organizations or enable production workflows until the reviewer authority, independent review/dual-control process, evidence types, expiry/revocation, audit and appeals are approved under Shakti Standards. Do not claim official CPCB integration or statutory compliance from this internal gate.
