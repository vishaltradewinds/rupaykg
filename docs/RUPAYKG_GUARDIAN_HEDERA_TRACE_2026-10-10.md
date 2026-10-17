# RupayKG Guardian / Hedera Trace — 10 October 2026

## Repository and operating boundary

- Working repository: `C:\\Users\\Vishal\\rupaykg-live`
- Git remote: `vishaltradewinds/rupaykg`
- Base branch at recovery: `main` tracking `origin/main`
- Production health endpoint checked read-only: `https://rupaykg.onrender.com/health`
- Observed response: HTTP 200, `status=READY`, `database=AVAILABLE`, `syntheticData=false`
- This health check is not proof that Guardian policy execution, Hedera writes, or Mirror Node verification succeed.

## Existing flow traced

1. The MRV submission route binds activity, approved verification and verified evidence to the same activity.
2. It enforces verified organization membership, `guardian:operate`, and geography authorization.
3. It loads observations, evidence and the latest measurement.
4. The Guardian adapter only accepts `VERIFIED` when the provider returns an authoritative execution ID.
5. Hedera HCS receives the MRV payload and returns transaction/consensus details.
6. RupayKG persists the provenance event in PostgreSQL; the database trigger independently gates credential issuance on Guardian + HCS provenance.
7. The Mirror Node route verifies the consensus message against the persisted topic, timestamp, activity, verification, evidence, Guardian execution and integrity hash.

## Changes made in this recovery

- Fixed canonical integrity hashing so undefined optional object properties are omitted consistently with JSON serialization. This prevents a valid HCS payload from failing hash verification after JSON drops optional fields.
- Added tests for Mirror Node payload verification, mismatched activity rejection, and hash stability across JSON serialization.
- Added an MRV replay check that reuses an exact persisted Guardian/HCS anchor rather than submitting a duplicate HCS message on a sequential retry.
- Added a PostgreSQL advisory lock around the MRV submission critical section so identical concurrent requests serialize before checking/reusing a persisted anchor.
- Integrated Guardian/Hedera provenance into the actual React application instead of relying on an excluded legacy panel. The UI shows provider configuration, persisted transaction/consensus details, the registry gate, and a user-triggered Mirror Node verification action.
- Changed the SPA fallback to serve the known `index.html` path directly, avoiding a Fastify `sendFile` type error in the current build.
- Marked the database-only settlement acceptance test as skipped when `DATABASE_URL` is absent; it remains enabled when a test database is configured.

## Explicitly unverified / remaining gates

- The local environment has no Guardian endpoint or Hedera credentials/topic configured. Production environment settings were not inspected or modified in this recovery.
- The previous checkpoint recorded an invalid signature for Hedera account `0.0.10123135`. A matching, authorized operator key and topic configuration are needed; no replacement key or synthetic success should be used.
- A real Guardian execution returning `VERIFIED`, a real HCS `CONSENSUS_CONFIRMED` transaction, and successful Mirror Node verification still need to be demonstrated against the intended network.
- PostgreSQL integration tests requiring `DATABASE_URL` were not run against a dedicated test database in this session.
- Policy import/publish readiness and production edge rate limiting must be validated separately before deployment.
- The advisory lock prevents duplicate work for the same request key; an external HCS success followed by a process crash before the database commit remains a recovery scenario that must be exercised with a real test topic before production acceptance.

## Deployment decision

Do not deploy this branch to production merely because the health endpoint is green or local tests pass. Run the complete acceptance protocol with authorized Guardian and Hedera configuration, validate Mirror Node evidence, review the policy import, and confirm database-backed acceptance before promotion.

## Local verification

- `npm run build`: passed after the Guardian/Hedera route, hash and UI changes.
- `npm test`: workspace tests completed with 87 passing, 0 failing and 4 skipped. The skipped cases require database-backed or production-lifecycle acceptance configuration that was not available locally.
- `git diff --check`: passed. The working tree contains other pre-existing untracked Guardian policy candidates and temporary inspection artifacts; those are intentionally excluded from this change.
