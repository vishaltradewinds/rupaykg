# Stakeholder authentication and onboarding

RupayKG separates **identity authentication** from **platform authorization**. The current implementation uses RupayKG-native, PostgreSQL-backed authentication. Firebase Authentication is not part of the current runtime contract.

## Authentication implementation

The web application calls the RupayKG API authentication endpoints. The API implements:

- Account registration at `POST /api/v1/auth/register`.
- Email-and-password sign-in at `POST /api/v1/auth/login`.
- Current-session lookup at `GET /api/v1/auth/me`.
- Session revocation at `POST /api/v1/auth/logout`.

Passwords are stored as salted scrypt hashes in `identity_password_credentials`; plaintext passwords are not stored. Successful sign-in creates an opaque, revocable, eight-hour session. PostgreSQL stores a hash of the session token; the token is returned to the client for authenticated API requests.

The frontend build validator explicitly validates native authentication configuration and does not require a third-party identity-provider configuration. The inspected web and API package manifests do not declare the Firebase SDK.

## Email verification and account recovery

New native registrations are created with identity status `PENDING` and cannot sign in until a one-time email verification token is redeemed. Tokens are stored only as SHA-256 hashes, expire after 30 minutes and are single-use. Existing identities are not bulk-modified by the migration.

The API exposes `POST /api/v1/auth/email/verify`, `POST /api/v1/auth/email/resend`, `POST /api/v1/auth/password/request-reset` and `POST /api/v1/auth/password/reset`. Password reset tokens are hashed, single-use and expire after 30 minutes. A successful password reset revokes all active sessions and clears failed-login lockout state. Reset-request responses do not disclose whether an account exists.

Email delivery uses a provider-neutral HTTPS webhook configured through server-side `RUPAYKG_EMAIL_DELIVERY_URL` and `RUPAYKG_EMAIL_DELIVERY_TOKEN`. This change does not select a mail vendor or paid plan. Until a trusted delivery endpoint is configured and tested, verification and recovery messages cannot be delivered; new accounts remain pending and cannot sign in. Never put these values in frontend environment variables.

## Onboarding and authorization

After authentication, a stakeholder selects a supported participant class and submits organization and operating details. RupayKg creates:

1. an organization in `PENDING` state;
2. an organization-scoped role with no elevated permissions;
3. a `PENDING` organization membership;
4. a `PENDING` stakeholder application.

Submitting an application **does not grant operational authority**. Organization membership and operational access remain subject to the platform's verification and authorization controls. High-risk capabilities such as evidence verification, credential issuance, registry transfer/retirement and settlement completion remain separately permissioned and are not granted by self-registration.

## Stakeholder classes

The current onboarding API includes citizens/households, farmers, collection workers, FPO/rural participants, ULBs, municipal and other generators, aggregators/transporters, processors/recyclers, carbon participants, EPR participants, ESG/CSR participants and regulators.

## Deployment configuration

The current native authentication implementation does not require Firebase environment variables. The stale Firebase entries have been removed from the Render blueprint and the web environment example. Do not add Firebase configuration unless a separately reviewed migration to Firebase is implemented and tested.

## Production acceptance gate

Before treating authentication as production-ready, verify at minimum:

- email ownership verification or an approved alternative identity-proofing control;
- password reset and account-recovery workflow;
- rate limiting and abuse controls for registration and login;
- session expiry, revocation and secure client-side token handling;
- tenant isolation and organization/geography authorization;
- automated authentication tests and the final CI/container gate.

A successful password login alone does not establish verified email ownership or stakeholder authorization.
