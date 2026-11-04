# Render runtime identity audit — 4 November 2026

## Scope
Read-only inspection after the user explicitly confirmed use of Render workspace `My Workspace`.

## Verified deployment facts
- Render workspace: `tea-dakh7k142hec73aj2kr0`.
- Service: `rupaykg`, id `srv-daki4d7qj5pc73b8qksg`.
- Live deploy: `dep-dblekp0473hc73b3qsag`.
- Live commit: `934062ef8af2ca47bbcbf5e37c12de12a4f9f743`.
- Auto-deploy: enabled on commits to `main`.
- Render app log at `2026-11-04T08:19:23.898Z`: `Database migrations are current (91 files).`
- No matching `Applied` migration log entries or acceptance-seed log entries were returned for the queried startup interval. This absence is not proof that no seed code ran.
- Health checks returned 200. The source `/health` handler executes `select 1` using the configured pool, proving database reachability only.

## Neon authoritative main — read-only
- Confirmed main branch id: `br-restless-base-b44cip2h`.
- 67 public tables; 0 RLS; 0 FORCE RLS; 92 migration ledger rows; latest version `20261021`.
- The `pg_stat_activity` snapshot showed no customer application client connection at the query instant.
- The Neon connector session's `current_user/session_user=rupaykg` is the audit connector identity, not the Render runtime identity.

## Conclusion
Actual Render runtime database role and target Neon branch remain UNPROVEN. Do not infer them from health checks, connector identity, role/table ownership, service manifests or secret names.

## Next proof path
Implement a minimal gated diagnostic on a non-production candidate that logs only database name, current_user, session_user, server/branch identity and deployed commit. Never log connection strings, passwords, tokens, certificates or other secret values. Validate in disposable rehearsal and do not deploy to production without explicit release approval.

## Safety
No Render settings/secrets, deployments, Neon data, roles, grants, migrations, RLS or branches were changed. No merge, worker activation or certification occurred.
