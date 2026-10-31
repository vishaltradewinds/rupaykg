# 2026-10-31 17:06 UTC — BWG positive report-write acceptance

- Previous implementation SHA `7b38efb31e5a65606368687ac1dd669dd3c1ab00`, CI #3999 / run `41221567187`: SUCCESS on exact SHA. It verifies authenticated denial and no-write behavior for waste, EPR and ESG report routes.
- New implementation SHA `b9ee2a9b9a796032026e40980dbac27d52248992` adds positive authenticated write paths on disposable PostgreSQL:
  - `waste:record` can create a waste report, which remains `PENDING` without verified evidence.
  - `epr:manage` can create an EPR report only against a verified EPR scheme; the response remains `externalSubmission: NOT_SUBMITTED` and report status `PENDING`.
  - `esg:write` is explicitly recognized by the database `can_write_esg` function and can create an ESG report, which remains `PENDING` without verified evidence.
- Each positive fixture has a real verified membership, an `APPLICABLE` + `VERIFIED` BWG profile, and a reporting period accepted by the real database trigger. Randomized scheme code prevents collisions. Cleanup removes report rows, periods, scheme, profiles, memberships, sessions, organizations, identities and geography.
- CI #4004 / run `41221825225` is in progress for the exact new SHA. No green claim until it completes.
- No production database changes or deployment. These tests do not assert that a pending record is independently verified, regulator-submitted, accepted or eligible for carbon value.
