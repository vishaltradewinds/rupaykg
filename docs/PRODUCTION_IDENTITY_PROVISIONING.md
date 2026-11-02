# RupayKG production identity provisioning

This document defines the production boundary for identities, organization membership, permissions, and API sessions. It is an operational acceptance procedure, not a credential store and not evidence that production identities have already been provisioned.

## Authoritative model

RupayKG authenticates API requests against PostgreSQL-backed `identity_sessions` and then loads only `VERIFIED` `organization_memberships`. High-risk permissions are evaluated from PostgreSQL role data rather than from a client-supplied token.

The identity record's `external_subject` is the subject from the external identity provider. PostgreSQL does not store an identity-provider password.

## Required production sequence

1. Provision the real production identity in the selected identity provider.
2. Obtain the provider's stable `external_subject` for that identity.
3. Create or reconcile the corresponding `identities` row without inventing a provider subject.
4. Create the production `organizations` row and the required role definitions.
5. Assign the identity to the organization through `organization_memberships` with the intended role and `VERIFIED` status only after organizational verification has actually occurred.
6. Populate only the permissions required for that role. High-risk actions require explicit PostgreSQL permissions.
7. Create an API session through a controlled server-side provisioning process: generate a high-entropy opaque token outside the browser, store only its SHA-256 hash in `identity_sessions`, set a bounded `expires_at`, and never commit or bundle the plaintext token.
8. Verify that the session resolves to the intended identity and verified organization membership.
9. Verify authorization for the exact production geography scope before allowing production writes.
10. Revoke and replace sessions when personnel, devices, or access assignments change.

## Required negative checks

Production sign-off must fail if any of the following is observed:

- a client bundle contains `VITE_RUPAYKG_SESSION_TOKEN`;
- a production startup path accepts a development or simulated authentication mode;
- a session is accepted after `expires_at` or `revoked_at`;
- an identity without a `VERIFIED` organization membership can access authoritative workspace data;
- a high-risk action succeeds without its explicit PostgreSQL role permission;
- an identity can act outside the organization's verified geography scope;
- passwords, database credentials, bearer tokens, or private keys are committed to the repository or baked into the image.

## Browser boundary

The web application may retain an authenticated session token only in the browser session needed for the current session. The repository must not provide a default production token. Production secrets and database credentials never belong in the browser bundle.

## Acceptance evidence

Record the identity-provider subject, organization membership, role/permission assignment, session expiry/revocation test, and geography authorization test in the deployment acceptance record without recording the plaintext bearer token.

Until this sequence has been executed against the actual production identity provider and PostgreSQL environment, production identity provisioning remains **EXTERNAL ACCEPTANCE / NOT VERIFIED**.
