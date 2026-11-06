# CTO execution checkpoint — 4 November 2026

## Batch
Remove implicit production database mutation from the long-lived web-service startup path.

## Evidence
- Audited main head: `934062ef8af2ca47bbcbf5e37c12de12a4f9f743`.
- Live Render service `rupaykg`: `srv-daki4d7qj5pc73b8qksg`; latest deploy `dep-dblekp0473hc73b3qsag`, status LIVE, commit `934062ef8af2ca47bbcbf5e37c12de12a4f9f743`.
- Main Dockerfile executed `node apps/dist/src/migrate.js && node apps/dist/src/acceptance-seed.js && node apps/dist/src/production-server.js`.
- `apps/src/migrate.ts` reads `DATABASE_URL`, creates/updates `schema_migrations`, and applies unrecorded numbered SQL files at startup.
- `apps/src/acceptance-seed.ts` is gated, but does not belong in the ordinary web-service command.
- `package.json` already defines `start` as `node apps/dist/src/production-server.js`.

## Change
The candidate Dockerfile now starts only `node apps/dist/src/production-server.js`. Migration and acceptance-seed scripts remain in the image/source but are no longer invoked by the web service startup command.

## Safety
- Change is isolated on branch `shakti/2026-11-04-disable-implicit-production-migrations`.
- No merge, Render change, deployment, production SQL, migration, role/grant/RLS change, secret access, Neon branch operation, worker activation or certification was performed.
- The candidate is not deployable until a separately invoked migration workflow, distinct migrator credential, migration-source/checksum gate, backup/rollback and independent review are complete.
- Exact-head CI is pending PR creation.

## Next
Run CI, review exact-head results, then continue combined verification-stack convergence and migration/runtime separation. Keep production READ-ONLY / HOLD.
