# Stakeholder authentication and onboarding

RupayKG separates **identity authentication** from **platform authorization**.

## Authentication

The web application uses Firebase Authentication for account creation and sign-in. Firebase is the identity provider; RupayKG does not store stakeholder passwords. Firebase's web SDK supports email/password account creation and sign-in, and session persistence is explicitly configured for browser-session scope. The API accepts a verified Firebase ID token only long enough to exchange it for a short-lived, revocable RupayKG session.

Required web variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

Required API production variable:

- `FIREBASE_PROJECT_ID`

The backend verifies the Firebase token signature, issuer, audience, subject and time claims against Google's published Secure Token certificates. Email-based accounts must also have a verified email before a RupayKG session is issued.

## Onboarding

After authentication, a stakeholder selects a supported participant class and provides the organization/operating name. RupayKG creates:

1. an organization in `PENDING` state;
2. an organization-scoped role with no elevated permissions;
3. a `PENDING` organization membership;
4. a `PENDING` stakeholder application.

Submitting an application **does not grant operational authority**.

A verified platform authority with explicit `MANAGE_STAKEHOLDERS` permission (or the controlled platform-admin role) must approve the application. Approval atomically verifies the membership, organization and configured geography scope.

## Stakeholder classes

The onboarding list is based on the product context in the legacy AI Studio repository and reconciled against the current platform stakeholder model. It includes citizens/households, farmers, collection workers, FPO/rural participants, ULBs, generators, aggregators/transporters, processors/recyclers, carbon participants, EPR participants, ESG/CSR participants and regulators.

High-risk capabilities such as verification, credential issuance, registry transfer/retirement and settlement completion remain separate permissions and are never granted by self-registration.

## Production rule

Do not deploy until Firebase project configuration, verified-email flow, stakeholder approval, organization/geography authorization and the final CI/container gate have all been verified against the live API contract.
