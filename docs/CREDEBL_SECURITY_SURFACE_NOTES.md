# CREDEBL API Security Surface — Source Inspection Notes

**Review date:** 2026-11-04  
**Repository inspected:** credebl/platform, default branch main  
**Purpose:** identify exact source-level authorization boundaries that must be tested before adoption.  
**Limit:** static source inspection only. This is not a penetration test, full service trace, release-pinned review or proof of exploitability.

## 1. Organization-scoped management routes

The inspected OID4VC issuance controller applies all three of the following to issuer and template management routes: JWT authentication, OrgRolesGuard, and OWNER role metadata. The inspected issuer-management and template routes include issuer creation/update/read/list/delete, template create/read/update/delete, offer creation/update/read/delete and issuance-session revocation.

The inspected OID4VP verification controller applies JWT authentication, OrgRolesGuard and OWNER role metadata to verifier configuration, verifier templates, presentation initiation/retrieval and authorization-response verification routes.

This is a positive source-level control signal, but it is not sufficient evidence of tenant isolation. OrgRolesGuard implementation, JWT strategy, organization membership resolution, service-layer resource ownership checks and database query scoping must all be tested. OWNER-only may also be operationally too broad; RupayKg should not grant CREDEBL administration to routine field or reviewer users.

## 2. Webhook callback routes require a separate trust review

The inspected issuance callback route POST wh/:id/openid4vc-issuance and verification callback route POST wh/:id/openid4vc-verification have no controller-level JWT/OrgRolesGuard decorators in the inspected methods. They accept DTO bodies and a path id, then delegate to services. The issuance method normalizes a contextCorrelationId and, for the literal default value, assigns orgId from the path id. The verification method similarly normalizes contextCorrelationId and assigns a type before delegation.

This observation does **not** establish that the endpoints are publicly exploitable: a guard may exist at a global gateway, network, service-mesh, transport, or downstream service boundary. However, controller-level protection is not visible in these methods. Before adoption, trace the full ingress path and prove:
- callback sender authentication and authorization;
- cryptographic body integrity and freshness validation at the receiver;
- binding of callback ID, correlation ID, issuer/session and organization to a previously created server-side operation;
- strict DTO validation and size limits;
- nonce/event-ID replay prevention and duplicate idempotency;
- rejection of unknown, expired, cross-tenant or out-of-order callbacks;
- no tenant authority derived solely from a callback path parameter or untrusted body.

Do not assume the sender's signing behavior is enforced by the receiver. Sender-side HMAC generation is not proof of receiver-side signature verification.

## 3. Webhook microservice observations

The inspected webhook controller exposes NestJS MessagePattern handlers for register-webhook, get-webhookurl, update-webhook and post-webhook-response-to-webhook-url. These are message-transport handlers rather than ordinary HTTP controller routes. The inspected webhook service constructs an HMAC-SHA256 signature over timestamp plus serialized request payload and sends X-Signature and X-Timestamp headers.

This confirms a sender-side signing mechanism exists in the inspected code. It does not establish receiver-side verification, timestamp-window enforcement, replay protection, secret rotation, tenant binding, SSRF resistance or safe retry semantics. Those controls must be traced and tested at the actual receiving endpoint and message-broker boundary.

## 4. Required follow-up before any CREDEBL POC

1. Pin the exact release/commit and repeat this review against that immutable source.
2. Trace NestJS global guards, middleware, gateway routing, microservice transport and service-layer authorization.
3. Inspect DTO decorators, global validation-pipe configuration, body-size limits and error handling for both callback routes.
4. Trace callback receiver and sender end-to-end, including secret lookup, signature verification, timestamp tolerance, replay store, event idempotency and tenant binding.
5. Test cross-organization resource access and callback forgery/replay in an isolated synthetic environment.
6. Review SSRF controls for configured webhook destinations, redirect policy, DNS rebinding, private/link-local address blocking, TLS verification and egress allowlisting.
7. Record independent security review results before any real credentials or data are used.

## 5. Disposition

**Open security gate.** Management controllers show explicit JWT + OWNER role guards in the inspected source, while callback methods require deeper ingress/downstream tracing. No exploitability conclusion is made from static inspection alone. CREDEBL remains evaluation-only; no deployment, dependency, credential, key or production integration is authorised.
