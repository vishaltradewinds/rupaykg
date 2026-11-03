# Stakeholder authentication and onboarding

## Authoritative authentication architecture

The current application uses **native RupayKG authentication backed by PostgreSQL**. Firebase Authentication is not part of the current runtime authentication path.

- Registration and sign-in routes are implemented in `apps/src/auth-routes.ts`.
- Passwords are hashed server-side using Node.js `scrypt`; plaintext passwords must never be stored.
- Successful authentication issues an opaque, short-lived session token. The database stores its SHA-256 token hash in `identity_sessions`, not the raw token.
- API authentication checks the bearer token against an unrevoked, unexpired session and a verified, non-suspended identity.
- Organization memberships and role permissions are checked server-side. Registration alone must not grant operational authority.
- Multi-organization identities must explicitly select an authorized organization for scoped operations.
- High-risk capabilities such as verification, credential issuance, registry transfer/retirement and settlement require separate permissions.

## Required production configuration

Production startup is validated by `apps/src/production-config.ts` and `apps/src/production-server.ts`.

Required values include:
- `NODE_ENV=production`
- `DATABASE_URL` pointing to the managed PostgreSQL instance
- `DATABASE_SSL=require` for the managed external database connection
- `RUPAYKG_AUTH_MODE=real`
- `RUPAYKG_ALLOWED_ORIGINS` containing HTTPS origins only
- `RUPAYKG_SYNTHETIC_DATA=false`

Database TLS trust material must meet the production configuration contract. Never put credentials or live tokens in source control, client bundles, examples, or logs.

No `VITE_FIREBASE_*` or `FIREBASE_PROJECT_ID` variables are required for the current native authentication design. Do not reintroduce them unless the authentication architecture is deliberately changed, reviewed, tested and documented.

## Onboarding and authorization

Registration does not automatically grant a verified organization membership or elevated permissions. Stakeholder identity, organization, membership, geography scope and role permissions must be verified through the controlled onboarding and approval workflow.

The supported stakeholder types are defined in `apps/src/auth-routes.ts`. Treat that code as the current application list; update this document when the list changes.

## Fail-closed release rule

Do not represent authentication as production-ready solely because unit tests pass or the health endpoint returns HTTP 200. Release validation must include registration/sign-in, session expiry/revocation, authorization boundaries, organization isolation, production configuration and representative stakeholder workflows.