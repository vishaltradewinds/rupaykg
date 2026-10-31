# Render live service preflight — 2026-10-31 17:28 UTC

## Scope
Read-only inspection of the user-authorized Render workspace. No environment variables were changed, no deploy was triggered, no database query/write was executed, and no service settings were modified.

## Workspace and actual service — VERIFIED
- Render workspace: `My Workspace`, ID `tea-dakh7k142hec73aj2kr0`.
- Live RupayKg service: `rupaykg`, ID `srv-daki4d7qj5pc73b8qksg`.
- Type: web service; runtime Docker; Dockerfile `./Dockerfile`; Docker context `.`.
- Plan: Free; region: Singapore; one configured instance.
- Public URL: `https://rupaykg.onrender.com`; health check path `/health`.
- Repository: `https://github.com/vishaltradewinds/rupaykg`; tracked branch `main`; auto-deploy on commit enabled.
- Service is not suspended; maintenance mode disabled; public IP allow list `0.0.0.0/0`.
- No Render-hosted Postgres instances or Key Value resources exist in this workspace.

## Exact live deploy — VERIFIED
- Current live deploy ID: `dep-dbj1r07avr4c73bjc2c0`.
- Commit: `b5e91241d84a6712ff544d3deec1805702f45efd`.
- Commit message: `docs(checkpoint): record passing BWG authorised report write acceptance`.
- Deploy started 2026-10-31 16:55:28 UTC and completed successfully 16:56:30 UTC; status `live`.
- GitHub `main` HEAD independently resolves to the same exact commit SHA.
- This is a documentation checkpoint commit on main, not the current Shakti feature branch.
- Current engineering branch remains separate: `shakti/atomic-inbox-claim-2026-10-31`. Its tests and documentation have not been deployed to the live service.
- Do not deploy the feature branch as a shortcut. First finish review, merge policy, security gates and release evidence.

## Runtime observations — VERIFIED, LIMITED
- Render event history records successful build and deploy for the exact live commit; no rollback trigger.
- Application log at 2026-10-31 16:56:12 UTC states: `Database migrations are current (91 files).`
- The live commit's repository tree contains exactly 91 SQL migration files. This matches the runtime log's file count.
- Subsequent log records include repeated `GET /health` responses with HTTP 200. Filtered error/fatal logs in the inspected time window returned no records.
- Metrics query returned low CPU and memory observations, but no instance-count or HTTP-request series; do not infer capacity or request traffic from empty series.
- Application logs include a PostgreSQL client SSL-mode compatibility warning for a future major version. It is informational, not evidence of a current connection failure; track dependency hardening separately.

## Database authority and runtime identity — PARTIALLY VERIFIED / NOT PROVEN
- No Render-hosted Postgres database is present. Prior read-only Neon catalog inspection identifies the sole authoritative production database as Neon project `rupaykg-production-fresh` (`steep-mud-79906940`), primary branch `main` (`br-restless-base-b44cip2h`), database `rupaykg`.
- Render's service metadata and deploy metadata do not expose environment-variable values or the live process's resolved database hostname/database name/database role.
- The startup log proves the deployed application completed its 91-file migration-current check against some configured PostgreSQL target, but it does NOT by itself prove the target is the authoritative Neon project or identify the database principal.
- Therefore live Render → Neon target binding and the actual application runtime DB role remain NOT VERIFIED. Do not claim that the runtime identity is known.
- Do not dump secrets or print connection strings. Complete this gate using a redacted, in-process diagnostic that reports only provider/host fingerprint, database name, current_user, current_database(), TLS state and safe privilege flags, with credentials and full URLs never logged. The diagnostic must be restricted to an authenticated operator or a controlled one-time run, then removed/disabled.

## Security and operating posture
- Live service is public on `0.0.0.0/0`; application authentication/authorization must carry the security boundary.
- Existing Neon production findings remain: 67 public base tables, zero RLS-enabled tables, zero public RLS policies; inspected roles `rupaykg` and `neon_service` have BYPASSRLS and role-creation privileges; `cloud_admin` is SUPERUSER/BYPASSRLS. Actual runtime role remains unknown.
- Neon primary-branch protection disabled. GitHub main protection was not assessed (403). Working branch is unprotected.
- Production remains HOLD for any new schema/security deployment. Worker OFF; scheduler OFF; certification OFF; TRL 9 NOT ESTABLISHED.

## Next steps
1. Build a safe, temporary, authenticated runtime DB identity diagnostic without returning credentials or raw connection strings; verify actual host/project fingerprint, database, role and role flags.
2. Compare the 91-file runtime migration set to the authoritative Neon migration ledger and exact live schema; explain the 92-row/91-file ledger difference before any migration.
3. Review the PostgreSQL client SSL-mode warning and pin explicit secure TLS semantics before the next major pg/pg-connection-string upgrade; test against the actual Neon endpoint.
4. Complete tenant isolation/RLS and least-privilege role design on disposable production-derived branches; never grant production runtime broad privileges.
5. Keep production service on main; do not deploy the Shakti feature branch or change environment variables until exact target, migration parity, security and release gates are independently reviewed.
